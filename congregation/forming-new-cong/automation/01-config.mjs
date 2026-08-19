import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUTOMATION_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(AUTOMATION_ROOT, "..");
export const WORKSPACE_ROOT = path.resolve(AUTOMATION_ROOT, "../../..");
export const DATA_FILE = path.join(PROJECT_ROOT, "data", "00-project.json");
export const CDP_ENDPOINT = process.env.JW_AUTOMATION_CDP_ENDPOINT || "http://127.0.0.1:9333";
export const PRIVATE_ROOT = path.join(WORKSPACE_ROOT, ".jw-automation");
export const ARTIFACTS_DIR = path.join(PRIVATE_ROOT, "artifacts", "forming-new-cong");
export const PROJECT_ID = "ashburton-tagalog-new-congregation";
export const TIMEZONE = "Pacific/Auckland";
