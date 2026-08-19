// Create-a-dev-session-for-an-issue: build the task prompt and (when the current
// session has a suitable working directory) auto-start a new dev session that
// implements the issue. No host changes needed — pure client via ctx.get("sessions").

import type { DevNotice, Issue } from "./types";
import { registerIssueSession } from "./session-store";

/** Build the task prompt handed to the new dev session (auto-started when suitable). */
export function buildPrompt(issue: Issue, project?: string, cwd?: string): string {
  const labels = issue.labels.length ? issue.labels.map((l) => l.name).join(", ") : "无";
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  return [
    `请处理 GitLab issue #${issue.iid}：${issue.title || "(无标题)"}`,
    "",
    `- 项目：${project || "（未知）"}`,
    `- 状态：${issue.state} · 标签：${labels} · 指派人：${assignee}`,
    `- Issue 链接：${issue.web_url}`,
    cwd ? `- 工作目录：${cwd}` : "- 工作目录：（未设置）",
    "",
    "",
    "## 开发规程（务必按此执行：先规划、先确认，再动手）",
    "0. 【只读调研·不写代码】先用 gitlab_view_issue 读取 #${issue.iid} 的完整描述，用 gitlab_list_notes 读取整条讨论（含用户的方案、疑问、回复）；" +
      (cwd
        ? `clone/定位仓库后，评估【该 issue 与当前代码的匹配程度】：需求能落在哪些现有模块/代码路径上、改动范围大概多大。`
        : `评估该 issue 与代码的匹配程度：先确定/克隆该项目到合适工作目录。`) +
      " 这一步只调研，绝不开始写代码。",
    "1. 【制定 plan】把【开发计划】用 gitlab_create_note 发到 issue #${issue.iid} 的评论里——含：对需求的理解、方案选择、issue 与代码匹配度评估、疑问点、实施步骤、工作量估计。",
    "2. 【更新标签】用 gitlab_api 更新该 issue 的标签以反映当前状态（例如标为「规划中/待确认」或你按需新建的状态标签），但先不要把「进行中」标得太早。",
    "3. 【触发对话·等待确认】把 plan 同步到 issue 评论，必要时在对话里向用户说明并明确询问确认。**等待用户确认后再开始实际开发。**",
    "4. 【确认后实现】用户确认后，严格按 plan 实现；期间若用户在 issue 评论或对话里回复（答复疑问、给新方案、@ 你），用 gitlab_list_notes 及时重读讨论并把反馈正确加载进执行流，不要忽略。",
    "5. 【收尾】实现完成后，用 gitlab_create_note 在 issue 上补充实现说明/结论（必要时提交 MR），说明如何验证，并把标签更新为已完成/进行中对应的状态。",
    "",
    "## 对话交互",
    "用户在对话里 @ 你或直接对你说话时，都要正确响应其请求；若该请求属于某个 issue，先 gitlab_list_notes 读讨论再回应。",
  ].join("\n");
}

/**
 * Auto-check then act: if the current session has a working directory, create a
 * new dev session there and auto-send the issue task (the agent starts working);
 * otherwise do NOT auto-start — return the prompt for the user to copy instead.
 */
export async function createDevSession(
  ctx: unknown,
  scope: { sessionId?: string; cwd?: string } | undefined,
  issue: Issue,
  project?: string
): Promise<DevNotice> {
  type Sessions = {
    create?: (opts: { cwd?: string }) => Promise<string>;
    open?: (id: string) => void;
    binding?: (id: string) => { session?: { prompt?: (content: unknown[], mode: string) => Promise<unknown> } };
  };
  const sessions = ((ctx as { get?: (name: string) => unknown })?.get?.("sessions") as Sessions | undefined);
  if (!sessions || typeof sessions.create !== "function") {
    return { kind: "err", text: "DSH 会话服务不可用，无法创建开发会话" };
  }
  const cwd = scope?.cwd;
  const suitable = typeof cwd === "string" && cwd.trim() !== "";
  const prompt = buildPrompt(issue, project, cwd);
  try {
    if (!suitable) {
      return {
        kind: "warn",
        text: "当前会话没有工作目录，不适合自动启动开发任务。请先在会话里设置工作目录，或复制下方提示词手动发送。",
        prompt,
      };
    }
    const sessionId = await sessions.create({ cwd });
    if (typeof sessionId !== "string" || !sessionId) {
      return { kind: "err", text: "创建会话失败（未返回 sessionId）" };
    }
    // Remember the issue→session link so the card can show live progress/tokens.
    registerIssueSession(project, issue.iid, sessionId);
    const session = sessions.binding?.(sessionId)?.session;
    if (session && typeof session.prompt === "function") {
      await session.prompt([{ type: "text", text: prompt }], "queue");
      return { kind: "ok", text: `已创建开发会话并自动启动任务 · #${issue.iid}`, sessionId };
    }
    return { kind: "warn", text: "已创建会话，但未能自动发送任务（请复制提示词手动发送）", prompt, sessionId };
  } catch (e) {
    return { kind: "err", text: "创建失败：" + String((e && (e as Error).message) || e) };
  }
}
