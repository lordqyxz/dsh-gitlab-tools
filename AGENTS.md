# dsh-gitlab-tools — AGENTS

维护者须知（给后续接手的 agent/人）。

## 这个插件是什么

DSH cordis 插件，把 GitLab 操作暴露为 agent 工具。底座是**从 GitLab OpenAPI spec 生成的 SDK**（`lib/generated/gitlabApi.mjs`），不是 CLI 包装。

**术语约定（2026-09）**：本插件的「事件监听 + 自动响应」能力整体称 **GitLab Agent**——GitLab 侧事件（note / issue / MR / pipeline）进入，agent 会话处理后把回复贴回 issue/MR 评论。webhook / ntfy / 轮询只是三种**事件来源**（机制名，不作为组件名）；描述整条链路时不写「xx dsh webhook」这类说法。服务器实例的 profile 名 `bug-triage` 是历史命名，仅指 DSH 实例本身，不是能力名（见「服务器部署形态」）。

## 关键决策与坑（务必读）

1. **为什么生成 SDK 而不是包 CLI / 用 @gitbeaker**
   - ~~glab 专用子命令不支持 --hostname~~（2026-09-18 实测 glab 1.112.0 已不成立：非仓库目录 `GITLAB_HOST=… glab <子命令> -R owner/repo` 可正常发起请求，`glab api --hostname` 官方支持）。**现在拒绝包 CLI 的真正理由是凭据边界**：glab 需要 GITLAB_TOKEN 进 agent bash 可达环境（env 或 keyring/config），而本系统把不可信 GitLab 评论原文送进会话（mention 管道/issue 上下文），能评论的人就能提示词注入 → env/glab config 外传即成立；服务器容器单 uid，文件权限也藏不住。SDK 直连让 host+token 全程不出插件进程。
   - @gitbeaker/rest 官方 README 覆盖到 GitLab 16.5，而实例是 19.2.0；实测其 `Pipelines.all` 在该实例上 404。版本对齐靠不住。
   - 从 GitLab 官方 `openapi_v2.yaml`（master ~19.x）生成 → 与实例同代，最干净。

2. **生成器两个 bug 的补丁**（`tools/gen-sdk.mjs` 里的 FIXES）：
   - 通配符/可选路径段（`*package_name`、`(ref/{ref}/)`）变成非法标识符 → 重写成合法 camelCase。
   - **`securityWorker` 默认不执行**：必须 `new Api({ baseApiParams: { secure: true }, securityWorker })`，否则 token 永不附加，实例返回 404（不是 401）。这是本插件认证能用的关键，别回退。

3. **认证为纯配置直连**（`lib/sdk.js`）：host+token 由插件 Config 提供（settings.yaml 的 `gitlab-tools:` 节或 profile patch 的 insert config），**不依赖 glab/keyring，也不 spawn 任何子进程**。缺 host/token 时 createClient 抛清晰报错。旧版曾用 glab keyring 自动探测，已废弃。

7. **SDK 辅助模块已从 `lib/client.js` 挪到 `lib/sdk.js`**（2026-08）：`lib/client.js` 这个路径让给了**浏览器 bundle**（构建产物）。`package.json` 的 `exports["./client"]` 指向 `lib/client.js`（浏览器 bundle），因为 `dsh-client-modules` 固定用 `exports["./client"]` 定位客户端 bundle（`dsh.client` 声明在 package.json）。宿主 `lib/index.js` 用相对路径 `./sdk.js` 引 SDK helper，不受 exports 影响。别把 SDK helper 再搬回 `lib/client.js`，会覆盖浏览器 bundle。

