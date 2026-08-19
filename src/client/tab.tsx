// The better-sidebar tab root for GitLab Issues (same level as explorer / git /
// subagent / terminal). Renders the issue list, a create-dev-session notice, and
// switches to the inline detail view when a row is opened.

import { useCallback, useState } from "react";
import { createDevSession } from "./devsession";
import { usePanel } from "./hooks";
import { IssueMark } from "./icons";
import { fmtRelative } from "./format";
import { C, headerStyle, iconBtnStyle, miniBtnStyle, noticeStyle, rootPanelStyle } from "./theme";
import { IssueList } from "./issue-list";
import { IssueDetailView } from "./issue-detail";
import type { DevNotice, Issue } from "./types";

const NOTICE_COLOR: Record<DevNotice["kind"], string> = { ok: C.ok, warn: C.warn, err: C.err };

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
  const project = state.data?.ok ? state.data.project : settings?.defaultProject;
  const count = state.data?.ok ? (state.data.issues ?? []).length : 0;

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
        <div style={noticeStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
            <span
              style={{
                flex: "1",
                minWidth: "0",
                fontSize: "11px",
                lineHeight: "16px",
                color: NOTICE_COLOR[notice.kind],
              }}
            >
              {notice.text}
            </span>
            <button type="button" title="关闭" onClick={() => setNotice(null)} style={iconBtnStyle}>✕</button>
          </div>
          {notice.prompt ? (
            <div
              style={{
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
                overflowY: "auto",
              }}
            >
              {notice.prompt}
            </div>
          ) : null}
          {notice.prompt || notice.sessionId ? (
            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              {notice.prompt ? (
                <button
                  type="button"
                  onClick={() => {
                    if (notice.prompt) navigator.clipboard?.writeText(notice.prompt).catch(() => {});
                  }}
                  style={miniBtnStyle}
                >
                  复制提示词
                </button>
              ) : null}
              {notice.sessionId ? (
                <button type="button" onClick={openNoticeSession} style={miniBtnStyle}>
                  打开会话
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <IssueList state={state} onOpen={onOpen} onDevSession={onDevSession} />

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
