// Token 用量折叠 + 出站回复用量脚注（纯函数，零依赖，可离线测）。
// 折叠口径：assistant/message 事件上的 usage（reported 级，含缓存/推理 token），
// 与 GET /gitlab-tools/session/stats 共用本模块（单一口径：脚注数字 = 面板数字）。
// 用量不按工具调用计费——模型 API 的计费粒度就是轮次级，工具调用只有轨迹没有
// 独立 usage，不要在展示层承诺「每工具调用的 token」（ty/data-flow#368 结论）。
// 脚注固定格式（缺数优雅省略，绝不伪造；#368：未返回的用量不能伪装成精确值）：
//   📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s ｜ 累计 2 轮 · ↑ 10.5k · ↓ 2.1k
//   - ↑/↓ 本轮输入/输出必有；🧠 推理 >0 才显示；⚡ 需 ≥2 样本且时间跨度可算；
//   - 累计仅在会话存在本轮之外的样本时显示；缓存 token 不进脚注（每轮重复读
//     上下文会显得用量爆炸，五类全量走 /session/stats 的分析口径）。

/** 折叠会话事件流中的 usage；opts.turn 传轮次 id 时只折叠该轮。 */
export function foldUsage(events, opts = {}) {
  const acc = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, samples: 0, turns: 0, firstAt: null, lastAt: null }
  if (!Array.isArray(events)) return acc
  const seenTurns = new Set()
  for (const ev of events) {
    if (!ev || ev.type !== 'assistant/message') continue
    const data = ev.data && typeof ev.data === 'object' ? ev.data : undefined
    const usage = data?.usage
    if (!usage || typeof usage !== 'object') continue
    if (opts.turn !== undefined && data.turn !== opts.turn) continue
    acc.input += usage.inputTokens || 0
    acc.output += usage.outputTokens || 0
    acc.cacheRead += usage.cacheReadTokens || 0
    acc.cacheWrite += usage.cacheWriteTokens || 0
    acc.reasoning += usage.reasoningTokens || 0
    acc.samples += 1
    if (data.turn !== undefined) seenTurns.add(data.turn)
    const t = typeof ev.time === 'number' ? ev.time : 0
    if (t && (acc.firstAt === null || t < acc.firstAt)) acc.firstAt = t
    if (t && (acc.lastAt === null || t > acc.lastAt)) acc.lastAt = t
  }
  acc.turns = seenTurns.size
  return acc
}

/** 数值紧凑化：12000 → '12k'，1234567 → '1.2M'，999 → '999'。 */
export function humanizeTokens(n) {
  if (!Number.isFinite(n)) return null
  if (n >= 1e6) return Math.round(n / 1e5) / 10 + 'M'
  if (n >= 1e3) return Math.round(n / 100) / 10 + 'k'
  return String(Math.round(n))
}

/** 出站用量脚注（不含分隔线）。本轮无 usage 样本返回 ''（调用方不追加）。 */
export function formatUsageFooter(turnU, sessionU) {
  if (!turnU || !turnU.samples) return ''
  const parts = [`↑ ${humanizeTokens(turnU.input)}`, `↓ ${humanizeTokens(turnU.output)}`]
  if (turnU.reasoning > 0) parts.push(`🧠 ${humanizeTokens(turnU.reasoning)}`)
  const dt = turnU.samples >= 2 && turnU.firstAt !== null && turnU.lastAt !== null && turnU.lastAt > turnU.firstAt
    ? (turnU.lastAt - turnU.firstAt) / 1000
    : null
  if (dt && turnU.input + turnU.output > 0) parts.push(`⚡ ${((turnU.input + turnU.output) / dt).toFixed(1)} tok/s`)
  let line = `📊 本轮 ${parts.join(' · ')}`
  if (sessionU && sessionU.samples > turnU.samples) {
    line += ` ｜ 累计${sessionU.turns > 0 ? ` ${sessionU.turns} 轮` : ''} · ↑ ${humanizeTokens(sessionU.input)} · ↓ ${humanizeTokens(sessionU.output)}`
  }
  return line
}
