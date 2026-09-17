// GitLab emoji ACK 状态机（入站响应的用户可见信号）：
//   👀（eyes）= 会话已开始处理 → ✅（white_check_mark）= 已回复 / ❌（x）= 失败。
// 贴在「触发响应的那条 note」上（mention/追问），pipeline 分诊没有触发 note → 贴在 MR 本身。
// 失败时除换 ❌ 外再补一条兜底短评，让用户明确知道要重试。
// 本模块零 cordis 依赖：client 以 async 工厂注入（aiToken/SA 身份），可离线测试。
// GitLab award emoji API 不在生成的 openapi SDK 里 → 全走 client.raw()。

const enc = encodeURIComponent // project path "group/proj" → "group%2Fproj"

export const ACK_EYES = 'eyes'
export const ACK_DONE = 'white_check_mark'
export const ACK_FAILED = 'x'

function awardBasePath({ project, kind, iid, noteId }) {
  const t = kind === 'mr' ? 'merge_requests' : 'issues'
  const n = Number(iid)
  return `/api/v4/projects/${enc(project)}/${t}/${n}` + (noteId ? `/notes/${Number(noteId)}` : '')
}

/**
 * ACK 动作助手。client：async () => GitLabApi（同 index.js getClient，aiToken/SA 身份）。
 * 所有方法都按「尽力而为」使用：调用方必须自行 try/catch，这里只做薄封装并抛原始错误。
 */
export function createAckHelper({ client, logger }) {
  async function raw(path, method, body) {
    const c = await client()
    const r = await c.raw({ path, method, ...(body ? { body } : {}) })
    if (r?.error) throw new Error(String(r.error))
    return r?.data ?? null
  }

  /** 在 note（noteId 给定时）或 issue/MR 本身上贴 emoji。返回 award id（可能为 null）。 */
  async function award({ project, kind, iid, noteId, name }) {
    const d = await raw(`${awardBasePath({ project, kind, iid, noteId })}/award_emoji`, 'POST', { name })
    return d?.id ?? null
  }

  /** 撤掉一个 award（awardId 缺失时静默跳过）。 */
  async function removeAward({ project, kind, iid, noteId, awardId }) {
    if (!awardId) return
    await raw(`${awardBasePath({ project, kind, iid, noteId })}/award_emoji/${Number(awardId)}`, 'DELETE')
  }

  /** 状态机一步到位：撤掉当前 emoji → 贴新 emoji。返回新 award id（失败抛错，调用方兜底）。 */
  async function swap(info, name) {
    await removeAward(info)
    return await award({ ...info, name })
  }

  /** 失败兜底短评（issue/MR 评论）。 */
  async function fallbackComment({ project, kind, iid }, text) {
    const t = kind === 'mr' ? 'merge_requests' : 'issues'
    return await raw(`/api/v4/projects/${enc(project)}/${t}/${Number(iid)}/notes`, 'POST', { body: text })
  }

  return { award, removeAward, swap, fallbackComment }
}

/**
 * 失败评论体：错误信息原样贴出（不转述）。对象/非字符串 → JSON.stringify 保结构；
 * 围栏用四波浪线（~~~~），错误文本里几乎不可能出现，保住原始格式不被 Markdown 吃掉。
 */
export function failureBody(raw) {
  let text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '', null, 2)
  if (!text.trim()) text = '(无错误详情)'
  if (text.length > 4000) text = text.slice(0, 4000) + '\n…（错误信息过长，已截断）'
  return '⚠️ 自动处理失败，错误信息原样如下：' + '\n\n~~~~\n' + text + '\n~~~~'
}

/** 记录会话的未决 ACK（新 emoji 覆盖旧的；有界，防止僵尸堆积）。 */
export function rememberAck(state, sessionId, info) {
  if (!sessionId || !info) return
  state.acks = state.acks || {}
  state.acks[sessionId] = info
  const keys = Object.keys(state.acks)
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete state.acks[k]
}

/** 取走会话的未决 ACK（取走即删，resolved 一次性）。无则返回 undefined。 */
export function takeAck(state, sessionId) {
  if (!sessionId || !state.acks) return undefined
  const info = state.acks[sessionId]
  if (info) delete state.acks[sessionId]
  return info
}

/**
 * 线程回复助手：优先把内容回进「触发 note 所在的 discussion thread」，
 * 拿不到 discussionId（或 thread 回复失败）→ 回落顶层 note。
 */
export function createReplyPoster({ client, logger }) {
  async function raw(path, method, body) {
    const c = await client()
    const r = await c.raw({ path, method, ...(body ? { body } : {}) })
    if (r?.error) throw new Error(String(r.error))
    return r?.data ?? null
  }
  /** 在该 issue/MR 的 discussions 里找 noteId 所在 thread（最多翻 5 页）。 */
  async function findDiscussionId({ project, kind, iid }, noteId) {
    if (!noteId) return undefined
    const t = kind === 'mr' ? 'merge_requests' : 'issues'
    for (let page = 1; page <= 5; page++) {
      const d = await raw(`/api/v4/projects/${enc(project)}/${t}/${Number(iid)}/discussions?per_page=100&page=${page}`, 'GET')
      if (!Array.isArray(d) || d.length === 0) break
      for (const disc of d) {
        if ((disc.notes || []).some((n) => n && n.id === noteId)) return disc.id
      }
      if (d.length < 100) break
    }
    return undefined
  }
  /** 统一回复入口：body 为评论文本。noteId/discussionId 可用则进 thread，失败回落顶层。 */
  async function postReply({ project, kind, iid, noteId, discussionId, body }) {
    const t = kind === 'mr' ? 'merge_requests' : 'issues'
    const base = `/api/v4/projects/${enc(project)}/${t}/${Number(iid)}`
    let discId = discussionId
    if (!discId && noteId) {
      try {
        discId = await findDiscussionId({ project, kind, iid }, noteId)
      } catch (e) {
        logger?.warn?.('[gitlab-tools] discussions resolve failed: ' + String((e && e.message) || e))
      }
    }
    if (discId) {
      try {
        const d = await raw(`${base}/discussions/${discId}/notes`, 'POST', { body })
        return { noteId: d?.id ?? null, threaded: true, discussionId: discId }
      } catch (e) {
        logger?.warn?.('[gitlab-tools] thread reply failed, fallback to top-level: ' + String((e && e.message) || e))
      }
    }
    const d = await raw(`${base}/notes`, 'POST', { body })
    return { noteId: d?.id ?? null, threaded: false }
  }
  return { postReply, findDiscussionId }
}