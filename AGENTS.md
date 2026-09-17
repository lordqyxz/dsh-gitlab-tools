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
   - `dsh-better-sidebar` 标签（`betterSidebar.registerTab`，id `gitlab-tools:issues`，`order:60`，与 explorer/git/terminal 等平级）。**注册方式（2026-09 修正）**：不再用「apply 时直接注册 + 500ms×20 轮询兜底」——better-sidebar 0.18+ 的客户端半区可能晚于旧 10 秒窗口挂载，轮询过期后 tab 静默丢失。现改为 `ctx.effect(() => ctx.inject(['betterSidebar'], (svc) => svc.effect(() => svc.betterSidebar.registerTab(TAB_DESCRIPTOR))))`，fiber 等服务就绪再注册；未装 better-sidebar 时 fiber 永久 pending（无害），设置页不受影响。配套把 package.json `dsh.client.inject` 从已消亡的 `@deepseek-ai/dsh-client-runtime` 换成 `dsh-better-sidebar`（boot 图保证其客户端 bundle 先加载；改 dsh.client 声明需重启，见第 12 条）
   - `settings.section`（「GitLab Issues」设置页：host/token/projectDirs + defaultProject/refreshMs 回退配置）
   - **声明式「功能设置」（2026-09 新增）**：TAB_DESCRIPTOR 带 `settings.pluginToggles`（defaultProject 文本 / refreshMs 数字 5000–3600000ms），持久化在 better-sidebar `pluginSettings["gitlab-tools:issues"]`；tab.tsx 的 `useTabPluginSettings` 经 `store.subscribe` 订阅并传给 `usePanel(visible, overrides)`，合并优先级 = 功能设置 > host 设置 > 默认。改字段必须同步 test/verify.mjs 的 pluginToggles 断言
   - **每行 issue 的「创建开发会话」按钮**（纯客户端）：`ctx.get('sessions')` → `create(...)` → `binding(id).session.prompt(提示词, 'queue')` 自动把「实现该 issue」任务发给 agent → `open(id)` 跳转。**启动即内嵌上下文（用规范的 Markdown 排版）**：建会话前用 `fetchIssueContext(project,iid)` 走 `/gitlab-tools/issue` + `/issue/notes` 拉取 issue 正文与既有讨论，整理成 Markdown（正文用块引用 `>`，讨论用列表项 `- **@用户** _(时间)_: 内容`）写进提示词「Issue 内容」段——agent 启动时**不必**再调 `gitlab_view_issue`/`gitlab_list_notes` 重复拉取，省一轮往返与 token；执行中只对**新增**评论增量 `gitlab_list_notes`。**分组（工作区）**：用 `sessions.create({ workspaceId })` 创建（不是裸 `cwd`，裸 cwd 会落到错误/默认分组）——目标文件夹取「设置 → GitLab Issues → 项目→本地文件夹映射」里该 issue 项目对应的 `dir`，否则回落到当前会话 `cwd`；再经 `resolveWorkspaceId(ctx, dir)`（`ctx.get('workspaces').list` 匹配 path）得到 `workspaceId`。**先自动检查**：能确定工作目录才自动开干；没有则只给提示词 + 复制按钮，不自动启动。纯客户端，无需重启。
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
   host+token 留在静态 config（profile patch），**绝不下发浏览器**。`iid` 参数必须显式存在且 >0（`Number(null)===0` 曾绕过校验）。

10. **构建**：`node scripts/build.mjs`（esbuild，externals 表见脚本）产出 `lib/client.js`（即 `exports["./client"]`，`dsh-client-modules` 固定按此路径定位 bundle，与超级注入器 `dev_reload_package` 的 preflight 一致）。esbuild 是 devDependency，装完要 `pnpm approve-builds esbuild`（已在 package.json 用 `pnpm.onlyBuiltDependencies` 白名单）。改客户端代码 → 重新 build → 刷新页面即可（无需重启）；改宿主代码 → 重启或热重载。

12. **给插件新增 `dsh.client` 声明后的激活坑（实测 2026-08）**：`dsh-client-modules` 在**启动时**按包缓存 `pkgMeta`（`dsh-gitlab-tools` 启动时没有 `dsh.client` → 缓存为 `null`，之后 `processOne` 永远返回 false）。因此**新增 `dsh.client` 声明必须重启 DSH** 才会注册浏览器 bundle——`dev_reload_package` 只能热重载宿主 fiber（宿主路由能立即生效），清不掉这个启动缓存。重启后刷新浏览器，侧边栏标签才会出现。

