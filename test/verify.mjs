// dsh-gitlab-tools — offline verification (no running DSH needed).
//  1. host lib/index.js imports cleanly (syntax + SDK load)
//  2. /gitlab-tools routes behave: status / settings GET+POST / issues / 404
//  3. browser bundle lib/client.js loads through window.__ModuleLoader__ and
//     registers a dsh-better-sidebar tab + settings.section slot
import { Readable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
  const userLayer = {}
  const ctx = {
    logger: { info() {}, warn() {} },
    tools: { register() {} },
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
    effect(fn) { const ret = fn(); return ret },
  }
  return { ctx, routes, userLayer }
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

function makeReq(method, path, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = path
  return req
}

async function call(route, method, path, body) {
  const res = makeRes()
  await route.handler(makeReq(method, path, body), res)
  return { status: res._status, json: res._data ? JSON.parse(res._data) : null }
}

// configured instance
const { ctx, routes } = makeCtx()
await mod.apply(ctx, { host: 'https://gl.example.com', token: 'glpat-x', defaultProject: '', perPage: 20, timeoutMs: 60000 })
const route = routes.find((r) => r.kind === 'prefix' && r.path === '/gitlab-tools')
assert(Boolean(route), 'registers /gitlab-tools prefix route')

let r = await call(route, 'GET', '/gitlab-tools/status')
assert(r.status === 200 && r.json.ok === true && r.json.configured === true, 'GET /status → configured=true')

r = await call(route, 'GET', '/gitlab-tools/settings')
assert(r.status === 200 && r.json.ok === true && r.json.defaultProject === '' && r.json.refreshMs === 120000, 'GET /settings → defaults')

r = await call(route, 'POST', '/gitlab-tools/settings', { defaultProject: 'group/proj', refreshMs: 300000 })
assert(r.status === 200 && r.json.ok === true && r.json.defaultProject === 'group/proj', 'POST /settings → persists defaultProject')

r = await call(route, 'POST', '/gitlab-tools/settings', { evil: 'x', refreshMs: 1 })
assert(r.status === 400 && r.json.code === 'config', 'POST /settings → rejects out-of-range refreshMs')

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

// ── 3. browser bundle structure ──────────────────────────────────────────────
globalThis.window = { __ModuleLoader__: { load: (def) => { globalThis.__cap = def } } }
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
loaded.apply({ slots, get: (name) => (name === 'betterSidebar' ? fakeBetterSidebar : undefined) })
const overlay = registered.find((e) => e.name === 'shell.overlay')
assert(!overlay, 'no shell.overlay entry (moved into better-sidebar)')
const section = registered.find((e) => e.name === 'settings.section')
assert(Boolean(section) && section.entry.id === 'gitlab-tools' && section.entry.label === 'GitLab Issues', 'registers settings.section entry')
assert(tabs.length === 1 && tabs[0].id === 'gitlab-tools:issues' && tabs[0].single === true && typeof tabs[0].component === 'function' && typeof tabs[0].icon === 'function', 'registers better-sidebar tab gitlab-tools:issues')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall checks passed')
