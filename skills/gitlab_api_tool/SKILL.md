---
name: gitlab_api_tool
description: >-
  gitlab_api 工具的完整使用手册（dsh-gitlab-tools 插件）：用一个工具调用一切 GitLab REST v4 API——
  issue/MR/pipeline 的查建改、标签、里程碑、release、分支/提交、用户、群组等任意操作。
  含调用形状、%2F 编码、分页、60k 截断应对、大 JSON jq 切片、notes vs discussions 坑、
  何时改用 gitlab_create_note，以及人用 glab CLI（本人身份）的分工边界。
---

# gitlab_api_tool — 用 gitlab_api 调用一切 GitLab REST API

本文件不是工具，是 `gitlab_api` 工具的使用手册。

浓缩版手册已内置在 `gitlab_api` 工具描述里（随工具 schema 一起下发，无需装机）；本文件是扩展版：完整迁移对照表 + 分页/截断细节 + glab 人用路线。两处内容改动需同步，防漂移。

另有一个查询工具 `gitlab_api_lookup`：按关键词搜全部操作 / op 查详情（含可改编示例）；`gitlab_api` 出错时响应会自动附正确用法建议，通常无需手动查。先在会话里直接调用 `gitlab_api`（工具目录没看到就 tool_search 定位），再按本手册拼参数。

## 调用形状

- path：相对 /api/v4，如 `projects/16/repository/branches`、`projects/group%2Fproj/issues`
- project 路径里的 / 必须 %2F 编码（数字 id 原样）；gitlab_api 没有 defaultProject 兜底，路径必须写全
- method：GET（默认）/ POST / PUT / DELETE；query、body 都是 JSON 对象
- 响应是原始 JSON 的格式化文本；超过 ~60k 字符被截断并附注记

## 常用操作对照（旧具名工具 → 端点）

| 任务 | 调用 |
|---|---|
| 当前用户 | GET user |
| 项目搜索 | GET projects?search=xx&membership=true |
| issue 列表 | GET projects/:id/issues?state=opened&per_page=20 |
| issue 详情 | GET projects/:id/issues/:iid |
| 创建/编辑 issue | POST projects/:id/issues（body: title,description,labels） / PUT projects/:id/issues/:iid |
| issue 评论列表 | GET projects/:id/issues/:iid/notes?sort=desc&order_by=created_at |
| issue 加评论 | POST projects/:id/issues/:iid/notes（body: {body}）——日常开发语义优先 gitlab_create_note |
| MR 列表/详情 | GET projects/:id/merge_requests / GET .../:iid |
| 创建/合并 MR | POST projects/:id/merge_requests / PUT .../:iid/merge |
| MR 讨论 | GET projects/:id/merge_requests/:iid/discussions（本实例 MR 的 /notes 端点实测 404，用 discussions） |
| pipeline 列表/单个 | GET projects/:id/pipelines?ref=xx / GET projects/:id/pipelines/:pid |
| 失败作业/日志 | GET projects/:id/pipelines/:pid/jobs?scope=failed / GET projects/:id/jobs/:job_id/trace |
| 标签/里程碑/release | GET|POST|PUT projects/:id/labels 与 milestones 与 releases |
| 分支/提交 | GET projects/:id/repository/branches 与 commits |

## 分页与大响应

- 分页：query 带 `page`/`per_page`（默认 20，最大 100）；返回条数 < per_page 即末页
- 遇到 60k 截断注记：改更精确的 query（更小 per_page / 指定 iid / 字段过滤），或 bash 下载后 jq 切片——不要原样重试整包
- 服务器场景 bash 直连可用 `git remote get-url origin` 里的 oauth 凭据作 PRIVATE-TOKEN

## 何时不用 gitlab_api

- 给 issue 发开发流程评论（计划/结论/同步）→ `gitlab_create_note`
- 自动桥接会话（@mention / pipeline 分诊）的最终回复 → 不调用任何工具，系统自动贴回

## 人用 glab 路线（可选，仅限本人身份）

用户本人在自己的终端/会话里操作 GitLab 可以直接用 glab（自己的登录态/keyring）：

- 非仓库目录：子命令 `GITLAB_HOST=<host> glab <cmd> -R owner/repo`；透传 `glab api --hostname <host> <path>`
- 列表类输出加 `-O json` / `--jq` 切片
- 禁止把插件 SA/aiToken 或插件 config 里的 token 注入 glab 环境（GITLAB_TOKEN/env/config 均不行）——SA 凭据只活在插件进程内，防提示词注入外传
