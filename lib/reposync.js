// 响应前自动 clone/fetch（2026-09-18）：确保每次 issue 响应都在最新代码上进行。
// 设计：
//   - 纯 Node 零 cordis 依赖（child_process only），runGit 可注入 → verify 离线测试。
//   - 目录推导复用 listener.js 的 deriveProjectDir（<root>/<项目名>，root 默认 ~/dev）。
//   - clone：目录不存在时一次性 clone（鉴权走临时 URL）；clone 后立刻把 origin 烙回
//     干净 URL——token 只出现在 argv，绝不落盘 .git/config。
//   - fetch：已存在目录每次响应前 fetch（--prune，从规范仓库 URL），随后【仅当工作树
//     干净且当前分支能 ff】才 merge --ff-only origin/<branch>——绝不 reset/checkout/
//     clean：~/dev 下可能是用户自己的检出（脏树、feature 分支都不能动）。
//   - 自签证书：首次失败且 stderr 命中证书特征 → -c http.sslVerify=false 重试一次（记 warn）。
//   - 并发去重：同目录进行中的 prepare 复用同一 Promise；每步超时熔断。
//   - 任何失败都不抛出：返回 { dir, usable, status, error? }，响应链路据此回落
//     agentDefaultCwd（无可用检出）或照常进行（fetch 失败但旧检出可用）。
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { deriveProjectDir } from './listener.js'

const CERT_RE = /ssl|certificate|self-signed|x509|unable to access.*ca/i

function execGit(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile('git', args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || ''), killed: Boolean(err && err.killed) })
    })
  })
}

export function createRepoSync({ root, host, token, logger, derive = deriveProjectDir, runGit = execGit, cloneTimeoutMs = 120000, fetchTimeoutMs = 30000 }) {
  const base = String(root || '').trim()
  const hostClean = (() => {
    let h = String(host || '').trim().replace(/\/+$/, '')
    if (!h) return ''
    if (!/^https?:\/\//i.test(h)) h = 'https://' + h
    return h
  })()
  const cleanUrl = (project) => {
    if (!hostClean) return ''
    const p = String(project || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')
    return hostClean + '/' + p + '.git'
  }
  const authUrl = (project, t) => {
    const u = cleanUrl(project)
    return u ? u.replace('://', '://oauth2:' + encodeURIComponent(t) + '@') : ''
  }
  const inflight = new Map()
  const lastSync = new Map() // dir → { at, status, error? }（冒烟探针/诊断读）

  async function git(args, timeoutMs) {
    const r = await runGit(args, timeoutMs)
    if (r.code !== 0) {
      const e = new Error('git ' + args[0] + ' failed: ' + String(r.stderr || r.stdout || ('exit ' + r.code)).slice(0, 200))
      e.code = r.code
      e.stderr = r.stderr
      throw e
    }
    return r
  }

  async function _prepare(project, dir, t) {
    const gitDir = path.join(dir, '.git')
    if (!fs.existsSync(gitDir)) {
      if (!t) return { dir, usable: false, status: 'no-token' }
      const url = cleanUrl(project)
      if (!url) return { dir: null, usable: false, status: 'no-host' }
      try {
        await git(['clone', authUrl(project, t), dir], cloneTimeoutMs)
      } catch (e) {
        // 自签证书实例：clone 与 fetch 同样降级重试一次
        if (!CERT_RE.test(String(e.stderr || ''))) throw e
        ;(logger?.warn || console.warn)('[gitlab-tools] reposync clone ssl verify failed for ' + project + ', retrying insecure')
        await git(['-c', 'http.sslVerify=false', 'clone', authUrl(project, t), dir], cloneTimeoutMs)
      }
      // token 不落盘：clone 完立刻把 origin 换成干净 URL（后续 fetch 走临时鉴权 URL）
      await git(['-C', dir, 'remote', 'set-url', 'origin', url], 10000)
      lastSync.set(dir, { at: Date.now(), status: 'cloned' })
      return { dir, usable: true, status: 'cloned' }
    }
    // 已有检出：fetch（从规范仓库 URL，鉴权临时 URL 不落盘）→ 干净树才 ff
    if (t) {
      try {
        try {
          await git(['-C', dir, 'fetch', authUrl(project, t), '+refs/heads/*:refs/remotes/origin/*', '--prune'], fetchTimeoutMs)
        } catch (e) {
          if (!CERT_RE.test(String(e.stderr || ''))) throw e
          // 自签证书实例：降级跳过校验重试一次（logger.warn 留痕）
          ;(logger?.warn || console.warn)('[gitlab-tools] reposync ssl verify failed for ' + project + ', retrying insecure')
          await git(['-C', dir, '-c', 'http.sslVerify=false', 'fetch', authUrl(project, t), '+refs/heads/*:refs/remotes/origin/*', '--prune'], fetchTimeoutMs)
        }
        let status = 'fetched'
        const dirty = (await git(['-C', dir, 'status', '--porcelain'], 10000)).stdout.trim()
        if (dirty) {
          status = 'fetched-dirty' // 用户的/agent 的未提交改动：绝不 reset，保持现状
        } else {
          const branch = (await git(['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], 10000)).stdout.trim()
          if (!branch || branch === 'HEAD') {
            status = 'fetched-detached'
          } else {
            const ff = await runGit(['-C', dir, 'merge', '--ff-only', 'origin/' + branch], 30000)
            if (ff.code !== 0) status = 'fetched-ff-skipped' // 分叉/无 upstream：保现状
          }
        }
        lastSync.set(dir, { at: Date.now(), status })
        return { dir, usable: true, status }
      } catch (e) {
        const msg = String((e && e.message) || e).slice(0, 160)
        lastSync.set(dir, { at: Date.now(), status: 'fetch-failed', error: msg })
        ;(logger?.warn || console.warn)('[gitlab-tools] reposync fetch failed for ' + project + ': ' + msg)
        return { dir, usable: true, status: 'fetch-failed', error: msg } // 旧检出仍可用：照常响应
      }
    }
    return { dir, usable: true, status: 'no-token' }
  }

  // forcedDir：设置页 projectDirs 映射的目录也走同一保新鲜流程（fetch/ff-only 同样安全）。
  async function prepare(project, forcedDir) {
    const dir = forcedDir && String(forcedDir).trim() ? String(forcedDir).trim() : derive(project, base)
    if (!dir) return { dir: null, usable: false, status: 'no-derive' }
    if (inflight.has(dir)) return inflight.get(dir)
    const p = (async () => {
      try {
        const t = (await Promise.resolve(token()).catch(() => '') || '').trim()
        return await _prepare(project, dir, t)
      } catch (e) {
        const usable = fs.existsSync(path.join(dir, '.git'))
        const msg = String((e && e.message) || e).slice(0, 160)
        lastSync.set(dir, { at: Date.now(), status: usable ? 'fetch-failed' : 'clone-failed', error: msg })
        ;(logger?.warn || console.warn)('[gitlab-tools] reposync prepare failed for ' + project + ': ' + msg)
        return { dir, usable, status: usable ? 'fetch-failed' : 'clone-failed', error: msg }
      }
    })().finally(() => inflight.delete(dir))
    inflight.set(dir, p)
    return p
  }

  function status() {
    return { root: base, host: hostClean || '', enabled: Boolean(base && hostClean), entries: [...lastSync.entries()].map(([dir, v]) => ({ dir, ...v })) }
  }

  return { prepare, status }
}