import crypto from "node:crypto";
import fs from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";
import { capture, runId, writeAudit } from "./04-audit.mjs";
import { DATA_FILE } from "./01-config.mjs";
import { normalizeUrl } from "./02-guardrails.mjs";

const ACTION_ID = "reply-language-fields-scope-clarification";
const CDP_ENDPOINT = process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225";

function visible(locator) {
  return locator.filter({ visible: true });
}

async function exactlyOneVisible(locator, label) {
  const matches = [];
  for (let index = 0; index < await locator.count(); index += 1) {
    if (await locator.nth(index).isVisible()) matches.push(locator.nth(index));
  }
  if (matches.length !== 1) throw new Error(`Expected one visible ${label}; found ${matches.length}.`);
  return matches[0];
}

function manifestHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalEditorText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/gu, " ").trim();
}

async function loadAction() {
  const project = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const actions = project.online?.approved_mutations?.filter((item) => item.id === ACTION_ID) ?? [];
  if (actions.length !== 1) throw new Error(`Expected one approved action ${ACTION_ID}; found ${actions.length}.`);
  const action = actions[0];
  if (action.operation !== "reply-email" || action.status !== "explicitly-authorised") {
    throw new Error("The language-fields reply is not explicitly authorised in the project manifest.");
  }
  if (action.attachments?.length !== 0) throw new Error("This reply must not contain attachments.");
  const drafts = project.correspondence.filter((item) => item.id === action.source_correspondence_id);
  if (drafts.length !== 1 || drafts[0].status !== "draft") throw new Error("Expected one approved unsent correspondence draft.");
  return { action, draft: drafts[0], hash: manifestHash(action) };
}

function assertMailDestination(raw) {
  const url = normalizeUrl(raw);
  if (url.hostname === "login.jw.org") throw new Error("JWPub Mail redirected to login; complete login manually.");
  if (url.origin !== "https://mail.jwpub.org" || url.pathname !== "/owa/") {
    throw new Error(`Unexpected mail destination: ${url.origin}${url.pathname}`);
  }
}

async function openMailFolder(page, label) {
  const treeItems = page.locator(`[role="treeitem"]:has(span[title="${label}"])`);
  let target = null;
  for (let index = 0; index < await treeItems.count(); index += 1) {
    if (await treeItems.nth(index).isVisible()) { target = treeItems.nth(index); break; }
  }
  if (!target) throw new Error(`No visible ${label} folder tree item was found.`);
  await target.click();
  await page.waitForFunction((expected) => {
    const headers = [...document.querySelectorAll("span.folderHeaderLabel")];
    return headers.some((header) => header.offsetParent !== null && header.textContent.trim() === expected);
  }, label, { timeout: 10_000 });
}

async function navigateToTargetInboxRow(page, action) {
  await openMailFolder(page, "Inbox");
  await page.waitForTimeout(1_200);
  const rows = page.locator('[role="option"]')
    .filter({ hasText: action.expected_subject })
    .filter({ hasText: action.expected_sender })
    .filter({ hasText: action.expected_received_time });
  return exactlyOneVisible(rows, "exact Daniel Martin Inbox row");
}

async function openTarget(page, action) {
  assertMailDestination(page.url());
  if ((await page.title()) !== action.expected_account_title) {
    throw new Error(`Wrong account or mailbox title: ${await page.title()}`);
  }
  const row = await navigateToTargetInboxRow(page, action);
  const rowText = await row.innerText();
  const openedBody = page.getByText("Would you please fill in the form for me?", { exact: true });
  let readingPaneAlreadyOpen = false;
  for (let index = 0; index < await openedBody.count(); index += 1) {
    if (await openedBody.nth(index).isVisible()) readingPaneAlreadyOpen = true;
  }
  if (!readingPaneAlreadyOpen) {
    await row.evaluate((element) => element.click());
    await page.waitForTimeout(1_200);
  }
  let messages = page.locator('[aria-label="Expanded Message Contents"]')
    .filter({ hasText: action.expected_sender })
    .filter({ hasText: action.expected_received_time })
    .filter({ hasText: "Would you please fill in the form for me?" });
  let visibleMessages = 0;
  for (let index = 0; index < await messages.count(); index += 1) if (await messages.nth(index).isVisible()) visibleMessages += 1;
  if (!visibleMessages) {
    const collapsed = page.locator('[aria-label="Collapsed Message Contents"]')
      .filter({ hasText: action.expected_sender })
      .filter({ hasText: action.expected_received_time })
      .filter({ hasText: "Would you please fill in the form for me?" });
    const card = await exactlyOneVisible(collapsed, "collapsed Daniel Martin 1:48 p.m. message");
    await card.click();
    await page.waitForTimeout(700);
    messages = page.locator('[aria-label="Expanded Message Contents"]')
      .filter({ hasText: action.expected_sender })
      .filter({ hasText: action.expected_received_time })
      .filter({ hasText: "Would you please fill in the form for me?" });
  }
  const message = await exactlyOneVisible(messages, "Daniel Martin 1:48 p.m. message");
  const bodyLine = await exactlyOneVisible(message.getByText("Would you please fill in the form for me?", { exact: true }), "expected message body line");
  if (!(await bodyLine.isVisible())) throw new Error("The expected Daniel Martin message body is not visible.");
  const replyControls = message.getByRole("button", { name: "Reply all", exact: true });
  let reply = null;
  for (let index = 0; index < await replyControls.count(); index += 1) {
    if (await replyControls.nth(index).isVisible()) { reply = replyControls.nth(index); break; }
  }
  const draftCards = page.locator('[aria-label="Message Contents"]').filter({ hasText: "[Draft] This message hasn't been sent." });
  let hasDraft = false;
  for (let index = 0; index < await draftCards.count(); index += 1) if (await draftCards.nth(index).isVisible()) hasDraft = true;
  if (!reply && !hasDraft) throw new Error("Neither Daniel's Reply all control nor an exact autosaved draft is available.");
  return { reply, rowText, hasDraft };
}

