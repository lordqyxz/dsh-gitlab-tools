// Issue list surface: one row per issue + the list container.
// The tab root renders this; clicking a row opens the inline detail view.

import { useState } from "react";
import { DevSessionMark } from "./icons";
import { fmtRelative } from "./format";
import { C, chipStyle, hintStyle, listStyle, metaStyle, rowDevBtnStyle } from "./theme";
import type { Issue, PanelState } from "./types";

function IssueRow({ issue, onOpen, onDevSession }: {
  issue: Issue;
  onOpen: (issue: Issue) => void;
  onDevSession: (issue: Issue) => void;
}) {
  const [hover, setHover] = useState(false);
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 6px 6px 8px",
        margin: "0 0 2px",
        borderRadius: "6px",
        background: hover ? C.hover : "transparent",
      }}
    >
      <button
        type="button"
        title={`${issue.title}\n查看详情与讨论`}
        onClick={() => onOpen(issue)}
        style={{
          flex: "1 1 auto",
          minWidth: "0",
          textAlign: "left",
          padding: "0",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: C.label1,
          font: "inherit",
        }}
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
      <button
        type="button"
        title={`创建开发会话（实现 issue #${issue.iid}）`}
        aria-label="创建开发会话"
        onClick={() => onDevSession(issue)}
        style={{ ...rowDevBtnStyle, opacity: hover ? 1 : 0.55 }}
      >
        <DevSessionMark size={14} />
      </button>
    </div>
  );
}

export function IssueList({ state, onOpen, onDevSession }: {
  state: PanelState;
  onOpen: (issue: Issue) => void;
  onDevSession: (issue: Issue) => void;
}) {
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
        issues.map((i) => <IssueRow key={i.iid} issue={i} onOpen={onOpen} onDevSession={onDevSession} />)
      )}
    </div>
  );
}