11. **验证**：`node test/verify.mjs`（宿主路由 mock 冒烟 + 浏览器 bundle 结构断言，不起 DSH）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。**完整测试手册（三层验证模型 + 激活/热重载的坑 + 主题 token 检查 + 改动后验证清单）见 `tests/agent.md`，改完代码先照它的清单跑，别只看 verify 全绿。**

4. **spec 缺口**：`GET /api/v4/user`（当前用户）与 `POST /projects/{id}/issues/{iid}/notes`（评论）不在 openapi spec 里 → 这两个工具走 `client.raw()`（`GitlabApi.raw` 是 `protected request` 的公开透传）。其余工具走生成的具名方法。

5. **project 路径编码**：`group/project` 作为路径参数必须 `%2F` 编码（`projectPathArg`），数字 id 原样。

6. **client 懒加载**：`createClient` 纯配置构造（零子进程），`apply` 里用 `clientPromise ??=` 记忆化，首个工具调用才构建。

13. **GitLab webhook 接收（可选功能，2026-09）**：`lib/webhook.js`（纯 Node、零 cordis 依赖、可离线测）+ `lib/index.js` 装配。
    - **启用**：插件 config（cordis.patch.yml 的 gitlab-tools insert）加 `webhookSecretToken`（值 = GitLab webhook 设置里的 Secret token）；**为空 = 功能关闭**（POST /gitlab-tools/webhook → 404 `webhook-disabled`，不建 store、事件不落盘）。改 insert config 热生效（cordis 重新 apply）。
    - **端点**：`POST /gitlab-tools/webhook`（挂在既有 prefix 路由下，分支在最前）。fail-closed：token 不匹配 401、非 POST 405、体 >2MB 400；`X-Gitlab-Webhook-UUID` 去重（GitLab 重试重发同 uuid）；`webhookProjectWhitelist` 白名单（空 = 全收；白名单外 202 + 记录标 skipped）。
    - **事件落盘**：`webhookEventsFile`（默认 `~/.dsh/gitlab-tools/webhook-events.jsonl`，超 `webhookMaxFileLines` 2000 行自动保留后半）。**会被 dsh-config-sync 同步到 iCloud**，payload 含项目内容，介意就加进 config-sync excludes。
    - **查询工具**：`gitlab_webhook_events`（首行接收器状态：文件路径/总数/类型分布；`detail: true` 附 payload）。
    - **测试**：`node test/verify.mjs` 第 4 节（mock：401/405/200 落盘/dedup/note 摘要/未启用 404 + 工具如实报告）。
    - **连接层（GitLab→本机，未定）**：GitLab 在公网 VPS（47.97.44.134:8443），本机 GUI 127.0.0.1:3080。首选 SSH 反向隧道（`ssh -N -R 127.0.0.1:3081:127.0.0.1:3080 vps`，GitLab URL 填 `http://127.0.0.1:3081/gitlab-tools/webhook`，Admin 后台开「允许 webhook 请求本地网络」）；无 SSH 权限则 cloudflared + 只转发该路径的本机中转进程（**勿直接暴露 3080，整个 GUI 会公网可达**）。
    - **Phase 2（issue @mention 自动响应，未实现）**：note 事件 + `payload.issue` 存在 + 正文含 SA 用户名 → 宿主端会话注入（参考客户端「创建开发会话」的 `sessions.create({ workspaceId })` + `binding(id).session.prompt(prompt, 'queue')` 模式定位宿主等价 API）→ 以 aiToken（SA id=42）POST issue note。**防环**：忽略 `author.username === SA 用户名` 的 note（bot 自己的评论同样触发 note webhook）+ 同一 issue 频率上限。MR 事件只落盘展示不自动响应。

