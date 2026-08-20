window.__ModuleLoader__.load({ id: "dsh-gitlab-tools", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function IssueMark({ size = 14 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      "aria-hidden": true,
      style: { flex: "none", display: "block" },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "2.6", fill: "currentColor", stroke: "none" })
      ]
    }
  );
}
function DevSessionMark({ size = 14 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      "aria-hidden": true,
      style: { flex: "none", display: "block" },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z", fill: "currentColor" })
    }
  );
}
function StopMark({ size = 14 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      "aria-hidden": true,
      style: { flex: "none", display: "block" },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2", fill: "currentColor" })
    }
  );
}

// src/client/tab.tsx
var import_react6 = require("react");

// src/client/session-store.ts
var map = /* @__PURE__ */ new Map();
function issueKey(project, iid) {
  return `${project ?? ""}#${iid}`;
}
function registerIssueSession(project, iid, sessionId) {
  if (!sessionId) return;
  map.set(issueKey(project, iid), { sessionId, createdAt: Date.now() });
}
function getIssueSession(project, iid) {
  return map.get(issueKey(project, iid));
}

// src/client/devsession.ts
function normProject(p) {
  return (p ?? "").trim().toLowerCase();
}
function resolveWorkspaceId(ctx, cwd) {
  const workspaces = ctx?.get?.("workspaces");
  const items = workspaces?.list?.getSnapshot?.()?.items ?? [];
  if (!items.length) return void 0;
  const norm = (p) => p.replace(/[\\/]+$/, "");
  const base = norm(cwd);
  let best;
  for (const w of items) {
    const p = w.path ? norm(w.path) : "";
    if (!p) continue;
    if (p === base) return w.workspaceId;
    if (base === p || base.startsWith(p + "/") || base.startsWith(p + "\\")) {
      if (!best || p.length > best.path.length) best = { workspaceId: w.workspaceId, path: p };
    }
  }
  return best?.workspaceId;
}
async function fetchIssueContext(project, iid) {
  const qp = `project=${encodeURIComponent(project ?? "")}&iid=${iid}`;
  let description = "";
  let notes = "";
  try {
    const r = await fetch(`/gitlab-tools/issue?${qp}`, { cache: "no-store" });
    const j = await r.json();
    if (j && j.ok === true && j.issue && typeof j.issue.description === "string") {
      description = j.issue.description;
    }
  } catch {
  }
  try {
    const r = await fetch(`/gitlab-tools/issue/notes?${qp}`, { cache: "no-store" });
    const j = await r.json();
    if (j && j.ok === true && Array.isArray(j.notes)) {
      notes = j.notes.map((n) => {
        const who = n.system ? "\u7CFB\u7EDF" : `@${n.author?.username ?? "?"}`;
        const when = n.created_at ? `_(${n.created_at})_` : "";
        const body = String(n.body ?? "").replace(/\s*\n\s*/g, " ").trim();
        return `- **${who}** ${when}: ${body || "\uFF08\u7A7A\uFF09"}`;
      }).join("\n");
    }
  } catch {
  }
  return { description, notes };
}
function buildPrompt(issue, project, cwd, context) {
  const labels = issue.labels.length ? issue.labels.map((l) => l.name).join(", ") : "\u65E0";
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "\u672A\u6307\u6D3E";
  const hasBody = Boolean(context?.description?.trim());
  const hasNotes = Boolean(context?.notes?.trim());
  return [
    `\u8BF7\u5904\u7406 GitLab issue #${issue.iid}\uFF1A${issue.title || "(\u65E0\u6807\u9898)"}`,
    "",
    `- \u9879\u76EE\uFF1A${project || "\uFF08\u672A\u77E5\uFF09"}`,
    `- \u72B6\u6001\uFF1A${issue.state} \xB7 \u6807\u7B7E\uFF1A${labels} \xB7 \u6307\u6D3E\u4EBA\uFF1A${assignee}`,
    `- Issue \u94FE\u63A5\uFF1A${issue.web_url}`,
    cwd ? `- \u5DE5\u4F5C\u76EE\u5F55\uFF1A${cwd}` : "- \u5DE5\u4F5C\u76EE\u5F55\uFF1A\uFF08\u672A\u8BBE\u7F6E\uFF09",
    "",
    "",
    "## Issue \u5185\u5BB9\uFF08\u542F\u52A8\u65F6\u5DF2\u5185\u5D4C\uFF0C\u65E0\u9700\u518D\u8C03\u7528\u5DE5\u5177\u91CD\u590D\u62C9\u53D6\uFF09",
    "### \u6B63\u6587",
    hasBody ? context.description.split("\n").map((l) => `> ${l}`).join("\n") : "> \uFF08\u65E0\u6B63\u6587\uFF09",
    "",
    "### \u65E2\u6709\u8BA8\u8BBA",
    hasNotes ? context.notes : "- \uFF08\u65E0\u65E2\u6709\u8BA8\u8BBA\uFF09",
    "",
    "## \u5F00\u53D1\u89C4\u7A0B\uFF08\u52A1\u5FC5\u6309\u6B64\u6267\u884C\uFF1A\u5148\u89C4\u5212\u3001\u5148\u786E\u8BA4\uFF0C\u518D\u52A8\u624B\uFF09",
    "0. \u3010\u53EA\u8BFB\u8C03\u7814\xB7\u4E0D\u5199\u4EE3\u7801\u3011\u57FA\u4E8E\u4E0A\u9762\u5DF2\u5185\u5D4C\u7684 issue \u6B63\u6587\u4E0E\u8BA8\u8BBA\uFF08\u4E0D\u5FC5\u518D gitlab_view_issue / gitlab_list_notes \u91CD\u590D\u62C9\u53D6\uFF09\uFF0C" + (cwd ? `clone/\u5B9A\u4F4D\u4ED3\u5E93\u540E\uFF0C\u8BC4\u4F30\u3010\u8BE5 issue \u4E0E\u5F53\u524D\u4EE3\u7801\u7684\u5339\u914D\u7A0B\u5EA6\u3011\uFF1A\u9700\u6C42\u80FD\u843D\u5728\u54EA\u4E9B\u73B0\u6709\u6A21\u5757/\u4EE3\u7801\u8DEF\u5F84\u4E0A\u3001\u6539\u52A8\u8303\u56F4\u5927\u6982\u591A\u5927\u3002` : `\u8BC4\u4F30\u8BE5 issue \u4E0E\u4EE3\u7801\u7684\u5339\u914D\u7A0B\u5EA6\uFF1A\u5148\u786E\u5B9A/\u514B\u9686\u8BE5\u9879\u76EE\u5230\u5408\u9002\u5DE5\u4F5C\u76EE\u5F55\u3002`) + " \u8FD9\u4E00\u6B65\u53EA\u8C03\u7814\uFF0C\u7EDD\u4E0D\u5F00\u59CB\u5199\u4EE3\u7801\u3002",
    "1. \u3010\u5236\u5B9A plan\u3011\u628A\u3010\u5F00\u53D1\u8BA1\u5212\u3011\u7528 gitlab_create_note \u53D1\u5230 issue #${issue.iid} \u7684\u8BC4\u8BBA\u91CC\u2014\u2014\u542B\uFF1A\u5BF9\u9700\u6C42\u7684\u7406\u89E3\u3001\u65B9\u6848\u9009\u62E9\u3001issue \u4E0E\u4EE3\u7801\u5339\u914D\u5EA6\u8BC4\u4F30\u3001\u7591\u95EE\u70B9\u3001\u5B9E\u65BD\u6B65\u9AA4\u3001\u5DE5\u4F5C\u91CF\u4F30\u8BA1\u3002",
    "2. \u3010\u66F4\u65B0\u6807\u7B7E\u3011\u7528 gitlab_api \u66F4\u65B0\u8BE5 issue \u7684\u6807\u7B7E\u4EE5\u53CD\u6620\u5F53\u524D\u72B6\u6001\uFF08\u4F8B\u5982\u6807\u4E3A\u300C\u89C4\u5212\u4E2D/\u5F85\u786E\u8BA4\u300D\u6216\u4F60\u6309\u9700\u65B0\u5EFA\u7684\u72B6\u6001\u6807\u7B7E\uFF09\uFF0C\u4F46\u5148\u4E0D\u8981\u628A\u300C\u8FDB\u884C\u4E2D\u300D\u6807\u5F97\u592A\u65E9\u3002",
    "3. \u3010\u89E6\u53D1\u5BF9\u8BDD\xB7\u7B49\u5F85\u786E\u8BA4\u3011\u628A plan \u540C\u6B65\u5230 issue \u8BC4\u8BBA\uFF0C\u5FC5\u8981\u65F6\u5728\u5BF9\u8BDD\u91CC\u5411\u7528\u6237\u8BF4\u660E\u5E76\u660E\u786E\u8BE2\u95EE\u786E\u8BA4\u3002**\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u540E\u518D\u5F00\u59CB\u5B9E\u9645\u5F00\u53D1\u3002**",
    "4. \u3010\u786E\u8BA4\u540E\u5B9E\u73B0\u3011\u7528\u6237\u786E\u8BA4\u540E\uFF0C\u4E25\u683C\u6309 plan \u5B9E\u73B0\uFF1B\u671F\u95F4\u82E5\u7528\u6237\u5728 issue \u8BC4\u8BBA\u6216\u5BF9\u8BDD\u91CC\u56DE\u590D\uFF08\u7B54\u590D\u7591\u95EE\u3001\u7ED9\u65B0\u65B9\u6848\u3001@ \u4F60\uFF0C\u65B0\u589E\u7684\u8BC4\u8BBA\u4E0D\u5728\u542F\u52A8\u5185\u5BB9\u91CC\uFF09\uFF0C\u7528 gitlab_list_notes \u589E\u91CF\u8BFB\u53D6\u65B0\u589E\u8BA8\u8BBA\u5E76\u628A\u53CD\u9988\u6B63\u786E\u52A0\u8F7D\u8FDB\u6267\u884C\u6D41\uFF0C\u4E0D\u8981\u5FFD\u7565\u3002",
    "5. \u3010\u6536\u5C3E\u3011\u5B9E\u73B0\u5B8C\u6210\u540E\uFF0C\u7528 gitlab_create_note \u5728 issue \u4E0A\u8865\u5145\u5B9E\u73B0\u8BF4\u660E/\u7ED3\u8BBA\uFF08\u5FC5\u8981\u65F6\u63D0\u4EA4 MR\uFF09\uFF0C\u8BF4\u660E\u5982\u4F55\u9A8C\u8BC1\uFF0C\u5E76\u628A\u6807\u7B7E\u66F4\u65B0\u4E3A\u5DF2\u5B8C\u6210/\u8FDB\u884C\u4E2D\u5BF9\u5E94\u7684\u72B6\u6001\u3002",
    "",
    "## \u5BF9\u8BDD\u4EA4\u4E92",
    "\u7528\u6237\u5728\u5BF9\u8BDD\u91CC @ \u4F60\u6216\u76F4\u63A5\u5BF9\u4F60\u8BF4\u8BDD\u65F6\uFF0C\u90FD\u8981\u6B63\u786E\u54CD\u5E94\u5176\u8BF7\u6C42\uFF1B\u82E5\u8BE5\u8BF7\u6C42\u5C5E\u4E8E\u67D0\u4E2A issue\uFF0C\u5148 gitlab_list_notes \u8BFB\u8BA8\u8BBA\u518D\u56DE\u5E94\u3002"
  ].join("\n");
}
async function createDevSession(ctx, scope, issue, project, projectDirs) {
  const sessions = ctx?.get?.("sessions");
  if (!sessions || typeof sessions.create !== "function") {
    return { kind: "err", text: "DSH \u4F1A\u8BDD\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u521B\u5EFA\u5F00\u53D1\u4F1A\u8BDD" };
  }
  const context = await fetchIssueContext(project, issue.iid);
  const mapped = (projectDirs ?? []).find((m) => normProject(m.project) === normProject(project));
  const cwd = mapped?.dir && mapped.dir.trim() || scope?.cwd;
  const suitable = typeof cwd === "string" && cwd.trim() !== "";
  const prompt = buildPrompt(issue, project, cwd, context);
  try {
    if (!suitable) {
      return {
        kind: "warn",
        text: "\u65E0\u6CD5\u786E\u5B9A\u9879\u76EE\u5DE5\u4F5C\u76EE\u5F55\uFF08\u672A\u914D\u7F6E\u9879\u76EE\u2192\u6587\u4EF6\u5939\u6620\u5C04\uFF0C\u5F53\u524D\u4F1A\u8BDD\u4E5F\u6CA1\u6709\u5DE5\u4F5C\u76EE\u5F55\uFF09\u3002\u8BF7\u5230 \u8BBE\u7F6E \u2192 GitLab Issues \u914D\u7F6E\u9879\u76EE\u6587\u4EF6\u5939\uFF0C\u6216\u590D\u5236\u4E0B\u65B9\u63D0\u793A\u8BCD\u624B\u52A8\u53D1\u9001\u3002",
        prompt
      };
    }
    const workspaceId = resolveWorkspaceId(ctx, cwd);
    const sessionId = await sessions.create(workspaceId ? { workspaceId } : { cwd });
    if (typeof sessionId !== "string" || !sessionId) {
      return { kind: "err", text: "\u521B\u5EFA\u4F1A\u8BDD\u5931\u8D25\uFF08\u672A\u8FD4\u56DE sessionId\uFF09" };
    }
    registerIssueSession(project, issue.iid, sessionId);
    const session = sessions.binding?.(sessionId)?.session;
    if (session && typeof session.prompt === "function") {
      await session.prompt([{ type: "text", text: prompt }], "queue");
      return { kind: "ok", text: `\u5DF2\u521B\u5EFA\u5F00\u53D1\u4F1A\u8BDD\u5E76\u81EA\u52A8\u542F\u52A8\u4EFB\u52A1 \xB7 #${issue.iid}`, sessionId };
    }
    return { kind: "warn", text: "\u5DF2\u521B\u5EFA\u4F1A\u8BDD\uFF0C\u4F46\u672A\u80FD\u81EA\u52A8\u53D1\u9001\u4EFB\u52A1\uFF08\u8BF7\u590D\u5236\u63D0\u793A\u8BCD\u624B\u52A8\u53D1\u9001\uFF09", prompt, sessionId };
  } catch (e) {
    return { kind: "err", text: "\u521B\u5EFA\u5931\u8D25\uFF1A" + String(e && e.message || e) };
  }
}

