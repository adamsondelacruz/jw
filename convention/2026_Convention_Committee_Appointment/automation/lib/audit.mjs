import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ARTIFACTS_DIR, CONVENTION_ID, EVENT_LABEL, ROOT } from "./config.mjs";

const execFileAsync = promisify(execFile);
const workbook = path.resolve(ROOT, "..", "2026 CONVENTION COMMITTEE.xlsx");

export function runId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function gitCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: ROOT });
    return stdout.trim();
  } catch { return null; }
}

export async function sourceEvidence() {
  const stat = await fs.stat(workbook);
  return { workbook: path.basename(workbook), modifiedAt: stat.mtime.toISOString(), sha256: await sha256(workbook) };
}

export async function writeAudit({ id, mode, role, expectedName, status, checks, artifacts = [], error = null }) {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true, mode: 0o700 });
  const record = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    timezone: "Pacific/Auckland",
    gitCommit: await gitCommit(),
    conventionId: CONVENTION_ID,
    eventLabel: EVENT_LABEL,
    mode,
    role,
    expectedName,
    source: await sourceEvidence(),
    status,
    checks,
    artifacts: artifacts.map(file => path.relative(ARTIFACTS_DIR, file)),
    error: error ? { name: error.name, code: error.code ?? "unexpected", message: error.message } : null,
  };
  const target = path.join(ARTIFACTS_DIR, `${id}-audit.json`);
  await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return target;
}

export async function writeBatchAudit({ id, mode, status, results, exclusions, error = null }) {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true, mode: 0o700 });
  const record = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    timezone: "Pacific/Auckland",
    gitCommit: await gitCommit(),
    conventionId: CONVENTION_ID,
    eventLabel: EVENT_LABEL,
    mode,
    status,
    source: await sourceEvidence(),
    results,
    exclusions,
    error: error ? { name: error.name, code: error.code ?? "unexpected", message: error.message } : null,
  };
  const target = path.join(ARTIFACTS_DIR, `${id}-batch-audit.json`);
  await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return target;
}

export async function capture(page, id, label) {
  const target = path.join(ARTIFACTS_DIR, `${id}-${label}.png`);
  await page.screenshot({ path: target, fullPage: true });
  await fs.chmod(target, 0o600);
  return target;
}
