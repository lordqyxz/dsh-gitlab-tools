// dsh-gitlab-tools — offline verification (no running DSH needed).
//  1. host lib/index.js imports cleanly (syntax + SDK load)
//  2. /gitlab-tools routes behave: status / settings GET+POST / issues / 404
//  3. browser bundle lib/client.js loads through window.__ModuleLoader__ and
//     registers a dsh-better-sidebar tab + settings.section slot
import { Readable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const assert = (cond, msg) => {
  if (cond) console.log('  ok —', msg)
  else { failures++; console.error('  FAIL —', msg) }
}

// ── 1. host loads ────────────────────────────────────────────────────────────
const mod = await import(join(ROOT, 'lib/index.js'))
assert(typeof mod.apply === 'function' && mod.inject.includes('tools'), 'host apply + inject')

// ── 2. host routes (mock ctx) ────────────────────────────────────────────────
function makeCtx(config) {
  const routes = []
  const tools = []
  const userLayer = {}
  const creds = new Map()
  const ctx = {
    logger: { info() {}, warn() {} },
    tools: { register(t) { tools.push(t) } },
    credentials: {
      resolve: async (ref) => { const v = creds.get(ref); return v === undefined ? undefined : { value: v, source: 'mock' } },
      describe: async (ref) => ({ configured: creds.has(ref), source: creds.has(ref) ? 'mock' : undefined, writable: true }),
      set: async (ref, value) => { creds.set(ref, value) },
      unset: async (ref) => { creds.delete(ref) },
    },
    settings: {
      register(ns, _schema, { base }) {
        const current = { ...base }
        return {
          get: () => current,
          async update(patch) { Object.assign(current, patch); Object.assign(userLayer, patch) },
          watch() { return () => {} },
        }
      },
    },
    webServer: { register(route) { routes.push(route); return () => {} } },
    on(event, fn) { return () => {} },
    effect(fn) { const ret = fn(); return ret },
  }
  return { ctx, routes, tools, userLayer, creds }
}

function makeRes() {
  return {
    _status: null,
    _headers: {},
    _data: '',
    writeHead(status, headers) { this._status = status; this._headers = headers || {}; return this },
    end(data) { this._data = data },
  }
}

function makeReq(method, path, body, headers) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = path
  req.headers = headers || {}
  return req
}

async function call(route, method, path, body, headers) {
  const res = makeRes()
  await route.handler(makeReq(method, path, body, headers), res)
  return { status: res._status, json: res._data ? JSON.parse(res._data) : null }
}

// configured instance
const { ctx, routes, userLayer, creds } = makeCtx()
await mod.apply(ctx, { host: 'https://gl.example.com', token: 'glpat-x', defaultProject: '', perPage: 20, timeoutMs: 60000 })
const route = routes.find((r) => r.kind === 'prefix' && r.path === '/gitlab-tools')
assert(Boolean(route), 'registers /gitlab-tools prefix route')

let r = await call(route, 'GET', '/gitlab-tools/status')
assert(r.status === 200 && r.json.ok === true && r.json.configured === true, 'GET /status → configured=true')

r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.ok === true && r.json.defaultProject === '' && r.json.host === 'https://gl.example.com' && r.json.refreshMs === 120000, 'GET /settings → defaults (host = config fallback)')

r = await call(route, 'POST', '/gitlab-tools/settings', { host: 'https://new.example.com:8443' })
assert(r.status === 200 && r.json.ok === true && r.json.host === 'https://new.example.com:8443', 'POST /settings → persists host')

r = await call(route, 'POST', '/gitlab-tools/settings', { host: 12345 })
assert(r.status === 400 && r.json.code === 'config', 'POST /settings → rejects non-string host')

r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.tokenConfigured === true && !('token' in r.json), 'GET /settings → tokenConfigured=true, token 明文不回显')

r = await call(route, 'POST', '/gitlab-tools/settings', { token: 'glpat-abcdef123456' })
assert(r.status === 200 && r.json.ok === true, 'POST /settings → set token')
assert(creds.get('gitlabToolsToken') === 'glpat-abcdef123456' && !('token' in userLayer), 'token 存进 credentials（.credentials.yaml），不进 settings')
r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.tokenConfigured === true && !('token' in r.json), 'GET /settings → 新 token 已生效且不回显')

