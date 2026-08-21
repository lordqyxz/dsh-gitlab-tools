// Markdown rendering for issue descriptions and comments.
//
// Uses the open-source react-markdown + remark-gfm stack (CommonMark + GFM:
// tables / strikethrough / autolinks / task lists) instead of a hand-rolled
// subset, so **bold**, *italic*, `code`, fenced blocks, headings, lists and
// tables all render correctly. react-markdown renders to React elements rather
// than an HTML string, so raw HTML in user content is escaped — no
// dangerouslySetInnerHTML, XSS-safe by default.
//
// GitLab's `render_html` is NOT honored on this instance, so descriptions and
// comments are rendered client-side. `@user`, `#123`, `!123` references are
// turned into real links by a small remark plugin when `links` (a project base
// + origin) is provided. `.gt-md` styles are injected into document.head once.
//
// GitLab **system notes** are a separate case: their bodies come back as HTML
// (e.g. the `idiff` diff markup for "changed title from X to Y") and go through
// the allow-list sanitizer in sanitize-html.ts instead.

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { PluggableList } from "unified";
import type { Root } from "mdast";
import { sanitizeSystemHtml } from "./sanitize-html";

export interface MdLinks {
  /** Project web root, e.g. https://host/group/proj (used for #issue / !MR). */
  base?: string;
  /** Server origin, e.g. https://host (used for @user profile links). */
  origin?: string;
}

// ── GitLab @user / #issue / !MR references → real links ─────────────────────

const REF_RE = /(?<![\w!])!(\d+)|(?<![\w#])#(\d+)|(?<![\w@])@([\w.-]+)/g;

/**
 * remark plugin (attacher form, used as `[remarkGitlabLinks, links]`): rewrite
 * plain-text `@user`/`#123`/`!123` into link nodes. Must be registered through
 * the `[plugin, options]` tuple — the factory returns the *transformer*, so
 * passing it bare into `remarkPlugins` makes unified call the transformer as an
 * attacher during parse (no tree → crash).
 */
function remarkGitlabLinks(links?: MdLinks) {
  return (tree: Root) => {
    if (!links) return;
    visit(tree, "text", (node, index, parent) => {
      if (!parent || parent.type === "link" || parent.type === "linkReference") return;
      if (index === undefined || index === null) return;
      const value = node.value;
      const parts: { text: string; url?: string }[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      REF_RE.lastIndex = 0;
      while ((m = REF_RE.exec(value)) !== null) {
        if (m.index > last) parts.push({ text: value.slice(last, m.index) });
        if (m[1] !== undefined) {
          parts.push({ text: m[0], url: `${links.base}/-/merge_requests/${m[1]}` });
        } else if (m[2] !== undefined) {
          parts.push({ text: m[0], url: `${links.base}/-/issues/${m[2]}` });
        } else if (m[3] !== undefined) {
          parts.push({ text: m[0], url: `${links.origin}/${m[3]}` });
        }
        last = m.index + m[0].length;
      }
      if (last < value.length) parts.push({ text: value.slice(last) });
      if (parts.length <= 1) return;
      const children = parts.map((p) =>
        p.url
          ? { type: "link", url: p.url, title: null, children: [{ type: "text", value: p.text }] }
          : { type: "text", value: p.text }
      );
      parent.children.splice(index, 1, ...children);
      // Continue from the next sibling after the nodes we just inserted.
      return index + children.length;
    });
  };
}

/** Open external links in a new tab, same as the old linkify behavior. */
const components: Components = {
  a({ node: _node, ...props }) {
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

/** Render markdown text through react-markdown (GFM on, GitLab links on). */
export function Markdown({ text, links, className = "gt-md" }: {
  text: string;
  links?: MdLinks;
  className?: string;
}) {
  const plugins = useMemo<PluggableList>(
    () => [remarkGfm, [remarkGitlabLinks, links]],
    [links]
  );
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── GitLab system notes ─────────────────────────────────────────────────────
// HTML bodies are sanitized through the allow-list in sanitize-html.ts;
// plain-text bodies (e.g. "assigned to @x", "added #42 as parent item") run
// through the markdown renderer so @/#/! stay clickable.

/** True when a system-note body is already HTML (idiff markup, etc.). */
export function isSystemHtml(body: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(body);
}

/** Sanitize an HTML system-note body through the allow-list (returns HTML). */
export function systemNoteHtml(body: string): string {
  return sanitizeSystemHtml(body);
}

/** Scoped styles for rendered markdown — tokens only, injected once per page. */
let mdCssInjected = false;
export function ensureMarkdownCss() {
  if (mdCssInjected || typeof document === "undefined") return;
  mdCssInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-gt-md", "1");
  style.textContent = [
    ".gt-md{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word}",
    ".gt-md p{margin:0 0 8px}",
    ".gt-md h1,.gt-md h2,.gt-md h3,.gt-md h4,.gt-md h5,.gt-md h6{font-weight:600;line-height:1.4;margin:0 0 6px;color:var(--dsw-alias-label-primary)}",
    ".gt-md h1{font-size:15px}.gt-md h2{font-size:14px}.gt-md h3{font-size:13px}",
    ".gt-md pre{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:8px;overflow-x:auto;margin:0 0 8px;font-size:11px;line-height:16px}",
    ".gt-md code{font-family:var(--ds-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 3px;font-size:11px}",
    ".gt-md pre code{background:transparent;border:none;padding:0}",
    ".gt-md ul,.gt-md ol{margin:0 0 8px;padding-left:18px}",
    ".gt-md li{margin:2px 0}",
    ".gt-md a{color:var(--dsw-brand-accent,#fc6d26);text-decoration:none}",
    ".gt-md blockquote{margin:0 0 8px;padding:2px 10px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}",
    ".gt-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:8px 0}",
    ".gt-md del{color:var(--dsw-alias-label-tertiary)}",
    // GFM tables
    ".gt-md table{border-collapse:collapse;margin:0 0 8px;width:100%;font-size:11px;line-height:16px}",
    ".gt-md th,.gt-md td{border:1px solid var(--dsw-alias-border-l2);padding:4px 6px;text-align:left;vertical-align:top}",
    ".gt-md th{background:var(--dsw-alias-bg-base);font-weight:600;color:var(--dsw-alias-label-primary)}",
    ".gt-md tr:nth-child(even) td{background:var(--dsw-alias-bg-layer-2)}",
    // GFM task lists
    ".gt-md li.task-list-item{list-style:none}",
    // GitLab system-note diff markup (title-change etc.)
    ".gt-md .idiff.deletion{color:#f85149;text-decoration:line-through}",
    ".gt-md .idiff.addition{color:#3fb950;font-weight:600}",
  ].join("");
  document.head.appendChild(style);
}
