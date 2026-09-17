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
// 会话恢复/续跑路由（POST /gitlab-tools/session/prompt）
r = await call(route, 'POST', '/gitlab-tools/session/prompt')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'params' && /sessionId/.test(r.json.message), 'prompt: 缺 sessionId 拒绝')
r = await call(route, 'POST', '/gitlab-tools/session/prompt?sessionId=s1')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'params' && /text/.test(r.json.message), 'prompt: 缺 text 拒绝')
r = await call(route, 'POST', '/gitlab-tools/session/prompt?sessionId=s1&text=go')
assert(r.status === 200 && r.json.ok === false && r.json.code === 'no-session-controller', 'prompt: 无 sessionController 降级报错')
{
  const prompts = []
  const second = makeCtx()
  second.ctx.get = (k) => (k === 'sessionController' ? { prompt: async (p) => { prompts.push(p) } } : undefined)
  await mod.apply(second.ctx, { host: 'https://gl.example.com', token: 'glpat-x', defaultProject: '', perPage: 20, timeoutMs: 60000 })
  const route2 = second.routes.find((x) => x.kind === 'prefix' && x.path === '/gitlab-tools')
  const rr = await call(route2, 'POST', '/gitlab-tools/session/prompt?sessionId=session-abc&text=%E7%BB%A7%E7%BB%AD')
  assert(rr.status === 200 && rr.json.ok === true && rr.json.queued === true && rr.json.sessionId === 'session-abc', 'prompt: 注入成功 queued=true')
  assert(prompts.length === 1 && prompts[0].sessionId === 'session-abc' && prompts[0].mode === 'queue' && prompts[0].content[0].text === '继续', 'prompt: 走 sessionController.prompt（queue + 文本透传）')
}

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

