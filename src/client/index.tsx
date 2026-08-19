// dsh-gitlab-tools — client half (browser bundle).
// Two additive surfaces, no shipped UI displaced:
//   1. dsh-better-sidebar tab → a "GitLab Issues" activity-bar tab (same level
//      as explorer / git / subagent / terminal / browser), registered through
//      the better-sidebar service (`ctx.get('betterSidebar').registerTab`).
//   2. settings.section       → a "GitLab Issues" settings page (defaultProject,
//      refreshMs) persisted through the plugin's own /gitlab-tools/settings route.
// Every byte of GitLab data arrives through the host proxy routes — the token
// never leaves the server (same pattern as dsh-ark-quota / dsh-config-sync).
//
// All colors use the DSH design-system alias tokens (--dsw-alias-*) so the UI
// follows the active theme (light / dark). Only tokens that EXIST in
// dsh-client-ui-theme/styles/design-platform.css are referenced — undefined
// tokens (bg-elevated / track-bg) with dark fallbacks are what broke light mode.
//
// Built to lib/client.js by scripts/build.mjs (esbuild); platform modules (react,
// react/jsx-runtime) resolve from the loader module table and are never inlined.

import { useCallback, useEffect, useRef, useState } from "react";

type Issue = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  assignees: { username: string; name?: string }[];
  author: { username: string; name?: string } | null;
  milestone: { title: string } | null;
  confidential: boolean;
};

type SettingsResp = {
  ok: boolean;
  defaultProject?: string;
  host?: string;
  refreshMs?: number;
  configured?: boolean;
  code?: string;
  message?: string;
};

type IssuesResp = {
  ok: boolean;
  code?: string;
  message?: string;
  project?: string;
  issues?: Issue[];
  updatedAt?: number;
};

type PanelState = {
  loading: boolean;
  data: IssuesResp | null;
  error: string | null;
};

/** Module-scope fan-out: settings saves push every mounted surface to reload. */
const refreshSignal = {
  listeners: new Set<() => void>(),
  subscribe(fn: () => void) {
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
        /* keep other listeners alive */
      }
    }
  },
};

function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}

/** Minimal issue/thread glyph (circle outline + dot) — used as the tab icon + headers. */
function IssueMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ flex: "none", display: "block" }}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Shared data hook: settings (refresh interval) + issue list, with polling + save
 * fan-out. `active` pauses everything while the surface is hidden (e.g. the
 * better-sidebar tab collapsed/backgrounded) and resumes on becoming visible.
 */
function usePanel(active = true) {
  const [settings, setSettings] = useState<{ defaultProject: string; refreshMs: number } | null>(null);
  const [state, setState] = useState<PanelState>({ loading: true, data: null, error: null });

  const loadIssues = useCallback((project?: string) => {
    setState((prev) => ({ loading: true, data: prev.data, error: null }));
    const q = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: IssuesResp) => {
        setState({
          loading: false,
          data: json,
          error: json.ok ? null : json.message || "查询失败",
        });
      })
      .catch((e) => {
        setState({ loading: false, data: null, error: String((e && e.message) || e) });
      });
  }, []);

  const loadSettings = useCallback(() => {
    fetch("/gitlab-tools/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: SettingsResp) => {
        if (!json || json.ok !== true) return;
        setSettings((prev) => {
          const next = { defaultProject: json.defaultProject ?? "", refreshMs: json.refreshMs ?? 120000 };
          if (prev && prev.defaultProject === next.defaultProject && prev.refreshMs === next.refreshMs) {
            return prev; // same reference → React bails out, no re-render loop
          }
          return next;
        });
      })
      .catch(() => {
        /* settings are optional; surface still renders from defaults */
      });
  }, []);

  const refreshMsRef = useRef(120000);
  refreshMsRef.current = settings?.refreshMs ?? 120000;

  useEffect(() => {
    if (!active) return; // hidden surface: no fetch, no poll
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

// ---- styling tokens (DSH design system aliases; all exist in design-platform.css
// and flip with body[data-ds-dark-theme], so this is light- and dark-adaptive). ----
const C = {
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
  brand: "var(--dsw-brand-accent, #fc6d26)", // GitLab orange; readable on both themes
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderBottom: `1px solid ${C.borderThin}`,
  flex: "none",
};

const iconBtnStyle: React.CSSProperties = {
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
  lineHeight: "1",
};

const listStyle: React.CSSProperties = {
  overflowY: "auto",
  flex: "1 1 auto",
  minHeight: "0",
  padding: "4px",
};

const rowBaseStyle: React.CSSProperties = {
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
  font: "inherit",
};

const metaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px 8px",
  marginTop: "3px",
  fontSize: "11px",
  lineHeight: "16px",
  color: C.label3,
};

const chipStyle: React.CSSProperties = {
  padding: "0 5px",
  borderRadius: "4px",
  background: C.layer2,
  color: C.label2,
  fontSize: "10px",
  lineHeight: "15px",
  whiteSpace: "nowrap",
};

const hintStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "12px",
  lineHeight: "18px",
  color: C.label3,
};

const inputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: "6px 8px",
  fontSize: "12px",
  lineHeight: "16px",
  color: C.label1,
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: "6px",
};

function IssueRow({ issue }: { issue: Issue }) {
  const [hover, setHover] = useState(false);
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  return (
    <button
      type="button"
      title={`${issue.title}\n打开: ${issue.web_url}`}
      onClick={() => window.open(issue.web_url, "_blank", "noopener,noreferrer")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...rowBaseStyle, background: hover ? C.hover : "transparent" }}
    >
      <div style={{ fontSize: "12.5px", lineHeight: "18px", fontWeight: 500, color: C.label1 }}>
        {issue.title || `(untitled #${issue.iid})`}
      </div>
      <div style={metaStyle}>
        <span style={{ color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }}>
          #{issue.iid} · {assignee}
        </span>
        {issue.labels.slice(0, 3).map((l) => (
          <span key={l} style={chipStyle}>
            {l}
          </span>
        ))}
        <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>更新 {fmtRelative(issue.updated_at)}</span>
      </div>
    </button>
  );
}

/** The issue list body shared by the sidebar tab (and any future surface). */
function IssueList({ state, project }: { state: PanelState; project?: string }) {
  const issues = state.data?.ok ? state.data.issues ?? [] : [];
  const errorText = state.error || (state.data && !state.data.ok ? state.data.message || null : null);
  return (
    <div style={listStyle}>
      {errorText ? (
        <div style={hintStyle}>
          <div style={{ color: C.err, fontWeight: 500 }}>{errorText}</div>
          {state.data?.code === "no_project" ? (
            <div style={{ marginTop: "4px" }}>请到 设置 → GitLab Issues 配置项目。</div>
          ) : null}
        </div>
      ) : issues.length === 0 ? (
        <div style={hintStyle}>{state.loading ? "加载中…" : "没有打开的 issue。"}</div>
      ) : (
        issues.map((i) => <IssueRow key={i.iid} issue={i} />)
      )}
    </div>
  );
}

// ---- dsh-better-sidebar tab (the primary surface; replaces the old floating overlay) ----
const tabRootStyle: React.CSSProperties = {
  boxSizing: "border-box",
  height: "100%",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: C.label1,
  fontFamily: "var(--ds-font-family, inherit)",
};

