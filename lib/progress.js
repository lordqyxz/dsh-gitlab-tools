// 实时进度评论（session → GitLab 的 live 半区，2026-09）：
// 绑定线程的会话运行期间，在 issue/MR 上维护「一条」进度评论 —— 原地编辑
// （PUT notes/:note_id，GitLab 页面对 note 更新有准实时推送），turn 结束即删除。
// 这是外部 agent 在 GitLab 上做「实时显示」的业界通行形态（Copilot coding agent /
// Claude Code action / Devin 同款）：GitLab 无流式通道可消费，唯一可实时变更的
// 用户可见面就是评论原地编辑 + award emoji。
// 不啰嗦的三层设计：
//   - 默认视图 = 一行状态（当前活动 + 时长/步数）
//   - 思考摘要与步骤表放 <details> 折叠区（GitLab 净化白名单允许 details/summary/table/sub）
//   - turn 结束 → DELETE 该评论，零残留（最终回复由 outbound 桥单独贴回）
// Token 成本零：数据来自已订阅的 session/event（assistant/message 每 step 一条，
// content 含 type:'reasoning' 思考块与 tool-call 块；tool/result 带回执），全部宿主侧
// 字符串处理，不经过模型、不占 turn token。
// 安全：评论内容经 scrubText 清洗（token/secret 形态字符串打码）——思考/参数可能
// 携带敏感片段，宁枉勿纵。
// 纪律：handleSessionEvent / dispose 永不 throw；任何 GitLab 失败吞掉记状态，
// 绝不影响会话 loop。防环天然成立：SA 自己的 note 被入站 skip-self-note 与
// seenNotes 去重吃掉，且原地编辑不产生新 note id。
import { saveState } from './listener.js'

const enc = encodeURIComponent // project path "group/proj" → "group%2Fproj"
const THOUGHTS_KEEP = 8 // 内存里滚动保留的思考条数（渲染取最后 5 条）
const THOUGHTS_SHOW = 5
const STEPS_KEEP = 30 // 内存里滚动保留的步骤数（渲染取最后 15 行）
const STEPS_SHOW = 15
const PROGRESS_SESSIONS_MAX = 100 // state.progress 有界，防僵尸堆积
const THOUGHT_MAX = 160 // 单条思考摘要截断
const ARGS_MAX = 48 // 工具参数摘要截断

/** 单行化 + 截断（思考摘要用）。 */
function oneLine(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** 表格单元格安全：| 会被 Markdown 吃掉。 */
function cell(text, max) {
  return oneLine(text, max).replace(/\|/g, '\\|')
}

/** 敏感片段打码：PAT/SK 形态与 key=value 里的 secret 词全遮。 */
function scrubText(text) {
  return String(text ?? '')
    .replace(/(glpat-|ghp_|github_pat_|sk-)[A-Za-z0-9_-]{6,}/g, '$1***')
    .replace(/((?:token|password|secret|api[_-]?key)["'\\s=:]+)\S+/gi, '$1***')
}

/** 工具参数摘要：JSON 可解析取首两层 key=value，否则原文截断。 */
function argSummary(rawArgs) {
  const raw = String(rawArgs ?? '').trim()
  if (!raw) return ''
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const parts = Object.entries(obj).slice(0, 2).map(([k, v]) => {
        const vs = typeof v === 'string' ? v : JSON.stringify(v)
        return k + '=' + oneLine(vs, 24)
      })
      return oneLine(parts.join(', '), ARGS_MAX)
    }
  } catch { /* 非 JSON：原文截断 */ }
  return oneLine(raw, ARGS_MAX)
}

/** 工具名渲染：标识符形态才包 code，防注入怪字符。 */
function toolName(name) {
  const s = String(name ?? '').trim()
  if (!s) return '工具调用'
  return /^[A-Za-z0-9_.:-]+$/.test(s) ? '\u0060' + s + '\u0060' : cell(s, 40)
}

/** 时长：42s / 2m10s / 1h02m。 */
function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60), r = s % 60
  if (m < 60) return m + 'm' + String(r).padStart(2, '0') + 's'
  return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') + 'm'
}

/**
 * 渲染进度评论体（导出供测试断言）。
 */
export function renderProgressBody(rec, nowMs) {
  const lines = []
  lines.push('🤖 **正在处理任务** · <sub>⏱ ' + fmtElapsed(nowMs - rec.startedAt) + ' · ' + rec.stepCount + ' 步</sub>')
  lines.push('')
  lines.push('**当前**：' + (rec.current ? rec.current : '思考中…'))
  const thoughts = rec.thoughts.slice(-THOUGHTS_SHOW)
  if (thoughts.length) {
    lines.push('')
    lines.push('<details>')
    lines.push('<summary>💭 思考（最近 ' + thoughts.length + ' 条）</summary>')
    lines.push('')
    for (const t of thoughts) lines.push('- ' + t)
    lines.push('')
    lines.push('</details>')
  }
  const steps = rec.steps.slice(-STEPS_SHOW)
  if (steps.length) {
    lines.push('')
    lines.push('<details>')
    lines.push('<summary>🛠 步骤（' + rec.stepCount + '）</summary>')
    lines.push('')
    lines.push('| # | 动作 | 状态 |')
    lines.push('|---|------|------|')
    for (const st of steps) lines.push('| ' + st.n + ' | ' + toolName(st.name) + (st.args ? '（' + cell(st.args, ARGS_MAX) + '）' : '') + ' | ' + st.status + ' |')
    lines.push('')
    lines.push('</details>')
  }
  lines.push('')
  lines.push('<sub>处理完成后本条评论自动删除</sub>')
  return lines.join('\n')
}