// ── 4. webhook 接收端点（可选功能，config.agentSecretToken）──────────────
const { ctx: wctx, routes: wroutes, tools: wtools } = makeCtx()
await mod.apply(wctx, {
  host: 'https://gl.example.com', token: 'glpat-x', timeoutMs: 60000,
  agentSecretToken: 'whsec-1',
  agentEventsFile: join(tmpdir(), `gl-webhook-test-${process.pid}-${Date.now()}.jsonl`),
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
assert(!wtools.some((t) => t.name === 'gitlab_agent_events'), 'webhook: 诊断工具已移除（升级为侧边栏面板）')
const aer = await call(wroute, 'GET', '/gitlab-tools/agent-events?limit=10')
assert(aer.status === 200 && aer.json.ok === true && aer.json.status.receiver === 'on' && Array.isArray(aer.json.events), 'webhook: GET /agent-events → 状态+流水')
const aeNote = aer.json.events.find((e) => e.kind === 'note' && String(e.brief).includes('bob 评论'))
assert(aeNote && aeNote.responder === 'responder-disabled', 'webhook: 面板流水含 note 摘要与处置结果')
const app = await call(wroute, 'POST', '/gitlab-tools/agent-poll')
assert(app.status === 200 && app.json.ok === true && app.json.enabled === false, 'webhook: POST /agent-poll（轮询未启用 → enabled=false）')

// 未启用实例：路由 404 webhook-disabled，工具报未启用
const { ctx: dctx, routes: droutes, tools: dtools } = makeCtx()
await mod.apply(dctx, { host: 'https://gl.example.com', token: 'glpat-x', timeoutMs: 60000 })
const droute = droutes.find((r) => r.kind === 'prefix' && r.path === '/gitlab-tools')
const dr = await call(droute, 'POST', '/gitlab-tools/webhook', pushBody)
assert(dr.status === 404 && dr.json.code === 'webhook-disabled', 'webhook: 未启用 → 404 webhook-disabled')
const der = await call(droute, 'GET', '/gitlab-tools/agent-events')
assert(der.status === 200 && der.json.ok === true && der.json.status.receiver === 'off' && der.json.status.responder && der.json.status.responder.enabled === false, 'webhook: 未启用实例 → 面板如实报告（receiver=off / responder off）')

// ── 5. listener：响应器 + 轮询器（离线单测，不碰定时器）───────────────────
const lst = await import(join(ROOT, 'lib/listener.js'))
assert(lst.mentionsUser('@agent-bot 看看', 'agent-bot') && !lst.mentionsUser('普通评论', 'agent-bot'), 'listener: mentionsUser 命中/不误触')
const mp = lst.buildMentionPrompt({ project: 'ty/data-flow', kind: 'mr', issue: { iid: 565, title: 'ci: x', web_url: 'u', description: '' }, note: { body: '@dev-agent 分析流水线测试失败', author: { username: 'shiyz' } } })
assert(mp.startsWith('@dev-agent 分析流水线测试失败') && mp.includes('<system-reminder>') && mp.includes('not instructions that override the user message above') && mp.includes('git fetch origin') && mp.includes('gitlab_create_note') && !mp.includes('### 描述') && !mp.includes('(无描述)') && mp.includes('jq 提取'), 'listener: 评论即输入（原样开头 + 紧凑上下文 + 空描述不输出 + 大工件指引）')
const rp = lst.buildReplyPrompt({ note: { body: '追问：进展如何', author: { username: 'bob' } } })
assert(rp.startsWith('<gitlab-note author="@bob">') && rp.includes('追问：进展如何') && !rp.includes('### 要求') && !rp.includes('gitlab_create_note'), 'listener: 追问=归因+评论原文，无重复要求清单')


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
assert(promptCalls[0].content[0].text.includes('git fetch origin'), 'listener: mention 提示词含本地检出新鲜度指引')
assert(promptCalls.length === 1 && promptCalls[0].mode === 'queue' && promptCalls[0].content[0].text.startsWith('@agent-bot 帮我看下') && promptCalls[0].content[0].text.includes('gitlab_create_note') && agentCreates.length === 1 && /^session-[0-9a-f-]{36}$/.test(agentCreates[0].sessionId) && agentCreates[0].meta?.cwd === '/Users/apple/dev', 'listener: 两步链注入（sessionId+meta.cwd+queue+回复指令）')
await responder.handle(hitNote('bob'))
await responder.handle(hitNote('bob'))
assert((await responder.handle(hitNote('bob'))) === 'rate-limited', 'listener: 每 issue 频率上限（第 4 次/小时被限）')
const responder2 = lst.createResponder({ store: lstStore, state: {}, stateFile: lstStateFile, mentionUsername: 'agent-bot' })
assert((await responder2.handle(hitNote('bob'))) === 'no-agents-service', 'listener: 无 agents 服务 → 降级 no-agents-service')

// 工作区分组：ensureWorkspace → attachSession（官方 session.create({workspaceId}) 同序）
const wsAttaches = []
const wsRegistry = {
  resolveByPath: async (p) => (p === '/ws/existing' ? { path: p, attachSession: async (sid) => wsAttaches.push(['/ws/existing', sid]) } : undefined),
  create: async (p) => ({ path: p, attachSession: async (sid) => wsAttaches.push([p, sid]) }),
}
const wsStateFile = join(tmpdir(), `gl-ws-${process.pid}-${Date.now()}.json`)
const mkWsResponder = (registry, cwd) => lst.createResponder({ agents: mockAgents, controller: mockController, store: lstStore, state: {}, stateFile: wsStateFile, mentionUsername: 'agent-bot', resolveCwd: () => cwd, ensureWorkspace: (dir) => registry.resolveByPath(dir).then((w) => w ?? registry.create(dir)) })
const wsHit = { project: 'g/ws', issue: { iid: 1, title: 't', description: 'd' }, note: { body: '@agent-bot 看', author: { username: 'bob' } } }
const oWs = await mkWsResponder(wsRegistry, '/ws/existing').handle(wsHit)
const wsSid = agentCreates[agentCreates.length - 1].sessionId
assert(oWs.startsWith('responded:session-') && !oWs.includes('workspace'), 'listener: attach 成功 → outcome 无错误注记（' + oWs + '）')
assert(wsAttaches.length === 1 && wsAttaches[0][0] === '/ws/existing' && wsAttaches[0][1] === wsSid, 'listener: 新会话 attachSession 进既有 workspace')
const oWsCreate = await mkWsResponder(wsRegistry, '/ws/new').handle({ project: 'g/ws2', issue: { iid: 1, title: 't', description: 'd' }, note: { body: '@agent-bot 看', author: { username: 'bob' } } })
assert(oWsCreate.startsWith('responded:session-') && wsAttaches.some((a) => a[0] === '/ws/new'), 'listener: 未注册路径 → create 分支后 attach')
const failRegistry = { resolveByPath: async () => undefined, create: async () => { throw new Error('dir missing') } }
const promptsBefore = promptCalls.length
const oFail = await mkWsResponder(failRegistry, '/nope').handle({ project: 'g/fail', issue: { iid: 1, title: 't', description: 'd' }, note: { body: '@agent-bot 看', author: { username: 'bob' } } })
assert(oFail.startsWith('responded:session-') && oFail.includes(';workspace-attach-failed:dir missing'), 'listener: attach 失败不阻断响应（outcome 带注记）')
assert(promptCalls.length === promptsBefore + 1, 'listener: attach 失败仍完成 prompt 注入')
// createListener 透传 + 冒烟探针覆盖 workspace
const listener3 = lst.createListener({ client: async () => ({}), agents: mockAgents, controller: mockController, store: { append() {} }, state: {}, stateFile: wsStateFile, projects: [], mentionUsername: 'agent-bot', resolveCwd: () => '/ws/existing', ensureWorkspace: (dir) => wsRegistry.resolveByPath(dir).then((w) => w ?? wsRegistry.create(dir)) })
const oL3 = await listener3.respond({ payload: { object_kind: 'note', user: { username: 'bob' }, issue: { iid: 9 }, object_attributes: { id: 88, note: '@agent-bot 看' }, project: { path_with_namespace: 'g/p' } }, source: 'ws' })
assert(oL3.startsWith('responded:session-') && wsAttaches.some((a) => a[0] === '/ws/existing' && a[1] !== wsSid), 'listener: createListener 透传 ensureWorkspace → attach')
const probe = await listener3.injectProbe()
assert(probe.agent && probe.prompt && probe.workspace === 'attached' && probe.workspaceService === true, 'listener: 冒烟探针覆盖 workspace attach（' + probe.workspace + '）')
assert(wsAttaches.length === 4, 'listener: workspace attach 计数（' + wsAttaches.length + '）')


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
assert(plPrompts[0].content[0].text.includes('git fetch origin') && plPrompts[0].content[0].text.includes('feature/x'), 'pipeline: 提示词含 fetch 指引与 MR 源分支')
assert(plPrompts[0].content[0].text.includes('不要整包'), 'pipeline: 提示词含大工件落盘指引')
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

// ── 8. emoji ACK：👀 开始处理 → ✅ 已回复 / ❌ 失败 ──────────────────────
const ackMod = await import(join(ROOT, 'lib/ack.js'))
assert(ackMod.ACK_EYES === 'eyes' && ackMod.ACK_DONE === 'white_check_mark' && ackMod.ACK_FAILED === 'x', 'ack: emoji 名常量')
const ackCalls = []
const mkAckClient = () => ({ raw: async ({ path, method, body }) => {
  ackCalls.push({ path, method, body })
  if (method === 'POST' && path.includes('/award_emoji')) return { data: { id: 700 + ackCalls.length } }
  if (method === 'DELETE') return { data: {} }
  if (method === 'POST' && path.endsWith('/notes')) return { data: { id: 800 + ackCalls.length } }
  return { data: {} }
} })
const ackHelper = ackMod.createAckHelper({ client: mkAckClient })
const ackState = {}
const ackStateFile = join(tmpdir(), `gl-ack-${process.pid}-${Date.now()}.json`)
const ackAgents = { create: mockAgents.create, get: () => ({}) }
const ackResponder = lst.createResponder({ agents: ackAgents, controller: mockController, store: lstStore, state: ackState, stateFile: ackStateFile, mentionUsername: 'agent-bot', resolveCwd: () => '/ws/existing', ensureWorkspace: (dir) => wsRegistry.resolveByPath(dir).then((w) => w ?? wsRegistry.create(dir)), ack: ackHelper, client: mkAckClient })
const oAck = await ackResponder.handle({ project: 'g/ack', issue: { iid: 3, title: 't', description: 'd' }, note: { id: 901, body: '@agent-bot 看', author: { username: 'bob' } } })
const ackSid = agentCreates[agentCreates.length - 1].sessionId
assert(oAck.startsWith('responded:session-'), 'ack: 注入成功（' + oAck + '）')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.includes('/issues/3/notes/901/award_emoji') && c.body.name === 'eyes'), 'ack: 会话开始 → 触发 note 贴 👀')
assert(ackState.acks?.[ackSid] && ackState.acks[ackSid].emoji === 'eyes' && ackState.acks[ackSid].awardId, 'ack: 未决 ACK 落 state')
// 出站：回复成功 → 👀 换 ✅，ACK 消费清除
const obAck = ob.createOutbound({ client: mkAckClient, state: ackState, stateFile: ackStateFile, ack: ackHelper })
const ackSess = { id: ackSid, events: [{ type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '回复正文' }] } } }] }
const oDone = await obAck.handleSessionEvent(ackSess, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
assert(oDone.startsWith('posted:note-'), 'ack: 回复贴回（' + oDone + '）')
assert(ackCalls.some((c) => c.method === 'DELETE' && c.path.includes('/award_emoji/')), 'ack: 撤 👀')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.includes('/issues/3/notes/901/award_emoji') && c.body.name === 'white_check_mark'), 'ack: 贴 ✅')
assert(!ackState.acks?.[ackSid], 'ack: 成功后 ACK 消费清除')
// turn 失败（error）→ ❌ + 兜底短评
const oAck2 = await ackResponder.handle({ project: 'g/ack', issue: { iid: 4, title: 't', description: 'd' }, note: { id: 902, body: '@agent-bot 再看', author: { username: 'bob' } } })
const ackSid2 = agentCreates[agentCreates.length - 1].sessionId
assert(oAck2.startsWith('responded:session-'), 'ack: 第二线程注入（' + oAck2 + '）')
const callsBeforeFail = ackCalls.length
const oAckFail = await obAck.handleSessionEvent({ id: ackSid2, events: [] }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'error' } } })
assert(oAckFail === 'skip-reason:error', 'ack: 失败 turn 走 skip-reason（' + oAckFail + '）')
assert(ackCalls.slice(callsBeforeFail).some((c) => c.method === 'DELETE'), 'ack: 失败撤 👀')
assert(ackCalls.slice(callsBeforeFail).some((c) => c.method === 'POST' && c.path.includes('/award_emoji') && c.body.name === 'x'), 'ack: 失败贴 ❌')
assert(ackCalls.slice(callsBeforeFail).some((c) => c.method === 'POST' && c.path.endsWith('/notes') && String(c.body.body).includes('~~~~') && String(c.body.body).includes('"kind"')), 'ack: 失败评论含 reason 原样（JSON + 围栏）')
assert(!ackState.acks?.[ackSid2], 'ack: 失败后 ACK 清除')
// 注入失败（agents.create 抛错）→ 直接 ❌ + 兜底短评（含原因）
const badAgents = { create: async () => { throw new Error('session header mismatch') } }
const badResponder = lst.createResponder({ agents: badAgents, controller: mockController, store: lstStore, state: {}, stateFile: ackStateFile, mentionUsername: 'agent-bot', ack: ackHelper })
const oBad = await badResponder.handle({ project: 'g/ack', issue: { iid: 5, title: 't', description: 'd' }, note: { id: 903, body: '@agent-bot 看', author: { username: 'bob' } } })
assert(oBad.startsWith('inject-failed:'), 'ack: 注入失败 outcome（' + oBad + '）')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.includes('/issues/5/notes/903/award_emoji') && c.body.name === 'x'), 'ack: 注入失败直接贴 ❌')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.endsWith('/notes') && String(c.body.body).includes('session header mismatch')), 'ack: 兜底短评含失败原因')
// pipeline 分诊：无触发 note → 👀 贴 MR 本身
const oTri = await ackResponder.handle({ project: 'g/ack', pipeline: { id: 77, ref: 'feature/z', sha: 'abc', status: 'failed' }, merge_request: { iid: 9, title: 'T', source_branch: 'feature/z' }, failedJobs: [] })
assert(oTri.startsWith('triaged:session-'), 'ack: pipeline 分诊注入（' + oTri + '）')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.includes('/merge_requests/9/award_emoji') && !c.path.includes('/notes/') && c.body.name === 'eyes'), 'ack: pipeline → MR 本身贴 👀')
// 追问（同线程续问，无需 @）→ 也贴 👀
const oCont = await ackResponder.handle({ project: 'g/ack', issue: { iid: 3, title: 't', description: 'd' }, note: { id: 904, body: '追问：进展如何', author: { username: 'bob' } } })
assert(oCont.startsWith('continued:'), 'ack: 追问注入（' + oCont + '）')
assert(ackCalls.some((c) => c.method === 'POST' && c.path.includes('/issues/3/notes/904/award_emoji') && c.body.name === 'eyes'), 'ack: 追问也贴 👀')

