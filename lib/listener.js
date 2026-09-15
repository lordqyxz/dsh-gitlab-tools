// GitLab 事件拉取源（轮询器）+ issue @mention 自动响应器。
// 设计：
//   - Poller：定时拉 tracked projects 的 issues/MRs（updated_after 游标）→ 新 notes →
//     归一化事件（写入 EventStore）→ 交给 responder。游标与已见 note id 落盘，重启不重放。
//   - Responder：note + issue 上下文 + 正文含 @mentionUsername → 创建会话并注入提示词
//     （agent 自己用 gitlab_create_note 以 aiToken/SA 身份回复）→ 防环（忽略 SA 自己的
//     note）+ 每 issue 频率上限。
//   - 本模块零 cordis 依赖：client/sessions/store 都以参数注入，可离线测试。
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

export function buildMentionPrompt({ project, issue, note }) {
  const desc = String(issue.description || '(无描述)').slice(0, 2000)
  return [
    '## 任务：GitLab issue 被提及，需要响应',
    '',
    `GitLab 上有人在 issue 里 @ 了你（你是该 GitLab 实例上的 DeepSeek Harness 服务账号）。`,
    '',
    '- 项目：`' + project + '`',
    `- Issue #${issue.iid}：${issue.title}`,
    issue.web_url ? `- 链接：${issue.web_url}` : '',
    '',
    '### Issue 描述',
    '',
    '> ' + desc.split('\n').join('\n> '),
    '',
    '### 触发本次响应的评论',
    '',
    `> **@${note.author.username}**：${String(note.body).slice(0, 1000)}`,
    '',
    '### 要求',
    '',
    '1. 需要更多上下文时用 gitlab_view_issue / gitlab_list_notes 查看（project 参数用上面的项目，iid 用上面的编号）。',
    '2. 分析问题并组织一次有帮助的回复：先直接回答，再展开必要细节。',
    '3. 用 gitlab_create_note 把回复发到该 issue（project 与 iid 同上）。回复以服务账号身份发出，语气专业、简洁。',
    '4. 不要执行 GitLab 之外的操作；信息不足时如实说明并追问。',
  ]
    .filter(Boolean)
    .join('\n')
}

// 追问提示词：同一 issue 已有会话，只注入新增评论（角色明确：评论来自人类用户，不是助手自己说的）。
export function buildReplyPrompt({ project, issue, note }) {
  return [
    '## 追问：GitLab issue 有新评论（继续本次会话）',
    '',
    '- 项目：`' + project + '`',
    '- Issue #' + issue.iid + '：' + (issue.title || ''),
    '',
    '### 新评论（人类用户 @' + note.author.username + ' 发的，不是你说的）',
    '',
    '> ' + String(note.body || '').split('\n').join('\n> '),
    '',
    '### 要求',
    '',
    '1. 这是既有讨论的追问：沿用本会话已有上下文继续对话，不要重复查看完整 issue 描述；上下文确实不够时才用 gitlab_view_issue / gitlab_list_notes 补充。',
    '2. 角色：上面评论的发言人是用户 @' + note.author.username + '，不要把它当成你自己之前的发言，也不要混淆发言人。',
    '3. 篇幅：回复的信息量与对方评论的长度和问题相称——短问题简洁答，不要过度展开。',
    '4. 用 gitlab_create_note 把回复发到该 issue（project 与 iid 同上），以服务账号身份发出。',
  ].join('\n')
}

/**
 * 自动响应器。mentionUsername 为空 = 功能关闭。
 * 宿主注入链（冒烟路由实证后的三步）：ctx.sessions.create() 建 Session 实例 →
 * ctx.agents.create({ sessionId }) 挂载 agent（loop 就绪）→ ctx.sessionController.prompt()
 * 提交提示词（GUI 发消息走的同一宿主 API）。
 */
