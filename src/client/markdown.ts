// Minimal safe markdown-subset renderer (escaping-first → no raw HTML/XSS),
// plus a sanitizer for GitLab **system notes** (which come back as HTML, e.g.
// the `idiff` diff markup for "changed title from X to Y").
//
// GitLab's `render_html` is NOT honored on this instance, so descriptions and
// comments are rendered client-side. Everything is escaped first; only a small
// allow-list of transforms runs on already-escaped text. `.gt-md` styles are
// injected into document.head exactly once.
//
// `@user`, `#123`, `!123` references are turned into real links when `links`
// (a project base + origin) is provided.

export interface MdLinks {
  /** Project web root, e.g. https://host/group/proj (used for #issue / !MR). */
  base?: string;
  /** Server origin, e.g. https://host (used for @user profile links). */
  origin?: string;
}

/** Escape user content first — everything after this is safe to inject. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn @mentions / #issue / !MR references into real links (skipped without links). */
function linkify(s: string, links?: MdLinks): string {
  if (!links) return s;
  return s
    .replace(/(?<![\w!])!(\d+)/g, (m, n) =>
      links.base ? `<a href="${links.base}/-/merge_requests/${n}">!${n}</a>` : m
    )
    .replace(/(?<![\w#])#(\d+)/g, (m, n) =>
      links.base ? `<a href="${links.base}/-/issues/${n}">#${n}</a>` : m
    )
    .replace(/(?<![\w@])@([\w.-]+)/g, (m, u) =>
      links.origin ? `<a href="${links.origin}/${u}">@${u}</a>` : m
    );
}

/** Inline transforms on already-escaped text. Code spans first (protected). */
function inlineMd(s: string, links?: MdLinks): string {
  return s
    .split(/(`[^`\n]+`)/g)
    .map((p) => {
      if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
        return `<code>${p.slice(1, -1)}</code>`;
      }
      return linkify(p, links)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
        .replace(/~~([^~]+)~~/g, "<del>$1</del>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    })
    .join("");
}

/** Minimal safe markdown-subset renderer (escaping-first → no raw HTML/XSS). */
export function renderMarkdown(md: string, links?: MdLinks): string {
  const out: string[] = [];
  for (const raw of md.split(/\n{2,}/)) {
    const block = raw.trimEnd();
    if (!block.trim()) continue;
    const fence = block.match(/^```(\w*)\s*\n([\s\S]*?)\n```\s*$/);
    if (fence) {
      out.push(`<pre><code>${escapeHtml(fence[2])}</code></pre>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(block.trim())) {
      out.push("<hr/>");
      continue;
    }
    const h = block.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inlineMd(escapeHtml(h[2]), links)}</h${h[1].length}>`);
      continue;
    }
    if (/^>/.test(block)) {
      out.push(`<blockquote>${inlineMd(escapeHtml(block.replace(/^>\s?/gm, "")), links)}</blockquote>`);
      continue;
    }
    const ul = block.match(/^\s*[-*+]\s+/);
    const ol = block.match(/^\s*\d+[.)]\s+/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      const items = block
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => (ul ? /^[-*+]\s+/.test(l) : /^\d+[.)]\s+/.test(l)))
        .map((l) => `<li>${inlineMd(escapeHtml(l.replace(/^\s*[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "")), links)}</li>`);
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    out.push(`<p>${inlineMd(escapeHtml(block), links)}</p>`);
  }
  return out.join("\n");
}

// ── GitLab system notes ─────────────────────────────────────────────────────
// System notes come back as already-HTML (e.g. title-change idiff markup).
// We keep only a tiny allow-list of safe tags/attributes and drop everything
// else, so there is no script/on*/style/javascript: injection surface.

const SAFE_TAGS = new Set([
  "p", "br", "code", "span", "strong", "em", "del", "b", "i", "a",
  "ul", "ol", "li", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
]);

function sanitizeSystemHtml(html: string): string {
  return html.replace(/<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g, (m, close, tag, attrs, selfclose) => {
    if (!SAFE_TAGS.has(tag.toLowerCase())) return "";
    let keep = "";
    const attrRe = /([a-zA-Z0-9-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrs))) {
      const name = am[1].toLowerCase();
      const val = (am[2] ?? am[3] ?? am[4] ?? "").replace(/"/g, "");
      if (name === "class") keep += ` class="${val}"`;
      else if (name === "href") {
        // Allow-list schemes only: http(s)/mailto + relative (#, /). A block-list
        // is bypassable via entity encoding (e.g. &#106;avascript:), so reject
        // anything that isn't on the safe list outright.
        const v = val.trim().toLowerCase();
        if (/^(https?:|mailto:|#|\/)/.test(v)) keep += ` href="${val}"`;
      } else if (name === "title") keep += ` title="${val}"`;
    }
    return `<${close}${tag}${keep}${selfclose}>`;
  });
}

/**
 * Render a GitLab system-note body. HTML bodies (title-change idiff, etc.) are
 * sanitized through the allow-list; plain-text bodies (e.g. "assigned to @x",
 * "added #42 as parent item") run through the markdown renderer so @/#/! stay
 * clickable.
 */
export function renderSystemNote(body: string, links?: MdLinks): string {
  if (/<[a-zA-Z][^>]*>/.test(body)) {
    return sanitizeSystemHtml(body);
  }
  return renderMarkdown(body, links);
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
    // GitLab system-note diff markup (title-change etc.)
    ".gt-md .idiff.deletion{color:#f85149;text-decoration:line-through}",
    ".gt-md .idiff.addition{color:#3fb950;font-weight:600}",
  ].join("");
  document.head.appendChild(style);
}
