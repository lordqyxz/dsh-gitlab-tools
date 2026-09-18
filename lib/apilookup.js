// dsh-gitlab-tools — GitLab REST operation index & usage lookup (host half).
// Derives a searchable index of ALL REST operations from the spec-generated SDK
// source (lib/generated/gitlabApi.mjs "@request METHOD:path" JSDoc lines), so:
//   1. gitlab_api_lookup tool can answer "exact path/params for X" queries;
//   2. gitlab_api error responses auto-attach correct-usage suggestions.
// Index is parsed lazily at first use and memoized — regenerating the SDK
// (tools/gen-sdk.mjs) automatically refreshes it. Zero maintenance, zero deps.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const SDK_FILE = join(dirname(fileURLToPath(import.meta.url)), "generated", "gitlabApi.mjs");

const REQUEST_RE = /^    \* @request ([A-Z]+):(\S+)\s*$/;
const SUMMARY_RE = /^    \* @summary (.+?)\s*$/;
const FUNC_RE = /^    ([A-Za-z0-9_]+): \(([^)]*)\) => this\.request\(/;

// spec 缺口（不在 openapi spec、走 client.raw 直通；见 AGENTS.md §4）补进索引，
// 让 lookup/建议覆盖网关实际支持的常用面。
const EXTRA_OPS = [
  { name: "getCurrentUserRaw", method: "GET", path: "/api/v4/user", summary: "Current authenticated user (spec gap, raw)", args: [] },
  { name: "getIssueNotesRaw", method: "GET", path: "/api/v4/projects/{id}/issues/{issue_iid}/notes", summary: "List issue comments (spec gap, raw)", args: ["id", "issue_iid", "query"] },
  { name: "postIssueNoteRaw", method: "POST", path: "/api/v4/projects/{id}/issues/{issue_iid}/notes", summary: "Add an issue comment, body {body} (spec gap, raw)", args: ["id", "issue_iid", "body"] },
];

/** Parse the generated SDK source into an operation index. */
export function buildIndex(source) {
  const lines = source.split("\n");
  const ops = [];
  for (let i = 0; i < lines.length; i++) {
    const m = REQUEST_RE.exec(lines[i]);
    if (!m) continue;
    let summary = "";
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const s = SUMMARY_RE.exec(lines[j]);
      if (s) { summary = s[1]; break; }
    }
    let name = "", args = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const f = FUNC_RE.exec(lines[j]);
      if (f) {
        name = f[1];
        args = f[2].split(",").map((s) => s.trim().split(/\s*=/)[0]).filter(Boolean);
        break;
      }
    }
    if (name) ops.push({ name, method: m[1], path: m[2], summary, args });
  }
  ops.push(...EXTRA_OPS);
  return ops;
}

let cache = null;
/** Load (and memoize) the index from the generated SDK next to this module. */
export function loadIndex(file = SDK_FILE) {
  if (!cache) cache = buildIndex(readFileSync(file, "utf8"));
  return cache;
}

/** One-line rendering used by search/suggest output. */
export function formatOp(op) {
  const s = op.summary ? String(op.summary).slice(0, 64) : "";
  return op.method + " " + op.path + (s ? " — " + s : "") + " [" + op.name + "]";
}

function tokensOf(text) {
  return String(text).toLowerCase().match(/[a-z0-9_{}]+/g) || [];
}

/** Keyword search across method+path+summary+op name (AND across tokens). */
export function search(ops, query, limit = 12) {
  const toks = tokensOf(query);
  if (!toks.length) return { text: "（空关键词）给 query，如 'release' / 'pipeline jobs' / 'merge request'。", count: 0 };
  const scored = [];
  for (const op of ops) {
    const hay = (op.method + " " + op.path + " " + op.summary + " " + op.name).toLowerCase();
    let score = 0, ok = true;
    for (const t of toks) {
      if (!hay.includes(t)) { ok = false; break; }
      score += op.path.toLowerCase().includes(t) ? 2 : 1;
    }
    if (ok) scored.push([score, op]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].path.length - b[1].path.length);
  const shown = scored.slice(0, limit);
  const text = scored.length
    ? "匹配 " + scored.length + " 个（显示前 " + shown.length + "；索引共 " + ops.length + " 个操作，op 参数可查详情）:\n" + shown.map((x) => formatOp(x[1])).join("\n")
    : "无匹配（索引共 " + ops.length + " 个操作）。换更短的关键词，如 'pipeline'、'release'、'branch'。";
  return { text, count: scored.length };
}

