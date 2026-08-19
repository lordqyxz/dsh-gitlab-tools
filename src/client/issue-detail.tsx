// Inline issue detail + discussion thread (no web jump): issue metadata,
// markdown description, the conversation as message rows, and a comment box.

import { useEffect, useState } from "react";
import { useIssueDetail } from "./use-issue-detail";
import { ensureMarkdownCss, renderMarkdown } from "./markdown";
import type { MdLinks } from "./markdown";
import { NoteRow } from "./note-row";
import {
  C,
  labelChipStyle,
  hintStyle,
  iconBtnStyle,
  inputStyle,
  metaStyle,
  primaryBtnStyle,
  rootPanelStyle,
} from "./theme";

/** Inline detail + discussion for one issue (no web jump). */
export function IssueDetailView({ project, iid, onBack }: {
  project: string;
  iid: number;
  onBack: () => void;
}) {
  const { state, posting, postError, load, post } = useIssueDetail(project, iid);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    ensureMarkdownCss();
  }, []);
  const issue = state.issue;
  // Derive link roots from the issue's own web URL so @/#/! refs can link out.
  const links: MdLinks | undefined = (() => {
    const w = issue?.web_url;
    if (!w) return undefined;
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
  return (
    <div style={rootPanelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 8px", borderBottom: `1px solid ${C.borderThin}`, flex: "none" }}>
        <button type="button" title="返回列表" onClick={onBack} style={iconBtnStyle}>←</button>
        <span style={{ fontSize: "12px", fontWeight: 600, color: C.label1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1", minWidth: "0" }}>
          {issue ? issue.title : `#${iid}`}
        </span>
        <span style={{ fontSize: "10.5px", color: C.caption, whiteSpace: "nowrap" }}>{project}</span>
        <button type="button" title="刷新详情与讨论" onClick={load} style={iconBtnStyle}>⟳</button>
      </div>

      <div style={{ flex: "1", minHeight: "0", overflowY: "auto" }}>
        {state.loading && !issue ? (
          <div style={hintStyle}>加载中…</div>
        ) : state.error && !issue ? (
          <div style={{ ...hintStyle, color: C.err }}>{state.error}</div>
        ) : issue ? (
          <>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.borderThin}` }}>
              <div style={{ fontSize: "13px", lineHeight: "19px", fontWeight: 600, color: C.label1 }}>{issue.title}</div>
              <div style={{ ...metaStyle, marginTop: "4px" }}>
                <span style={{ color: issue.state === "opened" ? C.ok : C.label3, whiteSpace: "nowrap" }}>
                  #{issue.iid} · {issue.state}
                </span>
                {issue.labels.slice(0, 5).map((l) => (
                  <span key={l.name} style={labelChipStyle(l)}>{l.name}</span>
                ))}
                <span style={{ color: C.caption, whiteSpace: "nowrap" }}>作者 @{issue.author?.username ?? "?"}</span>
                <span style={{ color: C.caption, whiteSpace: "nowrap" }}>
                  指派 {issue.assignees.length ? issue.assignees.map((a) => `@${a.username}`).join(", ") : "无"}
                </span>
              </div>
              {issue.milestone ? (
                <div style={{ fontSize: "11px", color: C.caption, marginTop: "2px" }}>里程碑：{issue.milestone.title}</div>
              ) : null}
              {issue.web_url ? (
                <a
                  href={issue.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "11px", color: C.brand, textDecoration: "none", marginTop: "4px", display: "inline-block" }}
                >
                  在 GitLab 打开 ↗
                </a>
              ) : null}
            </div>

            {issue.description ? (
              <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.borderThin}` }}>
                <div style={{ fontSize: "11px", color: C.caption, marginBottom: "4px" }}>描述</div>
                <div className="gt-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.description, links) }} />
              </div>
            ) : null}

            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontSize: "11px", color: C.caption, marginBottom: "4px" }}>讨论 · {state.notes.length}</div>
              {state.notes.length === 0 ? (
                <div style={{ fontSize: "12px", color: C.label3 }}>还没有评论。</div>
              ) : (
                state.notes.map((n) => <NoteRow key={n.id} note={n} links={links} />)
              )}
            </div>
          </>
        ) : null}
      </div>

      <div style={{ flex: "none", padding: "8px", borderTop: `1px solid ${C.borderThin}` }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="写评论（支持 Markdown；⌘/Ctrl+Enter 发送）"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        {postError ? <div style={{ color: C.err, fontSize: "11px", marginTop: "4px" }}>{postError}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
          <span style={{ fontSize: "10.5px", color: C.caption, alignSelf: "center" }}>
            你的评论以配置账号发布；AI 评论走专属 Service Account（若已配置）
          </span>
          <button type="button" onClick={() => void submit()} disabled={posting || !draft.trim()} style={primaryBtnStyle}>
            {posting ? "发送中…" : "发表评论"}
          </button>
        </div>
      </div>
    </div>
  );
}
