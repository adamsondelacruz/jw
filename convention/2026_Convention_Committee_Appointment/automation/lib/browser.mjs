import fs from "node:fs/promises";
import { chromium } from "playwright";
import { ARTIFACTS_DIR, PROFILE_DIR } from "./config.mjs";

export async function preparePrivateDirectories() {
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(PROFILE_DIR, 0o700);
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(ARTIFACTS_DIR, 0o700);
}

export async function launchProfile({ headless }) {
  await preparePrivateDirectories();
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    channel: "chrome",
    viewport: headless ? { width: 1440, height: 1000 } : null,
    acceptDownloads: false,
    locale: "en-NZ",
    timezoneId: "Pacific/Auckland",
  });
}

export async function primaryPage(context) {
  const pages = context.pages();
  return pages[0] ?? context.newPage();
}