r = await call(route, 'POST', '/gitlab-tools/settings', { token: 123 })
assert(r.status === 400 && r.json.code === 'config', 'POST /settings → rejects non-string token')

r = await call(route, 'POST', '/gitlab-tools/settings', { token: '' })
assert(r.status === 200 && r.json.ok === true, 'POST /settings → clear token')
assert(!creds.has('gitlabToolsToken'), '清除 token → 从 credentials 移除')
r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.tokenConfigured === true, 'GET /settings → 清除凭据 token 后回落 config token，仍 configured')

// AI 专属 token（DeepSeek Harness 身份，可选用）
r = await call(route, 'POST', '/gitlab-tools/settings', { aiToken: 'glpat-ai-bot-123456' })
assert(r.status === 200 && r.json.ok === true, 'POST /settings → set aiToken')
assert(creds.get('gitlabToolsAiToken') === 'glpat-ai-bot-123456' && !('aiToken' in userLayer), 'aiToken 存进 credentials，不进 settings')
r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.aiTokenConfigured === true && !('aiToken' in r.json), 'GET /settings → aiTokenConfigured=true，明文不回显')
r = await call(route, 'POST', '/gitlab-tools/settings', { aiToken: 123 })
assert(r.status === 400 && r.json.code === 'config', 'POST /settings → rejects non-string aiToken')
r = await call(route, 'POST', '/gitlab-tools/settings', { aiToken: '' })
assert(r.status === 200 && r.json.ok === true, 'POST /settings → clear aiToken')
assert(!creds.has('gitlabToolsAiToken'), '清除 aiToken → 从 credentials 移除')

r = await call(route, 'POST', '/gitlab-tools/settings', { defaultProject: 'group/proj', refreshMs: 300000 })
assert(r.status === 200 && r.json.ok === true && r.json.defaultProject === 'group/proj', 'POST /settings → persists defaultProject')

r = await call(route, 'POST', '/gitlab-tools/settings', { evil: 'x', refreshMs: 1 })
assert(r.status === 400 && r.json.code === 'config', 'POST /settings → rejects out-of-range refreshMs')

// new inline detail + discussion routes: parameter validation (no SDK hit)
r = await call(route, 'GET', '/gitlab-tools/issue?project=p')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'params', 'GET /issue → missing iid rejected')
r = await call(route, 'GET', '/gitlab-tools/issue/notes?project=p')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'params', 'GET /issue/notes → missing iid rejected')
r = await call(route, 'POST', '/gitlab-tools/issue/notes?project=p&iid=1', { body: '   ' })
assert(r.status === 400 && r.json.ok === false && r.json.code === 'params', 'POST /issue/notes → empty body rejected')

r = await call(route, 'GET', '/gitlab-tools/nope')
assert(r.status === 404, 'unknown route → 404')

// unconfigured instance
const { ctx: ctx2, routes: routes2 } = makeCtx()
await mod.apply(ctx2, { host: '', token: '', defaultProject: '', perPage: 20, timeoutMs: 60000 })
const route2 = routes2.find((x) => x.kind === 'prefix' && x.path === '/gitlab-tools')
r = await call(route2, 'GET', '/gitlab-tools/status')
assert(r.status === 200 && r.json.configured === false, 'unconfigured → GET /status configured=false')
r = await call(route2, 'GET', '/gitlab-tools/issues?project=group/proj')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'not_configured', 'unconfigured → /issues not_configured')
r = await call(route2, 'GET', '/gitlab-tools/issue?project=p&iid=1')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'not_configured', 'unconfigured → /issue not_configured')
r = await call(route2, 'GET', '/gitlab-tools/issue/notes?project=p&iid=1')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'not_configured', 'unconfigured → /issue/notes not_configured')
r = await call(route2, 'POST', '/gitlab-tools/issue/notes?project=p&iid=1', { body: 'hi' })
assert(r.status === 200 && r.json.ok === false && r.json.code === 'not_configured', 'unconfigured → POST /issue/notes not_configured')