// src/client/use-panel.ts
var import_react = require("react");

// src/client/state.ts
var refreshSignal = {
  listeners: /* @__PURE__ */ new Set(),
  subscribe(fn) {
    refreshSignal.listeners.add(fn);
    return () => {
      refreshSignal.listeners.delete(fn);
    };
  },
  notify() {
    for (const fn of [...refreshSignal.listeners]) {
      try {
        fn();
      } catch {
      }
    }
  }
};

// src/client/use-panel.ts
function usePanel(active = true) {
  const [settings, setSettings] = (0, import_react.useState)(null);
  const [state, setState] = (0, import_react.useState)({ loading: true, data: null, error: null });
  const loadIssues = (0, import_react.useCallback)((project) => {
    setState((prev) => ({ loading: true, data: prev.data, error: null }));
    const q = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" }).then((r) => r.json()).then((json) => {
      setState({
        loading: false,
        data: json,
        error: json.ok ? null : json.message || "\u67E5\u8BE2\u5931\u8D25"
      });
    }).catch((e) => {
      setState({ loading: false, data: null, error: String(e && e.message || e) });
    });
  }, []);
  const loadSettings = (0, import_react.useCallback)(() => {
    fetch("/gitlab-tools/settings", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (!json || json.ok !== true) return;
      setSettings((prev) => {
        const next = {
          defaultProject: json.defaultProject ?? "",
          refreshMs: json.refreshMs ?? 12e4,
          projectDirs: json.projectDirs ?? []
        };
        if (prev && prev.defaultProject === next.defaultProject && prev.refreshMs === next.refreshMs && JSON.stringify(prev.projectDirs) === JSON.stringify(next.projectDirs)) {
          return prev;
        }
        return next;
      });
    }).catch(() => {
    });
  }, []);
  const refreshMsRef = (0, import_react.useRef)(12e4);
  refreshMsRef.current = settings?.refreshMs ?? 12e4;
  (0, import_react.useEffect)(() => {
    if (!active) return;
    loadSettings();
    loadIssues();
    let timer;
    const schedule = () => {
      timer = window.setTimeout(() => {
        loadSettings();
        loadIssues();
        schedule();
      }, refreshMsRef.current);
    };
    schedule();
    const dispose = refreshSignal.subscribe(() => {
      loadSettings();
      loadIssues();
    });
    return () => {
      if (timer !== void 0) window.clearTimeout(timer);
      dispose();
    };
  }, [active, loadIssues, loadSettings]);
  return { settings, state, loadIssues };
}

