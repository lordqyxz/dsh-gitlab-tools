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

/** Subclass exposing the protected `request` for arbitrary endpoints (generic tool + spec-gap endpoints). */
export class GitlabApi extends Api {
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