/**
 * 实时进度评论工厂。
 * client：async () => GitlabApi（aiToken/SA 身份，同 index.js getClient）；
 * state/stateFile：与入站响应器/出站桥共享的监听状态（state.progress 落盘，重启后
 *   对已恢复会话续编同一条评论而非新开）；
 * enabled/throttleMs：cfg.agentLiveProgress / cfg.agentProgressThrottleMs（宿主层已钳制）；
 * now：可注入时钟（测试节流用）。
 */
export function createLiveProgress({ client, state, stateFile, logger, enabled = true, throttleMs = 15000, now = Date.now }) {
  const live = new Map() // sessionId → rec（内存活跃记录，含 timer/calls）

  async function raw(path, method, body) {
    const c = await client()
    const r = await c.raw({ path, method, ...(body ? { body } : {}) })
    if (r?.error) throw new Error(String(r.error))
    return r?.data ?? null
  }

  function basePath(kind, project, iid) {
    const t = kind === 'mr' ? 'merge_requests' : 'issues'
    return '/api/v4/projects/' + enc(project) + '/' + t + '/' + Number(iid)
  }

  /** 找到（或新建）会话的活跃记录。未绑定 → null。 */
  function ensure(sessionId) {
    if (live.has(sessionId)) return live.get(sessionId)
    const binding = state.sessionIndex?.[sessionId]
    if (!binding || !binding.project || !Number.isFinite(Number(binding.iid))) return null
    // 重启恢复：state.progress 里有残留 → 续编同一条评论（noteId 已在）
    const saved = state.progress?.[sessionId]
    const rec = {
      noteId: saved?.noteId ?? null,
      kind: binding.kind ?? 'issue',
      project: binding.project,
      iid: binding.iid,
      startedAt: saved?.startedAt ?? now(),
      stepCount: saved?.stepCount ?? 0,
      current: saved?.current ?? null,
      thoughts: Array.isArray(saved?.thoughts) ? saved.thoughts.slice(-THOUGHTS_KEEP) : [],
      steps: Array.isArray(saved?.steps) ? saved.steps.slice(-STEPS_KEEP) : [],
      calls: {},
      lastBody: saved?.lastBody ?? '',
      lastEdit: 0, // 重启后置 0：下次有变化立即刷
      timer: null,
      disabled: false,
      lastError: null,
    }
    live.set(sessionId, rec)
    return rec
  }

  function persist(sessionId, rec) {
    state.progress = state.progress || {}
    state.progress[sessionId] = {
      noteId: rec.noteId,
      kind: rec.kind,
      project: rec.project,
      iid: rec.iid,
      startedAt: rec.startedAt,
      stepCount: rec.stepCount,
      current: rec.current,
      thoughts: rec.thoughts.slice(-THOUGHTS_SHOW),
      steps: rec.steps.slice(-STEPS_SHOW).map((s) => ({ n: s.n, name: s.name, args: s.args, status: s.status })),
      lastBody: rec.lastBody,
    }
    const keys = Object.keys(state.progress)
    if (keys.length > PROGRESS_SESSIONS_MAX) for (const k of keys.slice(0, keys.length - PROGRESS_SESSIONS_MAX)) delete state.progress[k]
    saveState(stateFile, state)
  }

  function clearTimer(rec) {
    if (rec.timer) { clearTimeout(rec.timer); rec.timer = null }
  }

  /** 有变化就按节流刷；未到点则挂尾随定时器保证最后一次变化也会刷出。 */
  async function flush(sessionId) {
    const rec = live.get(sessionId)
    if (rec?.disabled) return 'disabled'
    if (!rec) return 'no-rec'
    const body = renderProgressBody(rec, now())
    if (body === rec.lastBody) return 'unchanged'
    const elapsed = now() - rec.lastEdit
    if (rec.noteId && elapsed < throttleMs) {
      if (!rec.timer) {
        rec.timer = setTimeout(() => { rec.timer = null; void flush(sessionId) }, Math.max(throttleMs - elapsed, 0))
        rec.timer.unref?.()
      }
      return 'scheduled'
    }
    try {
      if (!rec.noteId) {
        const d = await raw(basePath(rec.kind, rec.project, rec.iid) + '/notes', 'POST', { body })
        rec.noteId = d?.id ?? null
        if (!rec.noteId) throw new Error('empty-response')
      } else {
        await raw(basePath(rec.kind, rec.project, rec.iid) + '/notes/' + Number(rec.noteId), 'PUT', { body })
      }
      rec.lastEdit = now()
      rec.lastBody = body
      persist(sessionId, rec)
      return 'flushed'
    } catch (e) {
      rec.lastError = String((e && e.message) || e).slice(0, 160)
      if (!rec.noteId) {
        // 建不出评论（403/网络…）：本会话禁用，不重试轰炸
        rec.disabled = true
        logger?.warn?.('[gitlab-tools] 进度评论创建失败，本会话禁用：' + rec.lastError)
      }
      return 'failed:' + rec.lastError
    }
  }

  /** 从 assistant/message 事件提取思考/工具调用。 */
  async function extractAssistant(sessionId, data) {
    const rec = ensure(sessionId)
    if (!rec || rec.disabled) return rec ? 'disabled' : 'not-bound'
    if (!data || data.interrupted || !Array.isArray(data.message?.content)) return 'ignored'
    for (const b of data.message.content) {
      if (!b || typeof b !== 'object') continue
      if (b.type === 'reasoning' && typeof b.text === 'string' && b.text.trim()) {
        const t = oneLine(scrubText(b.text), THOUGHT_MAX)
        if (t && t !== rec.thoughts[rec.thoughts.length - 1]) rec.thoughts.push(t)
        if (rec.thoughts.length > THOUGHTS_KEEP) rec.thoughts.splice(0, rec.thoughts.length - THOUGHTS_KEEP)
      } else if (b.type === 'tool-call' && b.name) {
        rec.stepCount += 1
        const step = { n: rec.stepCount, name: String(b.name), args: argSummary(scrubText(b.arguments)), status: '…' }
        rec.steps.push(step)
        if (rec.steps.length > STEPS_KEEP) rec.steps.splice(0, rec.steps.length - STEPS_KEEP)
        if (b.id) {
          rec.calls[b.id] = step
          const ids = Object.keys(rec.calls)
          if (ids.length > 40) for (const k of ids.slice(0, ids.length - 40)) delete rec.calls[k]
        }
        rec.current = toolName(b.name) + (step.args ? '（' + cell(step.args, ARGS_MAX) + '）' : '')
      }
    }
    return await flush(sessionId)
  }

  /** tool/result 回执：按 toolCallId 找回步骤，标 ✓ / ⚠️。 */
  async function extractResult(sessionId, data) {
    const rec = ensure(sessionId)
    if (!rec || rec.disabled) return rec ? 'disabled' : 'not-bound'
    const blocks = Array.isArray(data?.message?.content) ? data.message.content : []
    for (const b of blocks) {
      if (b?.type !== 'tool-result' || !b.toolCallId) continue
      const step = rec.calls[b.toolCallId]
      if (step) step.status = (b.isError || data.error) ? '⚠️' : '✓'
    }
    return await flush(sessionId)
  }

  /** turn 结束：删评论、清状态。任何 reason 都清（完成/中断/出错一律不留）。 */
  async function cleanup(sessionId) {
    const rec = live.get(sessionId)
    if (!rec) return 'no-progress'
    clearTimer(rec)
    live.delete(sessionId)
    let removed = null
    if (rec.noteId) {
      try {
        await raw(basePath(rec.kind, rec.project, rec.iid) + '/notes/' + Number(rec.noteId), 'DELETE')
        removed = rec.noteId
      } catch (e) {
        logger?.warn?.('[gitlab-tools] 进度评论删除失败（尽力而为）：' + String((e && e.message) || e).slice(0, 120))
      }
    }
    if (state.progress) { delete state.progress[sessionId]; saveState(stateFile, state) }
    return removed ? 'cleaned:note-' + removed : 'cleaned'
  }

  /** 会话事件入口：绝不 throw。 */
  async function handleSessionEvent(session, event) {
    try {
      if (!enabled) return 'disabled'
      const sessionId = session?.id
      if (!sessionId) return 'ignored'
      if (event?.type === 'assistant/message') return extractAssistant(sessionId, event.data)
      if (event?.type === 'tool/result') return extractResult(sessionId, event.data)
      if (event?.type === 'turn/end') return await cleanup(sessionId)
      return 'ignored:' + String(event?.type ?? 'unknown')
    } catch (e) {
      return 'progress-error:' + String((e && e.message) || e).slice(0, 120)
    }
  }

  /** 卸载：清掉所有尾随定时器（ctx.effect teardown 调用）。 */
  function dispose() {
    for (const rec of live.values()) clearTimer(rec)
    live.clear()
  }

  function status() {
    let active = 0
    for (const rec of live.values()) if (rec.noteId && !rec.disabled) active += 1
    const errs = [...live.values()].map((r) => r.lastError).filter(Boolean)
    return { enabled: Boolean(enabled), active, lastError: errs.length ? errs[errs.length - 1] : null }
  }

  return { handleSessionEvent, dispose, status }
}
