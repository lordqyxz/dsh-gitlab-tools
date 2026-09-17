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
//   - settings namespace `gitlab-tools` (defaultProject / refreshMs), read live
//     via scope.get() — host+token stay in the static plugin config and are
//     NEVER sent to the browser.
//   - GET  /gitlab-tools/status    → { ok, configured } (no secrets echoed)
//   - GET  /gitlab-tools/settings  → effective UI config (defaultProject/refreshMs)
//   - POST /gitlab-tools/settings  → persist a whitelisted config patch
//   - GET  /gitlab-tools/issues    → sanitized open-issue list for a project
//   - GET  /gitlab-tools/projects  → project picker list for the settings page
import z from "@deepseek-ai/schemastery";
import { randomUUID } from "node:crypto";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createClient, projectPathArg } from "./sdk.js";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { EventStore, createGitlabWebhookHandler, summarizeRecord, expandHome } from "./webhook.js";
import { createListener, createNtfySource, loadState } from "./listener.js";
import { createAckHelper } from './ack.js';
import { createReplyPoster } from './ack.js';
import { createOutbound } from "./outbound.js";
import { foldUsage } from "./usage.js";

export const name = "gitlab-tools";
export const inject = ["tools", "webServer", "settings", "credentials", "agents", "sessionController", "sessions"];

/** Settings namespace for the browser UI (hot-reloaded; never holds secrets). */
const UI_NS = "gitlab-tools";

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
  timeoutMs: z.number().min(1000).default(60000),
  // ── GitLab webhook 接收（可选功能）───────────────────────────────────────
  // 为空 = 功能关闭（POST /gitlab-tools/webhook 回 404 webhook-disabled）。
  // 非空 = 启用；值须与 GitLab webhook 设置里的 Secret token 完全一致。
  agentSecretToken: z.string().default(""),
  // 事件落盘路径（JSONL；超 agentMaxFileLines 行自动保留后半）。
  agentEventsFile: z.string().default("~/.dsh/gitlab-tools/webhook-events.jsonl"),
  agentMaxFileLines: z.number().min(100).default(2000),
  // 空 = 接受全部项目；非空 = 只接受列出的 path_with_namespace。
  agentProjectWhitelist: z.array(z.string()).default([]),
  // ── 事件轮询源 + @mention 自动响应（可选）───────────────────────────────
  // 要监听的项目（path_with_namespace），空 = 轮询关闭。
  agentPollProjects: z.array(z.string()).default([]),
  // 轮询间隔（ms，最小 10s）。游标与已见 note id 落盘，重启不重放。
  agentPollIntervalMs: z.number().min(10000).default(30000),
  // @mention 触发的用户名（GitLab 服务账号用户名）；空 = 只记录事件、不自动响应。
  agentMentionUsername: z.string().default(""),
  // ntfy 订阅源（推送）：主题 /json 流地址 + dsh token；空 = 关闭（轮询兜底仍在）。
  agentNtfyUrl: z.string().default(""),
  agentNtfyToken: z.string().default(""),
  // 响应会话默认工作目录（项目→文件夹映射未命中时用；空 = 回落 /Users/apple/dev）。
  agentDefaultCwd: z.string().default(""),
  // MR 流水线失败自动分诊（推送源专属能力；轮询兜底不含 pipeline 事件）。
  agentPipelineTriage: z.boolean().default(true),
  // 出站回复末尾附 token 用量脚注（本轮 + 会话累计；无 usage 数据自动省略）。
  agentUsageFooter: z.boolean().default(true),
  agentPollStateFile: z.string().default("~/.dsh/gitlab-tools/webhook-poll-state.json")
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

