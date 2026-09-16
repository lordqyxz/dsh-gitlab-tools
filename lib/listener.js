// GitLab 事件拉取源（轮询器）+ issue @mention 自动响应器 + 双向评论桥接。
// 设计：
//   - Poller（入站）：定时拉 tracked projects 的 issues/MRs（updated_after 游标）→ 新 notes →
//     归一化事件（写入 EventStore）→ 交给 responder。游标与已见 note id 落盘，重启不重放。
//     定位是「兜底」：webhook 推送源可用时它只防漏（跨源去重保证不重复响应）。
//   - Responder（会话侧）：
//     · 新线程：issue/MR 评论 @mentionUsername → 创建会话并注入提示词；
//     · 追问：同线程内人类的后续评论（无需 @，SA 自己的除外）作为追问送进同一会话；
//     · pipeline 分诊：MR 流水线失败事件 → 触发分诊会话（推送源专属，轮询不含 pipeline）；
//     · 防环：SA 用户名名下的评论不回灌会话；创建/追问各有每小时频率上限。
//   - 回复出站（session → GitLab）不在本模块：lib/outbound.js 经宿主 index.js 的
//     ctx.on('session/event') 订阅，把绑定线程的会话最终回复自动贴回 issue/MR。
//   - 本模块零 cordis 依赖：client/agents/controller/store 都以参数注入，可离线测试。
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { briefOfKind } from './webhook.js'

export function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(state))
}

// 提及检测：大小写不敏感的 "@username" 包含判断（GitLab mention 不区分大小写）
export function mentionsUser(body, username) {
  if (!body || !username) return false
  return String(body).toLowerCase().includes('@' + String(username).toLowerCase())
}

const enc = encodeURIComponent // project path "group/proj" → "group%2Fproj"

const targetLabel = (kind, issue) => (kind === 'mr' ? `MR !${issue.iid}` : `Issue #${issue.iid}`)

export function buildMentionPrompt({ project, kind, issue, note }) {
  const desc = String(issue.description || '(无描述)').slice(0, 2000)
  return [
    '## 任务：GitLab 上有新讨论需要响应',
    '',
    `GitLab 上有人在 ${targetLabel(kind, issue)} 里 @ 了你（你是该 GitLab 实例上的 DeepSeek Harness 服务账号）。`,
    '',
    '- 项目：`' + project + '`',
    `- ${targetLabel(kind, issue)}：${issue.title}`,
    issue.web_url ? `- 链接：${issue.web_url}` : '',
    '',
    '### 描述',
    '',
    '> ' + desc.split('\n').join('\n> '),
    '',
    '### 触发本次响应的评论',
    '',
    `> **@${note.author.username}**：${String(note.body).slice(0, 1000)}`,
    '',
    '### 回复通道（重要，务必遵守）',
    '',
    '1. 你的最终回复会由系统自动以服务账号身份贴到该讨论区——**不要自己调用 gitlab_create_note 发回复**（会产生重复评论）；查看类/管理类 GitLab 操作仍可用工具。',
    '2. 人类在该讨论区的后续评论会由系统自动送进本会话，无需他们再次 @ 你——把对话当成持续进行的讨论。',
    '3. 最终回复直接写在你的最后一条消息里：先直接回答，再展开必要细节，篇幅与提问相称。',
    '4. 需要更多上下文时用 gitlab_view_issue / gitlab_list_notes 查看（project 参数用上面的项目，iid 用上面的编号）。',
    '5. 不要执行 GitLab 之外的操作；信息不足时如实说明并追问。',
  ]
    .filter(Boolean)
    .join('\n')
}