/** Full detail for one operation, with a ready-to-adapt gitlab_api example. */
export function detail(ops, name) {
  const op = ops.find((o) => o.name.toLowerCase() === String(name).toLowerCase());
  if (!op) {
    const near = ops.filter((o) => o.name.toLowerCase().includes(String(name).toLowerCase().slice(0, 8))).slice(0, 5);
    return { text: "无此操作 id。" + (near.length ? "相近：" + near.map((o) => o.name).join(", ") : "用 query 关键词搜索。"), op: null };
  }
  const placeholders = (op.path.match(/\{[^}]+\}/g) || []);
  const example = op.path.replace(/^\/api\/v4/, "").replace(/\{id\}/g, "group%2Fproj").replace(/\{[^}]+\}/g, (p) => /iid|sha|ref|branch|tag|user|name/i.test(p) ? "<" + p.slice(1, -1) + ">" : "42");
  const lines = [
    formatOp(op),
    "summary: " + (op.summary || "（无）"),
    "path 参数: " + (placeholders.length ? placeholders.join(", ") : "无") + (op.args.includes("query") ? "；query 对象: 有" : ""),
    (op.method === "GET" ? "" : "body 对象: " + (op.args.some((a) => a !== "params" && a !== "query" && !placeholders.includes("{" + a + "}")) ? "有" : "视操作而定") + "；"),
    "示例: gitlab_api path: \"" + example + "\"" + (op.method !== "GET" ? " method: \"" + op.method + "\"" : "") + "（组路径必须 %2F 编码）",
  ];
  return { text: lines.filter(Boolean).join("\n"), op };
}

const isPlaceholder = (s) => /^\{[^}]+\}$/.test(s);

/**
 * Correct-usage suggestions for a failed gitlab_api call.
 * Returns { auth: true } for 401/403 (not a path problem), else { lines }.
 */
export function suggest(ops, { method, path, errorText, limit = 4 }) {
  if (/HTTP 40[13]\b/.test(String(errorText))) {
    return { auth: true, lines: ["401/403：先查认证与权限（token 失效/scope 不足/项目不可见），不是路径问题。"] };
  }
  const req = String(path).split("?")[0].replace(/^\/api\/v4/, "").split("/").filter(Boolean);
  if (!req.length) return { lines: [] };
  const scored = [];
  for (const op of ops) {
    const opSegs = op.path.replace(/^\/api\/v4/, "").split("/").filter(Boolean);
    let i = 0, matched = 0, ok = true;
    for (let j = 0; j < opSegs.length && ok; j++) {
      if (isPlaceholder(opSegs[j])) {
        if (i >= req.length) { ok = false; break; }
        i++; matched++; continue;
      }
      const at = req.indexOf(opSegs[j], i);
      if (at < 0 || at - i > 3) { ok = false; break; }  // 容忍未编码的组路径多出 ≤3 段
      i = at + 1; matched++;
    }
    if (!ok || i < req.length - 3) continue;
    const score = 0.6 * (matched / opSegs.length) + 0.4 * (i / req.length) + (op.method === String(method).toUpperCase() ? 0.03 : 0);
    if (score >= 0.5) scored.push([score, op]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].path.length - b[1].path.length);
  const lines = scored.slice(0, limit).map((x) => formatOp(x[1]));
  if (lines.length && String(path).includes("/") && !String(path).includes("%2F")) {
    lines.push("提示：组路径（group/project）必须 %2F 编码，或直接用数字 id。");
  }
  return { lines };
}
