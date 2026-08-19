# dsh-gitlab-tools — 测试手册（agent 反思版）

给后续接手测试/验证的 agent（和人）看。不是纯"怎么跑"，而是把**这次测试实际踩过的坑与反思**记下来，避免重蹈覆辙。AGENTS.md 记"开发决策与坑"，本文件只聚焦**测试与验证**。

---

## 0. 三层验证模型

这个插件有**三层独立的东西**，各自有验证方式，别混：

| 层 | 是什么 | 怎么验证 | 要不要 DSH/浏览器 |
|---|---|---|---|
| ① 宿主（`lib/index.js` + `lib/sdk.js` + 路由） | 工具定义 + `/gitlab-tools/*` 代理路由 | `node test/verify.mjs`（mock ctx，不起 DSH）+ 真实实例冒烟 | 不需要 |
| ② 浏览器 bundle（`lib/client.js`） | better-sidebar 标签 + 设置页 | `verify.mjs` 结构断言（ModuleLoader + apply + 槽位注册） | 不需要（浏览器里看效果才需要） |
| ③ 激活/热重载（真机） | 路由是否真被 DSH 服务、bundle 是否真被 web shell 拉取 | curl 真机 3080 端口 + 看 boot manifest | 需要运行中的 DSH |

**关键教训**：①/② 全绿 ≠ ③ 生效。① 改了宿主要热重载/重启，② 改了要 rebuild + 刷新浏览器，③ 的激活才是"用户真能看到"的一步。

---

## 1. 离线验证：`node test/verify.mjs`

不碰 DSH、不起进程、不打真实 GitLab。15 个断言，两组：

**宿主侧（mock ctx）**
- `apply` + `inject` 含 `tools`
- 注册了 `/gitlab-tools` prefix 路由
- `GET /status` → `{ok:true,configured:true}`
- `GET /settings` → 默认 `defaultProject:''`、`refreshMs:120000`
- `POST /settings` → 白名单键持久化
- `POST /settings` 非法 `refreshMs` → 400 `code:'config'`
- 未知路由 → 404
- 未配置（host/token 空）→ `configured:false`、`/issues` → `not_configured`

**bundle 侧（结构断言）**
- 包进 `window.__ModuleLoader__.load`（id `dsh-gitlab-tools`，factory 是函数）
- `inject=["slots"]`
- `apply` 存在
- **不再注册 `shell.overlay`**（旧浮动面板已迁走，出现即回归）
- 注册 `settings.section`（id `gitlab-tools`）
- 通过 `ctx.get('betterSidebar').registerTab` 注册标签 `gitlab-tools:issues`（`single:true`、`component`/`icon` 都是函数）

**反思（改 verify 时注意）**
- mock `ctx` 要给 `get` 方法返回假 `betterSidebar`（`{registerTab}`），否则 `registerIssuesTab` 会走进 500ms×20 的 setInterval 重试分支——测试里它**立即注册成功**、不应起定时器。
- **断言顺序有依赖**：`POST /settings` 会写 mock 的 `userLayer`（合并进 `current`），后续 `/issues`（不带 project）会读到它——早期一个"失败"其实是测试顺序 bug 不是插件 bug。改断言时先想清楚状态泄漏。
- 加断言后用 `grep -c "assert("` 对账，别漏。

## 2. 真实实例冒烟（不打 DSH）

```bash
cd /Users/apple/dev/dsh-gitlab-tools
cat > .smoke.mjs <<'EOF'
import { createClient } from './lib/sdk.js'
const c = createClient({ host: 'https://47.97.44.134:8443', token: process.env.GL_TOKEN })
console.log((await c.api.getApiV4ProjectsIdIssues('ty%2Fdata-flow', { state: 'opened', per_page: 20 })).data.length)
EOF
GL_TOKEN='glpat-...' node .smoke.mjs && rm .smoke.mjs
```

已确认：`ty/data-flow` 15 个、`ty/sky_mirror` 6 个打开中 issue；`membership:true` 项目列表含 `ty/data-flow`、`robot-visual/*` 等。

**反思**
- **`/projects?search=ty` 返回空**：这是 GitLab 实例对 `search`+`membership` 的实际行为，不是路由/代理 bug——验证项目路由时别用 `search` 断言"必有结果"，直接不带 search 拉列表。
- `projectPathArg` 会把 `group/project` 编码成 `%2F`，冒烟时路径参数要么用 `%2F`、要么传 `projectPathArg('ty/data-flow')`。
- 脚本必须放 repo 目录里跑：相对导入 `./lib/sdk.js` 在 `/tmp` 下会 `ERR_MODULE_NOT_FOUND`（这是 Node ESM 相对解析，不是插件 bug）。

## 3. 激活/热重载验证（真机，最重要的一层）

改完代码到"用户真能看到"之间隔着这一步，这里坑最多。