8. **GitLab Issues 侧边栏标签（浏览器半区）**：客户端 `src/client/index.tsx` → `lib/client.js`（esbuild 构建，产物提交）。注册两个面：
   - `dsh-better-sidebar` 标签（`betterSidebar.registerTab`，id `gitlab-tools:issues`，`order:60`，与 explorer/git/terminal 等平级）。**注册方式（2026-09 修正）**：不再用「apply 时直接注册 + 500ms×20 轮询兜底」——better-sidebar 0.18+ 的客户端半区可能晚于旧 10 秒窗口挂载，轮询过期后 tab 静默丢失。现改为 `ctx.effect(() => ctx.inject(['betterSidebar'], (svc) => svc.effect(() => svc.betterSidebar.registerTab(TAB_DESCRIPTOR))))`，fiber 等服务就绪再注册；未装 better-sidebar 时 fiber 永久 pending（无害），设置页不受影响。配套把 package.json `dsh.client.inject` 从已消亡的 `@deepseek-ai/dsh-client-runtime` 换成 `dsh-better-sidebar`（boot 图保证其客户端 bundle 先加载；改 dsh.client 声明需重启，见第 12 条）
   - `settings.section`（「GitLab Issues」设置页：host/token/projectDirs + defaultProject/refreshMs 回退配置）
   - **声明式「功能设置」（2026-09 新增）**：TAB_DESCRIPTOR 带 `settings.pluginToggles`（defaultProject 文本 / refreshMs 数字 5000–3600000ms），持久化在 better-sidebar `pluginSettings["gitlab-tools:issues"]`；tab.tsx 的 `useTabPluginSettings` 经 `store.subscribe` 订阅并传给 `usePanel(visible, overrides)`，合并优先级 = 功能设置 > host 设置 > 默认。改字段必须同步 test/verify.mjs 的 pluginToggles 断言
   - **每行 issue 的「创建开发会话」按钮**（纯客户端）：`ctx.get('sessions')` → `create(...)` → `binding(id).session.prompt(提示词, 'queue')` 自动把「实现该 issue」任务发给 agent → `open(id)` 跳转。**启动即内嵌上下文（用规范的 Markdown 排版）**：建会话前用 `fetchIssueContext(project,iid)` 走 `/gitlab-tools/issue` + `/issue/notes` 拉取 issue 正文与既有讨论，整理成 Markdown（正文用块引用 `>`，讨论用列表项 `- **@用户** _(时间)_: 内容`）写进提示词「Issue 内容」段——agent 启动时**不必**再调 GitLab 工具重复拉取，省一轮往返与 token；执行中只对**新增**评论增量 `gitlab_api` 拉取 notes（对照 skill `gitlab_api_tool`）。**分组（工作区）**：用 `sessions.create({ workspaceId })` 创建（不是裸 `cwd`，裸 cwd 会落到错误/默认分组）——目标文件夹取「设置 → GitLab Issues → 项目→本地文件夹映射」里该 issue 项目对应的 `dir`，否则回落到当前会话 `cwd`；再经 `resolveWorkspaceId(ctx, dir)`（`ctx.get('workspaces').list` 匹配 path）得到 `workspaceId`。**先自动检查**：能确定工作目录才自动开干；没有则只给提示词 + 复制按钮，不自动启动。纯客户端，无需重启。
   - **点击 issue = 标签内详情+讨论**（不再跳 web）：列表点条目 → `IssueDetailView`（返回按钮回列表）。展示标题/状态/标签/指派/里程碑/描述（Markdown）+ 讨论消息流（作者头像+作者+相对时间，`NoteRow`，类对话消息结构；**头像**：宿主 `noteBrief` 透传 `author.avatar_url`（GitLab 公开 `/uploads` 路径，免 token），客户端 `<img loading="lazy">` 直载（实例自签证书已进系统钥匙串、浏览器可直载），无 URL/加载失败时回落首字母圆形徽章——`Avatar` 组件内联在 `note-row.tsx`）+ 底部评论框（POST 到 `/issue/notes`，⌘/Ctrl+Enter 发送）。**`render_html` 在该 GitLab 实例无效** → 客户端用开源 `react-markdown` + `remark-gfm` 渲染（`src/client/markdown.tsx` 的 `Markdown` 组件）：渲染成 React 元素而非 HTML 字符串（不用 `dangerouslySetInnerHTML`，原始 HTML 自动转义，**无 XSS**），完整支持 CommonMark + GFM（**加粗/表格/code 围栏**等）；`@user`/`#123`/`!123` 经自定义 remark 插件（`[remarkGitlabLinks, links]` tuple 注册）转成真链接；`.gt-md` 样式一次性注入 document.head。系统注释（HTML 正文）仍走 `sanitize-html.ts` 白名单清洗。依赖已入 package.json `dependencies`，esbuild 打包内联进 `lib/client.js`。AI 评论沿用开发会话的 `gitlab_create_note`（详情刷新可见）。评论以配置 token 所属账号发布。
   - **双身份（区分谁发评论）**：`aiToken`（凭据 REF `gitlabToolsAiToken`，设置页「AI 专属 token」字段）是 **DeepSeek Harness 专属 Service Account** 的 PAT（用户已在实例建好 `service_account_5c681ca62d63cc04fb90e812683750fa` id=42，admin=shiyz 建的；PAT 由用户自建）。**工具用 AI token、UI 路由用主 token**：`getClient()`=agent 工具（优先 aiToken，回落主 token），`getUIClient()`=浏览器路由（恒用主 token）——所以 agent 的 `gitlab_create_note` 以 SA 身份评论、你侧边栏评论以你身份发，讨论里作者天然区分。`makeClient(token)` 按 host|token 记忆化。aiToken 可选，未配置则回落主 token（行为不变）。
   数据一律走宿主代理路由（token 不出服务端），见下面「HTTP 路由」。配色只用 `design-platform.css` 里**真实存在**的 `--dsw-alias-*` token（bg-overlay / bg-layer-2 / interactive-bg-hover 等），随 `body[data-ds-dark-theme]` 自适应白天/夜间——曾误用不存在的 `bg-elevated`/`track-bg`（带深色 fallback）导致白天主题错色，已修。改客户端代码 → `node scripts/build.mjs` → `dev_reload_package gitlab-tools` → 刷新浏览器即可（免重启）。
   **标签颜色同步 GitLab**：issues 列表与详情请求都带 `with_labels_details=true`，宿主 `labelsBrief(i)` 把每个标签的 `color`/`text_color` 脱敏下发；客户端用 `labelChipStyle(l)`（theme.ts）直接渲染 GitLab 的配色，不本地映射。`Issue.labels` 类型为 `Label[]`（`{name,color?,text_color?}`），别再当 `string[]` 用。
   **客户端模块拆分原则（反向原则）**：默认一个职责一个文件，除非有证明才合并不拆——`src/client/` 下按职责拆成独立模块：`issue-card.tsx`（卡片，含底部按钮+统计条）、`issue-list.tsx`（薄容器/空错态）、`issue-detail.tsx`（详情+讨论，用 `note-row.tsx`）、`dev-notice.tsx`（创建会话结果横幅）、`token-fields.tsx`（复用密钥输入）、`sanitize-html.ts`（系统注释 HTML 白名单清洗）、hooks 按 hook 拆 `use-panel.ts`/`use-issue-detail.ts`/`use-session-stats.ts`。别再往一个大 `hooks.ts`/`issue-list.tsx` 里堆。