// src/client/format.ts
function fmtRelative(iso) {
  if (iso === void 0 || iso === null || iso === "") return "\u2014";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "\u2014";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "\u521A\u521A";
  if (m < 60) return `${m} \u5206\u949F\u524D`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} \u5C0F\u65F6\u524D`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} \u5929\u524D`;
  return new Date(iso).toLocaleDateString();
}
function fmtCount(n) {
  if (n === void 0 || n === null || !Number.isFinite(n)) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

// src/client/theme.ts
var C = {
  label1: "var(--dsw-alias-label-primary)",
  label2: "var(--dsw-alias-label-secondary)",
  label3: "var(--dsw-alias-label-tertiary)",
  caption: "var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary))",
  border: "var(--dsw-alias-border-l2)",
  borderThin: "var(--dsw-alias-border-l1)",
  surface: "var(--dsw-alias-bg-overlay)",
  layer2: "var(--dsw-alias-bg-layer-2)",
  hover: "var(--dsw-alias-interactive-bg-hover)",
  input: "var(--dsw-alias-bg-base)",
  ok: "var(--dsw-alias-state-success-primary, #46a758)",
  warn: "var(--dsw-alias-state-warn-primary, #f5a524)",
  err: "var(--dsw-alias-state-error-primary, #e5484d)",
  brand: "var(--dsw-brand-accent, #fc6d26)"
  // GitLab orange; readable on both themes
};
var headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderBottom: `1px solid ${C.borderThin}`,
  flex: "none"
};
var iconBtnStyle = {
  flex: "none",
  width: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  background: "transparent",
  color: C.label2,
  fontSize: "13px",
  lineHeight: "1"
};
var listStyle = {
  overflowY: "auto",
  flex: "1 1 auto",
  minHeight: "0",
  padding: "4px"
};
var metaStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px 8px",
  marginTop: "3px",
  fontSize: "11px",
  lineHeight: "16px",
  color: C.label3
};
function labelChipStyle(l) {
  const hex = (v) => v && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : void 0;
  return {
    padding: "0 5px",
    borderRadius: "4px",
    background: hex(l.color) ?? C.layer2,
    color: hex(l.text_color) ?? C.label2,
    fontSize: "10px",
    lineHeight: "15px",
    whiteSpace: "nowrap"
  };
}
var hintStyle = {
  padding: "12px",
  fontSize: "12px",
  lineHeight: "18px",
  color: C.label3
};
var inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "6px 8px",
  fontSize: "12px",
  lineHeight: "16px",
  color: C.label1,
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: "6px"
};
var noticeStyle = {
  margin: "4px 8px 0",
  padding: "8px",
  borderRadius: "8px",
  background: C.layer2,
  border: `1px solid ${C.borderThin}`,
  flex: "none"
};
var miniBtnStyle = {
  padding: "3px 8px",
  fontSize: "11px",
  lineHeight: "15px",
  borderRadius: "5px",
  cursor: "pointer",
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.label2
};
var rootPanelStyle = {
  boxSizing: "border-box",
  height: "100%",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: C.label1,
  fontFamily: "var(--ds-font-family, inherit)"
};
var avatarStyle = {
  flex: "none",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: 600,
  color: C.surface,
  background: C.brand
};
var primaryBtnStyle = {
  padding: "5px 12px",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: 500,
  borderRadius: "6px",
  cursor: "pointer",
  border: "none",
  background: C.brand,
  color: C.surface
};
var ghostBtnStyle = {
  padding: "5px 12px",
  fontSize: "12px",
  lineHeight: "16px",
  borderRadius: "6px",
  cursor: "pointer",
  border: `1px solid ${C.border}`
};
var rowDevBtnStyle = {
  flex: "none",
  width: "28px",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0",
  border: `1px solid ${C.border}`,
  borderRadius: "7px",
  cursor: "pointer",
  background: C.surface,
  color: C.brand,
  boxShadow: "0 1px 2px rgba(0,0,0,0.12)"
};

// src/client/issue-card.tsx
var import_react3 = require("react");