// ── 9. 线程回复：回复与触发评论同 discussion thread ─────────────────────
const thCalls = []
const mkThClient = () => ({ raw: async ({ path, method, body }) => {
  thCalls.push({ path, method, body })
  if (method === 'POST' && path.includes('/award_emoji')) return { data: { id: 900 + thCalls.length } }
  if (method === 'DELETE') return { data: {} }
  if (method === 'GET' && path.includes('/discussions')) return { data: [{ id: 'disc-9', notes: [{ id: 911 }] }] }
  if (method === 'POST' && path.includes('/discussions/')) return { data: { id: 970 } }
  if (method === 'POST' && path.endsWith('/notes')) return { data: { id: 980 } }
  return { data: {} }
} })
const thHelper = ackMod.createAckHelper({ client: mkThClient })
const thReply = ackMod.createReplyPoster({ client: mkThClient })
const thState = {}
const thStateFile = join(tmpdir(), `gl-th-${process.pid}-${Date.now()}.json`)
const thAgents = { create: mockAgents.create, get: () => ({}) }
const thResponder = lst.createResponder({ agents: thAgents, controller: mockController, store: lstStore, state: thState, stateFile: thStateFile, mentionUsername: 'agent-bot', ack: thHelper, reply: thReply })
// webhook 带 discussion_id → 出站回复 POST discussions/:id/notes
const oTh = await thResponder.handle({ project: 'g/th', issue: { iid: 7, title: 't', description: 'd' }, note: { id: 910, discussionId: 'disc-webhook', body: '@agent-bot 看', author: { username: 'bob' } } })
const thSid = agentCreates[agentCreates.length - 1].sessionId
assert(oTh.startsWith('responded:session-'), 'thread: 注入成功（' + oTh + '）')
assert(thState.sessionIndex?.[thSid]?.discussionId === 'disc-webhook' && thState.sessionIndex?.[thSid]?.noteId === 910, 'thread: sessionIndex 记录 noteId/discussionId')
const obTh = ob.createOutbound({ client: mkThClient, state: thState, stateFile: thStateFile, ack: thHelper, reply: thReply })
const thSess = { id: thSid, events: [{ type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '线程内回复' }] } } }] }
const oThDone = await obTh.handleSessionEvent(thSess, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
assert(oThDone.startsWith('posted:note-970'), 'thread: 回复落在 discussion thread（' + oThDone + '）')
assert(thCalls.some((c) => c.method === 'POST' && c.path.includes('/discussions/disc-webhook/notes')), 'thread: POST discussions/:id/notes')
// poll 路径（无 discussionId）→ GET discussions 扫描解析
const oTh2 = await thResponder.handle({ project: 'g/th', issue: { iid: 8, title: 't', description: 'd' }, note: { id: 911, body: '@agent-bot 看', author: { username: 'bob' } } })
const thSid2 = agentCreates[agentCreates.length - 1].sessionId
assert(oTh2.startsWith('responded:session-'), 'thread: 解析路径注入（' + oTh2 + '）')
const obTh2 = ob.createOutbound({ client: mkThClient, state: thState, stateFile: thStateFile, ack: thHelper, reply: thReply })
const callsB = thCalls.length
const oTh2Done = await obTh2.handleSessionEvent({ id: thSid2, events: [{ type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '解析后回复' }] } } }] }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
assert(oTh2Done.startsWith('posted:note-970'), 'thread: GET discussions 解析后进 thread（' + oTh2Done + '）')
assert(thCalls.slice(callsB).some((c) => c.method === 'GET' && c.path.includes('/discussions')), 'thread: 无 discussionId 时 GET discussions 解析')
// 找不到所在 discussion → 回落顶层 note
const oTh3 = await thResponder.handle({ project: 'g/th', issue: { iid: 9, title: 't', description: 'd' }, note: { id: 912, body: '@agent-bot 看', author: { username: 'bob' } } })
const thSid3 = agentCreates[agentCreates.length - 1].sessionId
assert(oTh3.startsWith('responded:session-'), 'thread: 回落路径注入（' + oTh3 + '）')
const obTh3 = ob.createOutbound({ client: mkThClient, state: thState, stateFile: thStateFile, ack: thHelper, reply: thReply })
const callsC = thCalls.length
const oTh3Done = await obTh3.handleSessionEvent({ id: thSid3, events: [{ type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '回落顶层' }] } } }] }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
assert(oTh3Done.startsWith('posted:note-980'), 'thread: 找不到 discussion → 回落顶层（' + oTh3Done + '）')
assert(thCalls.slice(callsC).some((c) => c.method === 'POST' && c.path.endsWith('/notes') && !c.path.includes('/discussions/')), 'thread: 回落 POST 顶层 notes')
// 追问（无 @）→ sessionIndex 更新为最新触发 note 的 thread；回复跟着最新 thread 走
const oThCont = await thResponder.handle({ project: 'g/th', issue: { iid: 7, title: 't', description: 'd' }, note: { id: 914, discussionId: 'disc-cont', body: '追问：进展如何', author: { username: 'bob' } } })
assert(oThCont.startsWith('continued:'), 'thread: 追问注入（' + oThCont + '）')
assert(thState.sessionIndex?.[thSid]?.discussionId === 'disc-cont' && thState.sessionIndex?.[thSid]?.noteId === 914, 'thread: 追问后 sessionIndex 指向最新触发 note')
// 注入失败 + discussionId → ❌ 且错误原样进同 thread
const badTh = lst.createResponder({ agents: badAgents, controller: mockController, store: lstStore, state: {}, stateFile: thStateFile, mentionUsername: 'agent-bot', ack: thHelper, reply: thReply })
const oBadTh = await badTh.handle({ project: 'g/th', issue: { iid: 10, title: 't', description: 'd' }, note: { id: 913, discussionId: 'disc-err', body: '@agent-bot 看', author: { username: 'bob' } } })
assert(oBadTh.startsWith('inject-failed:'), 'thread: 注入失败 outcome（' + oBadTh + '）')
assert(thCalls.some((c) => c.method === 'POST' && c.path.includes('/discussions/disc-err/notes') && String(c.body.body).includes('session header mismatch')), 'thread: 注入失败错误原样进同 thread')
// webhook 归一化携带 discussion_id
const whDisc = lst.normalizeWebhookRecord({ payload: { object_kind: 'note', issue: { iid: 3 }, object_attributes: { id: 55, note: '@agent-bot hi', discussion_id: 'disc-77' }, project: { path_with_namespace: 'g/p' } } })
assert(whDisc && whDisc.note.discussionId === 'disc-77', 'thread: webhook 归一化携带 discussion_id')



