import { chromium } from "playwright";
import { CDP_ENDPOINT } from "./01-config.mjs";

export async function connectSharedBrowser() {
  try {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 10_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("The shared browser has no accessible context.");
    return { browser, context };
  } catch (error) {
    throw new Error(`Could not connect to the shared JW Chrome session at ${CDP_ENDPOINT}. Run npm run session:status or npm run session:start. ${error.message}`);
  }
}