// 追问提示词：同线程内的新评论自动送入既有会话（无论是否 @，SA 自己的评论除外）。
export function buildReplyPrompt({ project, kind, issue, note, mentioned }) {
  const via = mentioned ? '@ 了你' : '发布在讨论里（系统自动转发，无需 @）'
  return [
    '## 追问：GitLab 有新评论（自动送入本会话）',
    '',
    '- 项目：`' + project + '`',
    `- ${targetLabel(kind, issue)}：${issue.title || ''}`,
    '',
    `### 新评论（人类用户 @${note.author.username} ${via}，不是你说的）`,
    '',
    '> ' + String(note.body || '').split('\n').join('\n> '),
    '',
    '### 要求',
    '',
    '1. 这是既有讨论的追问：沿用本会话已有上下文继续对话，不要重复查看完整描述；上下文确实不够时才用 gitlab_view_issue / gitlab_list_notes 补充。',
    '2. 角色：上面评论的发言人是用户 @' + note.author.username + '，不要把它当成你自己之前的发言，也不要混淆发言人。',
    '3. 回复通道：你的最终回复由系统自动贴回该讨论区——不要自己调用 gitlab_create_note 发回复。',
    '4. 篇幅：回复的信息量与对方评论的长度和问题相称——短问题简洁答，不要过度展开。',
  ].join('\n')
}

