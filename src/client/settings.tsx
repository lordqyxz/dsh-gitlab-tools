// The "GitLab Issues" settings page (settings.section surface).
// A fully separate surface from the sidebar tab — no shared state/refs.

import { useCallback, useEffect, useState } from "react";
import { IssueMark } from "./icons";
import { refreshSignal } from "./state";
import { TokenField } from "./token-fields";
import { C, ghostBtnStyle, inputStyle } from "./theme";
import type { ProjectDir, SettingsResp } from "./types";

type SettingsCfg = {
  defaultProject: string;
  host: string;
  token: string;
  clearToken: boolean;
  aiToken: string;
  clearAiToken: boolean;
  refreshMs: number;
  projectDirs: ProjectDir[];
};

type TestResult = { ok: boolean; text: string } | null;

export function SettingsCard() {
  const [cfg, setCfg] = useState<SettingsCfg>({
    defaultProject: "",
    host: "",
    token: "",
    clearToken: false,
    aiToken: "",
    clearAiToken: false,
    refreshMs: 120000,
    projectDirs: [],
  });
  const [status, setStatus] = useState<{
    loading: boolean;
    saving: boolean;
    msg: string | null;
    configured: boolean;
    tokenConfigured: boolean;
    aiTokenConfigured: boolean;
    test: TestResult;
  }>({
    loading: true,
    saving: false,
    msg: null,
    configured: false,
    tokenConfigured: false,
    aiTokenConfigured: false,
    test: null,
  });

  const load = useCallback(() => {
    fetch("/gitlab-tools/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setStatus((prev) => ({ ...prev, loading: false, configured: !!(json && json.ok === true && json.configured) }));
      })
      .catch(() => setStatus((prev) => ({ ...prev, loading: false })));
    fetch("/gitlab-tools/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: SettingsResp) => {
        if (json && json.ok === true) {
          setCfg((prev) => ({
            ...prev,
            // 必须保留 token/aiToken/clearToken/clearAiToken 等未回显字段，否则保存时 .trim() 崩溃
            defaultProject: json.defaultProject ?? prev.defaultProject,
            host: json.host ?? prev.host,
            refreshMs: json.refreshMs ?? prev.refreshMs,
            projectDirs: Array.isArray(json.projectDirs) ? json.projectDirs : prev.projectDirs,
          }));
          setStatus((prev) => ({
            ...prev,
            tokenConfigured: json.tokenConfigured === true,
            aiTokenConfigured: json.aiTokenConfigured === true,
          }));
        }
      })
      .catch(() => {
        /* settings optional */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = () => {
    setStatus((prev) => ({ ...prev, saving: true, msg: null }));
    const payload: Record<string, unknown> = {
      defaultProject: (cfg.defaultProject || "").trim(),
      host: (cfg.host || "").trim(),
      refreshMs: cfg.refreshMs,
      projectDirs: cfg.projectDirs
        .map((r) => ({ project: (r.project || "").trim(), dir: (r.dir || "").trim() }))
        .filter((r) => r.project && r.dir),
    };
    if (cfg.clearToken) {
      payload.token = ""; // 清除已保存 token，回落到 profile patch config
    } else if ((cfg.token || "").trim()) {
      payload.token = (cfg.token || "").trim(); // 覆盖为新 token
    }
    // 否则（空且未勾选清除）→ 不传 token，保持不变
    if (cfg.clearAiToken) {
      payload.aiToken = ""; // 清除 AI 专属 token，回落 profile patch config
    } else if ((cfg.aiToken || "").trim()) {
      payload.aiToken = (cfg.aiToken || "").trim(); // 覆盖为 AI 专属 token（DeepSeek Harness 身份）
    }
    // 否则（空且未勾选清除）→ 不传 aiToken，保持不变
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 10000); // 10s 超时兜底，避免无限「保存中」
    fetch("/gitlab-tools/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true) {
          setStatus((prev) => ({ ...prev, saving: false, msg: "已保存并热生效（无需重启）" }));
          refreshSignal.notify();
        } else {
          setStatus((prev) => ({ ...prev, saving: false, msg: (json && json.message) || "保存失败" }));
        }
      })
      .catch((e) => {
        const timedOut = e && e.name === "AbortError";
        setStatus((prev) => ({
          ...prev,
          saving: false,
          msg: "保存失败：" + (timedOut ? "请求超时（10s），请重试" : String((e && e.message) || e)),
        }));
      })
      .finally(() => window.clearTimeout(timer));
  };

  const onTest = () => {
    setStatus((prev) => ({ ...prev, test: null }));
    const q = cfg.defaultProject.trim() ? `?project=${encodeURIComponent(cfg.defaultProject.trim())}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.ok === true) {
          setStatus((prev) => ({ ...prev, test: { ok: true, text: `连接正常：${json.issues?.length ?? 0} 个打开中 issue` } }));
        } else {
          setStatus((prev) => ({ ...prev, test: { ok: false, text: (json && json.message) || "查询失败" } }));
        }
      })
      .catch((e) => setStatus((prev) => ({ ...prev, test: { ok: false, text: String((e && e.message) || e) } })));
  };

  return (
    <div style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px", padding: "10px 10px 12px", overflowY: "auto", minHeight: "0", flex: "1 1 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: C.brand }}>
          <IssueMark size={16} />
        </span>
        <span style={{ fontWeight: 600, fontSize: "13px", lineHeight: "20px", color: C.label1 }}>GitLab Issues · 侧边栏</span>
        <span style={{ fontSize: "11px", lineHeight: "16px", color: status.configured ? C.ok : C.err }}>
          {status.loading ? "…" : status.configured ? "已配置" : "未配置 host/token"}
        </span>
      </div>

      <div style={{ fontSize: "11px", lineHeight: "16px", color: C.label3 }}>
        服务器地址（host）存 settings；访问令牌（token）存 DSH 官方凭据存储
        （~/.dsh/.credentials.yaml，600 权限），只写不回显明文。留空且未勾选
        「清除」则保持不变；未设置/被清除时回落 profile patch config 里的值。
        保存后立即生效（无需重启）。
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>服务器地址（GitLab base URL，含端口，如 https://gitlab.example.com:8443）</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://gitlab.example.com:8443"
          value={cfg.host}
          onChange={(e) => setCfg((prev) => ({ ...prev, host: e.target.value }))}
          style={inputStyle}
        />
      </label>

      <TokenField
        title="访问令牌（Personal Access Token；只写不回显）"
        value={cfg.token}
        configured={status.tokenConfigured}
        placeholder={status.tokenConfigured ? "已设置（输入新值覆盖；留空不变）" : "未设置（输入 token）"}
        clear={cfg.clearToken}
        clearLabel="清除已保存的 token（回落 profile patch config）"
        onChange={(v) => setCfg((prev) => ({ ...prev, token: v }))}
        onClearChange={(c) => setCfg((prev) => ({ ...prev, clearToken: c }))}
      />

      <TokenField
        title={
          <>
            AI 专属 token（DeepSeek Harness 身份，可选）—— agent 工具（含 gitlab_create_note）用它发布，
            与你的身份区分；需使用为 AI 建的 Service Account 的 PAT（scope 至少 api）
          </>
        }
        value={cfg.aiToken}
        configured={status.aiTokenConfigured}
        placeholder={status.aiTokenConfigured ? "已设置（输入新值覆盖；留空不变）" : "未设置（输入 Service Account 的 PAT）"}
        clear={cfg.clearAiToken}
        clearLabel="清除 AI 专属 token（回落 profile patch config）"
        onChange={(v) => setCfg((prev) => ({ ...prev, aiToken: v }))}
        onClearChange={(c) => setCfg((prev) => ({ ...prev, clearAiToken: c }))}
      />

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>默认项目（path_with_namespace，如 group/project；留空则不展示）</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="group/project"
          value={cfg.defaultProject}
          onChange={(e) => setCfg((prev) => ({ ...prev, defaultProject: e.target.value }))}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <span>面板自动刷新间隔</span>
        <select
          value={cfg.refreshMs}
          onChange={(e) => setCfg((prev) => ({ ...prev, refreshMs: Number(e.target.value) }))}
          style={inputStyle}
        >
          <option value={30000}>30 秒</option>
          <option value={60000}>1 分钟</option>
          <option value={120000}>2 分钟</option>
          <option value={300000}>5 分钟</option>
          <option value={600000}>10 分钟</option>
        </select>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", lineHeight: "16px", color: C.label2 }}>项目 → 本地文件夹映射</span>
        <span style={{ fontSize: "10.5px", lineHeight: "15px", color: C.caption }}>
          创建开发会话时按此把会话放进对应项目的工作区分组（左侧填项目 path，如 group/project；右侧填本地文件夹路径）。
        </span>
        {cfg.projectDirs.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="group/project"
              value={row.project}
              onChange={(e) => setCfg((prev) => {
                const next = [...prev.projectDirs];
                next[i] = { ...next[i], project: e.target.value };
                return { ...prev, projectDirs: next };
              })}
              style={{ ...inputStyle, flex: "1 1 45%", minWidth: "0" }}
            />
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="/absolute/path/to/repo"
              value={row.dir}
              onChange={(e) => setCfg((prev) => {
                const next = [...prev.projectDirs];
                next[i] = { ...next[i], dir: e.target.value };
                return { ...prev, projectDirs: next };
              })}
              style={{ ...inputStyle, flex: "1 1 45%", minWidth: "0" }}
            />
            <button
              type="button"
              title="删除该映射"
              aria-label="删除该映射"
              onClick={() => setCfg((prev) => ({ ...prev, projectDirs: prev.projectDirs.filter((_, j) => j !== i) }))}
              style={{ ...ghostBtnStyle, background: "transparent", color: C.err, flex: "none" }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCfg((prev) => ({ ...prev, projectDirs: [...prev.projectDirs, { project: "", dir: "" }] }))}
          style={{ ...ghostBtnStyle, background: "transparent", color: C.label2, alignSelf: "flex-start" }}
        >
          + 添加映射
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={status.saving}
          style={{ ...ghostBtnStyle, background: C.surface, color: C.label1 }}
        >
          {status.saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onTest}
          style={{ ...ghostBtnStyle, background: "transparent", color: C.label2 }}
        >
          测试连接
        </button>
        {status.msg ? <span style={{ fontSize: "11px", color: C.label3 }}>{status.msg}</span> : null}
      </div>

      {status.test ? (
        <div style={{ fontSize: "11px", lineHeight: "16px", color: status.test.ok ? C.ok : C.err }}>
          {status.test.text}
        </div>
      ) : null}
    </div>
  );
}
