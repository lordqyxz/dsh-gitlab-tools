// One discussion note rendered as a conversation message row (avatar + author +
// relative time + body). Regular comments render markdown through react-markdown
// (GFM tables/code/bold all supported); system notes render through the HTML
// sanitizer when their body is already HTML (GitLab idiff markup), else through
// the markdown renderer so @/#/! stay clickable.

import { useState } from "react";
import { Markdown, isSystemHtml, systemNoteHtml } from "./markdown";
import type { MdLinks } from "./markdown";
import { fmtRelative } from "./format";
import { avatarStyle } from "./theme";
import { C } from "./theme";
import type { Note } from "./types";

/**
 * Author avatar: the real GitLab avatar image when available (lazy-loaded;
 * the instance's self-signed cert is system-trusted so the browser loads it
 * directly), falling back to the initial-letter badge if the URL is missing or
 * the image fails to load (cert not trusted in this browser, avatar deleted…).
 */
function Avatar({ src, initial, title }: { src?: string | null; initial: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={avatarStyle} title={title}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      title={title}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ ...avatarStyle, display: "block", objectFit: "cover" }}
    />
  );
}

/** One discussion note, styled as a conversation message. */
export function NoteRow({ note, links }: { note: Note; links?: MdLinks }) {
  const author = note.author?.username ?? (note.system ? "系统" : "匿名");
  const initial = (author[0] || "?").toUpperCase();
  const body = note.body ?? "";
  // System notes arrive as HTML; sanitize them. Everything else (regular
  // comments and plain-text system notes) renders as markdown.
  const systemHtml = note.system && isSystemHtml(body) ? systemNoteHtml(body) : null;
  return (
    <div style={{ display: "flex", gap: "8px", padding: "6px 0" }}>
      <Avatar src={note.author?.avatar_url ?? null} initial={initial} title={author} />
      <div style={{ flex: "1", minWidth: "0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: C.label1 }}>{author}</span>
          {note.system ? <span style={{ fontSize: "10px", color: C.brand }}>系统</span> : null}
          <span style={{ fontSize: "10px", color: C.caption }}>{fmtRelative(note.created_at)}</span>
        </div>
        {systemHtml !== null ? (
          <div className="gt-md" style={{ marginTop: "2px" }} dangerouslySetInnerHTML={{ __html: systemHtml }} />
        ) : (
          <div style={{ marginTop: "2px" }}>
            <Markdown text={body} links={links} />
          </div>
        )}
      </div>
    </div>
  );
}
