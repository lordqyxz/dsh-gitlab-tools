// Result banner shown after "创建开发会话": message + copy-prompt + open-session.

import { C, iconBtnStyle, miniBtnStyle, noticeStyle } from "./theme";
import type { DevNotice } from "./types";

const NOTICE_COLOR: Record<DevNotice["kind"], string> = { ok: C.ok, warn: C.warn, err: C.err };

export function DevNoticePanel({ notice, onClose, onOpenSession }: {
  notice: DevNotice;
  onClose: () => void;
  onOpenSession: () => void;
}) {
  return (
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
        <button type="button" title="关闭" onClick={onClose} style={iconBtnStyle}>✕</button>
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
            <button type="button" onClick={onOpenSession} style={miniBtnStyle}>
              打开会话
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
