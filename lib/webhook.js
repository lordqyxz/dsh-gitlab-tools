// GitLab webhook 接收（可选功能）— store + handler。
// 安全模型（fail-closed）：
//   1. secretToken 未配置 → 功能整体关闭（index.js 不建 store/handler，路由分支回 404）
//   2. X-Gitlab-Token 不匹配 → 401
//   3. 请求体 > 2MB → 400（GitLab 正常 payload 远小于此）
//   4. X-Gitlab-Webhook-UUID 去重（GitLab 重试会重发同一 uuid）
//   5. webhookProjectWhitelist 非空时，白名单外项目 → 202 + 记录标 skipped（保留可见性便于排查）
// 本模块不 import cordis/dsh 任何东西，纯 Node，可离线测试（test/verify.mjs）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAX_BODY = 2 * 1024 * 1024
const MAX_DEDUP = 1000

export function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
}

/** JSONL 追加 + 有界轮转 + 查询。追加写保证 webhook 主路径快（GitLab 要求快速 2xx）。 */
export class EventStore {
  constructor({ eventsFile, maxFileLines = 2000 }) {
    this.eventsFile = eventsFile
    this.maxFileLines = maxFileLines
    fs.mkdirSync(path.dirname(eventsFile), { recursive: true })
    this.lineCount = this.countLines()
  }

  countLines() {
    try {
      const buf = fs.readFileSync(this.eventsFile)
      let n = 0
      for (const b of buf) if (b === 0x0a) n++
      return n
    } catch {
      return 0
    }
  }

  append(record) {
    fs.appendFileSync(this.eventsFile, JSON.stringify(record) + '\n')
    this.lineCount++
    if (this.lineCount > this.maxFileLines) this.rotate()
  }

  rotate() {
    try {
      const lines = fs.readFileSync(this.eventsFile, 'utf8').split('\n').filter(Boolean)
      const keep = lines.slice(Math.floor(lines.length / 2))
      fs.writeFileSync(this.eventsFile, keep.length ? keep.join('\n') + '\n' : '')
      this.lineCount = keep.length
    } catch {
      // 轮转失败不阻断 webhook 主流程，下一条 append 会再试
    }
  }

  readAll() {
    try {
      return fs
        .readFileSync(this.eventsFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  query({ limit = 20, kind, project } = {}) {
    const all = this.readAll()
    const matched = all.filter(
      (r) =>
        (!kind || r.object_kind === kind) &&
        (!project || String(r.project || '').includes(project)),
    )
    return { total: all.length, matched: matched.slice(-limit).reverse() }
  }

  stats() {
    const all = this.readAll()
    const byKind = {}
    for (const r of all) byKind[r.object_kind] = (byKind[r.object_kind] || 0) + 1
    return {
      total: all.length,
      byKind,
      lastReceivedAt: all.length ? all[all.length - 1].receivedAt : null,
    }
  }
}

// 单条事件的一句话摘要（人读 + agent 读都够用；细节看 payload）
export function summarizeRecord(r) {
  const flags = []
  if (r.skipped) flags.push('skipped:项目不在白名单')
  return [
    `[${r.receivedAt}]`,
    r.object_kind,
    r.project || '(无项目)',
    '—',
    r.brief,
    flags.length ? `(${flags.join(', ')})` : '',
    r.uuid ? `[uuid:${String(r.uuid).slice(0, 8)}]` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

// 按 object_kind 生成一句话 brief
export function briefOfKind(kind, p = {}) {
  const user = p.user?.username || p.user_name || '?'
  switch (kind) {
    case 'push':
      return `${user} push ${p.total_commits_count ?? '?'} commits → ${p.ref ?? '?'}`
    case 'note': {
      const target = p.issue
        ? `issue #${p.issue.iid} ${p.issue.title || ''}`
        : p.merge_request
          ? `MR !${p.merge_request.iid} ${p.merge_request.title || ''}`
          : p.commit
            ? `commit ${String(p.commit.id || '').slice(0, 8)}`
            : p.snippet
              ? `snippet #${p.snippet.id}`
              : '(未知对象)'
      const body = String(p.object_attributes?.note || '').replace(/\s+/g, ' ').slice(0, 80)
      return `${user} 评论 ${target}: ${body}`
    }
    case 'issue':
      return `${user} ${p.object_attributes?.action || 'update'} issue #${p.object_attributes?.iid} ${p.object_attributes?.title || ''}`
    case 'merge_request':
      return `${user} ${p.object_attributes?.action || 'update'} MR !${p.object_attributes?.iid} ${p.object_attributes?.title || ''}`
    case 'pipeline':
      return `pipeline ${p.object_attributes?.status || '?'} on ${p.object_attributes?.ref || '?'} (id ${p.object_attributes?.id ?? '?'})`
    case 'tag_push':
      return `${user} tag ${p.ref ?? '?'}`
    default:
      try {
        return JSON.stringify(p).slice(0, 120)
      } catch {
        return '(无法摘要)'
      }
  }
}

/**
 * webhook 路由 handler 工厂。返回 async (req, res) => void，完全自管响应
 * （writeHead + end），供 index.js 的 prefix 路由按 pathname 分发调用。
 */
export function createGitlabWebhookHandler({ store, secretToken, projectWhitelist = [], respond }) {
  const seen = new Set()
  const seenOrder = []

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (c) => {
        size += c.length
        if (size > MAX_BODY) {
          reject(new Error('body too large'))
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  return async function handler(req, res) {
    const json = (status, obj) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(obj))
    }

    if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' })
    if (!secretToken) return json(503, { ok: false, error: 'webhook secretToken not configured' })
    if (req.headers['x-gitlab-token'] !== secretToken) return json(401, { ok: false, error: 'invalid X-Gitlab-Token' })

    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch {
      return json(400, { ok: false, error: 'invalid JSON body' })
    }

    const uuid = req.headers['x-gitlab-webhook-uuid'] || null
    if (uuid) {
      if (seen.has(uuid)) return json(200, { ok: true, dedup: true })
      seen.add(uuid)
      seenOrder.push(uuid)
      if (seenOrder.length > MAX_DEDUP) {
        for (const u of seenOrder.splice(0, MAX_DEDUP / 2)) seen.delete(u)
      }
    }

    const project = payload?.project?.path_with_namespace || ''
    const whitelisted = !projectWhitelist.length || projectWhitelist.includes(project)
    const kind = payload?.object_kind || 'unknown'

    const record = {
      receivedAt: new Date().toISOString(),
      uuid,
      object_kind: kind,
      project,
      project_id: payload?.project?.id ?? null,
      brief: briefOfKind(kind, payload),
      skipped: !whitelisted,
      payload,
    }
    // 可选响应管道（webhook 源也触发 @mention 自动响应；失败不阻断入库）
    if (respond) {
      try {
        record.responder = await respond(record)
      } catch (e) {
        record.responder = 'respond-error:' + String((e && e.message) || e).slice(0, 120)
      }
    }
    store.append(record)

    if (!whitelisted) return json(202, { ok: true, skipped: 'project not whitelisted', project })
    return json(200, { ok: true })
  }
}