// pipeline 分诊提示词：MR 流水线失败 → 分诊会话。回复自动贴回 MR 评论。
export function buildPipelinePrompt({ project, pipeline, mergeRequest, failedJobs }) {
  const jobs = (failedJobs || []).slice(0, 10)
  const jobLines = jobs.length
    ? jobs.map((j) => `- ${j.name ?? '?'}（stage: ${j.stage ?? '?'}）${j.web_url ? ` ${j.web_url}` : ''}`).join('\n')
    : '-（未能预取失败作业列表；可用 gitlab_api 查询 /projects/:id/pipelines/:pipeline_id/jobs?scope=failed）'
  return [
    '## 任务：MR 流水线失败，需要分诊',
    '',
    'GitLab 上一个 MR 流水线失败了。请分诊：给出根因假设、是否当下可修、修复建议。这是分诊报告，不是让你直接改代码。',
    '',
    '- 项目：`' + project + '`',
    `- MR !${mergeRequest.iid}：${mergeRequest.title || ''}`,
    `- 分支：${mergeRequest.source_branch ?? '?'} → ${mergeRequest.target_branch ?? '?'}`,
    `- 流水线：#${pipeline.id ?? '?'}（ref ${pipeline.ref ?? '?'}，sha ${String(pipeline.sha || '').slice(0, 8) || '?'}）`,
    pipeline.web_url ? `- 流水线链接：${pipeline.web_url}` : '',
    '',
    '### 失败作业',
    '',
    jobLines,
    '',
    '### 排查线索',
    '',
    '- 用 gitlab_api 拉失败作业日志：GET projects/:id/jobs/:job_id/trace（job id 见上面列表），重点看最后的错误段。',
    '- 结合 MR 的改动范围判断失败与本次改动是否相关。',
    '',
    '### 回复通道（重要，务必遵守）',
    '',
    '1. 你的最终回复（分诊结论）会由系统自动以服务账号身份贴到该 MR 评论区——不要自己调用 gitlab_create_note 发回复。',
    '2. 结论结构：一句话根因假设 → 证据（日志关键行）→ 是否阻塞合并 → 建议动作。',
    '3. 信息不足时如实说明缺什么，不要编造日志内容。',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * 自动响应器（会话侧）。mentionUsername 为空 = 功能关闭。
 * saUsername：async () => string，SA 用户名（宿主经 aiToken 查 /user 记忆后注入），
 * 用于防环——SA 名下的评论不回灌会话、不重复响应。
 * client：async () => GitLabApi（pipeline 分诊预取失败作业用，可省略）。
 * pipelineTriage：MR 流水线失败自动分诊开关（默认开）。
 */
export function createResponder({
  agents,
  controller,
  store,
  state,
  stateFile,
  mentionUsername,
  saUsername,
  resolveCwd,
  client,
  pipelineTriage = true,
  maxPerIssuePerHour = 3,
  maxContinuationsPerHour = 30,
  now = Date.now,
}) {
  if (!mentionUsername) {
    return { enabled: false, handle: async () => 'responder-disabled', status: () => ({ enabled: false }) }
  }

  const windowStart = () => now() - 3_600_000
  const keyOf = (event) => `${event.project}#${event.issue?.iid ?? event.merge_request?.iid}`

  function underRateLimit(key, field, max) {
    const log = (state[field]?.[key] || []).filter((t) => t > windowStart())
    return log.length < max
  }

  function recordRate(key, field) {
    state[field] = state[field] || {}
    const arr = (state[field]?.[key] || []).filter((t) => t > windowStart())
    arr.push(now())
    state[field][key] = arr
    saveState(stateFile, state)
  }

  function rememberThread(sessionId, key, event, kind, iid) {
    state.threads = state.threads || {}
    state.threads[key] = { sessionId, updatedAt: new Date().toISOString() }
    // 会话 → 线程 反查索引：出站桥（outbound.js 的 session/event 订阅）据此找到贴回目标。
    state.sessionIndex = state.sessionIndex || {}
    state.sessionIndex[sessionId] = { key, project: event.project, kind, iid }
  }

  async function injectSession(prompt, event, kind, iid) {
    // agents.create 工厂内部自己发布会话（先 sessions.create 同 id 会报 already exists）。
    // meta.cwd 必须给：无 cwd 的会话在组装系统提示词（deployment:persona-suffix 段需要
    // {{cwd}}）时 turn 直接报错结束（_no-cwd 桶 + turn/end reason.error）。
    // meta.agentPreset = 'ptc'：新会话以 PTC（run_code 程序化工具调用）预设启动。
    const sessionId = `session-${randomUUID()}`
    const cwd = resolveCwd ? resolveCwd(event.project) : undefined
    const meta = { agentPreset: 'ptc', ...(cwd ? { cwd } : {}) }
    await agents.create({ sessionId, meta })
    await controller.prompt({
      requestId: randomUUID(),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: prompt }],
    }, new AbortController().signal)
    rememberThread(sessionId, keyOf(event), event, kind, iid)
    saveState(stateFile, state)
    return sessionId
  }

  // pipeline 分诊（MR 流水线失败 → 分诊会话，回复贴回 MR 评论）
  async function handlePipeline(event) {
    const pipeline = event.pipeline
    if (!pipeline || pipeline.status !== 'failed') return 'pipeline-not-failed'
    const mr = event.merge_request
    if (!mr?.iid) return 'pipeline-not-mr' // 仅 MR 流水线触发分诊；分支流水线只落盘
    if (!pipelineTriage) return 'pipeline-triage-disabled'
    if (!agents || typeof agents.create !== 'function') return 'no-agents-service'
    if (!controller || typeof controller.prompt !== 'function') return 'no-session-controller'

    const key = `${event.project}#mr-${mr.iid}`
    if (!underRateLimit(key, 'responded', maxPerIssuePerHour)) return 'rate-limited'

    // 预取失败作业（尽力而为；失败不阻断分诊）
    let failedJobs = Array.isArray(event.failedJobs) ? event.failedJobs : []
    if (!failedJobs.length && pipeline.id && client) {
      try {
        const r = await client()
        const jr = await r.raw({
          path: `/api/v4/projects/${enc(event.project)}/pipelines/${pipeline.id}/jobs`,
          query: { scope: 'failed', per_page: 20 },
        })
        if (Array.isArray(jr.data)) {
          failedJobs = jr.data.map((j) => ({ id: j.id, name: j.name, stage: j.stage, status: j.status, web_url: j.web_url }))
        }
      } catch { /* 预取失败：提示词引导 agent 自查 */ }
    }

    const prompt = buildPipelinePrompt({ project: event.project, pipeline, mergeRequest: mr, failedJobs })
    const sessionId = await injectSession(prompt, event, 'mr', mr.iid)
    recordRate(key, 'responded')
    return `triaged:${sessionId}`
  }

  async function handle(event) {
    if (event.pipeline) return handlePipeline(event)
    const key = keyOf(event)
    const note = event.note
    const author = String(note?.author?.username || '').toLowerCase()
    const body = String(note?.body || '')
    const mentioned = mentionsUser(body, mentionUsername)
    const kind = event.issue ? 'issue' : 'mr'

    // 防环：SA 自己名下的评论（自动贴回的回复）不回灌会话。
    if (saUsername) {
      const sa = await saUsername()
      if (sa && author && author === sa.toLowerCase()) return 'skip-self-note'
    }
    if (author && author === String(mentionUsername).toLowerCase()) return 'skip-self-note'

    if (!agents || typeof agents.create !== 'function') return 'no-agents-service'
    if (!controller || typeof controller.prompt !== 'function') return 'no-session-controller'

    const promptArgs = { project: event.project, kind, issue: event.issue ?? event.merge_request, note }
    // 同一讨论 thread 复用同一会话：后续评论（无需 @）作为追问注入。
    const existing = state.threads?.[key]?.sessionId
    if (existing) {
      // agents.get 缺席（离线 mock/旧宿主）按「线程已不可用」处理。
      const agent = typeof agents.get === 'function' ? agents.get(existing) : null
      if (!agent) {
        if (!mentioned) return 'thread-stale-no-mention'
        // 宿主重启后内存 Agent 已不在：清除映射后回落到新建会话
        state.threads = state.threads || {}
        delete state.threads[key]
        if (state.sessionIndex) delete state.sessionIndex[existing]
      } else {
        if (!underRateLimit(key, 'continuations', maxContinuationsPerHour)) return 'continuation-rate-limited'
        recordRate(key, 'continuations')
        await controller.prompt({
          requestId: randomUUID(),
          sessionId: existing,
          mode: 'queue',
          content: [{ type: 'text', text: buildReplyPrompt({ ...promptArgs, mentioned }) }],
        }, new AbortController().signal)
        return `continued:${existing}`
      }
    }
    if (!mentioned) return 'no-mention'
    if (!underRateLimit(key, 'responded', maxPerIssuePerHour)) return 'rate-limited'

    const prompt = buildMentionPrompt(promptArgs)
    const sessionId = await injectSession(prompt, event, kind, promptArgs.issue.iid)
    recordRate(key, 'responded')
    return `responded:${sessionId}`
  }

  return {
    enabled: true,
    handle,
    status: () => ({ enabled: true, mentionUsername, maxPerIssuePerHour, maxContinuationsPerHour, pipelineTriage }),
  }
}

