# dsh-gitlab-tools

DSH（DeepSeek Harness）插件：把 GitLab 能力以 agent 工具形式注入 DSH。**不是**把 `glab` CLI 包一层，而是从 GitLab 自身的 OpenAPI spec 生成类型化 SDK 作为执行底座——SDK 与实例版本对齐，不依赖命令行子进程。除工具外，浏览器半区还提供一个**侧边栏 GitLab Issues 标签**（dsh-better-sidebar，与 终端/任务 等平级）+ 设置页。

## 架构

```
~/.dsh/profiles/web/cordis.patch.yml  (insert 声明)
        │
        ▼
dsh-gitlab-tools (cordis 插件)
        │
        ├─ lib/index.js      宿主：工具定义（defineTool + ctx.tools.register）
        │                    + /gitlab-tools/* 代理路由（token 不出服务端）
        ├─ lib/sdk.js        SDK 构造 + 纯配置认证（host+token，无 glab/keyring）+ raw 包装
        ├─ lib/client.js     浏览器 bundle（构建产物；src/client/index.tsx → esbuild）
        ├─ src/client/       客户端源码（better-sidebar 标签 + settings.section 设置页）
        ├─ scripts/build.mjs 客户端 bundle 构建脚本
        ├─ test/verify.mjs   离线验证（宿主路由冒烟 + bundle 结构断言）
        └─ lib/generated/    从 OpenAPI spec 生成的 SDK（gitlabApi.mjs + 类型）
```

> `package.json` 的 `exports["./client"]` 指向 `lib/client.js`（浏览器 bundle）——这是 `dsh-client-modules` 定位客户端 bundle 的固定路径。SDK helper 在 `lib/sdk.js`，宿主用相对路径引用。

## GitLab Issues 侧边栏标签（浏览器半区）

- **better-sidebar 标签**（`ctx.get('betterSidebar').registerTab`，id `gitlab-tools:issues`）：与 资源管理器 / Git / 子代理 / 终端 / 浏览器 等标签平级，打开即显示 `defaultProject` 的打开中 issue，**卡片式列表**（标题 / #iid / 指派人 / 标签 / 更新时间），点卡片展开标签内详情+讨论，可手动刷新 + 按设置间隔自动轮询（标签未激活时暂停轮询）。
- **标签颜色同步 GitLab**：issue 请求带 `with_labels_details=true`，宿主把每个标签的 `color`/`text_color`（GitLab 服务器设定的背景色 + 对比文字色）一并脱敏下发，客户端标签 chip 直接用这套配色渲染——标签在侧边栏与 GitLab web 端颜色一致。
- **从 issue 一键创建开发会话（▶ 播放三角按钮）**：每张卡片右上角的**播放三角（▶）**会**自动检查当前会话工作目录**——有工作目录就新建一个开发会话（继承该目录）并把「实现该 issue」的任务自动发给 agent（立刻开干）；没有工作目录则不自动启动，只给出可复制的任务提示词。任务提示词让 agent 用 `gitlab_view_issue` / `gitlab_list_notes` 读完整上下文，先把开发计划评论到 issue，再把用户回复加载进执行流；若当前目录不是对应仓库会先 `git clone`。纯客户端实现，无需重启。
- **开发会话实时进度（卡片底部）**：**开始（▶）/ 停止（■）/ 打开（▶）按钮与统计信息统一放在卡片底部**——运行/已结束 圆点 + **token 消耗**（⬆输入 / ⬇输出 / Σ合计）+ **token 速度**（tok/s）。配色区分：开发中=绿点、已结束=灰点、停止=红、开始/打开=品牌橙。token 数据由宿主读该会话的事件日志（`assistant/message` 的 `usage`）聚合而来，经 `/session/stats` 代理返回（token 不出服务端）。
- **点击 issue = 标签内详情 + 讨论（不跳 web）**：点条目直接在标签内展开 issue 内容（标题/状态/标签/指派/里程碑 + 描述）与完整讨论消息流，底部评论框可直接发评论（支持 Markdown，⌘/Ctrl+Enter 发送）。AI 在开发会话里用 `gitlab_create_note` 评论，详情刷新即见；你发的评论以配置 token 所属账号发布。描述/评论由客户端内置轻量 Markdown 渲染（先转义、无 XSS；GitLab 的 `render_html` 在该实例不生效）。
- **双身份（区分谁发评论）**：可选「AI 专属 token」——给 DeepSeek Harness 用的 Service Account 配一个 PAT（scope 至少 `api`）填到设置页「AI 专属 token」，之后 agent 工具（含评论）一律以该 AI 身份发布、你在侧边栏的评论以你自己的账号发布，讨论里作者天然区分。未配置则 agent 回落用主 token（行为不变）。
- **设置页**（`settings.section` 槽位，设置 →「GitLab Issues」）：配置默认项目 `defaultProject` 与刷新间隔 `refreshMs`，带「测试连接」。
- **主题**：配色只用 DSH 设计系统真实存在的 `--dsw-alias-*` token，随 `body[data-ds-dark-theme]` 自适应白天/夜间主题。
- **安全**：浏览器只通过宿主 `/gitlab-tools/*` 代理路由拿数据，host/token **绝不进入浏览器**。
- **生效**：只改 `src/client` → `node scripts/build.mjs` → `dev_reload_package gitlab-tools` → **刷新页面即可**（无需重启）；改宿主代码 / 加 `dsh.client` 声明则需要重启。