// src/client/use-session-stats.ts
var import_react2 = require("react");
function useSessionStats(sessionId, enabled = true, intervalMs = 3e3) {
  const [stats, setStats] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const refresh = (0, import_react2.useCallback)(() => {
    if (!sessionId) return;
    fetch(`/gitlab-tools/session/stats?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setStats(json);
        setError(null);
      } else {
        setError(json && json.message || "\u8BFB\u53D6\u4F1A\u8BDD\u7EDF\u8BA1\u5931\u8D25");
      }
    }).catch((e) => setError(String(e && e.message || e)));
  }, [sessionId]);
  (0, import_react2.useEffect)(() => {
    if (!enabled || !sessionId) return;
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, sessionId, intervalMs, refresh]);
  return { stats, error, refresh };
}

// src/client/issue-card.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function IssueCard({ issue, project, active, onOpen, onDevSession, isRunning, onOpenSession, onStopSession }) {
  const [hover, setHover] = (0, import_react3.useState)(false);
  const session = getIssueSession(project, issue.iid);
  const { stats } = useSessionStats(session?.sessionId, Boolean(session) && active);
  const running = session ? stats ? stats.running : isRunning(session.sessionId) : false;
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "\u672A\u6307\u6D3E";
  const statusColor = running ? C.ok : C.label3;
  const statusText = running ? "\u5F00\u53D1\u4E2D" : "\u5DF2\u7ED3\u675F";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        display: "flex",
        flexDirection: "column",
        margin: "0 0 6px",
        borderRadius: "8px",
        border: `1px solid ${hover ? C.border : C.borderThin}`,
        background: hover ? C.hover : C.surface,
        boxSizing: "border-box",
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            title: `${issue.title}
\u67E5\u770B\u8BE6\u60C5\u4E0E\u8BA8\u8BBA`,
            onClick: () => onOpen(issue),
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 10px 6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: C.label1,
              font: "inherit"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: "12.5px", lineHeight: "18px", fontWeight: 600, color: C.label1 }, children: issue.title || `(untitled #${issue.iid})` }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: metaStyle, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }, children: [
                  "#",
                  issue.iid,
                  " \xB7 ",
                  assignee
                ] }),
                issue.labels.slice(0, 3).map((l) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: labelChipStyle(l), children: l.name }, l.name)),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { marginLeft: "auto", whiteSpace: "nowrap" }, children: [
                  "\u66F4\u65B0 ",
                  fmtRelative(issue.updated_at)
                ] })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 8px 6px",
              borderTop: `1px solid ${C.borderThin}`,
              background: C.layer2
            },
            children: [
              session ? running ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  title: "\u505C\u6B62\u5F00\u53D1\u4F1A\u8BDD",
                  "aria-label": "\u505C\u6B62\u5F00\u53D1\u4F1A\u8BDD",
                  onClick: () => onStopSession(session.sessionId),
                  style: { ...rowDevBtnStyle, background: C.err, borderColor: C.err, color: "#fff" },
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StopMark, { size: 13 })
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  title: "\u6253\u5F00/\u7EE7\u7EED\u5F00\u53D1\u4F1A\u8BDD",
                  "aria-label": "\u6253\u5F00\u5F00\u53D1\u4F1A\u8BDD",
                  onClick: () => onOpenSession(session.sessionId),
                  style: { ...rowDevBtnStyle, color: C.brand },
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DevSessionMark, { size: 13 })
                }
              ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  title: `\u521B\u5EFA\u5F00\u53D1\u4F1A\u8BDD\uFF08\u5B9E\u73B0 issue #${issue.iid}\uFF09`,
                  "aria-label": "\u521B\u5EFA\u5F00\u53D1\u4F1A\u8BDD",
                  onClick: () => onDevSession(issue),
                  style: { ...rowDevBtnStyle, background: C.brand, borderColor: C.brand, color: "#fff" },
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DevSessionMark, { size: 13 })
                }
              ),
              session ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "4px 10px",
                    fontSize: "10.5px",
                    lineHeight: "15px",
                    color: C.label2,
                    flex: "1",
                    minWidth: "0"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { width: "7px", height: "7px", borderRadius: "50%", background: statusColor, display: "inline-block" } }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: statusColor, fontWeight: 600 }, children: statusText })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { whiteSpace: "nowrap" }, children: [
                      "\u2B06 ",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: C.label1 }, children: fmtCount(stats?.inputTokens) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { whiteSpace: "nowrap" }, children: [
                      "\u2B07 ",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: C.label1 }, children: fmtCount(stats?.outputTokens) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { whiteSpace: "nowrap", color: C.label1 }, children: [
                      "\u03A3 ",
                      fmtCount(stats?.totalTokens)
                    ] }),
                    stats?.tokensPerSec != null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { whiteSpace: "nowrap", color: C.brand }, children: [
                      "~",
                      stats.tokensPerSec.toFixed(1),
                      " tok/s"
                    ] }) : null
                  ]
                }
              ) : null
            ]
          }
        )
      ]
    }
  );
}

// src/client/issue-list.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function IssueList({ state, project, active, onOpen, onDevSession, isRunning, onOpenSession, onStopSession }) {
  const issues = state.data?.ok ? state.data.issues ?? [] : [];
  const errorText = state.error || (state.data && !state.data.ok ? state.data.message || null : null);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { ...listStyle, padding: "8px" }, children: errorText ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: hintStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: C.err, fontWeight: 500 }, children: errorText }),
    state.data?.code === "no_project" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: "4px" }, children: "\u8BF7\u5230 \u8BBE\u7F6E \u2192 GitLab Issues \u914D\u7F6E\u9879\u76EE\u3002" }) : null
  ] }) : issues.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: hintStyle, children: state.loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6CA1\u6709\u6253\u5F00\u7684 issue\u3002" }) : issues.map((i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    IssueCard,
    {
      issue: i,
      project,
      active,
      onOpen,
      onDevSession,
      isRunning,
      onOpenSession,
      onStopSession
    },
    i.iid
  )) });
}

// src/client/issue-detail.tsx
var import_react5 = require("react");