/** 轮询器。projects 非空才启动；一次 cycle 拉一轮，schedule 回调决定下轮时机。 */
export function createPoller({ client, store, responder, state, stateFile, projects, intervalMs, schedule = setTimeout, now = Date.now }) {
  let timer = null
  let running = false
  let lastCycle = null
  let lastCycleError = null

  async function fetchJson(p, query) {
    const r = await client.raw({ path: p, method: 'GET', query })
    if (r.error) throw new Error(String(r.error))
    return r.data
  }

  async function handleNewNotes(project, kind, item, cursorMs) {
    const notes = (await fetchJson(
      `/api/v4/projects/${enc(project)}/${kind}s/${item.iid}/notes`,
      { sort: 'desc', order_by: 'created_at', per_page: 30 },
    )) || []
    let processed = 0
    for (const n of notes.reverse()) {
      if (n.system) continue
      const nid = `${project}:${kind}:${n.id}`
      if (state.seenNotes?.includes(nid)) continue
      const createdAt = Date.parse(n.created_at)
      if (Number.isFinite(createdAt) && createdAt <= cursorMs) {
        state.seenNotes = state.seenNotes || []
        state.seenNotes.push(nid)
        continue
      }
      state.seenNotes = state.seenNotes || []
      if (state.seenNotes.length > 5000) state.seenNotes.splice(0, 2000)
      state.seenNotes.push(nid)
      processed++
      const target = kind === 'issue'
        ? { issue: { iid: item.iid, title: item.title, description: item.description, state: item.state, web_url: item.web_url } }
        : { merge_request: { iid: item.iid, title: item.title, state: item.state, web_url: item.web_url } }
      const record = {
        receivedAt: new Date().toISOString(),
        uuid: `poll-${nid}`,
        source: 'poll',
        object_kind: 'note',
        project,
        project_id: item.project_id ?? null,
        brief: `${n.author?.username || '?'} 评论 ${kind === 'issue' ? 'issue' : 'MR'} #${item.iid} ${item.title || ''}: ${String(n.body || '').replace(/\s+/g, ' ').slice(0, 80)}`,
        ...target,
        note: { id: n.id, body: n.body ?? '', author: { username: n.author?.username || '', name: n.author?.name || '' } },
      }
      let outcome = 'no-responder'
      try {
        outcome = await responder.handle(record)
      } catch (e) {
        outcome = 'responder-error:' + String((e && e.message) || e).slice(0, 120)
      }
      record.responder = outcome
      store.append(record)
    }
    return processed
  }

  async function cycle() {
    if (running) return { skipped: true, reason: 'previous-cycle-still-running' }
    running = true
    const started = now()
    let notes = 0
    const errors = []
    try {
      const cursorMs = state.lastPollAt ? Date.parse(state.lastPollAt) - 90_000 : now() - 5 * 60_000
      const updatedAfter = new Date(Math.max(0, cursorMs)).toISOString()
      for (const project of projects) {
        try {
          // issues：有更新的 issue 才拉 notes
          const issues = (await fetchJson(`/api/v4/projects/${enc(project)}/issues`, {
            order_by: 'updated_at', sort: 'desc', updated_after: updatedAfter, per_page: 20,
          })) || []
          for (const it of issues) notes += await handleNewNotes(project, 'issue', it, cursorMs)
          // MR notes 同样监听（命中 @mention 一样建会话，回复贴回 MR 评论）
          const mrs = (await fetchJson(`/api/v4/projects/${enc(project)}/merge_requests`, {
            order_by: 'updated_at', sort: 'desc', updated_after: updatedAfter, per_page: 20,
          })) || []
          for (const it of mrs) notes += await handleNewNotes(project, 'merge_request', it, cursorMs)
        } catch (e) {
          errors.push(`${project}: ${String((e && e.message) || e).slice(0, 120)}`)
        }
      }
      state.lastPollAt = new Date(now()).toISOString()
      saveState(stateFile, state)
      lastCycle = { at: new Date(started).toISOString(), notes, errors }
      return { skipped: false, notes, errors }
    } finally {
      running = false
    }
  }

  function scheduleNext() {
    timer = schedule(async () => {
      try {
        await cycle()
      } catch (e) {
        lastCycleError = String((e && e.message) || e)
      }
      if (timer !== null) scheduleNext()
    }, Math.max(10_000, intervalMs))
  }

  return {
    start() {
      if (timer !== null) return
      scheduleNext()
    },
    stop() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
    cycle,
    status() {
      return {
        enabled: projects.length > 0,
        projects,
        intervalMs,
        lastPollAt: state.lastPollAt || null,
        lastCycle,
        lastCycleError,
      }
    },
  }
}

