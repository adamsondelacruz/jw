import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ARTIFACTS_DIR, DATA_FILE, PROJECT_ID, PROJECT_ROOT, TIMEZONE } from "./01-config.mjs";

const execFileAsync = promisify(execFile);

export function runId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function prepareArtifacts() {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(ARTIFACTS_DIR, 0o700);
}

export async function capture(page, id, label) {
  await prepareArtifacts();
  const target = path.join(ARTIFACTS_DIR, `${id}-${label}.png`);
  await page.screenshot({ path: target, fullPage: true });
  await fs.chmod(target, 0o600);
  return target;
}

async function evidence() {
  const bytes = await fs.readFile(DATA_FILE);
  let gitCommit = null;
  try {
    const result = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: PROJECT_ROOT });
    gitCommit = result.stdout.trim();
  } catch { /* working outside Git is allowed */ }
  return {
    git_commit: gitCommit,
    project_data_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function sanitizedUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export async function writeAudit({ id, operation, pageKey, expectedUrl, finalUrl, title, checks, artifact = null, status, error = null }) {
  await prepareArtifacts();
  const record = {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    timezone: TIMEZONE,
    project_id: PROJECT_ID,
    mode: "dry-run",
    operation,
    page_key: pageKey,
    ...(await evidence()),
    expected_url: sanitizedUrl(expectedUrl),
    final_url: sanitizedUrl(finalUrl),
    title,
    checks,
    artifact: artifact ? path.basename(artifact) : null,
    status,
    error: error ? { name: error.name, code: error.code ?? "unexpected", message: error.message } : null,
  };
  const target = path.join(ARTIFACTS_DIR, `${id}-audit.json`);
  await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(target, 0o600);
  return target;
}
