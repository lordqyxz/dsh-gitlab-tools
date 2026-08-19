// The better-sidebar tab root for GitLab Issues (same level as explorer / git /
// subagent / terminal). Renders the issue list, a create-dev-session notice, and
// switches to the inline detail view when a row is opened.

import { useCallback, useEffect, useState } from "react";
import { createDevSession } from "./devsession";
import { usePanel } from "./use-panel";
import { IssueMark } from "./icons";
import { fmtRelative } from "./format";
import { C, headerStyle, iconBtnStyle, rootPanelStyle } from "./theme";
import { IssueList } from "./issue-list";
import { IssueDetailView } from "./issue-detail";
import { DevNoticePanel } from "./dev-notice";
import type { DevNotice, Issue } from "./types";

/** dsh-better-sidebar tab component (same level as explorer/git/subagent/terminal). */
export function GitLabIssuesTab({ ctx, scope, visible }: {
  ctx: { get?: (name: string) => unknown };
  scope: { sessionId?: string; cwd?: string } | undefined;
  visible?: boolean;
}) {
  const { settings, state, loadIssues } = usePanel(visible);
  const [notice, setNotice] = useState<DevNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ project: string; iid: number } | null>(null);
  const [runningById, setRunningById] = useState<Record<string, boolean>>({});
  const project = state.data?.ok ? state.data.project : settings?.defaultProject;
  const count = state.data?.ok ? (state.data.issues ?? []).length : 0;

  // Mirror the sessions list feed → a sessionId→running map (live agent status).
  useEffect(() => {
    const sessions = ctx?.get?.("sessions") as
      | { list?: { getSnapshot?: () => unknown; subscribe?: (fn: () => void) => () => void } }
      | undefined;
    const feed = sessions?.list;
    if (!feed || typeof feed.subscribe !== "function" || typeof feed.getSnapshot !== "function") return;
    const update = () => {
      const snap = feed.getSnapshot() as { byId?: Record<string, { running?: boolean }> } | null | undefined;
      const next: Record<string, boolean> = {};
      for (const [id, s] of Object.entries(snap?.byId ?? {})) {
        if (s && s.running === true) next[id] = true;
      }
      setRunningById(next);
    };
    update();
    return feed.subscribe(update);
  }, [ctx]);

  const isRunning = useCallback((sessionId: string) => runningById[sessionId] === true, [runningById]);

  const onOpenSession = useCallback((sessionId: string) => {
    ctx?.get?.("sessions")?.open?.(sessionId);
  }, [ctx]);

  const onStopSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/gitlab-tools/session/stop?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST" });
      const json = await res.json();
      setNotice({ kind: json?.stopped ? "ok" : "warn", text: json?.message || (json?.stopped ? "已停止开发会话" : "停止失败") });
    } catch (e) {
      setNotice({ kind: "err", text: "停止失败：" + String((e && (e as Error).message) || e) });
    }
  }, []);

  const onDevSession = useCallback(
    async (issue: Issue) => {
      if (busy) return;
      setBusy(true);
      try {
        const n = await createDevSession(ctx, scope, issue, project);
        setNotice(n);
      } finally {
        setBusy(false);
      }
    },
    [busy, ctx, scope, project]
  );

  const openNoticeSession = useCallback(() => {
    if (!notice?.sessionId) return;
    const sessions = ctx?.get?.("sessions");
    sessions?.open?.(notice.sessionId);
  }, [notice, ctx]);

  const onOpen = useCallback(
    (issue: Issue) => {
      setSelected({ project: project ?? "", iid: issue.iid });
    },
    [project]
  );

  if (selected) {
    return <IssueDetailView project={selected.project} iid={selected.iid} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={rootPanelStyle}>
      <div style={headerStyle}>
        <span style={{ color: C.brand }}>
          <IssueMark size={14} />
        </span>
        <span style={{ fontSize: "12.5px", fontWeight: 600, lineHeight: "18px", color: C.label1 }}>GitLab Issues</span>
        <span style={{ fontSize: "11px", color: C.label3, fontVariantNumeric: "tabular-nums" }}>
          {state.loading ? "刷新中…" : count}
        </span>
        <button type="button" title="立即刷新" onClick={() => loadIssues()} style={iconBtnStyle}>⟳</button>
      </div>

      {notice ? (
        <DevNoticePanel notice={notice} onClose={() => setNotice(null)} onOpenSession={openNoticeSession} />
      ) : null}

      <IssueList
        state={state}
        project={project}
        active={Boolean(visible)}
        onOpen={onOpen}
        onDevSession={onDevSession}
        isRunning={isRunning}
        onOpenSession={onOpenSession}
        onStopSession={onStopSession}
      />

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
        {state.data?.updatedAt ? ` · 更新于 ${fmtRelative(state.data.updatedAt)}` : ""}
      </div>
    </div>
  );
}