14. **事件监听管道（轮询源 + @mention 自动响应，2026-09）**：`lib/listener.js`（纯 Node，零 cordis 依赖）+ index.js 装配；与 webhook 推送源共用 EventStore 与响应管道。
    - **轮询源**：config `webhookPollProjects`（要监听的项目，空=关闭）+ `webhookPollIntervalMs`（默认 30s，最小 10s）。拉 `issues/merge_requests?order_by=updated_at&updated_after=<游标>` → 新 notes（`sort=desc&per_page=30`，剔 system）→ 按 `project:kind:noteId` 去重；游标 + 已见 id 落盘 `webhookPollStateFile`（默认 ~/.dsh/gitlab-tools/webhook-poll-state.json），**重启不重放**。用 setTimeout 链（非 setInterval）防慢周期堆叠；ctx.effect 注册，卸载自清。
    - **自动响应**：config `webhookMentionUsername`（SA 用户名，空=只记录不响应）。note 命中 @mention → `buildMentionPrompt`（内嵌 issue 标题/描述/触发评论）→ 宿主注入两步链（见下）→ **agent 自己用 gitlab_create_note（aiToken/SA 身份）回复**，响应器不等 turn 完成。**防环**：忽略 author.username===mentionUsername 的 note（bot 自己的评论同样触发 note webhook/轮询）；`responded` 状态文件里每 issue 每小时上限 3 次。
    - **宿主注入两步链（冒烟实证 2026-09）**：客户端门面的 `binding(id).session.prompt` 在宿主侧不存在（冒烟实测 `create({})` 报 session header id 不匹配）；**也不要先 `sessions.create`**——`agents.create` 的工厂内部自己发布会话，预建同 id 会话会报 already exists。
    正确形状：`await ctx.agents.create({ sessionId: `'session-' + randomUUID()` })`（一体化建会话+挂 agent+启 loop）→ `await ctx.sessionController.prompt({ requestId: randomUUID(), sessionId, mode: `'queue'`, content: [{ type: `'text'`, text }] })`（GUI 发消息同一 API）。
    inject 需含 `agents`/`sessionController`。**冒烟路由 `POST /gitlab-tools/webhook-smoke`** 保留，逐步报告链路状态；降级链：no-agents-service → no-session-controller。
    - **共用管道**：webhook 推送源经 handler `respond` 回调走同一 responder（`normalizeWebhookRecord` 把 GitLab 原始 payload 归一化成 note/issue 顶层形状）；轮询源在 cycle 内直接调用。respond 失败不阻断入库（record.responder 记录错误）。
    - **工具**：`gitlab_webhook_events` head 含轮询/响应状态；`gitlab_webhook_poll_now` 手动触发一轮（验证用）。测试：verify.mjs 第 5 节（防环/限流/降级/游标/去重，mock client+sessions，不碰定时器）。
    - **注意**：改 webhookPollProjects/webhookMentionUsername 走 insert config（热生效，cordis 重新 apply 会重建 listener 与定时器）。

## 常用操作

- 改工具：改 `lib/index.js`（`defineTool` + `ctx.tools.register`），工具名 `gitlab_*` 前缀。
- SDK 升级对齐：`node tools/gen-sdk.mjs`（先更新 `tools/openapi_v2.yaml`），重跑生成+补丁+编译。
- 验证：`node test/verify.mjs`（路由 mock 冒烟 + bundle 结构断言）；真实实例冒烟用 `lib/sdk.js` 的 `createClient`。

## 15. 全事件响应机制（出站桥 + pipeline 分诊 + 跨源去重，2026-09）

### 出站桥（session → GitLab，lib/outbound.js）