**① 改宿主后**：`dev_reload_package gitlab-tools` → 立即验证路由：
```bash
curl -si http://127.0.0.1:3080/gitlab-tools/status | head -1   # 期望: HTTP/1.1 200 + content-type: application/json
```
**判断标准**：返回 JSON 才是宿主新代码活了；返回 SPA 的 `text/html`（`<!doctype html>`) 说明路由没注册，宿主没热加载。

**② 改 bundle 后**：`node scripts/build.mjs` → `dev_reload_package gitlab-tools` → 验证：
```bash
# 服务端 bundle 与本地一致 + boot manifest rev 已更新
diff <(curl -s http://127.0.0.1:3080/plugins/dsh-gitlab-tools/client.js) lib/client.js && echo same
curl -s http://127.0.0.1:3080/ | grep -o '"id":"dsh-gitlab-tools[^"]*","url":"[^"]*","rev":"[^"]*"'
```
`dev_reload_package` 返回里 **`client ✓ (lib/client.js)`** 是权威判据；`client ✗（已声明 client 但注册失败）` 说明 bundle 没进 client-modules 表。

**③ 刷新浏览器**才能看到 UI 变化（boot manifest rev 变了，web shell 拉新 bundle；HMR 可能自动，别依赖）。

### 激活层的坑（全是实测反思）

- **bundle URL 必须带 `dsh-` 前缀**：真路径是 `/plugins/dsh-gitlab-tools/client.js`（**包名**，不是 entry id）。`/plugins/gitlab-tools/client.js` 会 404——**404 ≠ 没注册**，先检查是不是 URL 打错了。判断"注册没有"用 `dev_reload_package` 的 client 行或 boot manifest，别用错 URL 的 curl。
- **新增 `dsh.client` 声明必须重启 DSH**：`dsh-client-modules` 启动时按包缓存 `pkgMeta`（gitlab-tools 启动时没有 `dsh.client` → 缓存 `null`，之后 `processOne` 永远 false）。`dev_reload_package` 只热重载宿主 fiber，清不掉这个启动缓存。第一次加 `dsh.client` 的那次改动，重启是唯一路径；之后再改 bundle 才能热重载。（详见 AGENTS.md 第 12 条。）
- **`dev_reload_package` 的 preflight 要求 `lib/client.js` 存在**：如果只有 `lib/ui.js`（或别的名），reload 会以"没构建 client"为由拒绝重载宿主。产物名必须是 `lib/client.js`（`exports["./client"]` 也指向它）。
- **boot manifest（`window.__DSH_BOOT__`）是 web shell 加载哪些 client bundle 的唯一事实来源**：manifest 里有 dsh-gitlab-tools + rev 变化 = bundle 会被浏览器拉取；manifest 没有 = 刷新了也不会出现 UI。

## 4. 主题（白天/夜间）验证

- 主题 token 定义在 `dsh-client-ui-theme/lib/styles/design-platform.css`：`:root`（白天）与 `body[data-ds-dark-theme]`（夜间）两组值，**随属性切换**。
- **只用文件里真实存在的 token**：`bg-overlay`、`bg-layer-2`、`interactive-bg-hover`、`label-*`、`border-*`、`state-*` 都在；**`bg-elevated`、`track-bg` 不存在**——带深色 fallback 引它们 = 白天主题下永远深色（这就是本次"配色搞错了"的根因）。
- 验证方式：浏览器 DevTools 里 toggle `data-ds-dark-theme` 或切 DSH 主题设置，肉眼过一遍面板/标签/设置页；或 `grep -oE '\-\-dsw-alias-[a-z0-9-]+' src/client/index.tsx | sort -u` 后与 `design-platform.css` 的 token 集做差集，缺 token 即潜在错色。

## 5. 改动后验证清单（照着跑）

| 改了什么 | 必跑 |
|---|---|
| 宿主 `lib/index.js` / `lib/sdk.js` | `verify.mjs`；真实实例冒烟（涉及 SDK 调用时）；`dev_reload_package` + curl 路由 |
| `src/client/**` | `verify.mjs`；`scripts/build.mjs`；`dev_reload_package` + bundle diff + manifest rev；刷新浏览器肉眼过 |
| 新增 `dsh.client` / 改 `exports["./client"]` | 改完必须重启 DSH 一次（pkgMeta 缓存），重启后 curl bundle + manifest |
| 主题/配色 | token 差集检查 + 白天/夜间肉眼过 |
| 路由行为 | `verify.mjs` 的 mock 断言 + curl 真机（JSON 而非 SPA HTML） |

## 6. 已知但"不是 bug"的测试干扰项

- `/projects?search=` 空结果（GitLab 实例行为，见上）。
- 测试端口统一用 `127.0.0.1:3080`（本机 DSH web 进程）；换端口后所有 curl 一起改，别只改一半。
- `verify.mjs` 里 `globalThis.window`/`globalThis.__cap` 是 eval bundle 用的沙箱桩，别在真实浏览器代码里引用它们（bundle 里只有 `window.__ModuleLoader__` 是运行时真实存在的）。