// webhook/ntfy 路由的记录形状（payload 原样）→ responder 事件形状。
// note 事件 → { note, issue|merge_request }；pipeline 事件 → { pipeline, merge_request?, failedJobs }；
// 其余（push/issue/tag_push…）返回 null，仅落盘不进入响应管道。
export function normalizeWebhookRecord(record) {
  const p = record.payload
  if (!p) return null
  if (p.object_kind === 'pipeline') {
    const pa = p.object_attributes || {}
    const mr = p.merge_request
      ? {
          iid: p.merge_request.iid,
          title: p.merge_request.title,
          source_branch: p.merge_request.source_branch,
          target_branch: p.merge_request.target_branch,
          state: p.merge_request.state,
          web_url: p.merge_request.url || p.merge_request.web_url,
        }
      : null
    if (!mr) return null // 非 MR 流水线不进响应管道（只落盘）
    return {
      ...record,
      pipeline: {
        id: pa.id,
        ref: pa.ref,
        sha: pa.sha,
        status: pa.status,
        source: pa.source,
        web_url: pa.web_url || pa.url,
      },
      merge_request: mr,
      failedJobs: Array.isArray(p.builds)
        ? p.builds
            .filter((b) => b && (b.status === 'failed' || b.failure_reason))
            .map((b) => ({ id: b.id, name: b.name, stage: b.stage, status: b.status, web_url: b.web_url }))
        : [],
    }
  }
  if (p.object_kind !== 'note') return null
  const issue = p.issue
    ? { iid: p.issue.iid, title: p.issue.title, description: p.issue.description, state: p.issue.state, web_url: p.issue.web_url }
    : null
  const mr = p.merge_request
    ? { iid: p.merge_request.iid, title: p.merge_request.title, state: p.merge_request.state, web_url: p.merge_request.web_url }
    : null
  if (!issue && !mr) return null
  return {
    ...record,
    ...(issue ? { issue } : { merge_request: mr }),
    note: {
      id: p.object_attributes?.id,
      body: p.object_attributes?.note ?? '',
      author: { username: p.user?.username || '', name: p.user?.name || '' },
    },
  }
}

