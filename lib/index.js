// dsh-gitlab-tools — host half.
// Registers GitLab agent tools backed by a spec-generated SDK
// (lib/generated/gitlabApi.mjs, generated from GitLab's OpenAPI spec so the
// client is version-aligned with the instance instead of a lagging hand-rolled
// wrapper). Auth is configured directly via plugin Config (host + token) — no
// `glab` CLI / keyring dependency; every API call goes through the SDK directly.
//
// Tool set (渐进式：核心 + 全量):
//   - curated ergonomic tools (project/issue/MR/pipeline CRUD + comments)
//   - gitlab_api generic raw tool covering ALL spec operations
//
// UI half (右侧悬浮 issue 面板):
//   - settings namespace `gitlabTools` (defaultProject / refreshMs), read live
//     via scope.get() — host+token stay in the static plugin config and are
//     NEVER sent to the browser.
//   - GET  /gitlab-tools/status    → { ok, configured } (no secrets echoed)
//   - GET  /gitlab-tools/settings  → effective UI config (defaultProject/refreshMs)
//   - POST /gitlab-tools/settings  → persist a whitelisted config patch
//   - GET  /gitlab-tools/issues    → sanitized open-issue list for a project
//   - GET  /gitlab-tools/projects  → project picker list for the settings page
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createClient, projectPathArg } from "./sdk.js";
import { credentialRef } from "@deepseek-ai/dsh-credentials";

export const name = "gitlab-tools";
export const inject = ["tools", "webServer", "settings", "credentials"];

/** Settings namespace for the browser UI (hot-reloaded; never holds secrets). */
const UI_NS = "gitlabTools";

// token 存官方凭据存储（ctx.credentials → ~/.dsh/.credentials.yaml），不入 settings。
const TOKEN_REF = "gitlabToolsToken";
const AITOKEN_REF = "gitlabToolsAiToken";

/** HTTP helpers (same pattern as dsh-config-sync). */
function sendJson(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolvePromise) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        resolvePromise(text ? JSON.parse(text) : {});
      } catch {
        resolvePromise({ _parseError: true });
      }
    });
    req.on("error", () => resolvePromise({ _parseError: true }));
  });
}

export const Config = z.object({
  // Full GitLab base URL, e.g. "https://gitlab.example.com:8443". Required (no glab auto-detect anymore).
  host: z.string().default(""),
  // GitLab personal access token. Required (no glab keyring fallback anymore).
  token: z.string().default(""),
  // Default project (path_with_namespace like "group/project", or numeric id) when a tool omits `project`.
  defaultProject: z.string().default(""),
  // Result cap for list endpoints (maps to per_page).
  perPage: z.number().min(1).max(100).default(20),
  // Per-tool cooperative timeout budget (ms).
  timeoutMs: z.number().min(1000).default(60000)
});

/** Shared output: readable text + raw json payload. */
const TEXT_OUTPUT = {
  schema: {
    type: "object",
    additionalProperties: true,
    properties: {
      text: { type: "string", required: true },
      json: { type: "json" }
    }
  },
  render: (_args, value) => [{ type: "text", text: value.text }]
};

function res(text, json) {
  return { text, json };
}

function fmtList(title, items, fmt) {
  if (!Array.isArray(items) || items.length === 0) return `${title}: (none)`;
  return `${title}: ${items.length} item(s)\n` + items.map(fmt).join("\n");
}

function fmtProject(p) {
  const desc = p.description ? ` — ${String(p.description).slice(0, 60)}` : "";
  return `#${p.id} ${p.path_with_namespace}${desc} [${p.visibility ?? "?"}]`;
}

function fmtIssue(i) {
  const assignee = i.assignees?.length ? ` @${i.assignees.map((a) => a.username).join(",")}` : "";
  const labels = i.labels?.length ? ` [${i.labels.join(",")}]` : "";
  return `#${i.iid} ${i.state} ${i.title}${labels}${assignee} — ${i.web_url ?? ""}`;
}

