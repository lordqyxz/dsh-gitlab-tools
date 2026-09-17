// 回复出站桥（session → GitLab）— 全事件响应机制的出站半区。
// 机制：宿主 index.js 以官方持久化插件的惯用法订阅 `ctx.on('session/event')`，
// 把 (session, event) 原样交给本模块。DSH 会话事件是天然的全量事件源：
// assistant/message / turn/end 都能到达，比轮询事件日志干净且零延迟。
// 设计：
//   - 只有「绑定到 GitLab 线程」的会话出站（state.sessionIndex，由入站响应器写入）。
//     GUI 里手开的开发会话不受影响。
//   - 提交点 = turn/end 且 reason.kind ∈ {completed, max-tokens}（中断/出错不贴回，
//     避免把半截回复发到 issue）。最终回复 = 该 turn 最后一条未中断 assistant/message
//     的 text 块；事件日志不可用时退回内存暂存（assistant/message 到达时随手缓存）。
//   - 防重：同一 (session, turn) 只贴一次；SA 发出的 note 由入站防环（skip-self-note）消化。
//   - 出站永不抛错：任何失败返回 'post-failed:...' 字符串，事件监听器不能破坏会话 loop。
// 本模块零 cordis 依赖：client 以 async 工厂注入，state/stateFile 与入站共享，可离线测试。
import { saveState } from './listener.js'
import { takeAck, ACK_DONE, ACK_FAILED, failureBody } from './ack.js'

const enc = encodeURIComponent // project path "group/proj" → "group%2Fproj"
const COMMITTABLE_REASONS = new Set(['completed', 'max-tokens'])

/** 从会话事件日志提取某 turn 的最终回复文本（最后一条未中断 assistant/message 的 text 块）。 */
export function extractFinalText(events, turn) {
  if (!Array.isArray(events)) return ''
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (!ev || ev.type !== 'assistant/message') continue
    if (ev.data?.turn !== turn || ev.data?.interrupted) continue
    const blocks = ev.data?.message?.content
    if (!Array.isArray(blocks)) continue
    const text = blocks
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n\n')
      .trim()
    if (text) return text
  }
  return ''
}

/**
 * 出站桥工厂。
 * client：async () => GitLabApi（aiToken/SA 优先，见 index.js getClient）；
 * state/stateFile：与入站响应器共享的监听状态（sessionIndex / outbound 落盘）；
 * maxReplyLen：单条评论上限（GitLab note 上限约 1MB，这里保守截断）。
 */
