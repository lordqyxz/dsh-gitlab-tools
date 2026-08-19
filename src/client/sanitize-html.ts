// Allow-list HTML sanitizer for GitLab **system notes**, which come back as
// already-HTML (e.g. title-change `idiff` markup). Only a tiny safe set of
// tags/attributes survives; everything else is dropped — no script/on*/style/
// javascript: injection surface.

const SAFE_TAGS = new Set([
  "p", "br", "code", "span", "strong", "em", "del", "b", "i", "a",
  "ul", "ol", "li", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
]);

/** Strip everything except the allow-listed tags + `class`/`href`/`title`. */
export function sanitizeSystemHtml(html: string): string {
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
