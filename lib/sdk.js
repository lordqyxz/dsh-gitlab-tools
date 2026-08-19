// dsh-gitlab-tools — SDK helper (host half).
// Wires the spec-generated GitLab SDK (lib/generated/gitlabApi.mjs, generated from
// GitLab's own OpenAPI spec, version-aligned to the 19.x line) to the user's
// instance. Auth is configured directly through the plugin Config — no `glab`
// CLI / keyring dependency. Config source (see AGENTS.md):
//   host:  https://host[:port]   e.g. https://gitlab.example.com:8443
//   token: a GitLab personal access token
// Every API call goes straight through the SDK; glab is never spawned.
//
// The generated SDK's auth path requires `baseApiParams.secure: true` for the
// securityWorker to run; without it the token is silently never attached and
// the instance answers 404. This is the one runtime knob we must set.
import { Api } from "./generated/gitlabApi.mjs";

/** 从 SDK 抛出的非 2xx 错误里提取可读信息（含 HTTP 状态码）。 */
function requestErrorMessage(err) {
  if (err == null) return "unknown error";
  const status =
    typeof err === "object" && err && Number.isFinite(err.status)
      ? ` (HTTP ${err.status})`
      : "";
  if (err && typeof err === "object" && "error" in err) {
    const body = err.error;
    if (typeof body === "string") return body + status;
    if (body && typeof body === "object") {
      const m = body.message ?? body.error ?? body.description;
      if (m) return String(m) + status;
      try {
        return JSON.stringify(body) + status;
      } catch {
        return String(body) + status;
      }
    }
  }
  return ((err && err.message) ?? String(err)) + status;
}

/** Subclass exposing the protected `request` for arbitrary endpoints (generic tool + spec-gap endpoints). */
export class GitlabApi extends Api {
  constructor(...args) {
    super(...args);
    // 生成的 SDK 用 arrow 属性定义 `request`（挂在实例上，非原型），且非 2xx
    // 时是 `throw`（gitlabApi.mjs 里 `if (!response.ok) throw data;`）。此前
    // 每个工具都按「返回 {data,error}」写 `r.data ?? r.error` 兜底，失败时
    // 根本走不到，全被框架序列化成 `[object Response]`。这里在唯一咽喉点把
    // 基类的 request 包装成 `{ ok, data, error }`——raw() 与所有走生成方法
    // 的工具（create_issue/create_mr/merge_mr/列表查询等）都经此归一化。
    const baseRequest = this.request.bind(this);
    this.request = (params) =>
      baseRequest(params).then(
        (r) => ({ ok: true, data: r && r.data != null ? r.data : null, error: null }),
        (err) => ({ ok: false, data: null, error: requestErrorMessage(err) })
      );
  }

  raw({ path, method = "GET", query, body, format = "json" }) {
    // 生成的 SDK 方法会显式传 `type: "application/json"` 以带 Content-Type 头；
    // 裸 `raw` 调用若不补，POST/PUT 的 JSON body 会被 fetch 默认成 text/plain，
    // GitLab 直接 415。有 body 时强制声明 JSON。
    return this.request({
      path,
      method,
      query,
      body,
      format,
      type: body != null ? "application/json" : undefined
    });
  }
}

/**
 * Build the SDK client from explicit config `host` + `token`.
 * Throws a clear error when either is missing (no glab fallback anymore).
 */
export function createClient(config) {
  const baseUrl = config.host?.trim() || "";
  const token = config.token?.trim() || "";
  if (!baseUrl || !token) {
    throw new Error(
      "gitlab-tools: missing auth config. Set `host` (e.g. https://gitlab.example.com:8443) and `token` " +
      "in settings.yaml under `gitlab-tools:`, or in the profile patch's plugin config."
    );
  }
  const api = new GitlabApi({
    baseUrl,
    baseApiParams: { secure: true },
    securityWorker: (data) => (data?.token ? { headers: { "PRIVATE-TOKEN": data.token } } : {})
  });
  api.setSecurityData({ token });
  return api;
}

/** Normalize a project reference for path params: numeric id stays; `group/project` becomes URL-encoded. */
export function projectPathArg(project) {
  const s = String(project ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s;
  return s.split("/").map((seg) => encodeURIComponent(seg)).join("%2F");
}