export function createOutbound({ client, state, stateFile, logger, ack, reply, maxReplyLen = 20000, now = Date.now }) {
  // assistant/message 的内存暂存（session.events 不可用时的兜底；有界，FIFO 逐出）
  const stash = new Map()
  const STASH_MAX = 200

  function stashAssistant(sessionId, turn, text) {
    if (!sessionId || !text) return
    stash.set(sessionId, { turn, text })
    if (stash.size > STASH_MAX) {
      const oldest = stash.keys().next().value
      stash.delete(oldest)
    }
  }

  function notePath(binding) {
    const base = `/api/v4/projects/${enc(binding.project)}`
    return binding.kind === 'mr'
      ? `${base}/merge_requests/${Number(binding.iid)}/notes`
      : `${base}/issues/${Number(binding.iid)}/notes`
  }

  // 失败评论：reply 可用 → 进触发 note 所在 thread；否则顶层。
  async function failComment(info, body) {
    if (reply) return reply.postReply({ ...info, body })
    if (ack) return ack.fallbackComment(info, body)
  }

  /** 会话事件入口：返回结果串（诊断用），绝不 throw。 */
  async function handleSessionEvent(session, event) {
    try {
      if (event?.type === 'assistant/message') {
        const data = event.data
        if (data && !data.interrupted && Array.isArray(data.message?.content)) {
          const text = data.message.content
            .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text)
            .join('\n\n')
            .trim()
          if (text) stashAssistant(session?.id, data.turn, text)
        }
        return 'stashed'
      }
      if (!event || event.type !== 'turn/end') return 'ignored'
      const reason = event.data?.reason?.kind
      if (!COMMITTABLE_REASONS.has(reason)) {
        const info = takeAck(state, session?.id)
        if (info && (ack || reply)) {
          const soft = reason === 'aborted' || reason === 'interrupted'
          try {
            await ack.swap(info, ACK_FAILED)
          } catch (e) {
            logger?.warn?.('[gitlab-tools] ack swap failed: ' + String((e && e.message) || e))
          }
          if (!soft) {
            try {
              await failComment(info, failureBody(event.data?.reason))
            } catch (e) {
              logger?.warn?.('[gitlab-tools] ack fallback comment failed: ' + String((e && e.message) || e))
            }
          }
          saveState(stateFile, state)
        }
        return `skip-reason:${reason ?? 'unknown'}`
      }
      const sessionId = session?.id
      const binding = state.sessionIndex?.[sessionId]
      if (!binding || !binding.project || !Number.isFinite(Number(binding.iid))) return 'not-bound'
      state.outbound = state.outbound || {}
      const prev = state.outbound[sessionId]
      if (prev && prev.lastTurn === event.data.turn && prev.noteId) return 'already-posted'

      const turn = event.data.turn
      let text = extractFinalText(session.events, turn)
      if (!text) {
        const st = stash.get(sessionId)
        if (st && st.turn === turn) text = st.text
      }
      if (!text) {
        const info = takeAck(state, sessionId)
        if (info && (ack || reply)) {
          try {
            await ack.swap(info, ACK_FAILED)
          } catch (e) {
            logger?.warn?.('[gitlab-tools] ack swap failed: ' + String((e && e.message) || e))
          }
          try {
            await failComment(info, '⚠️ 处理完成但未生成回复。')
          } catch (e) {
            logger?.warn?.('[gitlab-tools] ack fallback comment failed: ' + String((e && e.message) || e))
          }
          saveState(stateFile, state)
        }
        return 'no-final-text'
      }
      if (text.length > maxReplyLen) text = text.slice(0, maxReplyLen) + '\n\n…（回复过长，已截断）'

      let noteId = null
      let threaded = false
      if (reply) {
        const res = await reply.postReply({ ...binding, body: text })
        noteId = res?.noteId ?? null
        threaded = Boolean(res?.threaded)
        if (!noteId) throw new Error('empty-response')
      } else {
        const c = await client()
        const r = await c.raw({ path: notePath(binding), method: 'POST', body: { body: text } })
        noteId = r?.data?.id ?? null
        if (!r?.data || r?.error) throw new Error(String(r?.error ?? 'empty-response'))
      }
      state.outbound[sessionId] = {
        lastTurn: turn,
        noteId,
        kind: binding.kind ?? 'issue',
        project: binding.project,
        iid: binding.iid,
        postedAt: new Date(now()).toISOString(),
        bytes: text.length,
        threaded,
        error: null,
      }
      // 有界：只保留最近 100 个会话的出站记录
      const keys = Object.keys(state.outbound)
      if (keys.length > 100) for (const k of keys.slice(0, keys.length - 100)) delete state.outbound[k]
      saveState(stateFile, state)
      // ✅ ACK：回复已贴 → 撤 👀 换 ✅（尽力而为）。
      const ackInfo = takeAck(state, sessionId)
      if (ackInfo && ack) {
        try {
          await ack.swap(ackInfo, ACK_DONE)
        } catch (e) {
          logger?.warn?.('[gitlab-tools] ack swap failed: ' + String((e && e.message) || e))
        }
        saveState(stateFile, state)
      }
      stash.delete(sessionId)
      return noteId ? `posted:note-${noteId}` : 'post-empty-response'
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 160)
      if (logger?.warn) logger.warn(`[gitlab-tools] outbound 贴回失败：${msg}`)
      try {
        const info = takeAck(state, session?.id)
        if (info && (ack || reply)) {
          await ack.swap(info, ACK_FAILED)
          await failComment(info, failureBody(msg))
          saveState(stateFile, state)
        }
      } catch (e2) {
        logger?.warn?.('[gitlab-tools] ack failure handling failed: ' + String((e2 && e2.message) || e2))
      }
      return `post-failed:${msg}`
    }
  }

  return {
    handleSessionEvent,
    status: () => {
      const out = state.outbound || {}
      const posted = Object.values(out).filter((o) => o.noteId)
      const last = posted.length ? posted[posted.length - 1] : null
      return {
        boundSessions: Object.keys(state.sessionIndex || {}).length,
        postedCount: posted.length,
        lastPostedAt: last?.postedAt ?? null,
        lastTarget: last ? `${last.kind === 'mr' ? 'MR' : 'issue'} #${last.iid ?? ''} @ ${last.project}` : null,
        lastError: [...Object.values(out)].reverse().find((o) => o.error)?.error ?? null,
      }
    },
  }
}
