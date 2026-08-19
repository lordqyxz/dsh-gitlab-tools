// Issue list surface: a vertical stack of issue cards (see issue-card.tsx),
// plus the loading/empty/error states.

import { IssueCard } from "./issue-card";
import { hintStyle, listStyle, C } from "./theme";
import type { Issue, PanelState } from "./types";

export function IssueList({ state, project, active, onOpen, onDevSession, isRunning, onOpenSession, onStopSession }: {
  state: PanelState;
  project?: string;
  active: boolean;
  onOpen: (issue: Issue) => void;
  onDevSession: (issue: Issue) => void;
  isRunning: (sessionId: string) => boolean;
  onOpenSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
}) {
  const issues = state.data?.ok ? state.data.issues ?? [] : [];
  const errorText = state.error || (state.data && !state.data.ok ? state.data.message || null : null);
  return (
    <div style={{ ...listStyle, padding: "8px" }}>
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
        issues.map((i) => (
          <IssueCard
            key={i.iid}
            issue={i}
            project={project}
            active={active}
            onOpen={onOpen}
            onDevSession={onDevSession}
            isRunning={isRunning}
            onOpenSession={onOpenSession}
            onStopSession={onStopSession}
          />
        ))
      )}
    </div>
  );
}