async function openApprovedDraft(page, action, draft) {
  await openMailFolder(page, "Drafts");
  await page.waitForTimeout(1_200);
  const rows = page.locator('[role="option"]')
    .filter({ hasText: action.expected_subject })
    .filter({ hasText: action.expected_sender });
  const row = await exactlyOneVisible(rows, "exact language-fields Drafts row");
  await row.evaluate((element) => element.click());
  await page.waitForTimeout(900);
  const editor = await exactlyOneVisible(page.getByRole("textbox", { name: "Message body", exact: true }), "saved reply message body");
  const actual = canonicalEditorText(await editor.innerText());
  const approved = canonicalEditorText(draft.body);
  if (!actual.startsWith(`${approved} From: Martin, Daniel Sent:`)) {
    throw new Error("The saved draft does not begin with the complete approved text followed by Daniel's quoted original message.");
  }
  const compose = editor.locator('xpath=ancestor::*[.//*[normalize-space(.)="Martin, Daniel"]][1]');
  const composeText = canonicalEditorText(await compose.innerText());
  if (!composeText.startsWith("To Martin, Daniel")) throw new Error("The saved draft recipient is not uniquely Martin, Daniel.");
  if (await compose.locator('[autoid="_ay_2"] a[href*="GetFileAttachment"]').count()) {
    throw new Error("The saved reply contains an unexpected attachment.");
  }
  const toolbar = await exactlyOneVisible(page.locator('[role="toolbar"][aria-label="command"]'), "draft command toolbar");
  const send = await exactlyOneVisible(toolbar.getByRole("button", { name: "Send", exact: true }), "primary Send button");
  return { editor, compose, send, source: "saved-draft" };
}

async function dismissReply(page) {
  const discardButtons = page.getByRole("button", { name: "Discard", exact: true });
  for (let index = 0; index < await discardButtons.count(); index += 1) {
    if (await discardButtons.nth(index).isVisible()) {
      await discardButtons.nth(index).click();
      await page.waitForTimeout(300);
      const confirmations = page.getByRole("button", { name: /discard/i });
      for (let confirmIndex = 0; confirmIndex < await confirmations.count(); confirmIndex += 1) {
        if (await confirmations.nth(confirmIndex).isVisible()) await confirmations.nth(confirmIndex).click().catch(() => {});
      }
      return;
    }
  }
}

