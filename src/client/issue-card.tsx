// One issue as a CARD. Top = clickable title + meta (opens the detail view).
// Bottom = a footer bar holding the dev-session action button AND the live
// stats strip, so start/stop + token usage are grouped at the bottom of the
// card and color-coded (green=running, gray=finished, red=stop, brand=start).

import { useState } from "react";
import { DevSessionMark, StopMark } from "./icons";
import { useSessionStats } from "./use-session-stats";
import { getIssueSession } from "./session-store";
import { fmtCount, fmtRelative } from "./format";
import { C, labelChipStyle, metaStyle, rowDevBtnStyle } from "./theme";
import type { Issue } from "./types";

export function IssueCard({ issue, project, active, onOpen, onDevSession, isRunning, onOpenSession, onStopSession }: {
  issue: Issue;
  project?: string;
  active: boolean;
  onOpen: (issue: Issue) => void;
  onDevSession: (issue: Issue) => void;
  isRunning: (sessionId: string) => boolean;
  onOpenSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const session = getIssueSession(project, issue.iid);
  const { stats } = useSessionStats(session?.sessionId, Boolean(session) && active);
  const running = session ? (stats ? stats.running : isRunning(session.sessionId)) : false;
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  const statusColor = running ? C.ok : C.label3;
  const statusText = running ? "开发中" : "已结束";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        margin: "0 0 6px",
        borderRadius: "8px",
        border: `1px solid ${hover ? C.border : C.borderThin}`,
        background: hover ? C.hover : C.surface,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header: clickable → open detail */}
      <button
        type="button"
        title={`${issue.title}\n查看详情与讨论`}
        onClick={() => onOpen(issue)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "8px 10px 6px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: C.label1,
          font: "inherit",
        }}
      >
        <div style={{ fontSize: "12.5px", lineHeight: "18px", fontWeight: 600, color: C.label1 }}>
          {issue.title || `(untitled #${issue.iid})`}
        </div>
        <div style={metaStyle}>
          <span style={{ color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }}>
            #{issue.iid} · {assignee}
          </span>
          {issue.labels.slice(0, 3).map((l) => (
            <span key={l.name} style={labelChipStyle(l)}>{l.name}</span>
          ))}
          <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>更新 {fmtRelative(issue.updated_at)}</span>
        </div>
      </button>

      {/* Footer (lighter than the content area): action button + live stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 8px 6px",
          borderTop: `1px solid ${C.borderThin}`,
          background: C.layer2,
        }}
      >
        {session ? (
          running ? (
            <button
              type="button"
              title="停止开发会话"
              aria-label="停止开发会话"
              onClick={() => onStopSession(session.sessionId)}
              style={{ ...rowDevBtnStyle, background: C.err, borderColor: C.err, color: "#fff" }}
            >
              <StopMark size={13} />
            </button>
          ) : (
            <button
              type="button"
              title="打开/继续开发会话"
              aria-label="打开开发会话"
              onClick={() => onOpenSession(session.sessionId)}
              style={{ ...rowDevBtnStyle, color: C.brand }}
            >
              <DevSessionMark size={13} />
            </button>
          )
        ) : (
          <button
            type="button"
            title={`创建开发会话（实现 issue #${issue.iid}）`}
            aria-label="创建开发会话"
            onClick={() => onDevSession(issue)}
            style={{ ...rowDevBtnStyle, background: C.brand, borderColor: C.brand, color: "#fff" }}
          >
            <DevSessionMark size={13} />
          </button>
        )}

        {session ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "4px 10px",
              fontSize: "10.5px",
              lineHeight: "15px",
              color: C.label2,
              flex: "1",
              minWidth: "0",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor, display: "inline-block" }} />
              <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
            </span>
            <span style={{ whiteSpace: "nowrap" }}>⬆ <span style={{ color: C.label1 }}>{fmtCount(stats?.inputTokens)}</span></span>
            <span style={{ whiteSpace: "nowrap" }}>⬇ <span style={{ color: C.label1 }}>{fmtCount(stats?.outputTokens)}</span></span>
            <span style={{ whiteSpace: "nowrap", color: C.label1 }}>Σ {fmtCount(stats?.totalTokens)}</span>
            {stats?.tokensPerSec != null ? (
              <span style={{ whiteSpace: "nowrap", color: C.brand }}>~{stats.tokensPerSec.toFixed(1)} tok/s</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
