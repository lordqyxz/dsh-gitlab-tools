// One discussion note rendered as a conversation message row (avatar + author +
// relative time + body). System notes render through the HTML sanitizer.

import { renderMarkdown, renderSystemNote } from "./markdown";
import type { MdLinks } from "./markdown";
import { fmtRelative } from "./format";
import { avatarStyle } from "./theme";
import { C } from "./theme";
import type { Note } from "./types";

/** One discussion note, styled as a conversation message. */
export function NoteRow({ note, links }: { note: Note; links?: MdLinks }) {
  const author = note.author?.username ?? (note.system ? "系统" : "匿名");
  const initial = (author[0] || "?").toUpperCase();
  const html = note.system ? renderSystemNote(note.body, links) : renderMarkdown(note.body, links);
  return (
    <div style={{ display: "flex", gap: "8px", padding: "6px 0" }}>
      <div style={avatarStyle}>{initial}</div>
      <div style={{ flex: "1", minWidth: "0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: C.label1 }}>{author}</span>
          {note.system ? <span style={{ fontSize: "10px", color: C.brand }}>系统</span> : null}
          <span style={{ fontSize: "10px", color: C.caption }}>{fmtRelative(note.created_at)}</span>
        </div>
        <div
          className="gt-md"
          style={{ marginTop: "2px" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