// ── 10. 用量脚注：foldUsage / formatUsageFooter / 出站附加 ───────────────────
const usg = await import(join(ROOT, 'lib/usage.js'))
const usev = (turn, u, time, text) => ({ type: 'assistant/message', time, data: { turn, ...(u ? { usage: u } : {}), ...(text ? { message: { content: [{ type: 'text', text }] } } : {}) } })
const uEvents = [
  usev(1, { inputTokens: 6000, outputTokens: 1000, reasoningTokens: 500 }, 1000),
  usev(1, { inputTokens: 4000, outputTokens: 1000 }, 11000),
  usev(2, { inputTokens: 500, outputTokens: 100 }, 20000),
]
const uAll = usg.foldUsage(uEvents)
assert(uAll.input === 10500 && uAll.output === 2100 && uAll.reasoning === 500 && uAll.cacheRead === 0 && uAll.cacheWrite === 0 && uAll.samples === 3 && uAll.turns === 2, 'usage: 会话级折叠五类字段 + 去重轮数')
const uT1 = usg.foldUsage(uEvents, { turn: 1 })
assert(uT1.input === 10000 && uT1.output === 2000 && uT1.reasoning === 500 && uT1.samples === 2 && uT1.turns === 1, 'usage: turn 过滤只折叠该轮')
assert(usg.formatUsageFooter(uT1, uAll) === '📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s ｜ 累计 2 轮 · ↑ 10.5k · ↓ 2.1k', 'usage: 脚注固定格式（推理/速度/累计全要）')
assert(usg.formatUsageFooter(usg.foldUsage([usev(3, { inputTokens: 500, outputTokens: 100 }, 20000)]), uAll) === '📊 本轮 ↑ 500 · ↓ 100 ｜ 累计 2 轮 · ↑ 10.5k · ↓ 2.1k', 'usage: 缺数优雅省略（无推理、单样本无速度）')
assert(usg.formatUsageFooter({ samples: 0 }, uAll) === '', 'usage: 本轮无样本 → 空脚注')
assert(usg.formatUsageFooter(uT1, uT1) === '📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s', 'usage: 累计无新增样本时不重复展示')
assert(usg.formatUsageFooter(uT1, null) === '📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s', 'usage: 无会话级数据时只报本轮')