function GitLabIssuesTab({ visible }: { visible: boolean }) {
  const { settings, state, loadIssues } = usePanel(visible);
  const project = state.data?.ok ? state.data.project : settings?.defaultProject;
  const count = state.data?.ok ? (state.data.issues ?? []).length : 0;
  return (
    <div style={tabRootStyle}>
      <div style={headerStyle}>
        <span style={{ color: C.brand }}>
          <IssueMark size={14} />
        </span>
        <span style={{ fontSize: "12.5px", fontWeight: 600, lineHeight: "18px", color: C.label1 }}>GitLab Issues</span>
        <span style={{ fontSize: "11px", color: C.label3, fontVariantNumeric: "tabular-nums" }}>
          {state.loading ? "刷新中…" : count}
        </span>
        <button type="button" title="立即刷新" onClick={() => loadIssues()} style={iconBtnStyle}>
          ⟳
        </button>
      </div>
      <IssueList state={state} project={project} />
      <div
        style={{
          padding: "6px 10px",
          borderTop: `1px solid ${C.borderThin}`,
          fontSize: "10.5px",
          lineHeight: "14px",
          color: C.caption,
          flex: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {project || "未配置项目"}
        {state.data?.updatedAt ? ` · 更新于 ${fmtRelative(new Date(state.data.updatedAt).toISOString())}` : ""}
      </div>
    </div>
  );
}

// ---- settings page ----

function SettingsCard() {
  const [cfg, setCfg] = useState({ defaultProject: "", host: "", refreshMs: 120000 });
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    msg: null as string | null,
    configured: false,
    test: null as string | null,
  });

  const load = useCallback(() => {
    fetch("/gitlab-tools/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setStatus((prev) => ({ ...prev, loading: false, configured: !!(json && json.ok === true && json.configured) }));
      })
      .catch(() => setStatus((prev) => ({ ...prev, loading: false })));
    fetch("/gitlab-tools/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true) {
          setCfg((prev) => ({
            defaultProject: json.defaultProject ?? prev.defaultProject,
            host: json.host ?? prev.host,
            refreshMs: json.refreshMs ?? prev.refreshMs,
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = () => {
    setStatus((prev) => ({ ...prev, saving: true, msg: null }));
    fetch("/gitlab-tools/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultProject: cfg.defaultProject.trim(), host: cfg.host.trim(), refreshMs: cfg.refreshMs }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true) {
          setStatus((prev) => ({ ...prev, saving: false, msg: "已保存并热生效（无需重启）" }));
          refreshSignal.notify();
        } else {
          setStatus((prev) => ({ ...prev, saving: false, msg: (json && json.message) || "保存失败" }));
        }
      })
      .catch((e) => {
        setStatus((prev) => ({ ...prev, saving: false, msg: "保存失败：" + String((e && e.message) || e) }));
      });
  };

  const onTest = () => {
    setStatus((prev) => ({ ...prev, test: null }));
    const q = cfg.defaultProject.trim() ? `?project=${encodeURIComponent(cfg.defaultProject.trim())}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true) {
          setStatus((prev) => ({ ...prev, test: `连接正常：${json.issues?.length ?? 0} 个打开中 issue` }));
        } else {
          setStatus((prev) => ({ ...prev, test: (json && json.message) || "查询失败" }));
        }
      })
      .catch((e) => setStatus((prev) => ({ ...prev, test: String((e && e.message) || e) })));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: C.brand }}>
          <IssueMark size={16} />
        </span>
        <span style={{ fontWeight: 600, fontSize: "13px", lineHeight: "20px", color: C.label1 }}>GitLab Issues · 侧边栏</span>
        <span style={{ fontSize: "11px", lineHeight: "16px", color: status.configured ? C.ok : C.err }}>
          {status.loading ? "…" : status.configured ? "已配置" : "未配置 host/token"}
        </span>
      </div>

      <div style={{ fontSize: "11px", lineHeight: "16px", color: C.label3 }}>
        服务器地址（host）在此配置，保存后立即生效（无需重启）；token 仍在 profile patch 的
        gitlab-tools config 里配置（不会下发到浏览器）。侧边栏的 GitLab Issues 标签会自动刷新。
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>服务器地址（GitLab base URL，含端口，如 https://gitlab.example.com:8443）</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://gitlab.example.com:8443"
          value={cfg.host}
          onChange={(e) => setCfg((prev) => ({ ...prev, host: e.target.value }))}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>默认项目（path_with_namespace，如 group/project；留空则不展示）</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="group/project"
          value={cfg.defaultProject}
          onChange={(e) => setCfg((prev) => ({ ...prev, defaultProject: e.target.value }))}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>面板自动刷新间隔</span>
        <select
          value={cfg.refreshMs}
          onChange={(e) => setCfg((prev) => ({ ...prev, refreshMs: Number(e.target.value) }))}
          style={inputStyle}
        >
          <option value={30000}>30 秒</option>
          <option value={60000}>1 分钟</option>
          <option value={120000}>2 分钟</option>
          <option value={300000}>5 分钟</option>
          <option value={600000}>10 分钟</option>
        </select>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={status.saving}
          style={{
            padding: "5px 12px",
            fontSize: "12px",
            lineHeight: "16px",
            borderRadius: "6px",
            cursor: "pointer",
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.label1,
          }}
        >
          {status.saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onTest}
          style={{
            padding: "5px 12px",
            fontSize: "12px",
            lineHeight: "16px",
            borderRadius: "6px",
            cursor: "pointer",
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.label2,
          }}
        >
          测试连接
        </button>
        {status.msg ? <span style={{ fontSize: "11px", color: C.label3 }}>{status.msg}</span> : null}
      </div>

      {status.test ? (
        <div style={{ fontSize: "11px", lineHeight: "16px", color: status.test.startsWith("连接正常") ? C.ok : C.err }}>
          {status.test}
        </div>
      ) : null}
    </div>
  );
}

// ---- plugin entry ----
const inject = ["slots"];

/** dsh-better-sidebar tab descriptor (same level as explorer/git/subagent/terminal/browser). */
const TAB_DESCRIPTOR = {
  id: "gitlab-tools:issues",
  title: "GitLab Issues",
  icon: (size: number) => <IssueMark size={size} />,
  order: 60,
  single: true,
  component: GitLabIssuesTab,
};

function registerIssuesTab(ctx: { get: (name: string) => unknown }) {
  const tryRegister = () => {
    const bs = ctx.get("betterSidebar") as { registerTab?: (d: unknown) => void } | null | undefined;
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
  // better-sidebar applies before us in the boot graph, but retry briefly as a
  // safety net for future load-order changes; the settings page stays up either way.
  if (tryRegister()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (tryRegister() || tries >= 20) window.clearInterval(timer);
  }, 500);
}

function apply(ctx: { slots: { inject: (name: string, factory: () => unknown) => unknown }; get: (name: string) => unknown }) {
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "gitlab-tools",
        order: 210,
        label: "GitLab Issues",
      },
      SettingsCard
    )
  );
  registerIssuesTab(ctx);
}

export { apply, inject };