// src/client/use-issue-detail.ts
var import_react4 = require("react");
function useIssueDetail(project, iid) {
  const [state, setState] = (0, import_react4.useState)({ loading: true, issue: null, notes: [], error: null });
  const [posting, setPosting] = (0, import_react4.useState)(false);
  const [postError, setPostError] = (0, import_react4.useState)(null);
  const load = (0, import_react4.useCallback)(() => {
    if (!project || !iid) {
      setState({ loading: false, issue: null, notes: [], error: "\u7F3A\u5C11\u9879\u76EE\u6216 issue \u7F16\u53F7" });
      return;
    }
    setState((p) => ({ ...p, loading: true, error: null }));
    const qp = `project=${encodeURIComponent(project)}&iid=${iid}`;
    Promise.all([
      fetch(`/gitlab-tools/issue?${qp}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/gitlab-tools/issue/notes?${qp}`, { cache: "no-store" }).then((r) => r.json())
    ]).then(([i, n]) => {
      setState({
        loading: false,
        issue: i.ok ? i.issue : null,
        notes: n.ok ? n.notes ?? [] : [],
        error: !i.ok ? i.message || "\u52A0\u8F7D\u5931\u8D25" : !n.ok ? n.message || "\u52A0\u8F7D\u5931\u8D25" : null
      });
    }).catch((e) => setState({ loading: false, issue: null, notes: [], error: String(e && e.message || e) }));
  }, [project, iid]);
  (0, import_react4.useEffect)(() => {
    load();
  }, [load]);
  const post = (0, import_react4.useCallback)(
    async (text) => {
      const t = text.trim();
      if (!project || !iid || !t) return "\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A";
      setPosting(true);
      setPostError(null);
      try {
        const res = await fetch(`/gitlab-tools/issue/notes?project=${encodeURIComponent(project)}&iid=${iid}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: t })
        });
        const json = await res.json();
        if (!json.ok) {
          const msg = json.message || "\u8BC4\u8BBA\u5931\u8D25";
          setPostError(msg);
          return msg;
        }
        load();
        return null;
      } catch (e) {
        const msg = String(e && e.message || e);
        setPostError(msg);
        return msg;
      } finally {
        setPosting(false);
      }
    },
    [project, iid, load]
  );
  return { state, posting, postError, load, post };
}

// src/client/sanitize-html.ts
var SAFE_TAGS = /* @__PURE__ */ new Set([
  "p",
  "br",
  "code",
  "span",
  "strong",
  "em",
  "del",
  "b",
  "i",
  "a",
  "ul",
  "ol",
  "li",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr"
]);
function sanitizeSystemHtml(html) {
  return html.replace(/<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g, (m, close, tag, attrs, selfclose) => {
    if (!SAFE_TAGS.has(tag.toLowerCase())) return "";
    let keep = "";
    const attrRe = /([a-zA-Z0-9-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let am;
    while (am = attrRe.exec(attrs)) {
      const name = am[1].toLowerCase();
      const val = (am[2] ?? am[3] ?? am[4] ?? "").replace(/"/g, "");
      if (name === "class") keep += ` class="${val}"`;
      else if (name === "href") {
        const v = val.trim().toLowerCase();
        if (/^(https?:|mailto:|#|\/)/.test(v)) keep += ` href="${val}"`;
      } else if (name === "title") keep += ` title="${val}"`;
    }
    return `<${close}${tag}${keep}${selfclose}>`;
  });
}

// src/client/markdown.ts
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function linkify(s, links) {
  if (!links) return s;
  return s.replace(
    /(?<![\w!])!(\d+)/g,
    (m, n) => links.base ? `<a href="${links.base}/-/merge_requests/${n}">!${n}</a>` : m
  ).replace(
    /(?<![\w#])#(\d+)/g,
    (m, n) => links.base ? `<a href="${links.base}/-/issues/${n}">#${n}</a>` : m
  ).replace(
    /(?<![\w@])@([\w.-]+)/g,
    (m, u) => links.origin ? `<a href="${links.origin}/${u}">@${u}</a>` : m
  );
}
function inlineMd(s, links) {
  return s.split(/(`[^`\n]+`)/g).map((p) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
      return `<code>${p.slice(1, -1)}</code>`;
    }
    return linkify(p, links).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/~~([^~]+)~~/g, "<del>$1</del>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  }).join("");
}
function renderMarkdown(md, links) {
  const out = [];
  for (const raw of md.split(/\n{2,}/)) {
    const block = raw.trimEnd();
    if (!block.trim()) continue;
    const fence = block.match(/^```(\w*)\s*\n([\s\S]*?)\n```\s*$/);
    if (fence) {
      out.push(`<pre><code>${escapeHtml(fence[2])}</code></pre>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(block.trim())) {
      out.push("<hr/>");
      continue;
    }
    const h = block.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inlineMd(escapeHtml(h[2]), links)}</h${h[1].length}>`);
      continue;
    }
    if (/^>/.test(block)) {
      out.push(`<blockquote>${inlineMd(escapeHtml(block.replace(/^>\s?/gm, "")), links)}</blockquote>`);
      continue;
    }
    const ul = block.match(/^\s*[-*+]\s+/);
    const ol = block.match(/^\s*\d+[.)]\s+/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      const items = block.split(/\n/).map((l) => l.trim()).filter((l) => ul ? /^[-*+]\s+/.test(l) : /^\d+[.)]\s+/.test(l)).map((l) => `<li>${inlineMd(escapeHtml(l.replace(/^\s*[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "")), links)}</li>`);
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    out.push(`<p>${inlineMd(escapeHtml(block), links)}</p>`);
  }
  return out.join("\n");
}
function renderSystemNote(body, links) {
  if (/<[a-zA-Z][^>]*>/.test(body)) {
    return sanitizeSystemHtml(body);
  }
  return renderMarkdown(body, links);
}
var mdCssInjected = false;
function ensureMarkdownCss() {
  if (mdCssInjected || typeof document === "undefined") return;
  mdCssInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-gt-md", "1");
  style.textContent = [
    ".gt-md{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word}",
    ".gt-md p{margin:0 0 8px}",
    ".gt-md h1,.gt-md h2,.gt-md h3,.gt-md h4,.gt-md h5,.gt-md h6{font-weight:600;line-height:1.4;margin:0 0 6px;color:var(--dsw-alias-label-primary)}",
    ".gt-md h1{font-size:15px}.gt-md h2{font-size:14px}.gt-md h3{font-size:13px}",
    ".gt-md pre{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:8px;overflow-x:auto;margin:0 0 8px;font-size:11px;line-height:16px}",
    ".gt-md code{font-family:var(--ds-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 3px;font-size:11px}",
    ".gt-md pre code{background:transparent;border:none;padding:0}",
    ".gt-md ul,.gt-md ol{margin:0 0 8px;padding-left:18px}",
    ".gt-md li{margin:2px 0}",
    ".gt-md a{color:var(--dsw-brand-accent,#fc6d26);text-decoration:none}",
    ".gt-md blockquote{margin:0 0 8px;padding:2px 10px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}",
    ".gt-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:8px 0}",
    ".gt-md del{color:var(--dsw-alias-label-tertiary)}",
    // GitLab system-note diff markup (title-change etc.)
    ".gt-md .idiff.deletion{color:#f85149;text-decoration:line-through}",
    ".gt-md .idiff.addition{color:#3fb950;font-weight:600}"
  ].join("");
  document.head.appendChild(style);
}

// src/client/note-row.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function NoteRow({ note, links }) {
  const author = note.author?.username ?? (note.system ? "\u7CFB\u7EDF" : "\u533F\u540D");
  const initial = (author[0] || "?").toUpperCase();
  const html = note.system ? renderSystemNote(note.body, links) : renderMarkdown(note.body, links);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: "8px", padding: "6px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: avatarStyle, children: initial }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { flex: "1", minWidth: "0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: "11.5px", fontWeight: 600, color: C.label1 }, children: author }),
        note.system ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: "10px", color: C.brand }, children: "\u7CFB\u7EDF" }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: "10px", color: C.caption }, children: fmtRelative(note.created_at) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          className: "gt-md",
          style: { marginTop: "2px" },
          dangerouslySetInnerHTML: { __html: html }
        }
      )
    ] })
  ] });
}

// src/client/issue-detail.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function IssueDetailView({ project, iid, onBack }) {
  const { state, posting, postError, load, post } = useIssueDetail(project, iid);
  const [draft, setDraft] = (0, import_react5.useState)("");
  (0, import_react5.useEffect)(() => {
    ensureMarkdownCss();
  }, []);
  const issue = state.issue;
  const links = (() => {
    const w = issue?.web_url;
    if (!w) return void 0;
    const i = w.indexOf("/-/");
    const base = i > 0 ? w.slice(0, i) : w;
    const m = /^(https?:\/\/[^/]+)/.exec(w);
    return { base, origin: m ? m[1] : "" };
  })();
  const submit = async () => {
    if (posting || !draft.trim()) return;
    const err = await post(draft);
    if (!err) setDraft("");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: rootPanelStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "4px", padding: "5px 8px", borderBottom: `1px solid ${C.borderThin}`, flex: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", title: "\u8FD4\u56DE\u5217\u8868", onClick: onBack, style: iconBtnStyle, children: "\u2190" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: "12px", fontWeight: 600, color: C.label1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1", minWidth: "0" }, children: issue ? issue.title : `#${iid}` }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: "10.5px", color: C.caption, whiteSpace: "nowrap" }, children: project }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", title: "\u5237\u65B0\u8BE6\u60C5\u4E0E\u8BA8\u8BBA", onClick: load, style: iconBtnStyle, children: "\u27F3" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { flex: "1", minHeight: "0", overflowY: "auto" }, children: state.loading && !issue ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: hintStyle, children: "\u52A0\u8F7D\u4E2D\u2026" }) : state.error && !issue ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { ...hintStyle, color: C.err }, children: state.error }) : issue ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "8px 10px", borderBottom: `1px solid ${C.borderThin}` }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: "13px", lineHeight: "19px", fontWeight: 600, color: C.label1 }, children: issue.title }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { ...metaStyle, marginTop: "4px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }, children: [
            "#",
            issue.iid,
            " \xB7 ",
            issue.state
          ] }),
          issue.labels.slice(0, 5).map((l) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: labelChipStyle(l), children: l.name }, l.name)),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { color: C.caption, whiteSpace: "nowrap" }, children: [
            "\u4F5C\u8005 @",
            issue.author?.username ?? "?"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { color: C.caption, whiteSpace: "nowrap" }, children: [
            "\u6307\u6D3E ",
            issue.assignees.length ? issue.assignees.map((a) => `@${a.username}`).join(", ") : "\u65E0"
          ] })
        ] }),
        issue.milestone ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { fontSize: "11px", color: C.caption, marginTop: "2px" }, children: [
          "\u91CC\u7A0B\u7891\uFF1A",
          issue.milestone.title
        ] }) : null,
        issue.web_url ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "a",
          {
            href: issue.web_url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: { fontSize: "11px", color: C.brand, textDecoration: "none", marginTop: "4px", display: "inline-block" },
            children: "\u5728 GitLab \u6253\u5F00 \u2197"
          }
        ) : null
      ] }),
      issue.description ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "8px 10px", borderBottom: `1px solid ${C.borderThin}` }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: "11px", color: C.caption, marginBottom: "4px" }, children: "\u63CF\u8FF0" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "gt-md", dangerouslySetInnerHTML: { __html: renderMarkdown(issue.description, links) } })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "8px 10px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { fontSize: "11px", color: C.caption, marginBottom: "4px" }, children: [
          "\u8BA8\u8BBA \xB7 ",
          state.notes.length
        ] }),
        state.notes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: "12px", color: C.label3 }, children: "\u8FD8\u6CA1\u6709\u8BC4\u8BBA\u3002" }) : state.notes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NoteRow, { note: n, links }, n.id))
      ] })
    ] }) : null }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { flex: "none", padding: "8px", borderTop: `1px solid ${C.borderThin}` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "textarea",
        {
          value: draft,
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          },
          placeholder: "\u5199\u8BC4\u8BBA\uFF08\u652F\u6301 Markdown\uFF1B\u2318/Ctrl+Enter \u53D1\u9001\uFF09",
          rows: 3,
          style: { ...inputStyle, resize: "vertical" }
        }
      ),
      postError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: C.err, fontSize: "11px", marginTop: "4px" }, children: postError }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: "10.5px", color: C.caption, alignSelf: "center" }, children: "\u4F60\u7684\u8BC4\u8BBA\u4EE5\u914D\u7F6E\u8D26\u53F7\u53D1\u5E03\uFF1BAI \u8BC4\u8BBA\u8D70\u4E13\u5C5E Service Account\uFF08\u82E5\u5DF2\u914D\u7F6E\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => void submit(), disabled: posting || !draft.trim(), style: primaryBtnStyle, children: posting ? "\u53D1\u9001\u4E2D\u2026" : "\u53D1\u8868\u8BC4\u8BBA" })
      ] })
    ] })
  ] });
}