9. **HTTP 路由**（宿主 `lib/index.js` 里注册，`kind:'prefix' path:'/gitlab-tools'`）：
   - `GET  /gitlab-tools/status` → `{ ok, configured }`（不回显任何 secret）
   - `GET  /gitlab-tools/settings` → UI 配置（defaultProject/host/refreshMs/**projectDirs** 来自 settings 命名空间；`tokenConfigured`/`aiTokenConfigured` 布尔位，不回显明文）
   - `POST /gitlab-tools/settings` → 白名单键 `{ defaultProject, host, refreshMs, projectDirs }` 写用户层；`token`/`aiToken` 写凭据存储（空串=清除）
   - `GET  /gitlab-tools/issues?project=&state=&perPage=&scope=&search=` → 经 SDK 代理，返回脱敏 issue 列表；`scope=assigned_to_me` 过滤为当前用户（主 token 账号）指派的 issue，`search` 全文搜标题/描述。侧边栏面板默认 `scope=assigned_to_me`（仅看我），带搜索框（`issue-filter.tsx`，debounce 350ms 触发服务端搜索）与「仅看我」开关
   - `GET  /gitlab-tools/issue?project=&iid=` → 详情（title/description/meta，`issueDetailBrief`）
   - `GET  /gitlab-tools/issue/notes?project=&iid=` → 讨论列表（`noteBrief`；走 `client.raw`，notes 不在生成 SDK 里）
   - `POST /gitlab-tools/issue/notes?project=&iid=` body `{body}` → 发评论（走 `client.raw`；以配置 token 所属账号发布）
   - `GET  /gitlab-tools/projects?search=&perPage=` → 设置页项目选择器用
   - `GET  /gitlab-tools/session/stats?sessionId=` → 读 DSH 会话事件日志，折叠 `assistant/message` 的 `usage` 得 token 消耗/速度 + running（`ctx.sessions.get(id).events`；无需 GitLab 认证）
   - `POST /gitlab-tools/session/stop?sessionId=` → 请求停止该开发会话（`ctx.agents.get(id)?.cancel({kind:'user'})`；无真正 pause，用 stop + open 替代）
   - `POST /gitlab-tools/session/prompt?sessionId=&text=` → 向既有会话注入 queue 消息（重启后恢复被中断会话/续跑用，与 session/stop 对称）。形状 = 网关同款 `controller.prompt(request, signal)`——signal 是第二位置参数（typert 惯例），缺失时控制器内部 signal.throwIfAborted() 对 undefined 崩；不要 agents.create 兜底——controller 的 resolve() 自带 resume-from-disk，create 只产新会话对已存在 id 必撞 already exists。text ≤4000 字符，路由只绑 127.0.0.1 无鉴权
   host+token 留在静态 config（profile patch），**绝不下发浏览器**。`iid` 参数必须显式存在且 >0（`Number(null)===0` 曾绕过校验）。

10. **构建**：`node scripts/build.mjs`（esbuild，externals 表见脚本）产出 `lib/client.js`（即 `exports["./client"]`，`dsh-client-modules` 固定按此路径定位 bundle，与超级注入器 `dev_reload_package` 的 preflight 一致）。esbuild 是 devDependency，装完要 `pnpm approve-builds esbuild`（已在 package.json 用 `pnpm.onlyBuiltDependencies` 白名单）。改客户端代码 → 重新 build → 刷新页面即可（无需重启）；改宿主代码 → 重启或热重载。

12. **给插件新增 `dsh.client` 声明后的激活坑（实测 2026-08）**：`dsh-client-modules` 在**启动时**按包缓存 `pkgMeta`（`dsh-gitlab-tools` 启动时没有 `dsh.client` → 缓存为 `null`，之后 `processOne` 永远返回 false）。因此**新增 `dsh.client` 声明必须重启 DSH** 才会注册浏览器 bundle——`dev_reload_package` 只能热重载宿主 fiber（宿主路由能立即生效），清不掉这个启动缓存。重启后刷新浏览器，侧边栏标签才会出现。

11. **验证**：`node test/verify.mjs`（宿主路由 mock 冒烟 + 浏览器 bundle 结构断言，不起 DSH）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。**完整测试手册（三层验证模型 + 激活/热重载的坑 + 主题 token 检查 + 改动后验证清单）见 `tests/agent.md`，改完代码先照它的清单跑，别只看 verify 全绿。**

4. **spec 缺口**：`GET /api/v4/user`（当前用户）与 `POST /projects/{id}/issues/{iid}/notes`（评论）不在 openapi spec 里 → 这两个工具走 `client.raw()`（`GitlabApi.raw` 是 `protected request` 的公开透传）。其余工具走生成的具名方法。

5. **project 路径编码**：`group/project` 作为路径参数必须 `%2F` 编码（`projectPathArg`），数字 id 原样。

6. **client 懒加载**：`createClient` 纯配置构造（零子进程），`apply` 里用 `clientPromise ??=` 记忆化，首个工具调用才构建。

13. **GitLab webhook 接收（可选功能，2026-09）**：`lib/webhook.js`（纯 Node、零 cordis 依赖、可离线测）+ `lib/index.js` 装配。
    - **启用**：插件 config（cordis.patch.yml 的 gitlab-tools insert）加 `agentSecretToken`（值 = GitLab webhook 设置里的 Secret token）；**为空 = 功能关闭**（POST /gitlab-tools/webhook → 404 `webhook-disabled`，不建 store、事件不落盘）。改 insert config 热生效（cordis 重新 apply）。
    - **端点**：`POST /gitlab-tools/webhook`（挂在既有 prefix 路由下，分支在最前）。fail-closed：token 不匹配 401、非 POST 405、体 >2MB 400；`X-Gitlab-Webhook-UUID` 去重（GitLab 重试重发同 uuid）；`agentProjectWhitelist` 白名单（空 = 全收；白名单外 202 + 记录标 skipped）。
    - **事件落盘**：`agentEventsFile`（默认 `~/.dsh/gitlab-tools/webhook-events.jsonl`，超 `agentMaxFileLines` 2000 行自动保留后半）。**会被 dsh-config-sync 同步到 iCloud**，payload 含项目内容，介意就加进 config-sync excludes。
    - **查询工具**：`gitlab_agent_events`（首行接收器状态：文件路径/总数/类型分布；`detail: true` 附 payload）。
    - **测试**：`node test/verify.mjs` 第 4 节（mock：401/405/200 落盘/dedup/note 摘要/未启用 404 + 工具如实报告）。
    - **连接层（GitLab→本机，未定）**：GitLab 在公网 VPS（47.97.44.134:8443），本机 GUI 127.0.0.1:3080。首选 SSH 反向隧道（`ssh -N -R 127.0.0.1:3081:127.0.0.1:3080 vps`，GitLab URL 填 `http://127.0.0.1:3081/gitlab-tools/webhook`，Admin 后台开「允许 webhook 请求本地网络」）；无 SSH 权限则 cloudflared + 只转发该路径的本机中转进程（**勿直接暴露 3080，整个 GUI 会公网可达**）。
    - **Phase 2（issue @mention 自动响应，未实现）**：note 事件 + `payload.issue` 存在 + 正文含 SA 用户名 → 宿主端会话注入（参考客户端「创建开发会话」的 `sessions.create({ workspaceId })` + `binding(id).session.prompt(prompt, 'queue')` 模式定位宿主等价 API）→ 以 aiToken（SA id=42）POST issue note。**防环**：忽略 `author.username === SA 用户名` 的 note（bot 自己的评论同样触发 note webhook）+ 同一 issue 频率上限。MR 事件只落盘展示不自动响应。

14. **事件监听管道（轮询源 + @mention 自动响应，2026-09）**：`lib/listener.js`（纯 Node，零 cordis 依赖）+ index.js 装配；与 webhook 推送源共用 EventStore 与响应管道。
    - **轮询源**：config `agentPollProjects`（要监听的项目，空=关闭）+ `agentPollIntervalMs`（默认 30s，最小 10s）。拉 `issues/merge_requests?order_by=updated_at&updated_after=<游标>` → 新 notes（`sort=desc&per_page=30`，剔 system）→ 按 `project:kind:noteId` 去重；游标 + 已见 id 落盘 `agentPollStateFile`（默认 ~/.dsh/gitlab-tools/webhook-poll-state.json），**重启不重放**。用 setTimeout 链（非 setInterval）防慢周期堆叠；ctx.effect 注册，卸载自清。
    - **自动响应**：config `agentMentionUsername`（SA 用户名，空=只记录不响应）。note 命中 @mention → `buildMentionPrompt`（内嵌 issue 标题/描述/触发评论）→ 宿主注入两步链（见下）→ **agent 自己用 gitlab_create_note（aiToken/SA 身份）回复**，响应器不等 turn 完成。**防环**：忽略 author.username===mentionUsername 的 note（bot 自己的评论同样触发 note webhook/轮询）；`responded` 状态文件里每 issue 每小时上限 3 次。
    - **宿主注入两步链（冒烟实证 2026-09）**：客户端门面的 `binding(id).session.prompt` 在宿主侧不存在（冒烟实测 `create({})` 报 session header id 不匹配）；**也不要先 `sessions.create`**——`agents.create` 的工厂内部自己发布会话，预建同 id 会话会报 already exists。
    正确形状：`await ctx.agents.create({ sessionId: `'session-' + randomUUID()` })`（一体化建会话+挂 agent+启 loop）→ `await ctx.sessionController.prompt({ requestId: randomUUID(), sessionId, mode: `'queue'`, content: [{ type: `'text'`, text }] })`（GUI 发消息同一 API）。
    inject 需含 `agents`/`sessionController`。**冒烟路由 `POST /gitlab-tools/webhook-smoke`** 保留，逐步报告链路状态；降级链：no-agents-service → no-session-controller。
    - **响应会话必须经 setup 挂载 agent 预设（2026-09-18 修复「服务器响应会话没工具/没技能」）**：`meta.agentPreset` 只是会话 header 的创建事实记录，**不触发任何组合挂载**——agent 工厂只认 `setup(agentCtx)` 钩子（GUI 网关传了 setup 所以 GUI 会话正常；插件此前没传，响应会话以「空全局层」发布：只剩宿主面插件工具 gitlab_*，无 bash/fs/run_code/skill，技能目录不存在。服务器实测 agent 被迫用 gitlab_api base64 读仓库代码、无法加载 .agents/skills，单会话 58 次 API 调用拼文件内容）。修复：injectSession/injectProbe 传 `setup: (agentCtx) => ctx.agentPresets.mount(agentCtx, wanted)`（listener.js 模块级 wantedPresetId/buildPresetSetup）；index.js 经 `ctx.get('agentPresets')` 懒解析（**不进静态 inject**，缺服务时 outcome 注记 `;preset-unavailable`）；mount 失败吞错降级 bare 会话（setup 抛错会回滚整个 agents.create → 响应直接 ❌），注记 `;preset-mount-failed:*`；未传 resolveAgentPresets 的旧调用方完全静默。config `agentResponsePreset`（默认 'ptc'；''/'default' = 部署默认预设 defaultId）。冒烟探针新增 out.presetService/out.preset（mounted:<id> / unavailable / 错误串）。测试：verify.mjs 第 5 节 preset 组。
    - **共用管道**：webhook 推送源经 handler `respond` 回调走同一 responder（`normalizeWebhookRecord` 把 GitLab 原始 payload 归一化成 note/issue 顶层形状）；轮询源在 cycle 内直接调用。respond 失败不阻断入库（record.responder 记录错误）。
    - **工具**：`gitlab_agent_events` head 含轮询/响应状态；`gitlab_agent_poll_now` 手动触发一轮（验证用）。测试：verify.mjs 第 5 节（防环/限流/降级/游标/去重，mock client+sessions，不碰定时器）。
    - **注意**：改 agentPollProjects/agentMentionUsername 走 insert config（热生效，cordis 重新 apply 会重建 listener 与定时器）。
    - **gitlab_api 大结果护栏（2026-09-17）**：响应超 60k 字符截断（capApiResponse），截断注记引导改走「bash 落盘 + jq 分段提取」或更精确分页；工具描述同步说明。mention 上下文与 pipeline 提示词各加「大工件/大 JSON 先 bash 落盘再 jq 提取，不要整包读进对话」。根因：MR !565 响应单 turn 17 分钟，整包 e2e-results.json 等工件进上下文后每步都背着走（step 12 单步 300s）。token 视角：截断一次省的是后续每个 step 的重复携带，不是省那一次。测试：verify.mjs 评论即输入/pipeline 断言同步。
    - **评论即输入（2026-09-17，MR !565 真实会话日志复盘 + 官方文档调研）**：buildMentionPrompt 重构——用户评论原样作为消息开头（旧版「## 任务」模板把一句话评论埋进 22 行包装，且污染会话标题：title-llm = first-prompt 取首条 user message）；操作上下文降级为官方 <system-reminder> 惯用语（agent-instructions render 同款导语：不覆盖上方用户消息）。buildReplyPrompt 只留归因 + 评论原文，回复通道等规则仅在首条注入出现一次（追问不再重复要求清单）。描述为空不输出；不推荐 gitlab_list_notes（MR notes 端点 404，日志实测浪费调用）。**调研结论（docs/architecture.md + dsh-api-session-controller + agent-instructions）**：inbox 语义为「唤醒消息触发回合、注入上下文等待捎带」→ 两条 prompt() 有变成下一回合的竞态，维持单条消息评论在前；官方 system-reminder 仅用于系统自身上下文（AGENTS.md/skills/runtime-context），插件中继评论用 <gitlab-note author> 归因包裹。测试：verify.mjs 评论即输入 2 断言。
    - **回复落 thread（2026-09-17）**：出站回复与失败评论一律进「触发 note 所在的 discussion thread」——POST /discussions/:discussion_id/notes（顶层 POST 会开新 thread）。discussionId 来源：webhook payload 的 object_attributes.discussion_id（normalizeWebhookRecord 归一化进 note.discussionId）；轮询路径 notes API 不带 → 出站时 GET discussions 扫描（≤5 页）按 noteId 解析。sessionIndex 记 noteId/discussionId 且**追问时更新为最新触发 note**（用户在原 thread 追问 → 同 thread；用户新顶层评论 → 回复贴在该评论下——两条路径都成立）。lib/ack.js createReplyPoster：thread 回复失败/找不到 → 回落顶层 note（postReply 内建 fallback）；markFailed 的错误原样评论同样走 thread；pipeline 分诊无 note → 顶层。empty-response 也算失败 → ❌ + 错误原样评论；state.outbound 记 threaded。测试：verify.mjs 第 9 节（15 断言）。
    - **emoji ACK 状态机（2026-09-17）**：响应会话开始处理即在「触发 note」上贴 👀（award_emoji；pipeline 分诊无 note → 贴 MR 本身），回复成功换 ✅，失败换 ❌ 并把错误信息**原样**贴进评论区（lib/ack.js failureBody：对象 JSON.stringify / 字符串原样，~~~~ 围栏保格式，>4000 截断）。覆盖：新线程 / 追问 / pipeline 分诊 / 注入失败（agents.create/prompt 抛错 → outcome inject-failed:* + ❌ + 错误原文）/ turn 失败（outbound skip-reason 分支；aborted/interrupted 只换 ❌ 不补评论）/ 贴回异常（catch 分支贴异常原文）。state.acks 按 sessionId 记账（takeAck 取走即删；有界 200）。模块 lib/ack.js（零 cordis）；award_emoji 不在生成 SDK → 全走 client.raw()。index.js 共享同一 ack 助手（getClient/SA 身份）。服务器实测 award API 200。测试：verify.mjs 第 8 节（21 断言）。
    - **响应会话工作区分组（2026-09-17）**：injectSession 在 agents.create 后对 resolveCwd 目录做宿主 workspaceRegistry 的 resolve-or-create + attachSession（镜像官方 session.create({workspaceId}) 顺序：ensureWorkspace → create(meta.cwd) → attach，见宿主 api-proxy.ts）。成员资格 = accounted 进 workspace.sessionIds + 会话 header cwd canonical 匹配，双条件；缺 attach 的新会话永远落 GUI「未分组」桶。attach 失败不阻断响应：outcome 串带 ;workspace-attach-failed: 注记（record.responder / agent-events 可见）+ logger.warn。index.js 经 ctx.get('workspaceRegistry') 懒解析（**不进静态 inject**——旧宿主缺服务时降级为不分组，不能让整个插件 pending）；webhook-smoke 探针同步覆盖 workspace 步骤（out.workspace = attached / unavailable / attach-failed:*，服务器实测 attached）。测试：verify.mjs 第 5 节 workspace 组（8 断言）。
    - **多项目开发目录 + 响应前自动 clone/fetch（2026-09-18）**：`resolveCwd` 改为 async（listener 侧 await）。优先级 = ① 设置页 projectDirs 映射（也走保新鲜流程）→ ② `agentReposRoot`（默认 `~/dev`，服务器 patch 覆盖为 `/workspace/repos`）下按**项目名**推导 `<root>/<项目名>`（`ty/data-flow` → `<root>/data-flow`；纯函数 `deriveProjectDir`：小写、不安全字符折 '-'。注意：不同命名空间下同名项目会撞同一目录，需区分时用 projectDirs 显式映射）→ ③ 单仓库 `agentDefaultCwd` 回落。自动同步 = `lib/reposync.js`（`createRepoSync`，纯 Node，runGit 可注入测试）：目录缺失自动 clone（token 走一次性鉴权 URL，clone 后 remote 立刻烙回干净 URL——**token 绝不落盘 .git/config**）；已有则 fetch（argv 携带鉴权 URL，--prune）+ **仅干净树 ff-only** 到 origin/<当前分支>（脏树/detached/分叉一律保现状——~/dev 下可能是用户自己的检出，绝不 reset/checkout/clean）；首次失败 stderr 命中证书特征 → `-c http.sslVerify=false` 重试一次；同目录并发去重（inflight map）；clone 120s/fetch 30s 超时熔断；**任何失败不阻断响应**（clone 失败 usable=false → 回落 agentDefaultCwd；fetch 失败旧检出照常用）。config `agentRepoSync`（默认 true）。mention/pipeline 提示词同步改为「系统已在响应前自动 fetch」。测试：verify.mjs deriveProjectDir 3 断言 + reposync 8 断言。

## 常用操作

- 改工具：改 `lib/index.js`（`defineTool` + `ctx.tools.register`），工具名 `gitlab_*` 前缀。
- SDK 升级对齐：`node tools/gen-sdk.mjs`（先更新 `tools/openapi_v2.yaml`），重跑生成+补丁+编译。
- 验证：`node test/verify.mjs`（路由 mock 冒烟 + bundle 结构断言）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。
- 改 skill：`skills/gitlab_api_tool/SKILL.md`（gitlab_api 端点手册）；本机装机 = symlink 到 `~/.agents/skills/gitlab_api_tool`。

## 15. 全事件响应机制（出站桥 + pipeline 分诊 + 跨源去重，2026-09）

### 出站桥（session → GitLab，lib/outbound.js）

- 宿主 index.js 以官方持久化插件同一惯用法订阅宿主事件：\`ctx.on('session/event', (session, event) => …)\`（agent 子 fiber 产生的会话事件会到达插件 ctx；官方 dsh-session-persistence-jsonl 的 install() 同款用法）。事件交给 \`createOutbound().handleSessionEvent\`。
- 提交点 = \`turn/end\` 且 \`reason.kind ∈ {completed, max-tokens}\`；最终回复 = 该 turn 最后一条**未中断** assistant/message 的 text 块（\`extractFinalText(session.events, turn)\`；session.events 不可用时退回 assistant/message 到达时写入的内存 stash）。aborted / error / blocked / interrupted 不贴回。
- 只有**绑定线程**的会话出站：入站响应器创建会话时在 \`state.sessionIndex[sessionId]\` 写 \`{ key, project, kind: 'issue'|'mr', iid }\`；GUI 手开的开发会话不在表内，不受影响。同 (session, turn) 只贴一次（\`state.outbound\` 有界 100 条）。kind=mr → \`/merge_requests/:iid/notes\`，issue → \`/issues/:iid/notes\`；一律 aiToken（SA）身份发布。
- **用量脚注（2026-09-17，联动 ty/data-flow#368）**：绑定会话的出站回复末尾自动附固定格式 token 脚注：`📊 本轮 ↑ 10k · ↓ 2k · 🧠 500 · ⚡ 1200.0 tok/s ｜ 累计 2 轮 · ↑ 10.5k · ↓ 2.1k`（↑/↓ 必有，🧠 推理 >0 才显示，⚡ 需 ≥2 样本，累计仅当会话有本轮之外样本；缓存 token 不进脚注——每轮重复读上下文会显得用量爆炸，五类全量走 /session/stats）。数据源 = 会话事件流 `assistant/message.usage`（reported 级）；折叠统一走 lib/usage.js（foldUsage / formatUsageFooter），/session/stats 路由同口径（脚注数字 = 面板数字）；事件日志不可用（stash 兜底路径）不加——宁缺勿造，不伪装精确值。config `agentUsageFooter`（默认开）。测试：verify.mjs 第 10 节。
- **部署恢复（2026-09-17）**：docker restart 会停掉运行中的 agent loop（会话数据在盘上不丢，GUI 可重开）。恢复 = 对重启前活跃的会话逐个 `POST /gitlab-tools/session/prompt?sessionId=<id>&text=<续跑指令>`；内部走 controller.resolve() 的 resume-from-disk（从持久化状态重挂 loop），响应 queued:true 后用 `GET /session/stats` 的 running:true 验证（服务器实测：session-6176a8d9 恢复成功）。前提坑：① inject 必须含 `sessions`（严格宿主上未声明的服务属性访问抛 cannot get property without inject——Mac 宿主宽松掩盖过这一点）；② prompt 的 signal 是第二位置参数。重启后 GUI boot token 会换，从 docker logs 新 boot 段取。现成方案调研：dsh-phoenix（最完整：graceful restart + 客户端重连 + 跨重启 goal 续跑，npm 可装）/ Harzva dsh-restart-autoresume（受控重启 + Resume Ledger，alpha，锚定 rc.2）/ dsh-boot-restore（单会话 ctx.agents.resume() 极简版）。
- \`handleSessionEvent\` 绝不 throw（失败返回 \`post-failed:*\` 字符串）——事件监听器不能破坏会话 loop。
- 模型已被明确告知（三份提示词的「回复通道」段 + \`gitlab_create_note\` 工具描述）：最终回复由系统自动贴回、不要自己调用 gitlab_create_note 发回复、人类后续评论会自动送进会话。

### pipeline 分诊（MR 流水线失败 → 分诊会话）

- \`normalizeWebhookRecord\` 扩展：object_kind=pipeline 且 payload 带 merge_request → 事件形状 \`{ pipeline, merge_request, failedJobs }\`（failedJobs 从 payload.builds 过滤）；非 MR 流水线返回 null（只落盘）。**轮询器不产 pipeline 事件**——分诊是推送源（webhook/ntfy）专属能力，轮询兜底不含它。
- \`responder.handlePipeline\`：status=failed 且有 MR 才触发；failedJobs 不足时经 client 拉 \`/pipelines/:id/jobs?scope=failed\` 预取；提示词含 MR/分支/流水线/失败作业 + 排查线索（jobs/:id/trace）+ 回复通道；会话绑定 kind='mr'，分诊结论自动贴回 MR 评论。config \`agentPipelineTriage\` 可关（默认开）。
- 频率上限复用 responded（key \`project#mr-<iid>\` 每小时 3 次）。

### 跨源去重（webhook ↔ ntfy ↔ poll）

- \`createListener.respond()\` 是推送源统一入口：先按 \`state.seenNotes / state.seenPipelines\` 去重（与轮询器共享同一份 state），再进 responder——GitLab 重试、socat 重发、轮询兜底撞车都只响应一次。标记先于响应：限流/跳过的决定对该事件是终态。
- 历史遗留：\`agents.get\` 缺席（离线 mock / 旧宿主）按「线程已不可用」处理，不再 TypeError。

### 服务器部署形态（47.97.44.134，2026-09 起）

- \`dsh-agent-dsh-1\` 容器（**host 网络**）跑 \`dsh --profile bug-triage --port 3080 --no-open\`（profile 名为历史命名，能力本体是 GitLab Agent，见顶部术语约定）；DSH_HOME=/data/.dsh ↔ 宿主 /opt/dsh-agent/data/.dsh；GUI 只绑 127.0.0.1:3080（防 RCE，DSH 拒绝 --host 0.0.0.0）。
- GitLab 同机容器（8880/8443/8822）。入站链：GitLab webhook → \`http://172.17.0.1:9100/gitlab-tools/webhook\`（docker 网桥地址）→ 宿主 socat（\`TCP-LISTEN:9100,bind=172.17.0.1,fork\` → 127.0.0.1:3080，systemd 单元 dsh-gitlab-webhook）→ 插件内建接收器（secret 校验/去重/防环/会话桥接全是插件现成逻辑）。GitLab 侧需允许 webhook 发往本地网络（Admin → Settings → Network → Outbound requests；此前 ntfy-converter 绑 172.17.0.1:17587 已依赖同一放行）。
- 插件真身放持久卷：宿主 /opt/dsh-agent/data/dsh-gitlab-tools（容器内 /data/dsh-gitlab-tools），profile node_modules 的 symlink 指向它（容器重建不丢）；/opt/dsh-gitlab-tools（容器层）是旧位置，重建即失效。部署 = 本地 rsync lib/ → 卷 → \`docker restart dsh-agent-dsh-1\`。
- profile-init.sh 每次启动重写 cordis.patch.yml（现含全套 webhook 配置：agentSecretToken / agentMentionUsername / agentPollProjects 兜底轮询 / agentDefaultCwd=/workspace/repo），entrypoint.sh 再 sed 注入 SA token。轮询器在服务器定位是兜底（间隔放大到 120s）。
- **AI 身份分配（2026-09-17）**：服务器 bug-triage = dev-agent（id 46），本地 Mac = DeepSeek Harness SA（id 42）——身份由各客户端的 aiToken 决定，两台各自只响应 @ 自己账户的评论（互不触发、无双响应）。SA token 存 volume 文件 /data/dsh-gitlab-tools/.sa-token（600），entrypoint.sh 文件优先、GITLAB_TOKEN env（.env）回退；轮换 = 改 volume 文件 + docker restart，无需重建容器。签发走 admin impersonation API（POST /users/:id/impersonation_tokens，service_accounts 专属签发端点在本实例 404），两把 token 均 api scope、2027-09-17 到期。注意：改 agentMentionUsername 必须与该台 aiToken 的账户一致（防环与触发同源）。AI 身份下拉功能曾实现后整体 revert（5728650）——身份由 token 决定，下拉属过度设计。
- **better-sidebar 侧边栏依赖（2026-09-17 服务器补装）**：gitlab-tools 客户端 `dsh.client.inject` 依赖的 `dsh-better-sidebar@0.19.1` 已装入服务器持久卷 profile（/data/.dsh/profiles/gitlab-agent，经 `dsh plugin add -w` 装入并自动 reconcile 进 bundles 层）。**安装纪律：插件装进卷、不动镜像**——容器层一次性，且 /data 运行时被卷覆盖、不能把插件装进镜像 /data；曾试验 Dockerfile bake 预取层（npm pack 到 /opt/dsh-better-sidebar）后回退，镜像保持原版（备份 Dockerfile.bak-bettersidebar-0917 / profile-init.sh.bak-bettersidebar-0917）。持久保障靠 profile-init.sh 自愈块（bind-mount 脚本，非镜像改动）：node_modules/dsh-better-sidebar 缺失时经 `dsh plugin add` 从 npmmirror 补装并 reconcile，fresh 卷场景 throwaway 实测走通。两个坑：① 服务器 pnpm 9.9 忽略 pnpm-workspace.yaml 的 nodeLinker（那是 pnpm 10+ 的键），实际 isolated 布局，依赖经 .pnpm realpath 链解析——node-pty 原生绑定实测可用，别用「包内无 node_modules 软链」误判损坏；② `dsh plugin add` 是 pnpm 透传器，profile 目录是 workspace 根，必须透传 -w（否则 ERR_PNPM_ADDING_TO_ROOT）。激活 = docker restart dsh-agent-dsh-1（bundle 成员变化须重启，卷上状态保留）。
- **代码可达性与新鲜度（2026-09-17）**：响应会话 cwd=/workspace/repo（entrypoint 每次启动 fetch + reset --hard origin/HEAD；容器长驻期间检出停留在启动时点，会逐渐落后）。entrypoint 现把 `git config http.sslVerify false` 持久化进 repo 配置并同步 /opt/build/dsh-agent/entrypoint.sh（自签证书；clone/fetch 的 -c 只作用于单条命令，此前 agent 会话内裸 `git fetch` 会证书报错、拿不到最新代码），agent 现可自行 fetch（含 `git fetch origin <MR 分支>`，.git 在持久卷写一次终身有效）。mention/pipeline 提示词各加一条「本地检出可能落后，先 fetch」指引（verify.mjs 有断言）。部署验证：容器内裸 fetch=FETCH_OK、smoke workspace=attached。
- 本机（Mac）dev 实例继续用 ntfy 推送源 + 轮询收事件；**双机同时开 mention 自动响应会对同一评论双响应**——留给你决定哪台响应（关掉一台的 agentMentionUsername 即可）。

## 16. 命名迁移与身份分工（2026-09-17）

- 触发词改为 @dev-agent：服务器 bug-triage（现名 gitlab-agent）profile 以 **Dev Agent**（id=46，ty 组 Developer）服务账户身份发言与响应；本地 Mac 以 **DeepSeek Harness SA**（service_account_5c681…，id=42）身份手动操作。两台 token 都是 admin 经 impersonation tokens API（POST /users/:id/impersonation_tokens）签发（2027-09-17 到期）。
- 配置键迁移（一次性协调，无旧键回退）：webhookSecretToken→agentSecretToken、webhookEventsFile→agentEventsFile、webhookMaxFileLines→agentMaxFileLines、webhookProjectWhitelist→agentProjectWhitelist、webhookPollProjects→agentPollProjects、webhookPollIntervalMs→agentPollIntervalMs、webhookMentionUsername→agentMentionUsername、webhookNtfyUrl/Token→agentNtfyUrl/Token、webhookDefaultCwd→agentDefaultCwd、webhookPipelineTriage→agentPipelineTriage、webhookPollStateFile→agentPollStateFile。迁移工具仍叫 gitlab_webhook_events / gitlab_webhook_poll_now 的改名：gitlab_agent_events / gitlab_agent_poll_now。落盘文件名不变（webhook-events.jsonl / webhook-poll-state.json，保持数据连续）。端点路径 /gitlab-tools/webhook 不变（GitLab hook 无需改）。
- 服务器 profile 改名 bug-triage → gitlab-agent：profile-init.sh / entrypoint.sh 内全部路径与 --profile 参数同步；旧 profile 目录移到 /data/.dsh/profiles/bug-triage.bak-*；sessions 与 settings.yaml 是 DSH_HOME 级，改名不受影响。systemd 单元 dsh-gitlab-webhook → gitlab-agent-webhook。
- SA token 存储定稿：docker volume 文件 /data/dsh-gitlab-tools/.sa-token（600），entrypoint 文件优先、GITLAB_TOKEN env 回退；轮换 = 改文件 + docker restart。曾用 GITLAB_TOKEN env 被吊销引发 entrypoint git fetch 失败 → set -e 崩溃循环（叠加 settings.yaml 半删除损坏，二次崩溃），修复过程见 git 历史。
- 崩溃循环排障入口：docker ps -a 看 RestartCount；docker logs 看 entrypoint 哪一步失败（git fetch 失败 = token 问题；settings section must be an object = settings.yaml 用户层结构损坏，整段移除受损命名空间）。

## 17. Agent 事件视图 + UI 原语层（2026-09-17）

- 诊断面从工具升级为视图：gitlab_agent_events 工具已移除；数据改经 GET /gitlab-tools/agent-events（limit/kind/project 参数，返回 status 块 + 事件流水）与 POST /gitlab-tools/agent-poll（手动触发一轮轮询，未启用时 enabled=false）两个路由，供内嵌视图消费。gitlab_agent_poll_now 工具保留（模型可主动触发轮询）。
- 视图内嵌在 GitLab Issues 标签（tab.tsx）：标签头 ⚡ 按钮切换 列表/事件 两个视图（与 ⚙ 设置互斥，← 返回）；组件 src/client/agent-events.tsx（AgentEventsView），非独立 better-sidebar 标签。
- **UI 原语层 src/client/ui.tsx**（shadcn/ui 思路的本地化）：Badge / Btn（带 active、disabled 态）/ StatusCard / StatusRow / Row / MetaLine / Hint。**不直接引入 shadcn/ui**：其组件绑定 Tailwind 类名体系，需要 Tailwind 构建管线并把生成的全局 CSS 注入宿主页面（无法 scoped，会与宿主 design-platform 样式互相污染）；Radix 的 portal/z-index 与本 GUI overlay 体系有冲突风险。原语样式一律走 --dsw-alias-* token（沿第 8 条规则）。新视图一律优先用这层原语，旧视图（issue-card/note-row 等）可渐进迁移。
- AI 身份诊断：agent-events 路由返回 status.aiIdentity（=aiToken 经 GET /user 解析的账户名，index.js resolveAiUsername，按 token 记忆化）+ aiIdentitySource。此前随身份下拉 revert 掉的 getAiIdentity 不再存在，勿在路由里引用。

## 18. 工具面收敛：15 → 4（网关 + lookup）+ gitlab_api_tool 手册（2026-09-18）

- **现存工具**：`gitlab_api`（全量网关；**失败响应自动附「正确用法建议」**，索引派生自生成 SDK 的 @request JSDoc，regen 自动同步）/ `gitlab_api_lookup`（端点查询：query 关键词搜全量操作 / op 查详情含示例；离线可用）/ `gitlab_create_note`（issue 评论写侧语义；提示词契约：自动桥接会话的最终回复由系统贴回，勿用它发回复）/ `gitlab_agent_poll_now`（模型主动触发轮询）。gitlab_current_user / list_projects / list_issues / view_issue / create_issue / list_mrs / view_mr / create_mr / merge_mr / list_pipelines / latest_pipeline / list_notes 十二个具名工具已删除，一律 gitlab_api 直调（迁移对照在 skill 内）。
- **规则：新 GitLab 能力默认不加具名工具**——用 gitlab_api 直调；确有高频/强 schema 需求再立新工具并在此记录。LLM 对 GitLab REST 路径是强记忆，list/view 薄封装增益低；DSH 工具目录是渐进式的，具名工具常驻 token 本来只有几百——收敛的主要收益是维护面与提示词耦合，不是常驻 token。
- **skill `skills/gitlab_api_tool/SKILL.md`**：gitlab_api 的端点手册（调用形状/常用操作迁移对照/分页与 60k 截断应对/notes vs discussions 坑/glab 人用路线）。本机装机：`ln -s "$PWD/skills/gitlab_api_tool" ~/.agents/skills/gitlab_api_tool`。改 skill 内容不需要重启。
- **glab 定位（人用工具，不是 SA 替身）**：用户本人身份在自己终端/会话操作 GitLab 用 glab 没问题（自己的 keyring/登录态）；插件 SA/aiToken 绝不注入 glab 环境（防提示词注入外传，见 §1 实测理由）。非仓库目录用法：子命令 `GITLAB_HOST=<host> glab <cmd> -R owner/repo`；透传 `glab api --hostname <host> <path>`（2026-09-18 实测 glab 1.112.0）。
- **联动改动**：src/client/devsession.ts 提示词三处工具引用改为 gitlab_api 端点（已重建 lib/client.js）；test/verify.mjs 增加工具集断言（恰好 4 个 + 描述契约）。
- **lookup 与错误建议（2026-09-18）**：`lib/apilookup.js`（纯 Node 零 cordis，verify 可离线单测）从 gitlabApi.mjs 线扫 @request/@summary 建索引（1148 spec 操作 + 3 个 spec 缺口 raw 端点）；gitlab_api 非 2xx 时 suggest() 对请求路径做占位符对齐评分，响应内附 top4 端点建议 + %2F 编码提示，401/403 只给认证提示。规则不变：lookup 是网关的配套查询面，不是恢复具名工具的口子。
- **描述与 skill 的分工**：gitlab_api 的 description 内置浓缩版手册（调用规则 + 高频端点 + 实例坑 MR notes→discussions），随工具 schema 一起下发、零装机依赖——工具的提示词必须跟工具走，不能只放在需要单独装机的 skill 里。SKILL.md 是扩展版（完整迁移对照）。两处内容改动要同步，防漂移。