// ── 3. browser bundle structure ──────────────────────────────────────────────
globalThis.window = { __ModuleLoader__: { load: (def) => { globalThis.__cap = def } } }
// micromark's decode-named-character-reference creates a DOM <i> at module load
// to decode entities; the browser always has `document`, Node doesn't — stub it.
globalThis.document = {
  createElement: () => {
    let innerHTML = ""
    return {
      set innerHTML(v) { innerHTML = v },
      get textContent() { return "" }, // entity decode → false (literal text), fine for structural checks
      appendChild() {},
    }
  },
  head: { appendChild() {} },
}
;(0, eval)(readFileSync(join(ROOT, 'lib/client.js'), 'utf8'))
const def = globalThis.__cap
assert(def && def.id === 'dsh-gitlab-tools' && typeof def.factory === 'function', 'bundle wrapped in ModuleLoader.load')

const reactStub = {
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useCallback: (f) => f,
  useRef: (v) => ({ current: v }),
  useMemo: (f) => f(),
}
const jsxStub = { jsx: (t) => t, jsxs: (t) => t, Fragment: 'frag' }
const loaded = def.factory((id) => ({ react: reactStub, 'react/jsx-runtime': jsxStub })[id])
assert(Array.isArray(loaded.inject) && loaded.inject.includes('slots'), 'client inject=["slots"]')
assert(typeof loaded.apply === 'function', 'client exports apply')

const registered = []
const tabs = []
const slots = {
  register: (entry, component) => ({ ...entry, component }),
  inject: (name, factory) => { registered.push({ name, entry: factory() }) },
}
const fakeBetterSidebar = {
  registerTab: (descriptor) => { tabs.push(descriptor); return () => {} },
}
// Real-cordis twins: effect() runs its callback now (disposer = return value);
// inject(services, cb) parks until the services exist — in the mock they exist,
// so the callback runs immediately with the services declared on the sub-ctx.
const clientCtx = {
  slots,
  effect: (fn) => fn(),
  betterSidebar: undefined,
}
clientCtx.inject = (services, cb) => {
  if (services.includes('betterSidebar')) clientCtx.betterSidebar = fakeBetterSidebar
  cb(clientCtx)
  return { dispose: () => {} }
}
loaded.apply(clientCtx)
const overlay = registered.find((e) => e.name === 'shell.overlay')
assert(!overlay, 'no shell.overlay entry (moved into better-sidebar)')
const section = registered.find((e) => e.name === 'settings.section')
assert(Boolean(section) && section.entry.id === 'gitlab-tools' && section.entry.label === 'GitLab Issues', 'registers settings.section entry')
assert(tabs.length === 1 && tabs[0].id === 'gitlab-tools:issues' && tabs[0].single === true && typeof tabs[0].component === 'function' && typeof tabs[0].icon === 'function', 'registers better-sidebar tab gitlab-tools:issues')
const decl = tabs[0].settings?.pluginToggles ?? []
assert(decl.length === 2 && decl.some((r) => r.key === 'defaultProject' && r.type === 'text') && decl.some((r) => r.key === 'refreshMs' && r.type === 'number'), 'declares pluginToggles settings (defaultProject/refreshMs)')

// ── 4. webhook 接收端点（可选功能，config.webhookSecretToken）──────────────
const { ctx: wctx, routes: wroutes, tools: wtools } = makeCtx()
await mod.apply(wctx, {
  host: 'https://gl.example.com', token: 'glpat-x', timeoutMs: 60000,
  webhookSecretToken: 'whsec-1',
  webhookEventsFile: join(tmpdir(), `gl-webhook-test-${process.pid}-${Date.now()}.jsonl`),
})
const wroute = wroutes.find((r) => r.kind === 'prefix' && r.path === '/gitlab-tools')
const pushBody = { object_kind: 'push', user_name: 'alice', ref: 'refs/heads/main', total_commits_count: 2, project: { id: 7, path_with_namespace: 'group/demo' } }
let wr = await call(wroute, 'POST', '/gitlab-tools/webhook', pushBody, { 'x-gitlab-token': 'bad' })
assert(wr.status === 401, 'webhook: 错 token → 401')
wr = await call(wroute, 'GET', '/gitlab-tools/webhook', undefined, { 'x-gitlab-token': 'whsec-1' })
assert(wr.status === 405, 'webhook: GET → 405')
wr = await call(wroute, 'POST', '/gitlab-tools/webhook', pushBody, { 'x-gitlab-token': 'whsec-1', 'x-gitlab-webhook-uuid': 'u-1' })
assert(wr.status === 200 && wr.json.ok === true, 'webhook: 合法 push → 200 落盘')
wr = await call(wroute, 'POST', '/gitlab-tools/webhook', pushBody, { 'x-gitlab-token': 'whsec-1', 'x-gitlab-webhook-uuid': 'u-1' })
assert(wr.status === 200 && wr.json.dedup === true, 'webhook: 同 uuid 重发 → dedup 不重复落盘')
const noteBody = { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 12, title: '登录页崩溃' }, object_attributes: { note: '@agent-bot 看一下' }, project: { id: 7, path_with_namespace: 'group/demo' } }
wr = await call(wroute, 'POST', '/gitlab-tools/webhook', noteBody, { 'x-gitlab-token': 'whsec-1', 'x-gitlab-webhook-uuid': 'u-2' })
assert(wr.status === 200, 'webhook: note 事件 → 200')
const evTool = wtools.find((t) => t.name === 'gitlab_webhook_events')
assert(Boolean(evTool), 'webhook: 注册 gitlab_webhook_events 工具')
const evOut = await evTool.execute({ detail: false })
assert(evOut.text.includes('接收器状态') && evOut.text.includes('bob 评论 issue #12'), 'webhook: 查询工具输出状态+note 摘要')
assert(Array.isArray(evOut.json.events) && evOut.json.events.length === 2, 'webhook: 查询工具 json.events')