// 跨源去重标记（webhook / ntfy / poll 共享 state.seenNotes / state.seenPipelines，有界）。
function markSeen(state, field, key) {
  state[field] = state[field] || []
  if (state[field].includes(key)) return false
  state[field].push(key)
  if (state[field].length > 5000) state[field].splice(0, 2000)
  return true
}

/** ntfy 消息处理器工厂：单条消息 → 归一化 → 去重 → 响应 → 入库（导出以便离线测试）。 */
export function makeNtfyMessageHandler({ store, responder, state, stateFile, now = Date.now }) {
  return async function processMessage(m) {
    if (!m || m.event !== 'message' || !m.message) return 'skip-event'
    let payload
    try { payload = JSON.parse(m.message) } catch { return 'skip-unparseable' }
    const kind = payload.object_kind
    const project = payload.project?.path_with_namespace || ''
    const target = kind === 'note' ? (payload.issue ? 'issue' : payload.merge_request ? 'merge_request' : null) : null
    const noteId = payload.object_attributes?.id
    const pipelineId = kind === 'pipeline' ? payload.object_attributes?.id : null
    const seenKey = target && noteId
      ? `${project}:${target}:${noteId}`
      : kind === 'pipeline' && pipelineId
        ? `${project}:pipeline:${pipelineId}`
        : null
    if (seenKey && !markSeen(state, target ? 'seenNotes' : 'seenPipelines', seenKey)) {
      if (m.time) state.ntfySince = m.time
      return 'dedup'
    }
    const record = {
      receivedAt: new Date((m.time || Math.floor(now() / 1000)) * 1000).toISOString(),
      uuid: 'ntfy-' + (m.id || randomUUID()),
      source: 'ntfy',
      object_kind: kind,
      project,
      project_id: payload.project?.id ?? null,
      brief: briefOfKind(kind, payload),
      payload,
    }
    let outcome = 'not-actionable'
    const event = normalizeWebhookRecord(record)
    if (event) {
      try { outcome = await responder.handle(event) } catch (e) { outcome = 'responder-error:' + String((e && e.message) || e).slice(0, 120) }
    }
    record.responder = outcome
    store.append(record)
    if (m.time) { state.ntfySince = m.time; saveState(stateFile, state) }
    return outcome
  }
}