// src/client/dev-notice.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var NOTICE_COLOR = { ok: C.ok, warn: C.warn, err: C.err };
function DevNoticePanel({ notice, onClose, onOpenSession }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: noticeStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", gap: "6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "span",
        {
          style: {
            flex: "1",
            minWidth: "0",
            fontSize: "11px",
            lineHeight: "16px",
            color: NOTICE_COLOR[notice.kind]
          },
          children: notice.text
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", title: "\u5173\u95ED", onClick: onClose, style: iconBtnStyle, children: "\u2715" })
    ] }),
    notice.prompt ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          marginTop: "6px",
          fontSize: "11px",
          lineHeight: "15px",
          color: C.label3,
          background: C.input,
          borderRadius: "6px",
          padding: "6px 8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: "120px",
          overflowY: "auto"
        },
        children: notice.prompt
      }
    ) : null,
    notice.prompt || notice.sessionId ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: "6px", marginTop: "6px" }, children: [
      notice.prompt ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            if (notice.prompt) navigator.clipboard?.writeText(notice.prompt).catch(() => {
            });
          },
          style: miniBtnStyle,
          children: "\u590D\u5236\u63D0\u793A\u8BCD"
        }
      ) : null,
      notice.sessionId ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", onClick: onOpenSession, style: miniBtnStyle, children: "\u6253\u5F00\u4F1A\u8BDD" }) : null
    ] }) : null
  ] });
}