// 未启用实例：路由 404 webhook-disabled，工具报未启用
const { ctx: dctx, routes: droutes, tools: dtools } = makeCtx()
await mod.apply(dctx, { host: 'https://gl.example.com', token: 'glpat-x', timeoutMs: 60000 })
const droute = droutes.find((r) => r.kind === 'prefix' && r.path === '/gitlab-tools')
const dr = await call(droute, 'POST', '/gitlab-tools/webhook', pushBody)
assert(dr.status === 404 && dr.json.code === 'webhook-disabled', 'webhook: 未启用 → 404 webhook-disabled')
const dTool = dtools.find((t) => t.name === 'gitlab_webhook_events')
const dOut = await dTool.execute({})
assert(dOut.text.includes('webhook=off') && dOut.text.includes('轮询=off'), 'webhook: 未启用时查询工具如实报告（webhook=off）')

// ── 5. listener：响应器 + 轮询器（离线单测，不碰定时器）───────────────────
const lst = await import(join(ROOT, 'lib/listener.js'))
assert(lst.mentionsUser('@agent-bot 看看', 'agent-bot') && !lst.mentionsUser('普通评论', 'agent-bot'), 'listener: mentionsUser 命中/不误触')

const lstStateFile = join(tmpdir(), `gl-listener-${process.pid}-${Date.now()}.json`)
const lstState = {}
const lstEvents = []
const lstStore = { append(rec) { lstEvents.push(rec) } }
const promptCalls = []
const agentCreates = []
const mockAgents = { create: async (opts) => { agentCreates.push(opts); return { agent: {}, dispose: async () => {} } } }
const mockController = { prompt: async (req) => { promptCalls.push(req) } }
const responder = lst.createResponder({ agents: mockAgents, controller: mockController, store: lstStore, state: lstState, stateFile: lstStateFile, mentionUsername: 'agent-bot', resolveCwd: () => '/Users/apple/dev' })
const hitNote = (author) => ({ project: 'g/p', issue: { iid: 1, title: 't', description: 'd' }, note: { body: '@agent-bot 帮我看下', author: { username: author } } })
assert((await responder.handle({ project: 'g/p', issue: { iid: 1 }, note: { body: '随便说说', author: { username: 'bob' } } })) === 'no-mention', 'listener: 无 @mention → no-mention')
assert((await responder.handle(hitNote('agent-bot'))) === 'skip-self-note', 'listener: SA 自己的 note → skip-self-note（防环）')
const o3 = await responder.handle(hitNote('bob'))
assert(o3.startsWith('responded:session-'), 'listener: 命中 → 创建会话注入（' + o3 + '）')
assert(promptCalls.length === 1 && promptCalls[0].mode === 'queue' && promptCalls[0].content[0].text.includes('gitlab_create_note') && agentCreates.length === 1 && /^session-[0-9a-f-]{36}$/.test(agentCreates[0].sessionId) && agentCreates[0].meta?.cwd === '/Users/apple/dev', 'listener: 两步链注入（sessionId+meta.cwd+queue+回复指令）')
await responder.handle(hitNote('bob'))
await responder.handle(hitNote('bob'))
assert((await responder.handle(hitNote('bob'))) === 'rate-limited', 'listener: 每 issue 频率上限（第 4 次/小时被限）')
const responder2 = lst.createResponder({ store: lstStore, state: {}, stateFile: lstStateFile, mentionUsername: 'agent-bot' })
assert((await responder2.handle(hitNote('bob'))) === 'no-agents-service', 'listener: 无 agents 服务 → 降级 no-agents-service')