function fmtMr(m) {
  const labels = m.labels?.length ? ` [${m.labels.join(",")}]` : "";
  return `!${m.iid} ${m.state} ${m.title}${labels} (${m.source_branch ?? "?"} → ${m.target_branch ?? "?"}) — ${m.web_url ?? ""}`;
}

function fmtPipeline(p) {
  return `#${p.id} ${p.ref ?? "?"} ${p.status ?? "?"} sha=${p.sha ? String(p.sha).slice(0, 8) : "?"} — ${p.web_url ?? ""}`;
}

function fmtUser(u) {
  return `@${u.username} ${u.name} (id ${u.id}) ${u.web_url ?? ""}`;
}

function fmtNote(n) {
  const author = n.author ? `@${n.author.username}` : "系统";
  const when = n.created_at ? ` ${n.created_at}` : "";
  const kind = n.system ? " [system]" : "";
  return `${author}${when}${kind}:\n${n.body ?? ""}`;
}

/** Sanitized issue shape for the browser panel (no token, minimal fields). */
function issueBrief(i) {
  return {
    iid: i.iid,
    title: i.title,
    state: i.state,
    web_url: i.web_url,
    created_at: i.created_at,
    updated_at: i.updated_at,
    labels: Array.isArray(i.labels) ? i.labels : [],
    assignees: (Array.isArray(i.assignees) ? i.assignees : []).map((a) => ({
      username: a.username,
      name: a.name
    })),
    author: i.author ? { username: i.author.username, name: i.author.name } : null,
    milestone: i.milestone ? { title: i.milestone.title } : null,
    confidential: Boolean(i.confidential)
  };
}

/** Sanitized full issue shape for the inline detail view (adds description). */
function issueDetailBrief(i) {
  return {
    iid: i.iid,
    title: i.title,
    state: i.state,
    web_url: i.web_url,
    description: i.description ?? "",
    created_at: i.created_at,
    updated_at: i.updated_at,
    labels: Array.isArray(i.labels) ? i.labels : [],
    assignees: (Array.isArray(i.assignees) ? i.assignees : []).map((a) => ({
      username: a.username,
      name: a.name
    })),
    author: i.author ? { username: i.author.username, name: i.author.name } : null,
    milestone: i.milestone ? { title: i.milestone.title } : null,
    confidential: Boolean(i.confidential)
  };
}

/** Sanitized note shape for the discussion thread (no token, minimal fields). */
function noteBrief(n) {
  return {
    id: n.id,
    body: n.body ?? "",
    system: Boolean(n.system),
    created_at: n.created_at,
    author: n.author ? { username: n.author.username, name: n.author.name } : null
  };
}

function projectBrief(p) {
  return {
    id: p.id,
    path_with_namespace: p.path_with_namespace,
    name: p.name,
    visibility: p.visibility ?? "?"
  };
}