- 宿主 index.js 以官方持久化插件同一惯用法订阅宿主事件：\`ctx.on('session/event', (session, event) => …)\`（agent 子 fiber 产生的会话事件会到达插件 ctx；官方 dsh-session-persistence-jsonl 的 install() 同款用法）。事件交给 \`createOutbound().handleSessionEvent\`。
- 提交点 = \`turn/end\` 且 \`reason.kind ∈ {completed, max-tokens}\`；最终回复 = 该 turn 最后一条**未中断** assistant/message 的 text 块（\`extractFinalText(session.events, turn)\`；session.events 不可用时退回 assistant/message 到达时写入的内存 stash）。aborted / error / blocked / interrupted 不贴回。
- 只有**绑定线程**的会话出站：入站响应器创建会话时在 \`state.sessionIndex[sessionId]\` 写 \`{ key, project, kind: 'issue'|'mr', iid }\`；GUI 手开的开发会话不在表内，不受影响。同 (session, turn) 只贴一次（\`state.outbound\` 有界 100 条）。kind=mr → \`/merge_requests/:iid/notes\`，issue → \`/issues/:iid/notes\`；一律 aiToken（SA）身份发布。
- \`handleSessionEvent\` 绝不 throw（失败返回 \`post-failed:*\` 字符串）——事件监听器不能破坏会话 loop。
- 模型已被明确告知（三份提示词的「回复通道」段 + \`gitlab_create_note\` 工具描述）：最终回复由系统自动贴回、不要自己调用 gitlab_create_note 发回复、人类后续评论会自动送进会话。

### pipeline 分诊（MR 流水线失败 → 分诊会话）

- \`normalizeWebhookRecord\` 扩展：object_kind=pipeline 且 payload 带 merge_request → 事件形状 \`{ pipeline, merge_request, failedJobs }\`（failedJobs 从 payload.builds 过滤）；非 MR 流水线返回 null（只落盘）。**轮询器不产 pipeline 事件**——分诊是推送源（webhook/ntfy）专属能力，轮询兜底不含它。
- \`responder.handlePipeline\`：status=failed 且有 MR 才触发；failedJobs 不足时经 client 拉 \`/pipelines/:id/jobs?scope=failed\` 预取；提示词含 MR/分支/流水线/失败作业 + 排查线索（jobs/:id/trace）+ 回复通道；会话绑定 kind='mr'，分诊结论自动贴回 MR 评论。config \`webhookPipelineTriage\` 可关（默认开）。
- 频率上限复用 responded（key \`project#mr-<iid>\` 每小时 3 次）。

### 跨源去重（webhook ↔ ntfy ↔ poll）

- \`createListener.respond()\` 是推送源统一入口：先按 \`state.seenNotes / state.seenPipelines\` 去重（与轮询器共享同一份 state），再进 responder——GitLab 重试、socat 重发、轮询兜底撞车都只响应一次。标记先于响应：限流/跳过的决定对该事件是终态。
- 历史遗留：\`agents.get\` 缺席（离线 mock / 旧宿主）按「线程已不可用」处理，不再 TypeError。

### 服务器部署形态（47.97.44.134，2026-09 起）

- \`dsh-agent-dsh-1\` 容器（**host 网络**）跑 \`dsh --profile bug-triage --port 3080 --no-open\`；DSH_HOME=/data/.dsh ↔ 宿主 /opt/dsh-agent/data/.dsh；GUI 只绑 127.0.0.1:3080（防 RCE，DSH 拒绝 --host 0.0.0.0）。
- GitLab 同机容器（8880/8443/8822）。入站链：GitLab webhook → \`http://172.17.0.1:9100/gitlab-tools/webhook\`（docker 网桥地址）→ 宿主 socat（\`TCP-LISTEN:9100,bind=172.17.0.1,fork\` → 127.0.0.1:3080，systemd 单元 dsh-gitlab-webhook）→ 插件内建接收器（secret 校验/去重/防环/会话桥接全是插件现成逻辑）。GitLab 侧需允许 webhook 发往本地网络（Admin → Settings → Network → Outbound requests；此前 ntfy-converter 绑 172.17.0.1:17587 已依赖同一放行）。
- 插件真身放持久卷：宿主 /opt/dsh-agent/data/dsh-gitlab-tools（容器内 /data/dsh-gitlab-tools），profile node_modules 的 symlink 指向它（容器重建不丢）；/opt/dsh-gitlab-tools（容器层）是旧位置，重建即失效。部署 = 本地 rsync lib/ → 卷 → \`docker restart dsh-agent-dsh-1\`。
- profile-init.sh 每次启动重写 cordis.patch.yml（现含全套 webhook 配置：webhookSecretToken / webhookMentionUsername / webhookPollProjects 兜底轮询 / webhookDefaultCwd=/workspace/repo），entrypoint.sh 再 sed 注入 SA token。轮询器在服务器定位是兜底（间隔放大到 120s）。
- 本机（Mac）dev 实例继续用 ntfy 推送源 + 轮询收事件；**双机同时开 mention 自动响应会对同一评论双响应**——留给你决定哪台响应（关掉一台的 webhookMentionUsername 即可）。