// 轮询器：mock client.raw（issues / merge_requests / notes 三个端点）
const pollEvents = []
const pollState = {}
const pollStateFile = join(tmpdir(), `gl-poll-${process.pid}-${Date.now()}.json`)
const mkNote = (id, msAgo, body, author = 'bob') => ({ id, created_at: new Date(Date.now() - msAgo).toISOString(), body, author: { username: author }, system: false })
const mockClient = {
  raw: async ({ path }) => {
    if (path.endsWith('/issues')) return { data: [{ iid: 12, title: '登录页崩溃', description: 'desc', state: 'opened', web_url: 'u', project_id: 7 }] }
    if (path.includes('/merge_requests')) return { data: [] }
    if (path.includes('/notes')) return { data: [mkNote(900, 1000, '@agent-bot 看下'), mkNote(890, 600000, '旧评论'), { ...mkNote(895, 1000, '系统通知', 'x'), system: true }] }
    return { data: [] }
  },
}
const pollResponder = lst.createResponder({ agents: mockAgents, controller: mockController, store: { append() {} }, state: {}, stateFile: pollStateFile, mentionUsername: 'agent-bot' })
const poller = lst.createPoller({ client: mockClient, store: { append(rec) { pollEvents.push(rec) } }, responder: pollResponder, state: pollState, stateFile: pollStateFile, projects: ['g/p'], intervalMs: 30000 })
const r1 = await poller.cycle()
assert(r1.notes === 1, 'listener: 轮询拉到 1 条新 note（旧评论/系统注释剔除）')
assert(pollEvents.length === 1 && pollEvents[0].source === 'poll' && String(pollEvents[0].responder).startsWith('responded:'), 'listener: 轮询事件入库（source=poll）并触发响应')
assert(pollState.lastPollAt && pollState.seenNotes.includes('g/p:issue:900'), 'listener: 游标与已见 note id 落盘')
const r2 = await poller.cycle()
assert(r2.notes === 0 && pollEvents.length === 1, 'listener: 第二轮去重不再入库')
const wh = lst.normalizeWebhookRecord({ payload: { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 3, title: 'T' }, object_attributes: { id: 9, note: '@agent-bot hi' } } })
assert(wh && wh.note.body === '@agent-bot hi' && wh.issue.iid === 3, 'listener: webhook 记录归一化为响应事件')

// ntfy 订阅源消息处理器：入库/响应/跨源去重
const ntfyEvents = []
const ntfyState = {}
const ntfyStateFile = join(tmpdir(), `gl-ntfy-${process.pid}-${Date.now()}.json`)
const ntfyResponder = lst.createResponder({ agents: mockAgents, controller: mockController, store: { append() {} }, state: {}, stateFile: ntfyStateFile, mentionUsername: 'agent-bot' })
const handleNtfy = lst.makeNtfyMessageHandler({ store: { append(rec) { ntfyEvents.push(rec) } }, responder: ntfyResponder, state: ntfyState, stateFile: ntfyStateFile })
const msg = (id, time, payload) => ({ id, time, event: 'message', message: JSON.stringify(payload) })
assert((await handleNtfy({ id: 'x', event: 'open' })) === 'skip-event', 'ntfy: 非 message 事件跳过')
const oN1 = await handleNtfy(msg('m1', 1789100000, { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 12, title: 'T' }, object_attributes: { id: 900, note: '@agent-bot ntfy 测试' }, project: { id: 14, path_with_namespace: 'ty/data-flow' } }))
assert(oN1.startsWith('responded:session-'), 'ntfy: note 命中 → 注入会话（' + oN1 + '）')
assert(ntfyEvents.length === 1 && ntfyEvents[0].source === 'ntfy' && ntfyEvents[0].project === 'ty/data-flow', 'ntfy: 事件入库 source=ntfy')
assert((await handleNtfy(msg('m2', 1789100001, { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 12 }, object_attributes: { id: 900, note: '重复' }, project: { path_with_namespace: 'ty/data-flow' } }))) === 'dedup', 'ntfy: 同 note 再来 → 跨源去重 dedup')
const oN3 = await handleNtfy(msg('m3', 1789100002, { object_kind: 'push', project: { path_with_namespace: 'ty/data-flow' } }))
assert(oN3 === 'not-actionable' && ntfyEvents.length === 2, 'ntfy: push 事件入库但不触发响应')
assert(ntfyState.ntfySince === 1789100002, 'ntfy: since 游标推进')