// 出站附加：有 usage → 固定脚注；usageFooter:false → 不加；无 usage 事件 → 不加（第 6 节已覆盖）
const obUPosts = []
const obUClient = { raw: async ({ path, method, body }) => { obUPosts.push({ path, method, body }); return { data: { id: 600 + obUPosts.length } } } }
const obUStateFile = join(tmpdir(), 'gl-ob-u-' + process.pid + '-' + Date.now() + '.json')
const obUState = { sessionIndex: { 'session-u': { key: 'g/p#5', project: 'g/p', kind: 'issue', iid: 5 } } }
const obU = ob.createOutbound({ client: async () => obUClient, state: obUState, stateFile: obUStateFile })
const uSess = mkSess('session-u', [
  usev(7, { inputTokens: 6000, outputTokens: 1000, reasoningTokens: 500 }, 1000, '带用量的回复'),
  usev(7, { inputTokens: 4000, outputTokens: 1000 }, 11000),
])
const oU = await obU.handleSessionEvent(uSess, { type: 'turn/end', data: { turn: 7, reason: { kind: 'completed' } } })
assert(oU === 'posted:note-601' && obUPosts[0].body.body === '带用量的回复\n\n---\n\n📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s', 'usage: 出站回复附加本轮脚注（会话仅本轮，无累计段）')
const obUOff = ob.createOutbound({ client: async () => obUClient, state: { sessionIndex: { 'session-v': { key: 'g/p#6', project: 'g/p', kind: 'issue', iid: 6 } } }, stateFile: obUStateFile, usageFooter: false })
const oUOff = await obUOff.handleSessionEvent(mkSess('session-v', [usev(8, { inputTokens: 6000, outputTokens: 1000 }, 1000, '关闭脚注的回复')]), { type: 'turn/end', data: { turn: 8, reason: { kind: 'completed' } } })
assert(oUOff === 'posted:note-602' && obUPosts[1].body.body === '关闭脚注的回复', 'usage: usageFooter:false → 回复不带脚注')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall checks passed')
