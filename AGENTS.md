# dsh-gitlab-tools — AGENTS

维护者须知（给后续接手的 agent/人）。

## 这个插件是什么

DSH cordis 插件，把 GitLab 操作暴露为 agent 工具。底座是**从 GitLab OpenAPI spec 生成的 SDK**（`lib/generated/gitlabApi.mjs`），不是 CLI 包装。

## 关键决策与坑（务必读）

1. **为什么生成 SDK 而不是包 CLI / 用 @gitbeaker**
   - `glab` 专用子命令不支持 `--hostname`（host 从 git remote 解析），在非仓库目录会打到 gitlab.com → 包 CLI 不可靠。
   - @gitbeaker/rest 官方 README 覆盖到 GitLab 16.5，而实例是 19.2.0；实测其 `Pipelines.all` 在该实例上 404。版本对齐靠不住。
   - 从 GitLab 官方 `openapi_v2.yaml`（master ~19.x）生成 → 与实例同代，最干净。

2. **生成器两个 bug 的补丁**（`tools/gen-sdk.mjs` 里的 FIXES）：
   - 通配符/可选路径段（`*package_name`、`(ref/{ref}/)`）变成非法标识符 → 重写成合法 camelCase。
   - **`securityWorker` 默认不执行**：必须 `new Api({ baseApiParams: { secure: true }, securityWorker })`，否则 token 永不附加，实例返回 404（不是 401）。这是本插件认证能用的关键，别回退。

3. **认证为纯配置直连**（`lib/sdk.js`）：host+token 由插件 Config 提供（settings.yaml 的 `gitlab-tools:` 节或 profile patch 的 insert config），**不依赖 glab/keyring，也不 spawn 任何子进程**。缺 host/token 时 createClient 抛清晰报错。旧版曾用 glab keyring 自动探测，已废弃。

7. **SDK 辅助模块已从 `lib/client.js` 挪到 `lib/sdk.js`**（2026-08）：`lib/client.js` 这个路径让给了**浏览器 bundle**（构建产物）。`package.json` 的 `exports["./client"]` 指向 `lib/client.js`（浏览器 bundle），因为 `dsh-client-modules` 固定用 `exports["./client"]` 定位客户端 bundle（`dsh.client` 声明在 package.json）。宿主 `lib/index.js` 用相对路径 `./sdk.js` 引 SDK helper，不受 exports 影响。别把 SDK helper 再搬回 `lib/client.js`，会覆盖浏览器 bundle。

8. **GitLab Issues 侧边栏标签（浏览器半区）**：客户端 `src/client/index.tsx` → `lib/client.js`（esbuild 构建，产物提交）。注册两个面：
   - `dsh-better-sidebar` 标签（`ctx.get('betterSidebar').registerTab`，id `gitlab-tools:issues`，`order:60`，与 explorer/git/terminal 等平级；better-sidebar 在 boot 图里先于本插件 apply，故 apply 时服务已可用，仍留 500ms×20 重试兜底）
   - `settings.section`（「GitLab Issues」设置页：defaultProject / refreshMs）
   数据一律走宿主代理路由（token 不出服务端），见下面「HTTP 路由」。配色只用 `design-platform.css` 里**真实存在**的 `--dsw-alias-*` token（bg-overlay / bg-layer-2 / interactive-bg-hover 等），随 `body[data-ds-dark-theme]` 自适应白天/夜间——曾误用不存在的 `bg-elevated`/`track-bg`（带深色 fallback）导致白天主题错色，已修。改客户端代码 → `node scripts/build.mjs` → `dev_reload_package gitlab-tools` → 刷新浏览器即可（免重启）。

9. **HTTP 路由**（宿主 `lib/index.js` 里注册，`kind:'prefix' path:'/gitlab-tools'`）：
   - `GET  /gitlab-tools/status` → `{ ok, configured }`（不回显任何 secret）
   - `GET  /gitlab-tools/settings` → UI 配置（defaultProject/refreshMs，来自 settings 命名空间 `gitlabTools` 的 `scope.get()`）
   - `POST /gitlab-tools/settings` → 白名单键 `{ defaultProject, refreshMs }` 写用户层（`scope.update`）
   - `GET  /gitlab-tools/issues?project=&state=&perPage=` → 经 SDK 代理，返回脱敏 issue 列表
   - `GET  /gitlab-tools/projects?search=&perPage=` → 设置页项目选择器用
   host+token 留在静态 config（profile patch），**绝不下发浏览器**。

10. **构建**：`node scripts/build.mjs`（esbuild，externals 表见脚本）产出 `lib/client.js`（即 `exports["./client"]`，`dsh-client-modules` 固定按此路径定位 bundle，与超级注入器 `dev_reload_package` 的 preflight 一致）。esbuild 是 devDependency，装完要 `pnpm approve-builds esbuild`（已在 package.json 用 `pnpm.onlyBuiltDependencies` 白名单）。改客户端代码 → 重新 build → 刷新页面即可（无需重启）；改宿主代码 → 重启或热重载。

12. **给插件新增 `dsh.client` 声明后的激活坑（实测 2026-08）**：`dsh-client-modules` 在**启动时**按包缓存 `pkgMeta`（`dsh-gitlab-tools` 启动时没有 `dsh.client` → 缓存为 `null`，之后 `processOne` 永远返回 false）。因此**新增 `dsh.client` 声明必须重启 DSH** 才会注册浏览器 bundle——`dev_reload_package` 只能热重载宿主 fiber（宿主路由能立即生效），清不掉这个启动缓存。重启后刷新浏览器，侧边栏标签才会出现。

11. **验证**：`node test/verify.mjs`（宿主路由 mock 冒烟 + 浏览器 bundle 结构断言，不起 DSH）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。**完整测试手册（三层验证模型 + 激活/热重载的坑 + 主题 token 检查 + 改动后验证清单）见 `tests/agent.md`，改完代码先照它的清单跑，别只看 verify 全绿。**

4. **spec 缺口**：`GET /api/v4/user`（当前用户）与 `POST /projects/{id}/issues/{iid}/notes`（评论）不在 openapi spec 里 → 这两个工具走 `client.raw()`（`GitlabApi.raw` 是 `protected request` 的公开透传）。其余工具走生成的具名方法。

5. **project 路径编码**：`group/project` 作为路径参数必须 `%2F` 编码（`projectPathArg`），数字 id 原样。

6. **client 懒加载**：`createClient` 纯配置构造（零子进程），`apply` 里用 `clientPromise ??=` 记忆化，首个工具调用才构建。

## 常用操作

- 改工具：改 `lib/index.js`（`defineTool` + `ctx.tools.register`），工具名 `gitlab_*` 前缀。
- SDK 升级对齐：`node tools/gen-sdk.mjs`（先更新 `tools/openapi_v2.yaml`），重跑生成+补丁+编译。
- 验证：`node test/verify.mjs`（路由 mock 冒烟 + bundle 结构断言）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。