// ── 6. outbound：session/event → 贴回 GitLab（issue/MR 双通道）─────────────
const ob = await import(join(ROOT, 'lib/outbound.js'))
const obState = {
  sessionIndex: {
    'session-1': { key: 'g/p#1', project: 'g/p', kind: 'issue', iid: 1 },
    'session-2': { key: 'g/p#2', project: 'g/p', kind: 'mr', iid: 9 },
  },
}
const obPosts = []
const obClient = { raw: async ({ path, method, body }) => { obPosts.push({ path, method, body }); return { data: { id: 500 + obPosts.length } } } }
const obStateFile = join(tmpdir(), 'gl-ob-' + process.pid + '-' + Date.now() + '.json')
const outbound = ob.createOutbound({ client: async () => obClient, state: obState, stateFile: obStateFile })
const evs = (turn, text, interrupted) => ({ type: 'assistant/message', data: { turn, interrupted, message: { content: [{ type: 'text', text }] } } })
assert(ob.extractFinalText([evs(1, '第一版', true), evs(1, '最终回复'), { type: 'tool/call' }], 1) === '最终回复', 'outbound: extractFinalText 取最后一条未中断文本')
const mkSess = (id, events) => ({ id, events })
assert((await outbound.handleSessionEvent(mkSess('session-x', []), { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })) === 'not-bound', 'outbound: 未绑定会话跳过')
assert((await outbound.handleSessionEvent(mkSess('session-1', []), { type: 'turn/end', data: { turn: 1, reason: { kind: 'aborted' } } })) === 'skip-reason:aborted', 'outbound: aborted turn 不贴回')
const o1 = await outbound.handleSessionEvent(mkSess('session-1', [evs(1, '这是最终回复')]), { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
assert(o1 === 'posted:note-501' && obPosts.length === 1 && obPosts[0].path === '/api/v4/projects/g%2Fp/issues/1/notes' && obPosts[0].method === 'POST' && obPosts[0].body.body === '这是最终回复', 'outbound: issue 绑定 → POST issue notes（' + o1 + '）')
assert((await outbound.handleSessionEvent(mkSess('session-1', [evs(1, '这是最终回复')]), { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })) === 'already-posted', 'outbound: 同 (session,turn) 只贴一次')
const o2a = await outbound.handleSessionEvent(mkSess('session-2', []), { type: 'assistant/message', data: { turn: 2, message: { content: [{ type: 'text', text: 'MR 分诊结论' }] } } })
assert(o2a === 'stashed', 'outbound: assistant/message 进内存 stash')
const o2 = await outbound.handleSessionEvent(mkSess('session-2', []), { type: 'turn/end', data: { turn: 2, reason: { kind: 'max-tokens' } } })
assert(o2 === 'posted:note-502' && obPosts[1].path === '/api/v4/projects/g%2Fp/merge_requests/9/notes', 'outbound: MR 绑定 → POST MR notes（stash 兜底，max-tokens 也提交）')
const badOutbound = ob.createOutbound({ client: async () => { throw new Error('network down') }, state: { sessionIndex: { s: { project: 'g/p', kind: 'issue', iid: 3 } } }, stateFile: obStateFile })
assert(String(await badOutbound.handleSessionEvent({ id: 's', events: [evs(1, 'x')] }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })).startsWith('post-failed:'), 'outbound: client 异常 → post-failed 不抛出')
assert(outbound.status().postedCount === 2 && outbound.status().boundSessions === 2 && outbound.status().lastTarget.includes('MR'), 'outbound: status 统计（已贴回/绑定/最近目标）')

// ── 7. pipeline 分诊 + respond() 跨源去重 ─────────────────────────────────
const plStateFile = join(tmpdir(), 'gl-pl-' + process.pid + '-' + Date.now() + '.json')
const plState = {}
const plPrompts = []
const plAgents = { create: async () => ({ agent: {} }) }
const plController = { prompt: async (req) => plPrompts.push(req) }
const plClient = { raw: async ({ path }) => (path.includes('/jobs') ? { data: [{ id: 66, name: 'rspec', stage: 'test', status: 'failed', web_url: 'j/66' }] } : { data: [] }) }
const responder3 = lst.createResponder({ agents: plAgents, controller: plController, store: { append() {} }, state: plState, stateFile: plStateFile, mentionUsername: 'agent-bot', client: async () => plClient })
const pipelineEvent = { project: 'g/p', pipeline: { id: 42, ref: 'feature/x', sha: 'abc1234def', status: 'failed', web_url: 'p/42' }, merge_request: { iid: 7, title: '新功能', source_branch: 'feature/x', target_branch: 'main' }, failedJobs: [] }
const t1 = await responder3.handle(pipelineEvent)
assert(t1.startsWith('triaged:session-') && plPrompts.length === 1, 'pipeline: MR 失败流水线 → 分诊会话（' + t1 + '）')
assert(plPrompts[0].content[0].text.includes('feature/x') && plPrompts[0].content[0].text.includes('rspec') && plPrompts[0].content[0].text.includes('不要自己调用 gitlab_create_note'), 'pipeline: 提示词含分支/预取失败作业/回复通道')
assert(plState.sessionIndex?.[t1.slice('triaged:'.length)]?.kind === 'mr' && plState.sessionIndex?.[t1.slice('triaged:'.length)]?.iid === 7, 'pipeline: sessionIndex 绑定 kind=mr')
assert((await responder3.handle({ project: 'g/p', pipeline: { id: 43, status: 'success' }, merge_request: { iid: 7 } })) === 'pipeline-not-failed', 'pipeline: 成功流水线不触发')
assert((await responder3.handle({ project: 'g/p', pipeline: { id: 44, status: 'failed' } })) === 'pipeline-not-mr', 'pipeline: 非 MR 流水线不触发')
const plRec = lst.normalizeWebhookRecord({ payload: { object_kind: 'pipeline', object_attributes: { id: 42, ref: 'feature/x', sha: 'abc', status: 'failed' }, merge_request: { iid: 7, title: 'T', source_branch: 'feature/x' }, builds: [{ id: 1, name: 'lint', stage: 'test', status: 'success' }, { id: 66, name: 'rspec', stage: 'test', status: 'failed' }], project: { path_with_namespace: 'g/p' } } })
assert(plRec && plRec.pipeline.status === 'failed' && plRec.failedJobs.length === 1 && plRec.failedJobs[0].name === 'rspec', 'pipeline: webhook payload 归一化（失败作业过滤）')
assert(lst.normalizeWebhookRecord({ payload: { object_kind: 'pipeline', object_attributes: { id: 50, status: 'failed' }, project: { path_with_namespace: 'g/p' } } }) === null, 'pipeline: 无 MR 的 pipeline payload 不进响应管道')

const respState = {}
const respFile = join(tmpdir(), 'gl-resp-' + process.pid + '-' + Date.now() + '.json')
const respAgents = { create: async () => ({ agent: {} }) }
const respController = { prompt: async () => {} }
const listener2 = lst.createListener({ client: async () => ({}), agents: respAgents, controller: respController, store: { append() {} }, state: respState, stateFile: respFile, projects: [], mentionUsername: 'agent-bot' })
const noteRecord = (tag) => ({ payload: { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 5 }, object_attributes: { id: 77, note: '@agent-bot 看' }, project: { path_with_namespace: 'g/p' } }, source: tag })
assert(String(await listener2.respond(noteRecord('webhook'))).startsWith('responded:'), 'dedup: note 经 webhook 首投 → 响应')
assert((await listener2.respond(noteRecord('poll'))) === 'dedup', 'dedup: 同 note 换通道再投 → dedup（轮询兜底不重复响应）')
const plRecord = () => ({ payload: { object_kind: 'pipeline', object_attributes: { id: 99, status: 'failed' }, merge_request: { iid: 8, title: 'X', source_branch: 'b' }, project: { path_with_namespace: 'g/p' } } })
assert(String(await listener2.respond(plRecord())).startsWith('triaged:'), 'dedup: pipeline 首投 → 分诊')
assert((await listener2.respond(plRecord())) === 'dedup', 'dedup: 同 pipeline 再投 → dedup')
assert((await listener2.respond({ payload: { object_kind: 'push', project: { path_with_namespace: 'g/p' } } })) === 'not-actionable', 'dedup: push 只落盘不响应')