## SDK 从哪来

- 源：`tools/openapi_v2.yaml`（GitLab 官方仓库 `doc/api/openapi/openapi_v2.yaml`，master ~19.x）
- 生成：`swagger-typescript-api` → 打补丁（修生成器对 `*package_name`/`(ref/...)` 路径段的 bug）→ `esbuild` 编译为 ESM
- 再生成：`node tools/gen-sdk.mjs`（升级 GitLab 后重新对齐用）
- 已修的生成器缺陷：`securityWorker` 需要 `baseApiParams.secure: true` 才会带 token（见 `lib/sdk.js`）

## 认证

**纯配置直连，不依赖 glab/keyring、不 spawn 子进程**。在插件 config（`$DSH_HOME/settings.yaml` 的 `gitlab-tools:` 节，或 patch entry 的 `config`）里写：

1. `host`：内网 GitLab 实例的 REST base URL（含端口），如 `https://gitlab.example.com:8443`
2. `token`：GitLab personal access token（敏感凭据，勿提交/外发）

SDK 用 `PRIVATE-TOKEN` 头访问。缺 host/token 时工具会抛清晰报错。

## 工具清单（渐进式：核心 + 全量）

| 工具 | 说明 |
|---|---|
| `gitlab_current_user` | 当前登录用户 |
| `gitlab_list_projects` | 项目列表（membership/search/排序） |
| `gitlab_list_issues` / `gitlab_view_issue` / `gitlab_create_issue` | issue 列表/详情/创建 |
| `gitlab_list_mrs` / `gitlab_view_mr` / `gitlab_create_mr` / `gitlab_merge_mr` | MR 列表/详情/创建/合并 |
| `gitlab_list_pipelines` / `gitlab_latest_pipeline` | CI/CD pipeline 列表/最新 |
| `gitlab_create_note` | 给 issue 加评论（开发计划/观点/疑问/方案同步用） |
| `gitlab_list_notes` | 读取 issue 完整讨论（旧→新；加载用户评论里的回复进开发流程用） |
| `gitlab_api` | **全量**：任意 REST v4 端点直通（覆盖 spec 全部 1145 个操作） |

`project` 参数接受 `group/project` 路径或数字 id（省略时用 config 的 `defaultProject`）。

## 安装（本机）

```bash
# 1. profile 依赖（link 到本目录）
cd ~/.dsh/profiles/web
pnpm add "dsh-gitlab-tools@link:/Users/apple/dev/dsh-gitlab-tools"

# 2. cordis.patch.yml 加声明：
# - insert:
#     - id: gitlab-tools
#       name: dsh-gitlab-tools
#       config:
#         host: 'https://gitlab.example.com:8443'
#         token: 'glpat-xxx'
#         defaultProject: ''

# 3. 重启 dsh（GUI 里重新打开/重启进程）加载插件
```

客户端 bundle 开发：

```bash
cd /Users/apple/dev/dsh-gitlab-tools
pnpm install --config.confirm-modules-purge=false   # 首次（esbuild devDependency）
node scripts/build.mjs                               # 产出 lib/client.js
node test/verify.mjs                                 # 离线验证
```

## 配置

patch entry 的 `config` 或 `$DSH_HOME/settings.yaml` 的 `gitlab-tools:` 节：

```yaml
gitlab-tools:
  host: 'https://gitlab.example.com:8443'   # 必填：实例 REST base URL
  token: 'glpat-xxx'                        # 必填：personal access token
  defaultProject: ''  # group/project 或数字 id
  perPage: 20
  timeoutMs: 60000
```