// 大结果护栏：巨型响应（CI 工件 JSON、trace 等）整包进上下文会拖垮后续每一步
// （实测 MR !565：单 turn 17 分钟，300s 的 step 就是整包 e2e-results.json）。
// 超限截断并明确告知模型改走「bash 落盘 + jq 分段提取」或更精确的分页查询。
const API_RESULT_CAP = 60000;
function capApiResponse(text) {
  if (text.length <= API_RESULT_CAP) return text;
  return text.slice(0, API_RESULT_CAP)
    + `
…[gitlab_api] 结果共 ${text.length} 字符，超过 ${API_RESULT_CAP} 上限已截断。不要原样重试整包请求：改用更精确的查询（per_page/分页/字段过滤），或用 bash 把响应下载到本地文件后用 jq 分段提取（git remote get-url origin 内含 oauth token，可作 PRIVATE-TOKEN）。`;
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

/** Map an issue's labels to {name, color, text_color}, preferring label details. */
function labelsBrief(i) {
  const details = Array.isArray(i.labels_details) ? i.labels_details : null;
  if (details) {
    return details.map((l) => ({
      name: l.name ?? String(l.title ?? l.id ?? "?"),
      color: l.color,
      text_color: l.text_color
    }));
  }
  return Array.isArray(i.labels)
    ? i.labels.map((n) => (typeof n === "string" ? { name: n } : n))
    : [];
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
    labels: labelsBrief(i),
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
    labels: labelsBrief(i),
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
    // author.avatar_url (full instance URL, public /uploads path, no auth) —
    // the browser panel renders it directly; falls back to the initial-letter
    // avatar on the client if the image fails to load.
    author: n.author
      ? {
          username: n.author.username,
          name: n.author.name,
          avatar_url: typeof n.author.avatar_url === "string" && n.author.avatar_url ? n.author.avatar_url : null
        }
      : null
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
    timeoutMs: config.timeoutMs ?? 60000,
    // webhook 接收（可选功能）：secretToken 为空 = 关闭。
    agentSecretToken: config.agentSecretToken ?? "",
    agentEventsFile: config.agentEventsFile ?? "~/.dsh/gitlab-tools/webhook-events.jsonl",
    agentMaxFileLines: config.agentMaxFileLines ?? 2000,
    agentProjectWhitelist: Array.isArray(config.agentProjectWhitelist) ? config.agentProjectWhitelist : [],
    agentPollProjects: Array.isArray(config.agentPollProjects) ? config.agentPollProjects : [],
    agentPollIntervalMs: config.agentPollIntervalMs ?? 30000,
    agentMentionUsername: config.agentMentionUsername ?? "",
    agentNtfyUrl: config.agentNtfyUrl ?? "",
    agentNtfyToken: config.agentNtfyToken ?? "",
    agentDefaultCwd: config.agentDefaultCwd ?? "",
    agentPipelineTriage: config.agentPipelineTriage ?? true,
    agentUsageFooter: config.agentUsageFooter ?? true,
    agentPollStateFile: config.agentPollStateFile ?? "~/.dsh/gitlab-tools/webhook-poll-state.json"
  };

  // 响应器/轮询器在 getClient 等辅助函数之后构建（依赖 client 工厂与会话服务），
  // webhook 路由回调经此 ref 延迟引用。
  const listenerRef = { current: null };

  // 事件存储：webhook 与轮询源共用（轮询不依赖 secretToken）。
  const agentEventsFile = expandHome(cfg.agentEventsFile);
  const eventStore = new EventStore({ eventsFile: agentEventsFile, maxFileLines: cfg.agentMaxFileLines });

  // ── GitLab webhook 接收器（可选功能）────────────────────────────────────
  // enabled=false 时路由分支回 404；事件存储始终存在（轮询源也写它）。
  const webhook = (() => {
    const secretToken = String(cfg.agentSecretToken || "").trim();
    if (!secretToken) return { enabled: false, store: eventStore, eventsFile: agentEventsFile };
    return {
      enabled: true,
      store: eventStore,
      eventsFile: agentEventsFile,
      handle: createGitlabWebhookHandler({
        store: eventStore,
        secretToken,
        projectWhitelist: cfg.agentProjectWhitelist,
        // 推送源同样走 @mention 响应管道（经 listenerRef 延迟引用）
        respond: (record) =>
          listenerRef.current
            ? listenerRef.current.respond(record)
            : Promise.resolve("no-listener")
      })
    };
  })();

  const project = (p) => p ?? cfg.defaultProject ?? "";

  const reg = (tool) => ctx.tools.register(tool);

  // ── generic full-coverage tool ────────────────────────────────────────────
  reg(defineTool({
    name: "gitlab_api",
    description: `Call ANY GitLab REST API v4 endpoint through the spec-generated SDK (version-aligned with this instance). Covers everything the curated gitlab_* tools don't. \`path\` is relative to /api/v4 (e.g. "projects/16/repository/branches", "groups"). For project paths use the encoded form "group%2Fproject" or numeric id. \`query\`/body are plain JSON objects. Responses over ~60k chars are truncated mid-content; prefer precise queries/pagination, or download big files via bash+curl and inspect with jq locally.`,
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
      return res(capApiResponse(json === null ? String(r.error ?? "") : JSON.stringify(json, null, 2)), json);
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
    description: "Add a comment (note) to an issue. NOTE: in auto-bridged sessions (created from a GitLab @mention or a failed-MR pipeline triage) your final reply is posted back automatically by the system — use this tool only for deliberate extra comments, never for your final reply.",
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

  reg(defineTool({
    name: "gitlab_agent_poll_now",
    description: "立即执行一轮 GitLab 事件轮询（不等定时器）：拉取监听项目的 issue/MR 新评论，命中 @mention 时触发自动响应。返回本轮新增事件数与错误。轮询关闭时如实报告。",
    parameters: {},
    timeoutMs: cfg.timeoutMs,
    output: TEXT_OUTPUT,
    async execute() {
      const L = listenerRef.current;
      if (!L || !L.poller.status().enabled) {
        return res("轮询未启用：在插件 config（cordis.patch.yml 的 gitlab-tools insert）配置 agentPollProjects 后生效。", { enabled: false });
      }
      const out = await L.poller.cycle();
      return res(
        out.skipped ? "上一轮仍在执行，本轮跳过。" : `轮询完成：新增事件 ${out.notes} 条${out.errors?.length ? "；错误：" + out.errors.join("；") : ""}`,
        out
      );
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
    refreshMs: z.number().min(5000).max(3600000).default(120000),
    // Project (path_with_namespace) → local folder mapping. Used when creating a
    // dev session so it lands in the correct workspace group for that project.
    projectDirs: z.array(z.object({ project: z.string(), dir: z.string() })).default([])
  });
  const uiBase = { defaultProject: cfg.defaultProject ?? "", host: cfg.host ?? "", refreshMs: 120000, projectDirs: [] };

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
      refreshMs: s.refreshMs ?? 120000,
      projectDirs: Array.isArray(s.projectDirs) ? s.projectDirs : []
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

  // 生效 AI 身份（诊断用）：aiToken 经 GET /user 解析，按 token 记忆化。
  const aiUsernameCache = new Map();
  const resolveAiUsername = async () => {
    try {
      const t = await getAiToken();
      if (!t) return { username: "", source: "" };
      let u = aiUsernameCache.get(t);
      if (u === undefined) {
        try {
          const c = await makeClient(t);
          const r = await c.raw({ path: "/api/v4/user", method: "GET" });
          u = (r.data && r.data.username) || "";
        } catch {
          u = "";
        }
        if (aiUsernameCache.size > 20) aiUsernameCache.clear();
        aiUsernameCache.set(t, u);
      }
      return { username: u, source: u ? "ai-token" : "" };
    } catch {
      return { username: "", source: "" };
    }
  };

  // SA 用户名（防环 + 诊断）：经 aiToken 查 /api/v4/user 记忆化；失败回落空串
  // （入站防环退回 mentionUsername 比对）。
  let saUsernameCache;
  const resolveSaUsername = async () => {
    if (saUsernameCache !== undefined) return saUsernameCache;
    try {
      const ai = (await getAiToken()).trim();
      const client = await makeClient(ai || (await getToken()).trim());
      const r = await client.raw({ path: "/api/v4/user", method: "GET" });
      saUsernameCache = r.data?.username || "";
    } catch {
      saUsernameCache = "";
    }
    return saUsernameCache;
  };

  // ── 事件监听（轮询源 + @mention 自动响应，可选）─────────────────────────
  // 轮询源写共享 EventStore；mention 命中时经会话注入让 agent 以 SA 身份回复。
  const listenerStateFile = expandHome(cfg.agentPollStateFile);
  const listenerState = loadState(listenerStateFile);
  // emoji ACK 状态机（👀 处理中 → ✅ 已回复 / ❌ 失败）：入站贴、出站换，共享 getClient（SA 身份）。
  const ack = createAckHelper({ client: getClient, logger: ctx.logger });
  const reply = createReplyPoster({ client: getClient, logger: ctx.logger });
  const listener = createListener({
    client: getClient,
    agents: ctx.agents,
    controller: ctx.sessionController,
    store: eventStore,
    state: listenerState,
    stateFile: listenerStateFile,
    projects: cfg.agentPollProjects,
    intervalMs: cfg.agentPollIntervalMs,
    mentionUsername: cfg.agentMentionUsername,
    pipelineTriage: cfg.agentPipelineTriage,
    saUsername: resolveSaUsername,
    // 响应会话的工作目录：项目→文件夹映射优先，否则 dev 根目录（无 cwd 的会话无法
    // 组装系统提示词，turn 会以 {{cwd}} 变量缺失报错结束）
    resolveCwd: (project) => {
      const m = (uiConfig().projectDirs || []).find((x) => x.project === project);
      return (m?.dir && m.dir.trim()) || cfg.agentDefaultCwd.trim() || "/Users/apple/dev";
    },
    // 响应会话的工作区分组：cwd → 宿主 workspaceRegistry resolve-or-create（幂等），
    // listener 侧 agents.create 后 attachSession（官方 session.create({workspaceId}) 同序）。
    // 不进静态 inject：旧宿主缺该服务时降级为「不分组」，不能让整个插件 pending。
    ack,
    reply,
    ensureWorkspace: async (dir) => {
      const reg = typeof ctx.get === "function" ? ctx.get("workspaceRegistry") : undefined;
      if (!reg || typeof reg.resolveByPath !== "function" || typeof reg.create !== "function") return undefined;
      const existing = await reg.resolveByPath(dir).catch(() => undefined);
      if (existing) return existing;
      return reg.create(dir).catch((e) => {
        (ctx.logger?.warn || console.warn)("[gitlab-tools] workspace create failed for '" + dir + "': " + String((e && e.message) || e));
        return undefined;
      });
    },
    logger: ctx.logger,
  });
  // ── 回复出站桥（session → GitLab，全事件机制）────────────────────────────
  // 订阅宿主会话事件总线（官方持久化插件同一惯用法 ctx.on('session/event')）：
  // 绑定线程（state.sessionIndex，由入站响应器写入）的会话每轮 turn/end 且正常
  // 完成时，把最终回复自动贴回对应 issue/MR（SA 身份）。handleSessionEvent
  // 自行兜底所有异常，不会影响会话 loop。
  const outbound = createOutbound({
    ack,
    reply,
    client: getClient,
    state: listenerState,
    stateFile: listenerStateFile,
    logger: ctx.logger,
    usageFooter: cfg.agentUsageFooter,
  });
  listenerRef.current = Object.assign(listener, { outbound });
  if (typeof ctx.on === "function") {
    ctx.effect(() => {
      const off = ctx.on("session/event", (session, event) => {
        void outbound.handleSessionEvent(session, event);
      });
      return () => (typeof off === "function" ? off() : undefined);
    }, "gitlab-tools: outbound session-event bridge");
  } else {
    (ctx.logger?.warn || console.warn)("[gitlab-tools] ctx.on 不可用，出站桥未订阅 session/event");
  }
  if (listener.poller.status().enabled) {
    ctx.effect(() => {
      listener.poller.start();
      return () => listener.poller.stop();
    }, "gitlab-tools: event poller");
  }
  if (cfg.agentNtfyUrl) {
    const ntfy = createNtfySource({
      url: cfg.agentNtfyUrl,
      token: cfg.agentNtfyToken,
      store: eventStore,
      responder: listener.responder,
      state: listenerState,
      stateFile: listenerStateFile,
    });
    listenerRef.current = { ...listener, ntfy }; // spread 含 outbound（Object.assign 已挂上）
    ctx.effect(() => {
      ntfy.start();
      return () => ntfy.stop();
    }, "gitlab-tools: ntfy source");
  }

  // ── HTTP routes (browser panel ↔ host proxy; token stays server-side) ────
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/gitlab-tools",
    handler: async (req, res) => {
      const url = new URL(req.url ?? "/", "http://gitlab-tools");
      const pathname = url.pathname;
      const isGet = req.method === "GET" || req.method === "HEAD";

      // 会话注入冒烟：POST /gitlab-tools/webhook-smoke → 实测宿主侧 create/binding/prompt 链路。
      if (pathname === "/gitlab-tools/webhook-smoke" && req.method === "POST") {
        if (!listenerRef.current) return sendJson(res, 503, { ok: false, code: "no-listener" });
        const out = await listenerRef.current.injectProbe();
        return sendJson(res, 200, { ok: true, smoke: out });
      }

      // GitLab webhook 接收端点（可选功能：config.agentSecretToken 非空才启用）。
      // handler 完全自管响应（writeHead+end），不走 sendJson。
      if (pathname === "/gitlab-tools/webhook") {
        if (!webhook.enabled) {
          return sendJson(res, 404, { ok: false, code: "webhook-disabled", message: "webhook 功能未启用：在插件 config 配置 agentSecretToken" });
        }
        return webhook.handle(req, res);
      }

      if (pathname === "/gitlab-tools/poll-debug" && isGet) {
        return sendJson(res, 200, listenerRef.current ? listenerRef.current.poller.status() : { none: true });
      }

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
          projectDirs: u.projectDirs,
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
        for (const key of ["defaultProject", "host", "refreshMs", "projectDirs"]) {
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
        if ("projectDirs" in patch) {
          if (!Array.isArray(patch.projectDirs)) {
            return sendJson(res, 400, { ok: false, code: "config", message: "projectDirs 必须是数组" });
          }
          const clean = [];
          for (const row of patch.projectDirs) {
            if (!row || typeof row.project !== "string" || typeof row.dir !== "string") {
              return sendJson(res, 400, { ok: false, code: "config", message: "projectDirs 每项需 { project, dir }" });
            }
            clean.push({ project: row.project.trim(), dir: row.dir.trim() });
          }
          patch.projectDirs = clean;
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
        // Optional list filters, mirroring GitLab's issue search:
        //   scope  = assigned_to_me | all  (default all on the API; UI passes it explicitly)
        //   search = full-text on title/description
        const scope = url.searchParams.get("scope") ?? "";
        const search = (url.searchParams.get("search") ?? "").trim();
        try {
          const client = await getUIClient();
          const r = await client.api.getApiV4ProjectsIdIssues(projectPathArg(projRaw), {
            state,
            per_page: Math.min(Math.max(Number.isFinite(perPage) ? perPage : cfg.perPage, 1), 100),
            with_labels_details: true,
            ...(scope === "assigned_to_me" ? { scope: "assigned_to_me" } : {}),
            ...(search ? { search } : {})
          });
          const list = Array.isArray(r.data) ? r.data : [];
          return sendJson(res, 200, {
            ok: true,
            project: projRaw,
            state,
            scope: scope === "assigned_to_me" ? "assigned_to_me" : "all",
            search: search || undefined,
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
          const r = await client.api.getApiV4ProjectsIdIssuesIssueIid(projectPathArg(projRaw), iid, { with_labels_details: true });
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

      // ── dev-session runtime stats (read-only; no GitLab auth needed) ──────
      // Reads the DSH session event log and folds the model's `assistant/message`
      // `usage` records into token totals + an approximate generation speed.
      if (pathname === "/gitlab-tools/session/stats" && isGet) {
        const sessionId = url.searchParams.get("sessionId") ?? "";
        if (!sessionId) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 sessionId" });
        }
        const sessionsSvc = ctx.sessions ?? ctx.get?.("sessions");
        let sess = null;
        try {
          sess = sessionsSvc?.get?.(sessionId);
        } catch {
          sess = null; // 会话未加载/不存在：一些宿主实现 get 直接抛，统一降级为 no_session
        }
        if (!sess) {
          return sendJson(res, 200, { ok: false, code: "no_session", message: "会话不存在或未加载" });
        }
        const events = Array.isArray(sess.events) ? sess.events : [];
        // 折叠口径统一走 lib/usage.js（与出站用量脚注同一份实现，脚注数字 = 面板数字）。
        const { input, output, cacheRead, cacheWrite, reasoning, samples, firstAt, lastAt } = foldUsage(events);
        const total = input + output;
        let tokensPerSec = null;
        if (samples >= 2 && firstAt !== null && lastAt !== null && lastAt > firstAt) {
          tokensPerSec = total / ((lastAt - firstAt) / 1000);
        }
        let running = false;
        try {
          const agentsSvc = ctx.agents ?? ctx.get?.("agents");
          running = Boolean(agentsSvc?.get?.(sessionId));
        } catch {
          /* agent registry optional */
        }
        return sendJson(res, 200, {
          ok: true,
          sessionId,
          exists: true,
          running,
          inputTokens: input,
          outputTokens: output,
          cacheReadTokens: cacheRead,
          cacheWriteTokens: cacheWrite,
          reasoningTokens: reasoning,
          totalTokens: total,
          tokensPerSec,
          firstActiveAt: firstAt,
          lastActiveAt: lastAt,
          samples,
          updatedAt: Date.now()
        });
      }

      // ── dev-session stop (cancel the live agent turn, if reachable) ───────
      if (pathname === "/gitlab-tools/session/stop" && req.method === "POST") {
        const sessionId = url.searchParams.get("sessionId") ?? "";
        if (!sessionId) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 sessionId" });
        }
        const agentsSvc = ctx.agents ?? ctx.get?.("agents");
        const agent = agentsSvc?.get?.(sessionId);
        if (!agent) {
          return sendJson(res, 200, { ok: true, stopped: false, message: "没有运行中的开发会话" });
        }
        try {
          if (typeof agent.cancel === "function") {
            agent.cancel({ kind: "user" });
            return sendJson(res, 200, { ok: true, stopped: true, message: "已请求停止该开发会话" });
          }
          return sendJson(res, 200, { ok: false, code: "no_cancel", message: "当前 DSH 未暴露 agent 停止接口" });
        } catch (error) {
          return sendJson(res, 200, { ok: false, code: "stop_failed", message: String(error?.message ?? error) });
        }
      }


      // ── 会话恢复/续跑（运维向）：向既有会话注入一条 queue 消息 ─────────────
      // 用途：宿主重启（部署）后把被中断的会话续起来；与 session/stop 对称。
      // 先直接 prompt（GUI 发消息同一 API）；重启后 agent 可能未挂载 → 兜底
      // agents.create 重挂 loop 再注入一次（失败如实返回错误）。
      if (pathname === "/gitlab-tools/session/prompt" && req.method === "POST") {
        const sessionId = url.searchParams.get("sessionId") ?? "";
        const text = (url.searchParams.get("text") ?? "").trim();
        if (!sessionId) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 sessionId" });
        }
        if (!text) {
          return sendJson(res, 200, { ok: false, code: "params", message: "缺少 text" });
        }
        const controller = ctx.sessionController ?? ctx.get?.("sessionController");
        if (!controller?.prompt) {
          return sendJson(res, 200, { ok: false, code: "no-session-controller", message: "当前 DSH 未暴露 sessionController" });
        }
        const run = () => controller.prompt({
          requestId: randomUUID(),
          sessionId,
          mode: "queue",
          content: [{ type: "text", text: text.slice(0, 4000) }]
        // 网关形状：service 方法第二参数是 abort signal（typert 统一透传）。直连调用
        // 必须自带——实测缺失时控制器内部 signal.throwIfAborted() 对 undefined 崩。
        }, AbortSignal.timeout(60000));
        try {
          await run();
          return sendJson(res, 200, { ok: true, sessionId, queued: true });
        } catch (error) {
          // 不做 agents.create 兜底：网关 resolve() 自带 resume-from-disk（从持久化状态
          // 重挂 agent）；create 只产新会话，对已存在 id 必报 already exists（AGENTS 第 14 条）。
          // 首错原样透传，便于诊断 resume 失败的真实原因。
          return sendJson(res, 200, { ok: false, code: "prompt-failed", message: String(error?.message ?? error), stack: String(error?.stack ?? "").slice(0, 900) });
        }
      }

      // ── Agent 事件面板：管线状态 + 事件流水（只读，无密钥）──────────────
      if (pathname === "/gitlab-tools/agent-events" && isGet) {
        const L = listenerRef.current;
        const q = url.searchParams;
        const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
        const kind = q.get("kind") || undefined;
        const project = q.get("project") || undefined;
        const aiName = await resolveAiUsername();
        const { total, matched } = webhook.store.query({ limit, kind, project });
        const events = matched.map((r) => ({
          receivedAt: r.receivedAt || "",
          source: r.source || (String(r.uuid || "").startsWith("poll-") ? "poll" : String(r.uuid || "").startsWith("ntfy-") ? "ntfy" : "webhook"),
          kind: r.object_kind || "unknown",
          brief: r.brief || "",
          responder: r.responder ?? null,
          project: r.project || "",
          skipped: Boolean(r.skipped),
        }));
        return sendJson(res, 200, {
          ok: true,
          status: {
            receiver: webhook.enabled ? "on" : "off",
            poller: L ? L.poller.status() : null,
            ntfy: L && L.ntfy ? L.ntfy.status() : null,
            responder: L ? L.responder.status() : null,
            outbound: L && L.outbound && L.outbound.status ? L.outbound.status() : null,
            aiIdentity: aiName.username || "",
            aiIdentitySource: aiName.source,
          },
          total,
          events,
        });
      }

      // ── 手动触发一轮轮询（面板按钮；轮询未启用时如实报告）──────────────
      if (pathname === "/gitlab-tools/agent-poll" && req.method === "POST") {
        const L = listenerRef.current;
        if (!L || !L.poller.status().enabled) {
          return sendJson(res, 200, { ok: true, enabled: false, message: "轮询未启用（agentPollProjects 为空）" });
        }
        const out = await L.poller.cycle();
        return sendJson(res, 200, { ok: true, enabled: true, ...out });
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
