// Agent 事件视图：事件管线状态 + 入库事件流水（含 responder 处置结果）。
// 内嵌在 GitLab Issues 标签内（标签头 ⚡ 切换），不是独立 better-sidebar 标签。
// 只读诊断面：数据来自 GET /gitlab-tools/agent-events，手动轮询走
// POST /gitlab-tools/agent-poll。不显示任何密钥；UI 原语见 ./ui。

import { useCallback, useEffect, useState } from "react";
import { Badge, Btn, Hint, MetaLine, Row, StatusCard, StatusRow } from "./ui";
import { C, inputStyle } from "./theme";
import type { AgentEventRow, AgentEventsResp } from "./types";

/** responder 处置结果 → 徽章色调：成功绿 / 失败红 / 跳过与去重灰。 */
function toneOf(responder?: string | null): string {
  if (!responder) return "neutral";
  const key = responder.split(":")[0];
  if (key === "responded" || key === "triaged" || key === "continued") return "ok";
  if (key === "post-failed" || key === "respond-error" || key === "responder-error") return "err";
  return "neutral";
}

function statusRows(s: NonNullable<AgentEventsResp["status"]>): { label: string; value: string; warn?: boolean }[] {
  const rows: { label: string; value: string; warn?: boolean }[] = [];
  rows.push({ label: "接收器", value: s.receiver === "on" ? "on（POST /gitlab-tools/webhook）" : "off（未配置 agentSecretToken）" });
  const p = s.poller;
  rows.push({
    label: "轮询兜底",
    value: p && p.enabled
      ? "on · " + p.projects.join(", ") + " · 每 " + Math.round(p.intervalMs / 1000) + "s · 上轮 " + (p.lastPollAt ? p.lastPollAt.slice(11, 19) + " UTC" : "—")
      : "off（agentPollProjects 为空）",
  });
  rows.push({ label: "ntfy 推送", value: s.ntfy && s.ntfy.enabled ? "on · " + s.ntfy.url + (s.ntfy.lastError ? " ⚠ " + s.ntfy.lastError : "") : "off" });
  const r = s.responder;
  rows.push({
    label: "自动响应",
    value: r && r.enabled
      ? "on · 触发 @" + r.mentionUsername + " · " + r.maxPerIssuePerHour + " 次/时" + (r.pipelineTriage ? " · pipeline 分诊" : "")
      : "off（agentMentionUsername 为空）",
  });
  const o = s.outbound;
  rows.push({
    label: "出站贴回",
    value: o
      ? "绑定会话 " + o.boundSessions + " · 已贴回 " + o.postedCount + (o.lastTarget ? " · 最近 " + o.lastTarget : "") + (o.lastError ? " ⚠ " + o.lastError : "")
      : "—",
    warn: Boolean(o && o.lastError),
  });
  rows.push({
    label: "AI 身份",
    value: s.aiIdentity ? "@" + s.aiIdentity + "（" + s.aiIdentitySource + "）" : "未解析",
  });
  return rows;
}

export function AgentEventsView() {
  const [status, setStatus] = useState<AgentEventsResp["status"] | null>(null);
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [project, setProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ limit: "100" });
    if (kind) q.set("kind", kind);
    if (project.trim()) q.set("project", project.trim());
    fetch("/gitlab-tools/agent-events?" + q.toString(), { cache: "no-store" })
      .then((r) => r.json())
      .then((json: AgentEventsResp) => {
        if (json && json.ok === true) {
          setStatus(json.status ?? null);
          setEvents(Array.isArray(json.events) ? json.events : []);
          setTotal(json.total ?? 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [kind, project]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [load]);

  const onPoll = () => {
    setPolling(true);
    setPollMsg(null);
    fetch("/gitlab-tools/agent-poll", { method: "POST" })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true && json.enabled) {
          setPollMsg("轮询完成：新增 " + (json.notes ?? 0) + " 条" + (Array.isArray(json.errors) && json.errors.length ? "；错误：" + json.errors.join("；") : ""));
        } else {
          setPollMsg((json && json.message) || "轮询未启用");
        }
        load();
      })
      .catch((e) => setPollMsg("触发失败：" + String((e && (e as Error).message) || e)))
      .finally(() => setPolling(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: 0, flex: "1 1 auto", overflowY: "auto" }}>
      {status ? (
        <StatusCard>
          {statusRows(status).map((row) => (
            <StatusRow key={row.label} label={row.label} value={row.value} warn={row.warn} />
          ))}
        </StatusCard>
      ) : (
        <Hint>{loading ? "加载中…" : "状态未加载"}</Hint>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, flex: "0 0 110px" }}>
          <option value="">全部类型</option>
          <option value="note">note</option>
          <option value="pipeline">pipeline</option>
          <option value="push">push</option>
          <option value="issue">issue</option>
          <option value="merge_request">merge_request</option>
        </select>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="按项目过滤（group/project）"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 auto", minWidth: 0 }}
        />
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <Btn onClick={onPoll} disabled={polling}>{polling ? "轮询中…" : "立即轮询"}</Btn>
        <Btn onClick={load}>刷新</Btn>
        <Hint>{events.length} / {total} 条 · 15s 自动刷新</Hint>
      </div>

      {pollMsg ? <Hint>{pollMsg}</Hint> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {events.length === 0 && !loading ? <Hint>（还没有事件：等 GitLab 投递，或点「立即轮询」）</Hint> : null}
        {events.map((e, i) => (
          <Row key={(e.uuid || String(i)) + (e.receivedAt || "")}>
            <MetaLine>
              <span>{e.receivedAt ? e.receivedAt.slice(11, 19) : "—"}</span>
              <Badge>{e.source}</Badge>
              <Badge>{e.kind}</Badge>
              {e.skipped ? <Badge tone="err">白名单外</Badge> : null}
            </MetaLine>
            <div style={{ fontSize: "11.5px", lineHeight: "17px", color: C.label1, wordBreak: "break-all" }}>{e.brief}</div>
            <div style={{ fontSize: "10.5px", lineHeight: "15px", color: toneOf(e.responder) === "ok" ? C.ok : toneOf(e.responder) === "err" ? C.err : C.label3 }}>
              {e.responder ? "处置：" + e.responder : "未进入响应管道"}
            </div>
          </Row>
        ))}
      </div>
    </div>
  );
}