export async function apply(ctx, config) {
  const cfg = {
    host: config.host ?? "",
    token: config.token ?? "",
    // DeepSeek Harness 专属身份：agent 工具（含 gitlab_create_note）用它发布评论，
    // 与用户身份（主 token）区分开。可选，未配置则回落主 token。
    aiToken: config.aiToken ?? "",
    defaultProject: config.defaultProject ?? "",
    perPage: config.perPage ?? 20,
    timeoutMs: config.timeoutMs ?? 60000
  };

  const project = (p) => p ?? cfg.defaultProject ?? "";

  const reg = (tool) => ctx.tools.register(tool);

  // ── generic full-coverage tool ────────────────────────────────────────────
  reg(defineTool({
    name: "gitlab_api",
    description: `Call ANY GitLab REST API v4 endpoint through the spec-generated SDK (version-aligned with this instance). Covers everything the curated gitlab_* tools don't. \`path\` is relative to /api/v4 (e.g. "projects/16/repository/branches", "groups"). For project paths use the encoded form "group%2Fproject" or numeric id. \`query\`/body are plain JSON objects.`,
    parameters: {
      path: { type: "string", required: true, description: "API v4 path without the /api/v4 prefix, e.g. 'projects/16/repository/branches' or 'projects/group%2Fproj/issues?state=opened'. Slashes in a project path must be %2F." },
      method: { type: "string", description: "HTTP method: GET (default), POST, PUT, DELETE." },
      query: { type: "object", additionalProperties: true, description: "Query parameters as a JSON object." },
      body: { type: "object", additionalProperties: true, description: "Request body as a JSON object (for POST/PUT)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args, exec) {
      const client = await getClient();
      const path = args.path.startsWith("/api/v4") ? args.path : `/api/v4/${args.path}`;
      const r = await client.raw({ path, method: (args.method ?? "GET").toUpperCase(), query: args.query, body: args.body });
      const json = r.data ?? null;
      return res(json === null ? String(r.error ?? "") : JSON.stringify(json, null, 2), json);
    }
  }));

  // ── curated tools ─────────────────────────────────────────────────────────
  reg(defineTool({
    name: "gitlab_current_user",
    description: "Return the current authenticated GitLab user (username, name, id, web URL).",
    parameters: {},
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute() {
      const client = await getClient();
      const r = await client.raw({ path: "/api/v4/user", method: "GET" });
      const u = r.data ?? null;
      return res(u ? fmtUser(u) : String(r.error ?? ""), u);
    }
  }));

  reg(defineTool({
    name: "gitlab_list_projects",
    description: "List GitLab projects visible to the authenticated user (optionally filtered by membership/search). Use to discover the repo path to pass to other tools.",
    parameters: {
      search: { type: "string", description: "Search projects by name or path." },
      membership: { type: "boolean", description: "Only projects the user is a member of (default true)." },
      orderBy: { type: "string", description: "last_activity_at (default), name, path, created_at, updated_at." },
      perPage: { type: "number", description: "Max results (default from plugin config)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const r = await client.api.getApiV4Projects({
        membership: args.membership !== false,
        order_by: args.orderBy ?? "last_activity_at",
        per_page: args.perPage ?? cfg.perPage,
        ...(args.search ? { search: args.search } : {})
      });
      const list = r.data ?? [];
      return res(fmtList("Projects", list, fmtProject), list);
    }
  }));

  reg(defineTool({
    name: "gitlab_list_issues",
    description: "List issues in a project. Use to see open/closed/all issues, filter by assignee/labels/search.",
    parameters: {
      project: { type: "string", description: "Project path (group/project) or numeric id; defaults to plugin config." },
      state: { type: "string", description: "opened (default), closed, all." },
      labels: { type: "string", description: "Comma-separated labels to filter by." },
      search: { type: "string", description: "Full-text search in title/description." },
      perPage: { type: "number", description: "Max results (default from plugin config)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdIssues(proj, {
        state: args.state ?? "opened",
        per_page: args.perPage ?? cfg.perPage,
        ...(args.labels ? { labels: args.labels } : {}),
        ...(args.search ? { search: args.search } : {})
      });
      const list = r.data ?? [];
      return res(fmtList("Issues", list, fmtIssue), list);
    }
  }));

  reg(defineTool({
    name: "gitlab_view_issue",
    description: "View one issue in full detail (title, description, assignees, labels, comments link).",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      iid: { type: "number", required: true, description: "Issue IID (the #N in the issue URL)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdIssuesIssueIid(proj, Number(args.iid), {});
      const i = r.data ?? null;
      if (!i) return res(String(r.error ?? "issue not found"), null);
      const labels = i.labels?.length ? ` [${i.labels.join(",")}]` : "";
      const body = i.description ? `\n${i.description}` : "";
      return res(`#${i.iid} ${i.state} ${i.title}${labels}\n${i.web_url ?? ""}\nassignees: ${i.assignees?.map((a) => `@${a.username}`).join(", ") || "none"}${body}`, i);
    }
  }));

  reg(defineTool({
    name: "gitlab_create_issue",
    description: "Create an issue in a project.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      title: { type: "string", required: true, description: "Issue title." },
      description: { type: "string", description: "Issue description (Markdown)." },
      labels: { type: "string", description: "Comma-separated labels." },
      assigneeIds: { type: "string", description: "Comma-separated user IDs to assign." },
      confidential: { type: "boolean", description: "Mark as confidential." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const body = { title: args.title };
      if (args.description) body.description = args.description;
      if (args.labels) body.labels = args.labels.split(",").map((s) => s.trim()).filter(Boolean);
      if (args.assigneeIds) body.assignee_ids = args.assigneeIds.split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
      if (args.confidential) body.confidential = true;
      const r = await client.api.postApiV4ProjectsIdIssues(proj, body, {});
      const i = r.data ?? null;
      return res(i ? `created ${fmtIssue(i)}` : String(r.error ?? ""), i);
    }
  }));

  reg(defineTool({
    name: "gitlab_list_mrs",
    description: "List merge requests in a project.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      state: { type: "string", description: "opened (default), closed, merged, all." },
      search: { type: "string", description: "Full-text search." },
      perPage: { type: "number", description: "Max results (default from plugin config)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdMergeRequests(proj, {
        state: args.state ?? "opened",
        per_page: args.perPage ?? cfg.perPage,
        ...(args.search ? { search: args.search } : {})
      });
      const list = r.data ?? [];
      return res(fmtList("Merge requests", list, fmtMr), list);
    }
  }));

  reg(defineTool({
    name: "gitlab_view_mr",
    description: "View one merge request in full detail (title, description, branches, author, state).",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      iid: { type: "number", required: true, description: "MR IID (the !N in the MR URL)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdMergeRequestsMergeRequestIid(proj, Number(args.iid), {}, {});
      const m = r.data ?? null;
      if (!m) return res(String(r.error ?? "MR not found"), null);
      const labels = m.labels?.length ? ` [${m.labels.join(",")}]` : "";
      const body = m.description ? `\n${m.description}` : "";
      return res(`!${m.iid} ${m.state} ${m.title}${labels}\n${m.source_branch ?? "?"} → ${m.target_branch ?? "?"} by @${m.author?.username ?? "?"}\n${m.web_url ?? ""}${body}`, m);
    }
  }));

  reg(defineTool({
    name: "gitlab_create_mr",
    description: "Create a merge request from a source branch to a target branch.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      sourceBranch: { type: "string", required: true, description: "Source branch (must already exist in the repo)." },
      targetBranch: { type: "string", required: true, description: "Target branch (e.g. main/master)." },
      title: { type: "string", required: true, description: "MR title." },
      description: { type: "string", description: "MR description (Markdown)." },
      removeSourceBranch: { type: "boolean", description: "Delete source branch on merge." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const body = {
        source_branch: args.sourceBranch,
        target_branch: args.targetBranch,
        title: args.title
      };
      if (args.description) body.description = args.description;
      if (args.removeSourceBranch) body.remove_source_branch = true;
      const r = await client.api.postApiV4ProjectsIdMergeRequests(proj, body, {});
      const m = r.data ?? null;
      return res(m ? `created ${fmtMr(m)}` : String(r.error ?? ""), m);
    }
  }));

  reg(defineTool({
    name: "gitlab_merge_mr",
    description: "Merge an open merge request.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      iid: { type: "number", required: true, description: "MR IID (the !N in the MR URL)." },
      squash: { type: "boolean", description: "Squash commits on merge." },
      removeSourceBranch: { type: "boolean", description: "Delete source branch after merge." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const body = {};
      if (args.squash) body.squash = true;
      if (args.removeSourceBranch) body.should_remove_source_branch = true;
      const r = await client.api.putApiV4ProjectsIdMergeRequestsMergeRequestIidMerge(proj, Number(args.iid), body, {});
      const m = r.data ?? null;
      return res(m ? `merged ${fmtMr(m)}` : String(r.error ?? ""), m);
    }
  }));

  reg(defineTool({
    name: "gitlab_list_pipelines",
    description: "List CI/CD pipelines in a project (newest first).",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      ref: { type: "string", description: "Branch/tag to filter by." },
      perPage: { type: "number", description: "Max results (default from plugin config)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdPipelines(proj, {
        per_page: args.perPage ?? cfg.perPage,
        ...(args.ref ? { ref: args.ref } : {})
      });
      const list = r.data ?? [];
      return res(fmtList("Pipelines", list, fmtPipeline), list);
    }
  }));

  reg(defineTool({
    name: "gitlab_latest_pipeline",
    description: "Get the latest CI/CD pipeline for a branch/ref (or any ref).",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      ref: { type: "string", description: "Branch/tag; omit for the most recent pipeline overall." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.api.getApiV4ProjectsIdPipelines(proj, {
        per_page: 1,
        ...(args.ref ? { ref: args.ref } : {})
      });
      const list = r.data ?? [];
      const p = list[0] ?? null;
      return res(p ? `Latest: ${fmtPipeline(p)}` : "No pipelines found.", p);
    }
  }));

  reg(defineTool({
    name: "gitlab_create_note",
    description: "Add a comment (note) to an issue.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      iid: { type: "number", required: true, description: "Issue IID." },
      body: { type: "string", required: true, description: "Comment text (Markdown)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.raw({
        path: `/api/v4/projects/${proj}/issues/${Number(args.iid)}/notes`,
        method: "POST",
        body: { body: args.body }
      });
      const n = r.data ?? null;
      return res(n ? `note #${n.id} added` : String(r.error ?? ""), n);
    }
  }));

  reg(defineTool({
    name: "gitlab_list_notes",
    description: "Read the full discussion (all comments/notes) of an issue, oldest first. Use this to load the user's replies and prior context into the development flow — always read the whole thread before planning or continuing work on an issue.",
    parameters: {
      project: { type: "string", description: "Project path or numeric id; defaults to plugin config." },
      iid: { type: "number", required: true, description: "Issue IID." },
      perPage: { type: "number", description: "Max comments to fetch (default from plugin config)." }
    },
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute(args) {
      const client = await getClient();
      const proj = projectPathArg(project(args.project));
      const r = await client.raw({
        path: `/api/v4/projects/${proj}/issues/${Number(args.iid)}/notes`,
        method: "GET",
        query: { per_page: args.perPage ?? cfg.perPage, sort: "asc", order_by: "created_at" }
      });
      const list = r.data ?? null;
      if (!Array.isArray(list)) {
        return res("notes: (error) " + String(r.error ?? ""), list);
      }
      const lines = list.map(fmtNote);
      const head = `Issue #${args.iid} 讨论（${list.length} 条）:`;
      return res(lines.length ? head + "\n\n" + lines.join("\n\n") : `${head} (no comments)`, list);
    }
  }));

  // ── UI-facing settings namespace (browser panel config; no secrets) ──────
  const UiConfig = z.object({
    // Which project (path_with_namespace or numeric id) the right-side panel shows.
    defaultProject: z.string().default(""),
    // 服务器地址（GitLab base URL，含端口，如 https://gitlab.example.com:8443）。
    // 设置页可改；留空则回落到 profile patch config 的 host。
    host: z.string().default(""),
    // Panel auto-refresh interval (ms).
    refreshMs: z.number().min(5000).max(3600000).default(120000)
  });
  const uiBase = { defaultProject: cfg.defaultProject ?? "", host: cfg.host ?? "", refreshMs: 120000 };

  let scope = null;
  ctx.effect(() => {
    scope = ctx.settings.register(UI_NS, UiConfig, { base: uiBase });
    const unwatch = scope.watch(() => {
      // No cache to drop — UI config is read live per request. The watcher keeps
      // the user layer (settings.yaml / GUI edits) applied without a restart.
    });
    return () => {
      unwatch();
      scope = null;
    };
  }, "gitlab-tools: settings namespace");

  const uiConfig = () => {
    if (!scope) return { ...uiBase };
    const s = scope.get();
    return {
      defaultProject: s.defaultProject ?? "",
      host: s.host ?? "",
      refreshMs: s.refreshMs ?? 120000
    };
  };

  // token 读取：优先官方凭据存储（ctx.credentials），未设置则回落配置 cfg.token。
  const getToken = async () => {
    if (ctx.credentials) {
      try {
        const r = await ctx.credentials.resolve(credentialRef(TOKEN_REF));
        if (r?.value) return r.value;
      } catch (e) {
        (ctx.logger?.warn || console.warn)(`[gitlab-tools] 读取凭据失败：${e?.message ?? e}`);
      }
    }
    return cfg.token || "";
  };

  // AI 专属 token（DeepSeek Harness 身份）：同一套凭据存取，独立 REF。
  const getAiToken = async () => {
    if (ctx.credentials) {
      try {
        const r = await ctx.credentials.resolve(credentialRef(AITOKEN_REF));
        if (r?.value) return r.value;
      } catch (e) {
        (ctx.logger?.warn || console.warn)(`[gitlab-tools] 读取 AI 凭据失败：${e?.message ?? e}`);
      }
    }
    return cfg.aiToken || "";
  };

  // 客户端按「有效 host/token」构建，并按 host|token 记忆化：改任一都会重建。
  let clientCache = new Map();
  const makeClient = async (token) => {
    const u = uiConfig();
    const host = (u.host || cfg.host).trim();
    const t = token.trim();
    const key = `${host}|${t}`;
    if (!clientCache.has(key)) {
      clientCache.set(key, createClient({ host, token: t }));
    }
    return clientCache.get(key);
  };

  // agent 工具（gitlab_*，含评论）：优先 AI 专属 token（Harness 身份），未配置回落主 token。
  const getClient = async () => {
    const ai = await getAiToken();
    return makeClient(ai.trim() ? ai : await getToken());
  };

  // 浏览器 UI 路由：始终用主 token（用户身份），用户评论/浏览与 AI 身份区分开。
  const getUIClient = async () => makeClient(await getToken());

  // ── HTTP routes (browser panel ↔ host proxy; token stays server-side) ────
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/gitlab-tools",
    handler: async (req, res) => {
      const url = new URL(req.url ?? "/", "http://gitlab-tools");
      const pathname = url.pathname;
      const isGet = req.method === "GET" || req.method === "HEAD";

      if (pathname === "/gitlab-tools/status" && isGet) {
        const u = uiConfig();
        const token = await getToken();
        const configured = Boolean((u.host || cfg.host).trim() && token.trim());
        return sendJson(res, 200, { ok: true, configured });
      }

      if (pathname === "/gitlab-tools/settings" && isGet) {
        const u = uiConfig();
        const token = await getToken();
        const aiToken = await getAiToken();
        // token 只写不回显：不回传明文，只回 tokenConfigured / aiTokenConfigured（供 UI 显示占位）。
        return sendJson(res, 200, {
          ok: true,
          defaultProject: u.defaultProject,
          host: u.host,
          refreshMs: u.refreshMs,
          tokenConfigured: Boolean(token.trim()),
          aiTokenConfigured: Boolean(aiToken.trim())
        });
      }

      if (pathname === "/gitlab-tools/settings" && req.method === "POST") {
        if (!scope) return sendJson(res, 503, { ok: false, code: "unavailable", message: "settings 服务不可用" });
        const body = await readBody(req);
        if (body._parseError) {
          return sendJson(res, 400, { ok: false, code: "parse", message: "请求体不是合法 JSON" });
        }
        // token 走官方凭据存储（ctx.credentials → ~/.dsh/.credentials.yaml），
        // 不进 settings 命名空间；空串=清除（回落 cfg.token）。
        if ("token" in body) {
          if (typeof body.token !== "string") {
            return sendJson(res, 400, { ok: false, code: "config", message: "token 必须是字符串" });
          }
          if (!ctx.credentials) {
            return sendJson(res, 503, { ok: false, code: "credentials", message: "credentials 服务未启用" });
          }
          try {
            if (body.token === "") {
              await ctx.credentials.unset(credentialRef(TOKEN_REF));
            } else {
              await ctx.credentials.set(credentialRef(TOKEN_REF), body.token);
            }
          } catch (error) {
            return sendJson(res, 400, { ok: false, code: "config", message: `token 保存失败：${error?.message ?? error}` });
          }
        }
        // AI 专属 token（DeepSeek Harness 身份）：同样进凭据存储，空串=清除。
        if ("aiToken" in body) {
          if (typeof body.aiToken !== "string") {
            return sendJson(res, 400, { ok: false, code: "config", message: "aiToken 必须是字符串" });
          }
          if (!ctx.credentials) {
            return sendJson(res, 503, { ok: false, code: "credentials", message: "credentials 服务未启用" });
          }
          try {
            if (body.aiToken === "") {
              await ctx.credentials.unset(credentialRef(AITOKEN_REF));
            } else {
              await ctx.credentials.set(credentialRef(AITOKEN_REF), body.aiToken);
            }
          } catch (error) {
            return sendJson(res, 400, { ok: false, code: "config", message: `AI token 保存失败：${error?.message ?? error}` });
          }
        }
        // Whitelist keys only (no SSRF / arbitrary field writes).
        const patch = {};
        for (const key of ["defaultProject", "host", "refreshMs"]) {
          if (key in body) patch[key] = body[key];
        }
        if ("defaultProject" in patch && typeof patch.defaultProject !== "string") {
          return sendJson(res, 400, { ok: false, code: "config", message: "defaultProject 必须是字符串" });
        }
        if ("host" in patch && typeof patch.host !== "string") {
          return sendJson(res, 400, { ok: false, code: "config", message: "host 必须是字符串" });
        }
        if ("refreshMs" in patch && (!Number.isFinite(patch.refreshMs) || patch.refreshMs < 5000 || patch.refreshMs > 3600000)) {
          return sendJson(res, 400, { ok: false, code: "config", message: "refreshMs 需在 5000–3600000 之间" });
        }
        if (Object.keys(patch).length === 0) {
          // 仅 token 写入（或纯 noop）也返回当前配置，前端据此刷新。
          return sendJson(res, 200, { ok: true, ...uiConfig(), tokenConfigured: Boolean((await getToken()).trim()), aiTokenConfigured: Boolean((await getAiToken()).trim()) });
        }
        try {
          await scope.update(patch);
          return sendJson(res, 200, { ok: true, ...uiConfig(), tokenConfigured: Boolean((await getToken()).trim()), aiTokenConfigured: Boolean((await getAiToken()).trim()) });
        } catch (error) {
          return sendJson(res, 400, { ok: false, code: "config", message: String(error?.message ?? error) });
        }
      }

      if (pathname === "/gitlab-tools/issues" && isGet) {
        if (!cfg.host || !cfg.token) {
          return sendJson(res, 200, { ok: false, code: "not_configured", message: "未配置 GitLab host/token（见 profile patch config）" });
        }
        const projRaw = url.searchParams.get("project") ?? uiConfig().defaultProject;
        if (!projRaw) {
          return sendJson(res, 200, { ok: false, code: "no_project", message: "未配置 defaultProject（可在设置页配置）" });
        }
        const state = url.searchParams.get("state") ?? "opened";
        const perPage = Number(url.searchParams.get("perPage") ?? cfg.perPage);
        try {
          const client = await getUIClient();
          const r = await client.api.getApiV4ProjectsIdIssues(projectPathArg(projRaw), {
            state,
            per_page: Math.min(Math.max(Number.isFinite(perPage) ? perPage : cfg.perPage, 1), 100)
          });
          const list = Array.isArray(r.data) ? r.data : [];
          return sendJson(res, 200, {
            ok: true,
            project: projRaw,
            state,
            issues: list.map(issueBrief),
            updatedAt: Date.now()
          });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "gitlab", message: String(error?.message ?? error) });
        }
      }

      // ── inline issue detail + discussion (sidebar detail view, no web jump) ──
      if (pathname === "/gitlab-tools/issue" && isGet) {
        if (!cfg.host || !cfg.token) {
          return sendJson(res, 200, { ok: false, code: "not_configured", message: "未配置 GitLab host/token（见 profile patch config）" });
        }
        const projRaw = url.searchParams.get("project") ?? uiConfig().defaultProject;
        const iidRaw = url.searchParams.get("iid");
        const iid = Number(iidRaw);
        if (!projRaw || !iidRaw || !Number.isFinite(iid) || iid <= 0) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 project 或 iid 参数" });
        }
        try {
          const client = await getUIClient();
          const r = await client.api.getApiV4ProjectsIdIssuesIssueIid(projectPathArg(projRaw), iid, {});
          if (!r.ok) {
            return sendJson(res, 200, { ok: false, code: "gitlab", message: String(r.error?.message ?? r.error ?? "查询失败") });
          }
          return sendJson(res, 200, { ok: true, project: projRaw, issue: issueDetailBrief(r.data) });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "gitlab", message: String(error?.message ?? error) });
        }
      }

      if (pathname === "/gitlab-tools/issue/notes" && isGet) {
        if (!cfg.host || !cfg.token) {
          return sendJson(res, 200, { ok: false, code: "not_configured", message: "未配置 GitLab host/token（见 profile patch config）" });
        }
        const projRaw = url.searchParams.get("project") ?? uiConfig().defaultProject;
        const iidRaw = url.searchParams.get("iid");
        const iid = Number(iidRaw);
        if (!projRaw || !iidRaw || !Number.isFinite(iid) || iid <= 0) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 project 或 iid 参数" });
        }
        try {
          const client = await getUIClient();
          const r = await client.raw({
            path: `/api/v4/projects/${projectPathArg(projRaw)}/issues/${iid}/notes`,
            query: { per_page: 100, sort: "asc" }
          });
          const list = Array.isArray(r.data) ? r.data : [];
          return sendJson(res, 200, { ok: true, project: projRaw, iid, notes: list.map(noteBrief), updatedAt: Date.now() });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "gitlab", message: String(error?.message ?? error) });
        }
      }

      if (pathname === "/gitlab-tools/issue/notes" && req.method === "POST") {
        if (!cfg.host || !cfg.token) {
          return sendJson(res, 200, { ok: false, code: "not_configured", message: "未配置 GitLab host/token（见 profile patch config）" });
        }
        const projRaw = url.searchParams.get("project") ?? uiConfig().defaultProject;
        const iidRaw = url.searchParams.get("iid");
        const iid = Number(iidRaw);
        if (!projRaw || !iidRaw || !Number.isFinite(iid) || iid <= 0) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 project 或 iid 参数" });
        }
        const body = await readBody(req);
        if (body._parseError) {
          return sendJson(res, 400, { ok: false, code: "parse", message: "请求体不是合法 JSON" });
        }
        const text = body.body;
        if (typeof text !== "string" || !text.trim()) {
          return sendJson(res, 400, { ok: false, code: "params", message: "评论内容不能为空" });
        }
        try {
          const client = await getUIClient();
          const r = await client.raw({
            path: `/api/v4/projects/${projectPathArg(projRaw)}/issues/${iid}/notes`,
            method: "POST",
            body: { body: text.trim() }
          });
          if (!r.ok) {
            return sendJson(res, 200, { ok: false, code: "gitlab", message: String(r.error?.message ?? r.error ?? "评论失败") });
          }
          return sendJson(res, 200, { ok: true, note: noteBrief(r.data) });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "gitlab", message: String(error?.message ?? error) });
        }
      }

      if (pathname === "/gitlab-tools/projects" && isGet) {
        if (!cfg.host || !cfg.token) {
          return sendJson(res, 200, { ok: false, code: "not_configured", message: "未配置 GitLab host/token（见 profile patch config）" });
        }
        const search = url.searchParams.get("search") ?? "";
        const perPage = Number(url.searchParams.get("perPage") ?? 10);
        try {
          const client = await getUIClient();
          const r = await client.api.getApiV4Projects({
            membership: true,
            order_by: "last_activity_at",
            per_page: Math.min(Math.max(Number.isFinite(perPage) ? perPage : 10, 1), 50),
            ...(search ? { search } : {})
          });
          const list = Array.isArray(r.data) ? r.data : [];
          return sendJson(res, 200, {
            ok: true,
            projects: list.map(projectBrief),
            updatedAt: Date.now()
          });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "gitlab", message: String(error?.message ?? error) });
        }
      }

      return sendJson(res, 404, { ok: false, code: "notfound", message: `未知路由 ${pathname}` });
    }
  }), "gitlab-tools: /gitlab-tools routes");
}
