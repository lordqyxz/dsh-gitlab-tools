// AI 身份（服务账户）选择 — 纯逻辑，零依赖，可离线测试。
//
// 模型：每个客户端（DSH 实例）可以选「本机以哪个 GitLab 账户的身份发言」。
//   - 身份 = (username, token) 对；token 按账户分存（credential REF 由
//     aiTokenRefKey(username) 派生），切账户不丢 token。
//   - 未选择（aiUsername 空）= 沿用历史行为：legacy REF（gitlabToolsAiToken）
//     → profile patch config 的 aiToken。
//   - 选了但没有对应 token → 明确回落主 token 并给出 warning（运行时不可能
//     静默用错身份：保存入口已校验，这里只是兜底 + 诊断可见）。
//
// credential REF 约束：/^[A-Za-z_][A-Za-z0-9_]*$/（dsh-credentials 的
// REF_PATTERN），而 GitLab 用户名可含 . 和 -，所以 REF 键要净化 + 加散列后缀
// 防碰撞（如 john.doe-1 与 john_doe_1 净化后同名）。

/** 由用户名派生稳定的、符合 credential REF 约束的存储键。 */
export function aiTokenRefKey(username) {
  const raw = String(username || "");
  const safe = raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "").slice(0, 40) || "unknown";
  let h = 0;
  for (const c of raw) h = ((h * 31) + (c.codePointAt(0) || 0)) >>> 0;
  return "gitlabToolsAiToken_" + safe + "_" + h.toString(36);
}

const eqi = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

/**
 * 身份解析决策矩阵（纯函数；IO 由调用方完成后传入）。
 * @param {object} p
 *   aiUsername        设置页选中的服务账户（'' = 未选择）
 *   perAccountToken   aiTokenRefKey(aiUsername) 对应的已存 token（'' = 无）
 *   legacyToken       旧链 token（legacy REF → cfg.aiToken 链的产物，'' = 无）
 *   legacyUsername    legacyToken 的实际身份（离线解析失败为 ''）
 *   cfgToken          patch config 的 aiToken（独立于 legacy 链的兜底，'' = 无）
 *   cfgUsername       cfgToken 的实际身份（'' = 未知）
 * @returns {{ token, username, source, warning }}
 *   source ∈ per-account | legacy | cfg | missing | legacy-unselected | cfg-unselected
 */
export function resolveAiIdentity({ aiUsername, perAccountToken, legacyToken, legacyUsername, cfgToken, cfgUsername }) {
  const selected = String(aiUsername || "").trim();
  if (!selected) {
    // 未选择：沿用旧链，身份以实际 token 解析结果为准
    if (legacyToken) return { token: legacyToken, username: legacyUsername || "", source: "legacy-unselected", warning: "" };
    if (cfgToken) return { token: cfgToken, username: cfgUsername || "", source: "cfg-unselected", warning: "" };
    return { token: "", username: "", source: "none", warning: "" };
  }
  if (perAccountToken) {
    return { token: perAccountToken, username: selected, source: "per-account", warning: "" };
  }
  if (legacyToken && legacyUsername && eqi(legacyUsername, selected)) {
    return { token: legacyToken, username: selected, source: "legacy", warning: "" };
  }
  if (cfgToken && cfgUsername && eqi(cfgUsername, selected)) {
    return { token: cfgToken, username: selected, source: "cfg", warning: "" };
  }
  return {
    token: "",
    username: selected,
    source: "missing",
    warning: `所选 AI 身份 @${selected} 没有可用 token，GitLab 工具将回落主 token 身份（请在设置页为该账户填入 PAT）`,
  };
}

/**
 * 合并下拉候选账户（按 username 去重，先到先得——优先级由调用方的传入顺序决定：
 * admin 全量 → 本机已存 token 的账户 → 当前生效 AI 身份 → 主 token 身份）。
 */
export function mergeAccountCandidates(groups) {
  const out = [];
  const seen = new Set();
  for (const group of groups || []) {
    for (const a of group || []) {
      const username = String(a?.username || "").trim();
      if (!username) continue;
      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ username, name: a.name || "", id: a.id ?? null, source: a.source || "unknown", hasToken: Boolean(a.hasToken) });
    }
  }
  return out;
}
