import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { WORKSPACE_ROOT } from "./01-config.mjs";

const argv = process.argv.slice(2);
const command = argv[0];
if (!command) {
  console.error("Usage: node 05-session.mjs <status|start|open|config> [--url HTTPS_URL]");
  process.exit(2);
}
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const helper = path.join(codexHome, "skills", "jw-forming-new-congregation", "scripts", "jw_session.mjs");
const result = spawnSync(process.execPath, [helper, command, "--workspace", WORKSPACE_ROOT, ...argv.slice(1)], { stdio: "inherit" });
if (result.error) {
  console.error(`Could not run shared session helper: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