async function verifySent(context, action, draft) {
  const page = await context.newPage();
  await page.goto("https://mail.jwpub.org/owa/#path=/mail", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4_000);
  assertMailDestination(page.url());
  if ((await page.title()) !== action.expected_account_title) throw new Error("Independent verification opened the wrong mailbox.");
  await openMailFolder(page, "Sent Items");
  await page.waitForTimeout(2_000);
  const sentRows = page.locator('[role="option"]')
    .filter({ hasText: new RegExp(action.expected_subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
    .filter({ hasText: action.expected_sender });
  const sentRow = await exactlyOneVisible(sentRows, "sent language-fields reply row");
  const sentSubject = await sentRow.innerText();
  await sentRow.evaluate((element) => element.click());
  await page.waitForTimeout(1_000);
  const sentBody = canonicalEditorText(await page.locator("body").innerText());
  if (!sentBody.includes(canonicalEditorText(draft.body))) throw new Error("The sent item does not contain the complete approved clarification text.");
  const artifact = await capture(page, runId(), "language-fields-sent-verified");
  const verification = { subject: sentSubject.split("\n").find((line) => line.includes(action.expected_subject)) ?? action.expected_subject, body_verified: true, artifact };
  await page.close();
  return verification;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run") || !confirm;
  if (confirm && process.argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --confirm, not both.");
  const mode = confirm ? "confirm" : "dry-run";
  const { action, draft, hash } = await loadAction();
  const auditId = runId();
  let browser;
  let page;
  let beforeArtifact = null;
  let createdThisRun = false;
  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 10_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("No authenticated JWPub browser context is available.");
    page = context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/")) ?? await context.newPage();
    if (!page.url().startsWith("https://mail.jwpub.org/owa/")) {
      await page.goto("https://mail.jwpub.org/owa/#path=/mail", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(4_000);
    }
    await page.bringToFront();
    const target = await openTarget(page, action);
    beforeArtifact = await capture(page, auditId, "language-fields-before");
    const checks = [
      "exact authorised action", "approved draft record", "no attachments", "exact mailbox account",
      "exact sender", "exact subject", "expected received time", "expected message body", "exact reply path",
    ];
    let savedDraft = null;
    if (target.hasDraft) {
      savedDraft = await openApprovedDraft(page, action, draft);
      checks.push("exact saved draft", "recipient in saved draft", "approved text before quoted original", "zero saved-draft attachments");
    }
    if (dryRun) {
      const audit = await writeAudit({ id: auditId, mode, operation: action.operation, pageKey: action.page_id,
        expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page.url(), title: await page.title(),
        checks, artifact: beforeArtifact, status: "ready", details: { action_id: action.id, manifest_sha256: hash, final_click: false } });
      console.log(JSON.stringify({ mode, status: "ready", action: action.id, recipient: action.expected_sender,
        subject: action.expected_subject, draft_state: savedDraft ? "verified-saved-draft" : "no-saved-draft",
        attachments: 0, manifest_sha256: hash, audit }, null, 2));
      return;
    }

    let composer = savedDraft;
    if (!composer) {
      if (!target.reply) throw new Error("No approved reply path is available.");
      await target.reply.click();
      createdThisRun = true;
      const editor = await exactlyOneVisible(page.getByRole("textbox", { name: "Message body", exact: true }), "reply message body");
      await editor.fill(draft.body);
      const send = await exactlyOneVisible(page.getByRole("button", { name: "Send", exact: true }), "Send button");
      const compose = editor.locator('xpath=ancestor::*[.//button[@aria-label="Send"]][1]');
      composer = { editor, compose, send, source: "new-inline-reply" };
    }
    const { editor, compose, send } = composer;
    const composeText = canonicalEditorText(await compose.innerText());
    if (!composeText.includes(action.expected_sender)) {
      throw new Error("Reply recipient did not resolve uniquely to Martin, Daniel; draft discarded.");
    }
    if (!canonicalEditorText(await editor.innerText()).startsWith(canonicalEditorText(draft.body))) {
      throw new Error("The live reply body does not begin with the complete approved draft.");
    }
    if (await compose.locator('[autoid="_ay_2"] a[href*="GetFileAttachment"]').count()) {
      throw new Error("An unexpected attachment was present in the reply composer.");
    }
    if ((await page.title()) !== action.expected_account_title) {
      throw new Error("Mailbox account changed before Send.");
    }

    await send.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="textbox"][aria-label="Message body"]')]
      .some((element) => element.offsetParent !== null), null, { timeout: 30_000 });
    const verification = await verifySent(context, action, draft);
    checks.push("recipient rechecked before Send", "approved body rechecked before Send", "no attachments before Send", "independent Sent Items verification");
    const audit = await writeAudit({ id: auditId, mode, operation: action.operation, pageKey: action.page_id,
      expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page.url(), title: await page.title(), checks,
      artifact: verification.artifact, status: "verified", details: { action_id: action.id, manifest_sha256: hash,
        recipient: action.expected_sender, subject: verification.subject, attachments: 0, sent_items_body_verified: true } });
    console.log(JSON.stringify({ mode, status: "sent-and-verified", action: action.id, recipient: action.expected_sender,
      subject: verification.subject, attachments: 0, audit }, null, 2));
  } catch (error) {
    if (page && createdThisRun) await dismissReply(page).catch(() => {});
    await writeAudit({ id: auditId, mode, operation: "reply-email", pageKey: "jwpub-mail",
      expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page?.url() ?? null,
      title: page ? await page.title().catch(() => null) : null, checks: [], artifact: beforeArtifact,
      status: "failed", error });
    throw error;
  } finally {
    // Disconnect only. The authenticated Chrome profile belongs to the user.
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Language-fields reply failed: ${error.message}`);
  process.exit(1);
});
