// Create-a-dev-session-for-an-issue: build the task prompt and (when the current
// session has a suitable working directory) auto-start a new dev session that
// implements the issue. No host changes needed — pure client via ctx.get("sessions").

import type { DevNotice, Issue } from "./types";

/** Build the task prompt handed to the new dev session (auto-started when suitable). */
export function buildPrompt(issue: Issue, project?: string, cwd?: string): string {
  const labels = issue.labels.length ? issue.labels.join(", ") : "无";
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  return [
    `请实现 GitLab issue #${issue.iid}：${issue.title || "(无标题)"}`,
    "",
    `- 项目：${project || "（未知）"}`,
    `- 状态：${issue.state} · 标签：${labels} · 指派人：${assignee}`,
    `- Issue 链接：${issue.web_url}`,
    cwd ? `- 工作目录：${cwd}` : "- 工作目录：（未设置）",
    "",
    "",
    "## 开发流程（务必照做）",
    "1. 先用 gitlab_view_issue 读取 #${issue.iid} 的完整描述，再用 gitlab_list_notes 读取该 issue 的整条讨论（含用户的方案、疑问、回复），以此建立完整上下文。",
    "2. 在动手前，先用 gitlab_create_note 把你的【开发计划】发到 issue #${issue.iid} 的评论里（含：对需求的理解、方案选择、疑问点、实施步骤、工作量估计）。有新的观点/疑问/方案变化时，也通过 gitlab_create_note 持续同步到 issue。",
    cwd
      ? `若当前工作目录不是 ${project || "该项目"} 的本地仓库，先 git clone 到合适位置再动手。`
      : "当前没有工作目录：先确定/克隆该项目到合适的工作目录，再开始实现。",
    "3. 实现过程中：若用户在 issue 评论或对话里回复你（答复疑问、给新方案、@ 你），用 gitlab_list_notes 及时重新读取讨论，把这些回复正确加载进执行流程并继续。不要忽略评论里的任何用户反馈。",
    "4. 实现完成后，用 gitlab_create_note 在 issue 上补充实现说明/结论（必要时提交 MR），并说明如何验证。",
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