// ── 8. AI 身份（服务账户下拉）────────────────────────────────────────────
const idm = await import(join(ROOT, 'lib/identity.js'))
const k1 = idm.aiTokenRefKey('service_account_5c681ca62d63cc04fb90e812683750fa')
assert(k1.startsWith('gitlabToolsAiToken_') && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k1), 'identity: REF 键符合 credentialRef 约束（含点/横线用户名净化）')
assert(idm.aiTokenRefKey('john.doe-1') === idm.aiTokenRefKey('john.doe-1'), 'identity: REF 键稳定')
assert(idm.aiTokenRefKey('john.doe-1') !== idm.aiTokenRefKey('john_doe_1'), 'identity: 散列后缀防净化碰撞')
const m1 = idm.resolveAiIdentity({ aiUsername: '', legacyToken: 'T1', legacyUsername: 'sa1', cfgToken: 'T2', cfgUsername: 'sa2' })
assert(m1.token === 'T1' && m1.source === 'legacy-unselected' && m1.warning === '', 'identity: 未选择 → 旧链')
const m2 = idm.resolveAiIdentity({ aiUsername: 'saX', perAccountToken: 'TP', legacyToken: 'T1', legacyUsername: 'sa1', cfgToken: '', cfgUsername: '' })
assert(m2.token === 'TP' && m2.source === 'per-account', 'identity: 所选账户有 per-account token')
const m3 = idm.resolveAiIdentity({ aiUsername: 'sa1', perAccountToken: '', legacyToken: 'T1', legacyUsername: 'sa1', cfgToken: '', cfgUsername: '' })
assert(m3.token === 'T1' && m3.source === 'legacy', 'identity: 所选账户身份与旧链 token 一致 → 旧链可用')
const m4 = idm.resolveAiIdentity({ aiUsername: 'saX', perAccountToken: '', legacyToken: 'T1', legacyUsername: 'sa1', cfgToken: 'T2', cfgUsername: 'other' })
assert(m4.token === '' && m4.source === 'missing' && m4.warning.includes('saX'), 'identity: 所选账户无 token → 明确缺失 + 警告')
const m5 = idm.mergeAccountCandidates([[{ username: 'a' }, { username: 'B' }], [{ username: 'b', name: 'dup' }], [{ username: 'c' }]])
assert(m5.length === 3 && m5[0].username === 'a' && m5[1].username === 'B' && m5[2].username === 'c', 'identity: 候选去重（大小写不敏感）保序')