// src/client/tab.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function GitLabIssuesTab({ ctx, scope, visible }) {
  const { settings, state, loadIssues } = usePanel(visible);
  const [notice, setNotice] = (0, import_react6.useState)(null);
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [selected, setSelected] = (0, import_react6.useState)(null);
  const [runningById, setRunningById] = (0, import_react6.useState)({});
  const project = state.data?.ok ? state.data.project : settings?.defaultProject;
  const count = state.data?.ok ? (state.data.issues ?? []).length : 0;
  (0, import_react6.useEffect)(() => {
    const sessions = ctx?.get?.("sessions");
    const feed = sessions?.list;
    if (!feed || typeof feed.subscribe !== "function" || typeof feed.getSnapshot !== "function") return;
    const update = () => {
      const snap = feed.getSnapshot();
      const next = {};
      for (const [id, s] of Object.entries(snap?.byId ?? {})) {
        if (s && s.running === true) next[id] = true;
      }
      setRunningById(next);
    };
    update();
    return feed.subscribe(update);
  }, [ctx]);
  const isRunning = (0, import_react6.useCallback)((sessionId) => runningById[sessionId] === true, [runningById]);
  const onOpenSession = (0, import_react6.useCallback)((sessionId) => {
    ctx?.get?.("sessions")?.open?.(sessionId);
  }, [ctx]);
  const onStopSession = (0, import_react6.useCallback)(async (sessionId) => {
    try {
      const res = await fetch(`/gitlab-tools/session/stop?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST" });
      const json = await res.json();
      setNotice({ kind: json?.stopped ? "ok" : "warn", text: json?.message || (json?.stopped ? "\u5DF2\u505C\u6B62\u5F00\u53D1\u4F1A\u8BDD" : "\u505C\u6B62\u5931\u8D25") });
    } catch (e) {
      setNotice({ kind: "err", text: "\u505C\u6B62\u5931\u8D25\uFF1A" + String(e && e.message || e) });
    }
  }, []);
  const onDevSession = (0, import_react6.useCallback)(
    async (issue) => {
      if (busy) return;
      setBusy(true);
      try {
        const n = await createDevSession(ctx, scope, issue, project, settings?.projectDirs);
        setNotice(n);
      } finally {
        setBusy(false);
      }
    },
    [busy, ctx, scope, project, settings]
  );
  const openNoticeSession = (0, import_react6.useCallback)(() => {
    if (!notice?.sessionId) return;
    const sessions = ctx?.get?.("sessions");
    sessions?.open?.(notice.sessionId);
  }, [notice, ctx]);
  const onOpen = (0, import_react6.useCallback)(
    (issue) => {
      setSelected({ project: project ?? "", iid: issue.iid });
    },
    [project]
  );
  if (selected) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IssueDetailView, { project: selected.project, iid: selected.iid, onBack: () => setSelected(null) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: rootPanelStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: headerStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: C.brand }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IssueMark, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600, lineHeight: "18px", color: C.label1 }, children: "GitLab Issues" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontSize: "11px", color: C.label3, fontVariantNumeric: "tabular-nums" }, children: state.loading ? "\u5237\u65B0\u4E2D\u2026" : count }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", title: "\u7ACB\u5373\u5237\u65B0", onClick: () => loadIssues(), style: iconBtnStyle, children: "\u27F3" })
    ] }),
    notice ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(DevNoticePanel, { notice, onClose: () => setNotice(null), onOpenSession: openNoticeSession }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      IssueList,
      {
        state,
        project,
        active: Boolean(visible),
        onOpen,
        onDevSession,
        isRunning,
        onOpenSession,
        onStopSession
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          padding: "6px 10px",
          borderTop: `1px solid ${C.borderThin}`,
          fontSize: "10.5px",
          lineHeight: "14px",
          color: C.caption,
          flex: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        },
        children: [
          project || "\u672A\u914D\u7F6E\u9879\u76EE",
          state.data?.updatedAt ? ` \xB7 \u66F4\u65B0\u4E8E ${fmtRelative(state.data.updatedAt)}` : ""
        ]
      }
    )
  ] });
}

// src/client/settings.tsx
var import_react7 = require("react");

// src/client/token-fields.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function TokenField({ title, value, configured, placeholder, clear, clearLabel, onChange, onClearChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "input",
      {
        type: "password",
        autoComplete: "new-password",
        spellCheck: false,
        placeholder,
        value,
        onChange: (e) => {
          onChange(e.target.value);
          if (e.target.value) onClearChange(false);
        },
        style: inputStyle
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "input",
        {
          type: "checkbox",
          checked: clear,
          onChange: (e) => onClearChange(e.target.checked)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: clearLabel })
    ] })
  ] });
}

// src/client/settings.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function SettingsCard() {
  const [cfg, setCfg] = (0, import_react7.useState)({
    defaultProject: "",
    host: "",
    token: "",
    clearToken: false,
    aiToken: "",
    clearAiToken: false,
    refreshMs: 12e4,
    projectDirs: []
  });
  const [status, setStatus] = (0, import_react7.useState)({
    loading: true,
    saving: false,
    msg: null,
    configured: false,
    tokenConfigured: false,
    aiTokenConfigured: false,
    test: null
  });
  const load = (0, import_react7.useCallback)(() => {
    fetch("/gitlab-tools/status", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      setStatus((prev) => ({ ...prev, loading: false, configured: !!(json && json.ok === true && json.configured) }));
    }).catch(() => setStatus((prev) => ({ ...prev, loading: false })));
    fetch("/gitlab-tools/settings", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setCfg((prev) => ({
          ...prev,
          // 必须保留 token/aiToken/clearToken/clearAiToken 等未回显字段，否则保存时 .trim() 崩溃
          defaultProject: json.defaultProject ?? prev.defaultProject,
          host: json.host ?? prev.host,
          refreshMs: json.refreshMs ?? prev.refreshMs,
          projectDirs: Array.isArray(json.projectDirs) ? json.projectDirs : prev.projectDirs
        }));
        setStatus((prev) => ({
          ...prev,
          tokenConfigured: json.tokenConfigured === true,
          aiTokenConfigured: json.aiTokenConfigured === true
        }));
      }
    }).catch(() => {
    });
  }, []);
  (0, import_react7.useEffect)(() => {
    load();
  }, [load]);
  const onSave = () => {
    setStatus((prev) => ({ ...prev, saving: true, msg: null }));
    const payload = {
      defaultProject: (cfg.defaultProject || "").trim(),
      host: (cfg.host || "").trim(),
      refreshMs: cfg.refreshMs,
      projectDirs: cfg.projectDirs.map((r) => ({ project: (r.project || "").trim(), dir: (r.dir || "").trim() })).filter((r) => r.project && r.dir)
    };
    if (cfg.clearToken) {
      payload.token = "";
    } else if ((cfg.token || "").trim()) {
      payload.token = (cfg.token || "").trim();
    }
    if (cfg.clearAiToken) {
      payload.aiToken = "";
    } else if ((cfg.aiToken || "").trim()) {
      payload.aiToken = (cfg.aiToken || "").trim();
    }
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 1e4);
    fetch("/gitlab-tools/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl.signal
    }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setStatus((prev) => ({ ...prev, saving: false, msg: "\u5DF2\u4FDD\u5B58\u5E76\u70ED\u751F\u6548\uFF08\u65E0\u9700\u91CD\u542F\uFF09" }));
        refreshSignal.notify();
      } else {
        setStatus((prev) => ({ ...prev, saving: false, msg: json && json.message || "\u4FDD\u5B58\u5931\u8D25" }));
      }
    }).catch((e) => {
      const timedOut = e && e.name === "AbortError";
      setStatus((prev) => ({
        ...prev,
        saving: false,
        msg: "\u4FDD\u5B58\u5931\u8D25\uFF1A" + (timedOut ? "\u8BF7\u6C42\u8D85\u65F6\uFF0810s\uFF09\uFF0C\u8BF7\u91CD\u8BD5" : String(e && e.message || e))
      }));
    }).finally(() => window.clearTimeout(timer));
  };
  const onTest = () => {
    setStatus((prev) => ({ ...prev, test: null }));
    const q = cfg.defaultProject.trim() ? `?project=${encodeURIComponent(cfg.defaultProject.trim())}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setStatus((prev) => ({ ...prev, test: { ok: true, text: `\u8FDE\u63A5\u6B63\u5E38\uFF1A${json.issues?.length ?? 0} \u4E2A\u6253\u5F00\u4E2D issue` } }));
      } else {
        setStatus((prev) => ({ ...prev, test: { ok: false, text: json && json.message || "\u67E5\u8BE2\u5931\u8D25" } }));
      }
    }).catch((e) => setStatus((prev) => ({ ...prev, test: { ok: false, text: String(e && e.message || e) } })));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { color: C.brand }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(IssueMark, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontWeight: 600, fontSize: "13px", lineHeight: "20px", color: C.label1 }, children: "GitLab Issues \xB7 \u4FA7\u8FB9\u680F" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: "11px", lineHeight: "16px", color: status.configured ? C.ok : C.err }, children: status.loading ? "\u2026" : status.configured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E host/token" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { fontSize: "11px", lineHeight: "16px", color: C.label3 }, children: "\u670D\u52A1\u5668\u5730\u5740\uFF08host\uFF09\u5B58 settings\uFF1B\u8BBF\u95EE\u4EE4\u724C\uFF08token\uFF09\u5B58 DSH \u5B98\u65B9\u51ED\u636E\u5B58\u50A8 \uFF08~/.dsh/.credentials.yaml\uFF0C600 \u6743\u9650\uFF09\uFF0C\u53EA\u5199\u4E0D\u56DE\u663E\u660E\u6587\u3002\u7559\u7A7A\u4E14\u672A\u52FE\u9009 \u300C\u6E05\u9664\u300D\u5219\u4FDD\u6301\u4E0D\u53D8\uFF1B\u672A\u8BBE\u7F6E/\u88AB\u6E05\u9664\u65F6\u56DE\u843D profile patch config \u91CC\u7684\u503C\u3002 \u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\uFF08\u65E0\u9700\u91CD\u542F\uFF09\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "\u670D\u52A1\u5668\u5730\u5740\uFF08GitLab base URL\uFF0C\u542B\u7AEF\u53E3\uFF0C\u5982 https://gitlab.example.com:8443\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "input",
        {
          type: "text",
          autoComplete: "off",
          spellCheck: false,
          placeholder: "https://gitlab.example.com:8443",
          value: cfg.host,
          onChange: (e) => setCfg((prev) => ({ ...prev, host: e.target.value })),
          style: inputStyle
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      TokenField,
      {
        title: "\u8BBF\u95EE\u4EE4\u724C\uFF08Personal Access Token\uFF1B\u53EA\u5199\u4E0D\u56DE\u663E\uFF09",
        value: cfg.token,
        configured: status.tokenConfigured,
        placeholder: status.tokenConfigured ? "\u5DF2\u8BBE\u7F6E\uFF08\u8F93\u5165\u65B0\u503C\u8986\u76D6\uFF1B\u7559\u7A7A\u4E0D\u53D8\uFF09" : "\u672A\u8BBE\u7F6E\uFF08\u8F93\u5165 token\uFF09",
        clear: cfg.clearToken,
        clearLabel: "\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684 token\uFF08\u56DE\u843D profile patch config\uFF09",
        onChange: (v) => setCfg((prev) => ({ ...prev, token: v })),
        onClearChange: (c) => setCfg((prev) => ({ ...prev, clearToken: c }))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      TokenField,
      {
        title: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_jsx_runtime9.Fragment, { children: "AI \u4E13\u5C5E token\uFF08DeepSeek Harness \u8EAB\u4EFD\uFF0C\u53EF\u9009\uFF09\u2014\u2014 agent \u5DE5\u5177\uFF08\u542B gitlab_create_note\uFF09\u7528\u5B83\u53D1\u5E03\uFF0C \u4E0E\u4F60\u7684\u8EAB\u4EFD\u533A\u5206\uFF1B\u9700\u4F7F\u7528\u4E3A AI \u5EFA\u7684 Service Account \u7684 PAT\uFF08scope \u81F3\u5C11 api\uFF09" }),
        value: cfg.aiToken,
        configured: status.aiTokenConfigured,
        placeholder: status.aiTokenConfigured ? "\u5DF2\u8BBE\u7F6E\uFF08\u8F93\u5165\u65B0\u503C\u8986\u76D6\uFF1B\u7559\u7A7A\u4E0D\u53D8\uFF09" : "\u672A\u8BBE\u7F6E\uFF08\u8F93\u5165 Service Account \u7684 PAT\uFF09",
        clear: cfg.clearAiToken,
        clearLabel: "\u6E05\u9664 AI \u4E13\u5C5E token\uFF08\u56DE\u843D profile patch config\uFF09",
        onChange: (v) => setCfg((prev) => ({ ...prev, aiToken: v })),
        onClearChange: (c) => setCfg((prev) => ({ ...prev, clearAiToken: c }))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "\u9ED8\u8BA4\u9879\u76EE\uFF08path_with_namespace\uFF0C\u5982 group/project\uFF1B\u7559\u7A7A\u5219\u4E0D\u5C55\u793A\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "input",
        {
          type: "text",
          autoComplete: "off",
          spellCheck: false,
          placeholder: "group/project",
          value: cfg.defaultProject,
          onChange: (e) => setCfg((prev) => ({ ...prev, defaultProject: e.target.value })),
          style: inputStyle
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "\u9762\u677F\u81EA\u52A8\u5237\u65B0\u95F4\u9694" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "select",
        {
          value: cfg.refreshMs,
          onChange: (e) => setCfg((prev) => ({ ...prev, refreshMs: Number(e.target.value) })),
          style: inputStyle,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: 3e4, children: "30 \u79D2" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: 6e4, children: "1 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: 12e4, children: "2 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: 3e5, children: "5 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: 6e5, children: "10 \u5206\u949F" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: "\u9879\u76EE \u2192 \u672C\u5730\u6587\u4EF6\u5939\u6620\u5C04" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: "10.5px", lineHeight: "15px", color: C.caption }, children: "\u521B\u5EFA\u5F00\u53D1\u4F1A\u8BDD\u65F6\u6309\u6B64\u628A\u4F1A\u8BDD\u653E\u8FDB\u5BF9\u5E94\u9879\u76EE\u7684\u5DE5\u4F5C\u533A\u5206\u7EC4\uFF08\u5DE6\u4FA7\u586B\u9879\u76EE path\uFF0C\u5982 group/project\uFF1B\u53F3\u4FA7\u586B\u672C\u5730\u6587\u4EF6\u5939\u8DEF\u5F84\uFF09\u3002" }),
      cfg.projectDirs.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "input",
          {
            type: "text",
            autoComplete: "off",
            spellCheck: false,
            placeholder: "group/project",
            value: row.project,
            onChange: (e) => setCfg((prev) => {
              const next = [...prev.projectDirs];
              next[i] = { ...next[i], project: e.target.value };
              return { ...prev, projectDirs: next };
            }),
            style: { ...inputStyle, flex: "1 1 45%", minWidth: "0" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "input",
          {
            type: "text",
            autoComplete: "off",
            spellCheck: false,
            placeholder: "/absolute/path/to/repo",
            value: row.dir,
            onChange: (e) => setCfg((prev) => {
              const next = [...prev.projectDirs];
              next[i] = { ...next[i], dir: e.target.value };
              return { ...prev, projectDirs: next };
            }),
            style: { ...inputStyle, flex: "1 1 45%", minWidth: "0" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "button",
          {
            type: "button",
            title: "\u5220\u9664\u8BE5\u6620\u5C04",
            "aria-label": "\u5220\u9664\u8BE5\u6620\u5C04",
            onClick: () => setCfg((prev) => ({ ...prev, projectDirs: prev.projectDirs.filter((_, j) => j !== i) })),
            style: { ...ghostBtnStyle, background: "transparent", color: C.err, flex: "none" },
            children: "\u2715"
          }
        )
      ] }, i)),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "button",
        {
          type: "button",
          onClick: () => setCfg((prev) => ({ ...prev, projectDirs: [...prev.projectDirs, { project: "", dir: "" }] })),
          style: { ...ghostBtnStyle, background: "transparent", color: C.label2, alignSelf: "flex-start" },
          children: "+ \u6DFB\u52A0\u6620\u5C04"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "button",
        {
          type: "button",
          onClick: onSave,
          disabled: status.saving,
          style: { ...ghostBtnStyle, background: C.surface, color: C.label1 },
          children: status.saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "button",
        {
          type: "button",
          onClick: onTest,
          style: { ...ghostBtnStyle, background: "transparent", color: C.label2 },
          children: "\u6D4B\u8BD5\u8FDE\u63A5"
        }
      ),
      status.msg ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: "11px", color: C.label3 }, children: status.msg }) : null
    ] }),
    status.test ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { fontSize: "11px", lineHeight: "16px", color: status.test.ok ? C.ok : C.err }, children: status.test.text }) : null
  ] });
}

// src/client/index.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var inject = ["slots"];
var TAB_DESCRIPTOR = {
  id: "gitlab-tools:issues",
  title: "GitLab Issues",
  icon: (size) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IssueMark, { size }),
  order: 60,
  single: true,
  component: GitLabIssuesTab
};
function registerIssuesTab(ctx) {
  const tryRegister = () => {
    const bs = ctx.get("betterSidebar");
    if (bs && typeof bs.registerTab === "function") {
      try {
        bs.registerTab(TAB_DESCRIPTOR);
        return true;
      } catch (e) {
        console.error("[gitlab-tools] betterSidebar registerTab failed:", e);
      }
    }
    return false;
  };
  if (tryRegister()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (tryRegister() || tries >= 20) window.clearInterval(timer);
  }, 500);
}
function apply(ctx) {
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: "gitlab-tools",
        order: 210,
        label: "GitLab Issues"
      },
      SettingsCard
    )
  );
  registerIssuesTab(ctx);
}
return module.exports; } });
