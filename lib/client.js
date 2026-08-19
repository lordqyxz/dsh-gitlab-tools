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
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
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
function fmtRelative(iso) {
  if (!iso) return "\u2014";
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
        const next = { defaultProject: json.defaultProject ?? "", refreshMs: json.refreshMs ?? 12e4 };
        if (prev && prev.defaultProject === next.defaultProject && prev.refreshMs === next.refreshMs) {
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
    const timer = window.setInterval(() => {
      loadSettings();
      loadIssues();
    }, refreshMsRef.current);
    const dispose = refreshSignal.subscribe(() => {
      loadSettings();
      loadIssues();
    });
    return () => {
      window.clearInterval(timer);
      dispose();
    };
  }, [active, loadIssues, loadSettings]);
  return { settings, state, loadIssues };
}
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
var rowBaseStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 8px",
  margin: "0 0 2px",
  border: "none",
  borderRadius: "6px",
  background: "transparent",
  cursor: "pointer",
  color: C.label1,
  font: "inherit"
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
var chipStyle = {
  padding: "0 5px",
  borderRadius: "4px",
  background: C.layer2,
  color: C.label2,
  fontSize: "10px",
  lineHeight: "15px",
  whiteSpace: "nowrap"
};
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
function IssueRow({ issue }) {
  const [hover, setHover] = (0, import_react.useState)(false);
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "\u672A\u6307\u6D3E";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      title: `${issue.title}
\u6253\u5F00: ${issue.web_url}`,
      onClick: () => window.open(issue.web_url, "_blank", "noopener,noreferrer"),
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: { ...rowBaseStyle, background: hover ? C.hover : "transparent" },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "12.5px", lineHeight: "18px", fontWeight: 500, color: C.label1 }, children: issue.title || `(untitled #${issue.iid})` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: metaStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }, children: [
            "#",
            issue.iid,
            " \xB7 ",
            assignee
          ] }),
          issue.labels.slice(0, 3).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: chipStyle, children: l }, l)),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { marginLeft: "auto", whiteSpace: "nowrap" }, children: [
            "\u66F4\u65B0 ",
            fmtRelative(issue.updated_at)
          ] })
        ] })
      ]
    }
  );
}
function IssueList({ state, project }) {
  const issues = state.data?.ok ? state.data.issues ?? [] : [];
  const errorText = state.error || (state.data && !state.data.ok ? state.data.message || null : null);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: listStyle, children: errorText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: hintStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: C.err, fontWeight: 500 }, children: errorText }),
    state.data?.code === "no_project" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: "4px" }, children: "\u8BF7\u5230 \u8BBE\u7F6E \u2192 GitLab Issues \u914D\u7F6E\u9879\u76EE\u3002" }) : null
  ] }) : issues.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: state.loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6CA1\u6709\u6253\u5F00\u7684 issue\u3002" }) : issues.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssueRow, { issue: i }, i.iid)) });
}
var tabRootStyle = {
  boxSizing: "border-box",
  height: "100%",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: C.label1,
  fontFamily: "var(--ds-font-family, inherit)"
};
function GitLabIssuesTab({ visible }) {
  const { settings, state, loadIssues } = usePanel(visible);
  const project = state.data?.ok ? state.data.project : settings?.defaultProject;
  const count = state.data?.ok ? (state.data.issues ?? []).length : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: tabRootStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: headerStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.brand }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssueMark, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "12.5px", fontWeight: 600, lineHeight: "18px", color: C.label1 }, children: "GitLab Issues" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: C.label3, fontVariantNumeric: "tabular-nums" }, children: state.loading ? "\u5237\u65B0\u4E2D\u2026" : count }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: "\u7ACB\u5373\u5237\u65B0", onClick: () => loadIssues(), style: iconBtnStyle, children: "\u27F3" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssueList, { state, project }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
          state.data?.updatedAt ? ` \xB7 \u66F4\u65B0\u4E8E ${fmtRelative(new Date(state.data.updatedAt).toISOString())}` : ""
        ]
      }
    )
  ] });
}
function SettingsCard() {
  const [cfg, setCfg] = (0, import_react.useState)({ defaultProject: "", host: "", refreshMs: 12e4 });
  const [status, setStatus] = (0, import_react.useState)({
    loading: true,
    saving: false,
    msg: null,
    configured: false,
    test: null
  });
  const load = (0, import_react.useCallback)(() => {
    fetch("/gitlab-tools/status", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      setStatus((prev) => ({ ...prev, loading: false, configured: !!(json && json.ok === true && json.configured) }));
    }).catch(() => setStatus((prev) => ({ ...prev, loading: false })));
    fetch("/gitlab-tools/settings", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setCfg((prev) => ({
          defaultProject: json.defaultProject ?? prev.defaultProject,
          host: json.host ?? prev.host,
          refreshMs: json.refreshMs ?? prev.refreshMs
        }));
      }
    }).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const onSave = () => {
    setStatus((prev) => ({ ...prev, saving: true, msg: null }));
    fetch("/gitlab-tools/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultProject: cfg.defaultProject.trim(), host: cfg.host.trim(), refreshMs: cfg.refreshMs })
    }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setStatus((prev) => ({ ...prev, saving: false, msg: "\u5DF2\u4FDD\u5B58\u5E76\u70ED\u751F\u6548\uFF08\u65E0\u9700\u91CD\u542F\uFF09" }));
        refreshSignal.notify();
      } else {
        setStatus((prev) => ({ ...prev, saving: false, msg: json && json.message || "\u4FDD\u5B58\u5931\u8D25" }));
      }
    }).catch((e) => {
      setStatus((prev) => ({ ...prev, saving: false, msg: "\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(e && e.message || e) }));
    });
  };
  const onTest = () => {
    setStatus((prev) => ({ ...prev, test: null }));
    const q = cfg.defaultProject.trim() ? `?project=${encodeURIComponent(cfg.defaultProject.trim())}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" }).then((r) => r.json()).then((json) => {
      if (json && json.ok === true) {
        setStatus((prev) => ({ ...prev, test: `\u8FDE\u63A5\u6B63\u5E38\uFF1A${json.issues?.length ?? 0} \u4E2A\u6253\u5F00\u4E2D issue` }));
      } else {
        setStatus((prev) => ({ ...prev, test: json && json.message || "\u67E5\u8BE2\u5931\u8D25" }));
      }
    }).catch((e) => setStatus((prev) => ({ ...prev, test: String(e && e.message || e) })));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.brand }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssueMark, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: "13px", lineHeight: "20px", color: C.label1 }, children: "GitLab Issues \xB7 \u4FA7\u8FB9\u680F" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", lineHeight: "16px", color: status.configured ? C.ok : C.err }, children: status.loading ? "\u2026" : status.configured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E host/token" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", lineHeight: "16px", color: C.label3 }, children: "\u670D\u52A1\u5668\u5730\u5740\uFF08host\uFF09\u5728\u6B64\u914D\u7F6E\uFF0C\u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\uFF08\u65E0\u9700\u91CD\u542F\uFF09\uFF1Btoken \u4ECD\u5728 profile patch \u7684 gitlab-tools config \u91CC\u914D\u7F6E\uFF08\u4E0D\u4F1A\u4E0B\u53D1\u5230\u6D4F\u89C8\u5668\uFF09\u3002\u4FA7\u8FB9\u680F\u7684 GitLab Issues \u6807\u7B7E\u4F1A\u81EA\u52A8\u5237\u65B0\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u670D\u52A1\u5668\u5730\u5740\uFF08GitLab base URL\uFF0C\u542B\u7AEF\u53E3\uFF0C\u5982 https://gitlab.example.com:8443\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9ED8\u8BA4\u9879\u76EE\uFF08path_with_namespace\uFF0C\u5982 group/project\uFF1B\u7559\u7A7A\u5219\u4E0D\u5C55\u793A\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9762\u677F\u81EA\u52A8\u5237\u65B0\u95F4\u9694" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          value: cfg.refreshMs,
          onChange: (e) => setCfg((prev) => ({ ...prev, refreshMs: Number(e.target.value) })),
          style: inputStyle,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 3e4, children: "30 \u79D2" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 6e4, children: "1 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 12e4, children: "2 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 3e5, children: "5 \u5206\u949F" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 6e5, children: "10 \u5206\u949F" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: onSave,
          disabled: status.saving,
          style: {
            padding: "5px 12px",
            fontSize: "12px",
            lineHeight: "16px",
            borderRadius: "6px",
            cursor: "pointer",
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.label1
          },
          children: status.saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: onTest,
          style: {
            padding: "5px 12px",
            fontSize: "12px",
            lineHeight: "16px",
            borderRadius: "6px",
            cursor: "pointer",
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.label2
          },
          children: "\u6D4B\u8BD5\u8FDE\u63A5"
        }
      ),
      status.msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: C.label3 }, children: status.msg }) : null
    ] }),
    status.test ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", lineHeight: "16px", color: status.test.startsWith("\u8FDE\u63A5\u6B63\u5E38") ? C.ok : C.err }, children: status.test }) : null
  ] });
}
var inject = ["slots"];
var TAB_DESCRIPTOR = {
  id: "gitlab-tools:issues",
  title: "GitLab Issues",
  icon: (size) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssueMark, { size }),
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
