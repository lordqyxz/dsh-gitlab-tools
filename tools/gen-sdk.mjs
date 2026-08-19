// dsh-gitlab-tools — SDK regeneration script.
// Reproduces lib/generated/gitlabApi.{ts,mjs} from GitLab's own OpenAPI spec so
// the client stays version-aligned with the instance (instead of lagging like
// hand-maintained clients). Run after a GitLab upgrade to re-align:
//
//   pnpm dlx swagger-typescript-api generate \
//     -p tools/openapi_v2.yaml -o /tmp/sta-gen -n gitlabApi.ts
//
// then apply the two generator bug fixes (wildcard/parenthesized path segments
// leaking into identifiers) and compile to ESM with esbuild:
//
//   npx esbuild /tmp/sta-gen/gitlabApi.ts --format=esm --outfile=lib/generated/gitlabApi.mjs --target=node22
//
// Spec source: https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi_v2.yaml
// (self-managed instances serve no openapi.json on /api/v4 as of 19.x — 404).
//
// Generator quirks patched (verified on 43.x swagger-typescript-api / spec 19.x):
//   1. `*package_name`-style wildcard and `(ref/{ref}/)`-style optional segments in
//      paths become identifiers containing `*` / `( )` — invalid JS. Rewritten to
//      valid camelCase; the URL template strings are left untouched.
//   2. The generated HttpClient never runs securityWorker unless `secure` is truthy,
//      and its default baseApiParams sets no `secure` — the token silently never
//      attaches and the instance answers 404. The plugin therefore constructs the
//      client with `baseApiParams: { secure: true }` (see lib/client.js).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SPEC = join(ROOT, "tools", "openapi_v2.yaml");
const OUT_TS = "/tmp/sta-gen/gitlabApi.ts";
const OUT_MJS = join(ROOT, "lib", "generated", "gitlabApi.mjs");
const OUT_TS_DEST = join(ROOT, "lib", "generated", "gitlabApi.ts");

const FIXES = [
  [/\*packageName/g, "packageName"],
  [/\*packageVersion\(\*path\)/g, "packageVersionPath"],
  [/\*pathFileName/g, "pathFileName"],
  [/\*moduleVersionFile/g, "moduleVersionFile"],
  [/\(refRef\)/g, "RefRef"],
  [/\(\*path\)/g, "Path"]
];

if (!existsSync(SPEC)) {
  console.error(`spec not found: ${SPEC}`);
  process.exit(1);
}

console.log("1/3 generating TS client ...");
execSync(`npx --yes swagger-typescript-api generate -p "${SPEC}" -o /tmp/sta-gen -n gitlabApi.ts`, { stdio: "inherit" });

console.log("2/3 patching generator bugs ...");
let src = require("node:fs").readFileSync(OUT_TS, "utf8");
for (const [re, to] of FIXES) src = src.replace(re, to);
require("node:fs").writeFileSync(OUT_TS, src);
require("node:fs").writeFileSync(OUT_TS_DEST, src);

console.log("3/3 compiling ESM ...");
execSync(`npx --yes esbuild "${OUT_TS}" --format=esm --outfile="${OUT_MJS}" --target=node22`, { stdio: "inherit" });

console.log(`done → ${OUT_MJS} (${require("node:fs").statSync(OUT_MJS).size} bytes)`);
