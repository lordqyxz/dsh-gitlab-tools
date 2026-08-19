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

- **better-sidebar 标签**（`ctx.get('betterSidebar').registerTab`，id `gitlab-tools:issues`）：与 资源管理器 / Git / 子代理 / 终端 / 浏览器 等标签平级，打开即显示 `defaultProject` 的打开中 issue 列表（标题 / #iid / 指派人 / 标签 / 更新时间），点条目在新标签打开 GitLab，可手动刷新 + 按设置间隔自动轮询（标签未激活时暂停轮询）。
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
| `gitlab_create_note` | 给 issue 加评论 |
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