export function createResponder({ agents, controller, store, state, stateFile, mentionUsername, resolveCwd, maxPerIssuePerHour = 3, now = Date.now }) {
  if (!mentionUsername) {
    return { enabled: false, handle: async () => 'responder-disabled', status: () => ({ enabled: false }) }
  }

  const windowStart = () => now() - 3_600_000
  const keyOf = (event) => `${event.project}#${event.issue?.iid ?? event.merge_request?.iid}`

  function underRateLimit(key) {
    const log = (state.responded?.[key] || []).filter((t) => t > windowStart())
    return log.length < maxPerIssuePerHour
  }

  function recordResponse(key) {
    state.responded = state.responded || {}
    const arr = (state.responded[key] || []).filter((t) => t > windowStart())
    arr.push(now())
    state.responded[key] = arr
    saveState(stateFile, state)
  }

  async function handle(event) {
    const key = keyOf(event)
    if (!mentionsUser(event.note?.body, mentionUsername)) return 'no-mention'
    if (String(event.note?.author?.username || '').toLowerCase() === String(mentionUsername).toLowerCase()) {
      return 'skip-self-note' // 防环：SA 自己的评论也会作为 note 出现
    }
    if (!underRateLimit(key)) return 'rate-limited'
    if (!agents || typeof agents.create !== 'function') return 'no-agents-service'
    if (!controller || typeof controller.prompt !== 'function') return 'no-session-controller'

    const promptArgs = { project: event.project, issue: event.issue ?? event.merge_request, note: event.note }
    // 同一 issue 的讨论 thread 复用同一会话：后续 @mention 只把新评论作为追问注入，不新开会话。
    const existing = state.threads?.[key]?.sessionId
    if (existing) {
      try {
        await controller.prompt({
          requestId: randomUUID(),
          sessionId: existing,
          mode: 'queue',
          content: [{ type: 'text', text: buildReplyPrompt(promptArgs) }],
        }, new AbortController().signal)
        recordResponse(key)
        return `continued:${existing}`
      } catch {
        // 会话已不可用（被删除/异常），清除映射后回落到新建会话
        state.threads = state.threads || {}
        delete state.threads[key]
      }
    }
    const prompt = buildMentionPrompt(promptArgs)
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
    state.threads = state.threads || {}
    state.threads[key] = { sessionId, updatedAt: new Date().toISOString() }
    saveState(stateFile, state)
    recordResponse(key)
    return `responded:${sessionId}`
  }

  return {
    enabled: true,
    handle,
    status: () => ({ enabled: true, mentionUsername, maxPerIssuePerHour }),
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
    const idKey = kind === 'issue' ? 'iid' : 'iid'
    const notes = (await fetchJson(
      `/api/v4/projects/${enc(project)}/${kind}s/${item[idKey]}/notes`,
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
          // MR notes 同样监听（响应器只对 issue 自动响应，MR 仅落盘）
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

// webhook 路由的记录形状（payload 原样）→ responder 事件形状（note/issue 顶层字段）
export function normalizeWebhookRecord(record) {
  const p = record.payload
  if (!p || p.object_kind !== 'note') return null
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
    const seenKey = target && noteId ? `${project}:${target}:${noteId}` : null
    if (seenKey) {
      state.seenNotes = state.seenNotes || []
      if (state.seenNotes.includes(seenKey)) { if (m.time) state.ntfySince = m.time; return 'dedup' }
      state.seenNotes.push(seenKey)
      if (state.seenNotes.length > 5000) state.seenNotes.splice(0, 2000)
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
 * 组合层：responder + poller + webhook 记录响应入口 + 冒烟探针。
 * client 是 async () => GitLabApi 工厂（aiToken 优先，见 index.js getClient）。
 * sessions/agents/controller 是宿主三服务（ctx.sessions / ctx.agents / ctx.sessionController）。
 */
export function createListener({ client, agents, controller, store, state, stateFile, projects, intervalMs, mentionUsername, resolveCwd, schedule, maxPerIssuePerHour }) {
  const responder = createResponder({ agents, controller, store, state, stateFile, mentionUsername, resolveCwd, maxPerIssuePerHour })
  const poller = createPoller({ client, store, responder, state, stateFile, projects, intervalMs, ...(schedule ? { schedule } : {}) })

  // webhook 路由回调：把 GitLab 原始 payload 归一化后交给 responder
  async function respond(record) {
    if (!responder.enabled) return 'responder-disabled'
    const event = normalizeWebhookRecord(record)
    if (!event) return 'not-issue-note'
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