// 路由级：下拉候选 + 选择校验（离线：admin 列举与身份解析都会失败，走回落路径）
const { ctx: ctxI, routes: routesI } = makeCtx()
await mod.apply(ctxI, { host: 'https://127.0.0.1:1', token: 'glpat-offline', defaultProject: '', perPage: 20, timeoutMs: 60000 })
const routeI = routesI.find((x) => x.kind === 'prefix' && x.path === '/gitlab-tools')
r = await call(routeI, 'GET', '/gitlab-tools/service-accounts')
assert(r.status === 200 && r.json.ok === true && Array.isArray(r.json.accounts) && r.json.source === 'local', 'identity: GET /service-accounts → 200（admin 不可用回落 local）')
r = await call(routeI, 'POST', '/gitlab-tools/settings', { aiUsername: 'no_such_account' })
assert(r.status === 400 && r.json.code === 'no-token-for-account', 'identity: 选择无 token 账户 → 400 no-token-for-account')
r = await call(routeI, 'POST', '/gitlab-tools/settings', { aiUsername: '' })
assert(r.status === 200 && r.json.ok === true, 'identity: 清除选择（空）→ 200')
r = await call(routeI, 'POST', '/gitlab-tools/settings', { aiUsername: 123 })
assert(r.status === 400 && r.json.code === 'config', 'identity: 非 string aiUsername → 400')
r = await call(routeI, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.ok === true && 'aiUsername' in r.json && 'aiIdentity' in r.json && Array.isArray(r.json.aiAccounts), 'identity: GET /settings 透出 aiUsername/aiIdentity/aiAccounts')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall checks passed')