/** ntfy 订阅源：流式 GET /json?since=<游标>，断线 5s 重连；url 为空 = 关闭。 */
export function createNtfySource({ url, token, store, responder, state, stateFile, now = Date.now }) {
  if (!url) return { enabled: false, start() {}, stop() {}, status: () => ({ enabled: false }) }
  let stopped = true
  let lastError = null
  let messages = 0
  const processMessage = makeNtfyMessageHandler({ store, responder, state, stateFile, now })
  async function loop() {
    while (!stopped) {
      try {
        const since = state.ntfySince || Math.floor(now() / 1000) - 600
        const r = await fetch(`${url.replace(/\/$/, '')}/json?since=${since}`, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
        if (!r.ok || !r.body) throw new Error('http ' + r.status)
        const decoder = new TextDecoder()
        let buf = ''
        for await (const chunk of r.body) {
          if (stopped) return
          buf += decoder.decode(chunk, { stream: true })
          let idx
          while ((idx = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, idx).trim()
            buf = buf.slice(idx + 1)
            if (!line) continue
            try { if ((await processMessage(JSON.parse(line))) !== 'skip-event') messages++ } catch (e) { lastError = 'line:' + String((e && e.message) || e).slice(0, 100) }
          }
        }
      } catch (e) {
        lastError = String((e && e.message) || e).slice(0, 120)
      }
      if (stopped) return
      await new Promise((res) => setTimeout(res, 5000))
    }
  }
  return {
    enabled: true,
    start() { if (!stopped) return; stopped = false; loop() },
    stop() { stopped = true },
    status: () => ({ enabled: true, url, messages, lastError }),
  }
}

/**
 * 组合层：responder + poller + webhook/ntfy 记录响应入口 + 冒烟探针。
 * client 是 async () => GitLabApi 工厂（aiToken 优先，见 index.js getClient）。
 * agents/controller 是宿主服务（ctx.agents / ctx.sessionController）。
 * saUsername 是 async () => string（SA 用户名，宿主记忆后注入，用于防环）。
 * respond() 是推送源的统一入口：跨源去重（webhook↔ntfy↔poll 不重复响应）后进 responder。
 */
export function createListener({ client, agents, controller, store, state, stateFile, projects, intervalMs, mentionUsername, saUsername, resolveCwd, pipelineTriage, schedule, maxPerIssuePerHour, maxContinuationsPerHour }) {
  const responder = createResponder({ agents, controller, store, state, stateFile, mentionUsername, saUsername, resolveCwd, client, pipelineTriage, maxPerIssuePerHour, maxContinuationsPerHour })
  const poller = createPoller({ client, store, responder, state, stateFile, projects, intervalMs, ...(schedule ? { schedule } : {}) })

  // webhook/ntfy 路由回调：归一化 → 中央去重 → responder。
  // 去重与轮询器共享 state.seenNotes / state.seenPipelines：GitLab 重试、socat 重发、
  // 轮询兜底撞车，同一事件只响应一次。标记先于响应（限流/跳过的决定对该事件是终态）。
  async function respond(record) {
    if (!responder.enabled) return 'responder-disabled'
    const event = normalizeWebhookRecord(record)
    if (!event) return 'not-actionable'
    if (event.note) {
      const target = event.issue ? 'issue' : 'merge_request'
      const seenKey = `${event.project}:${target}:${event.note.id}`
      if (!markSeen(state, 'seenNotes', seenKey)) return 'dedup'
    } else if (event.pipeline) {
      const seenKey = `${event.project}:pipeline:${event.pipeline.id ?? '?'}`
      if (!markSeen(state, 'seenPipelines', seenKey)) return 'dedup'
    }
    return responder.handle(event)
  }

  // 冒烟探针：按宿主两步链实测会话注入（agents.create 一体化建会话+挂 agent → controller.prompt），只发一句 pong。
  async function injectProbe() {
    const out = { agentsService: false, controllerService: false, agent: false, prompt: false, sessionId: null, error: null }
    try {
      out.agentsService = Boolean(agents && typeof agents.create === 'function')
      out.controllerService = Boolean(controller && typeof controller.prompt === 'function')
      if (!out.agentsService || !out.controllerService) {
        out.error = '服务缺失：agents=' + out.agentsService + ' sessionController=' + out.controllerService
        return out
      }
      out.sessionId = `session-${randomUUID()}`
      const cwd = resolveCwd ? resolveCwd('') : undefined
      await agents.create({ sessionId: out.sessionId, meta: { agentPreset: 'ptc', ...(cwd ? { cwd } : {}) } })
      out.agent = true
      await controller.prompt({
        requestId: randomUUID(),
        sessionId: out.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: '冒烟测试：只回复 pong 两个字母，不要使用任何工具。' }],
      }, new AbortController().signal)
      out.prompt = true
    } catch (e) {
      out.error = String((e && e.message) || e).slice(0, 250)
    }
    return out
  }

  return { responder, poller, respond, injectProbe }
}
