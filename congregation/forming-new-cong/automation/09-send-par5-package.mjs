import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { capture, runId, writeAudit } from "./04-audit.mjs";
import { DATA_FILE, PROJECT_ROOT } from "./01-config.mjs";
import { normalizeUrl } from "./02-guardrails.mjs";

const ACTION_ID = "reply-par5-package-to-daniel";
const CDP_ENDPOINT = process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225";

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

function canonicalText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/gu, " ").trim();
}

async function assertDanielOnly(compose) {
  const toWell = await exactlyOneVisible(
    compose.locator('[aria-label^="To recipients."]'),
    "To recipient well",
  );
  const recipients = [];
  const chips = toWell.locator('[autoid="_pe_b"]');
  for (let index = 0; index < await chips.count(); index += 1) {
    if (await chips.nth(index).isVisible()) recipients.push(canonicalText(await chips.nth(index).innerText()));
  }
  if (recipients.length !== 1 || recipients[0] !== "Martin, Daniel") {
    throw new Error(`Reply recipient did not resolve uniquely to Martin, Daniel. Recipients: ${JSON.stringify(recipients)}`);
  }
  const ccWells = compose.locator('[aria-label^="Cc recipients."]');
  for (let index = 0; index < await ccWells.count(); index += 1) {
    if (!await ccWells.nth(index).isVisible()) continue;
    const ccChips = ccWells.nth(index).locator('[autoid="_pe_b"]');
    for (let chipIndex = 0; chipIndex < await ccChips.count(); chipIndex += 1) {
      if (await ccChips.nth(chipIndex).isVisible()) throw new Error("A Cc recipient is present on the reply.");
    }
  }
  const composeText = canonicalText(await compose.innerText());
  if (!/^To: Martin, Daniel(?:\s|$)/u.test(composeText)) {
    throw new Error(`Unexpected compose recipient summary: ${composeText.slice(0, 220)}`);
  }
}

async function sha256(filename) {
  const data = await fs.readFile(filename);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function loadAction() {
  const project = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const actions = project.online?.approved_mutations?.filter((item) => item.id === ACTION_ID) ?? [];
  if (actions.length !== 1) throw new Error(`Expected one approved action ${ACTION_ID}; found ${actions.length}.`);
  const action = actions[0];
  if (action.operation !== "reply-email" || action.status !== "explicitly-authorised") {
    throw new Error("The S-50 par. 5 reply is not explicitly authorised in the project manifest.");
  }
  const drafts = project.correspondence.filter((item) => item.id === action.source_correspondence_id);
  if (drafts.length !== 1 || drafts[0].status !== "draft") throw new Error("Expected one approved unsent correspondence draft.");
  const draft = drafts[0];
  const declared = action.attachments ?? [];
  if (declared.length !== 7 || draft.attachments?.length !== 7) throw new Error("Expected exactly seven approved attachments.");
  if (declared.some((item, index) => item.path !== draft.attachments[index])) {
    throw new Error("The approved action attachment order does not match the reviewed draft.");
  }

  const packRoot = await fs.realpath(path.join(PROJECT_ROOT, "pack"));
  const files = [];
  for (const item of declared) {
    const filename = await fs.realpath(path.join(PROJECT_ROOT, item.path));
    const relative = path.relative(packRoot, filename);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Attachment is outside the approved pack: ${item.path}`);
    }
    const actual = await sha256(filename);
    if (actual !== item.sha256) throw new Error(`Attachment hash mismatch: ${item.path}`);
    files.push({ filename, name: path.basename(filename), sha256: actual });
  }
  if (new Set(files.map((item) => item.name)).size !== files.length) throw new Error("Attachment filenames are not unique.");
  return { action, draft, files, hash: manifestHash(action) };
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
  await page.waitForFunction((expected) => [...document.querySelectorAll("span.folderHeaderLabel")]
    .some((header) => header.offsetParent !== null && header.textContent.trim() === expected), label, { timeout: 10_000 });
}

async function openTarget(page, action) {
  assertMailDestination(page.url());
  if ((await page.title()) !== action.expected_account_title) throw new Error(`Wrong account or mailbox title: ${await page.title()}`);
  await openMailFolder(page, "Inbox");
  await page.waitForTimeout(1_200);
  // The conversation row reflects the latest participant and timestamp, which
  // can change as brothers reply. Require the unique exact subject here, then
  // bind the write to Daniel's original sender/time/body inside the thread.
  const rows = page.locator('[role="option"]')
    .filter({ hasText: action.expected_subject })
    .filter({ hasText: action.expected_thread_participants })
    .filter({ hasText: action.expected_thread_latest_text });
  const row = await exactlyOneVisible(rows, "exact Daniel Martin application row");
  const rowText = canonicalText(await row.innerText());
  await row.evaluate((element) => element.click());
  await page.waitForTimeout(1_200);

  let messages = page.locator('[aria-label="Expanded Message Contents"]')
    .filter({ hasText: action.expected_sender })
    .filter({ hasText: action.expected_received_time })
    .filter({ hasText: action.expected_body_text });
  let visibleCount = 0;
  for (let index = 0; index < await messages.count(); index += 1) if (await messages.nth(index).isVisible()) visibleCount += 1;
  if (!visibleCount) {
    const collapsed = page.locator('[aria-label="Collapsed Message Contents"]')
      .filter({ hasText: action.expected_sender })
      .filter({ hasText: action.expected_received_time })
      .filter({ hasText: action.expected_body_text });
    const card = await exactlyOneVisible(collapsed, "collapsed Daniel Martin application message");
    await card.click();
    await page.waitForTimeout(700);
    messages = page.locator('[aria-label="Expanded Message Contents"]')
      .filter({ hasText: action.expected_sender })
      .filter({ hasText: action.expected_received_time })
      .filter({ hasText: action.expected_body_text });
  }
  const message = await exactlyOneVisible(messages, "Daniel Martin application message");
  await exactlyOneVisible(message.getByText(action.expected_body_text, { exact: true }), "expected application message body line");
  let replyPath = "direct";
  let directReply = null;
  const directReplies = message.getByRole("button", { name: "Reply", exact: true });
  for (let index = 0; index < await directReplies.count(); index += 1) {
    if (await directReplies.nth(index).isVisible()) { directReply = directReplies.nth(index); break; }
  }
  if (!directReply) {
    replyPath = "more-actions";
    const moreActions = await exactlyOneVisible(message.getByRole("button", { name: "More Actions", exact: true }), "More Actions button");
    await moreActions.click();
    await exactlyOneVisible(
      page.locator('button[role="menuitem"]').filter({ hasText: /^\s*Reply\s*$/u }),
      "sender-only Reply menu button",
    );
    await page.keyboard.press("Escape");
  }

  const liveEditors = page.getByRole("textbox", { name: "Message body", exact: true });
  for (let index = 0; index < await liveEditors.count(); index += 1) {
    if (await liveEditors.nth(index).isVisible()) throw new Error("An existing live draft editor is already present in this thread; refusing to create another.");
  }
  const draftMarkers = page.getByText("[Draft] This message hasn't been sent.", { exact: true });
  for (let index = 0; index < await draftMarkers.count(); index += 1) {
    if (await draftMarkers.nth(index).isVisible()) throw new Error("An existing live draft is already present in this thread; refusing to create another.");
  }
  return { message, directReply, replyPath, rowText };
}

async function clickReplyToSender(page, target) {
  if (target.replyPath === "direct") {
    await target.directReply.click();
    return;
  }
  const moreActions = await exactlyOneVisible(target.message.getByRole("button", { name: "More Actions", exact: true }), "More Actions button");
  await moreActions.click();
  const reply = await exactlyOneVisible(
    page.locator('button[role="menuitem"]').filter({ hasText: /^\s*Reply\s*$/u }),
    "sender-only Reply menu button",
  );
  await reply.click();
}

async function waitForAttachments(compose, files) {
  const names = files.map((item) => item.name);
  await compose.page().waitForFunction((expected) => {
    const visibleComposer = [...document.querySelectorAll('[role="textbox"][aria-label="Message body"]')]
      .find((editor) => editor.offsetParent !== null)?.closest('[aria-label="Message Contents"]')
      ?? [...document.querySelectorAll('[role="textbox"][aria-label="Message body"]')]
        .find((editor) => editor.offsetParent !== null)?.parentElement?.parentElement;
    const root = visibleComposer || document;
    const cards = [...root.querySelectorAll('[autoid="_ay_2"]')];
    return expected.every((name) => cards.some((card) => {
      const label = card.querySelector(`[title="${CSS.escape(name)}"]`);
      const link = card.querySelector('a[href*="GetFileAttachment"]');
      const busy = card.querySelector('[role="marquee"][aria-busy="true"]');
      const error = card.querySelector('.owa-color-neutral-red:not([style*="display: none"])');
      return label && link && !busy && !error;
    }));
  }, names, { timeout: 180_000 });
  await compose.page().waitForTimeout(5_000);
  await compose.page().waitForFunction((count) => {
    const active = document.querySelectorAll('[role="progressbar"]:not([style*="display: none"]), [role="marquee"][aria-busy="true"]');
    const send = [...document.querySelectorAll('button[aria-label="Send"]')]
      .find((button) => button.offsetParent !== null && !button.disabled);
    const links = [...document.querySelectorAll('[autoid="_ay_2"] a[href*="GetFileAttachment"]')];
    return active.length === 0 && Boolean(send) && links.length >= count;
  }, names.length, { timeout: 60_000 });
}

async function attachFilesSequentially(compose, files) {
  const input = compose.locator('input[type="file"][multiple]:not([accept])');
  if (await input.count() !== 1) throw new Error(`Expected one attachment file input; found ${await input.count()}.`);
  for (const file of files) {
    await input.setInputFiles(file.filename);
    await compose.page().waitForFunction((name) => [...document.querySelectorAll('[autoid="_ay_2"]')].some((card) => {
      const label = card.querySelector(`[title="${CSS.escape(name)}"]`);
      const link = card.querySelector('a[href*="GetFileAttachment"]');
      const busy = card.querySelector('[role="marquee"][aria-busy="true"]');
      const error = card.querySelector('.owa-color-neutral-red:not([style*="display: none"])');
      return label && link && !busy && !error;
    }), file.name, { timeout: 180_000 });
    await compose.page().waitForTimeout(1_500);
  }
  await waitForAttachments(compose, files);
}

async function dismissReply(page) {
  const buttons = page.getByRole("button", { name: "Discard", exact: true });
  for (let index = 0; index < await buttons.count(); index += 1) {
    if (await buttons.nth(index).isVisible()) {
      await buttons.nth(index).click();
      await page.waitForTimeout(500);
      const dialogs = page.locator('[role="alertdialog"][ismodal="true"]');
      for (let dialogIndex = 0; dialogIndex < await dialogs.count(); dialogIndex += 1) {
        if (!await dialogs.nth(dialogIndex).isVisible()) continue;
        if (!(await dialogs.nth(dialogIndex).innerText()).includes("This message will be deleted.")) continue;
        const confirmations = dialogs.nth(dialogIndex).locator("button").filter({ hasText: /^Discard/u });
        for (let confirmIndex = 0; confirmIndex < await confirmations.count(); confirmIndex += 1) {
          if (await confirmations.nth(confirmIndex).isVisible()) {
            await confirmations.nth(confirmIndex).click().catch(() => {});
            await page.waitForTimeout(500);
            return;
          }
        }
      }
      return;
    }
  }
}

async function verifySent(context, action, draft, files) {
  const page = await context.newPage();
  await page.goto("https://mail.jwpub.org/owa/#path=/mail", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4_000);
  assertMailDestination(page.url());
  if ((await page.title()) !== action.expected_account_title) throw new Error("Independent verification opened the wrong mailbox.");
  await openMailFolder(page, "Sent Items");
  await page.waitForTimeout(2_000);
  const subjectPattern = new RegExp(action.expected_subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const rows = page.locator('[role="option"]')
    .filter({ hasText: subjectPattern })
    .filter({ hasText: action.expected_sender });
  const row = await exactlyOneVisible(rows, "sent application reply row");
  const sentRowText = canonicalText(await row.innerText());
  await row.evaluate((element) => element.click());
  await page.waitForTimeout(1_200);
  const bodyText = canonicalText(await page.locator("body").innerText());
  if (!bodyText.includes(canonicalText(draft.body))) throw new Error("Sent Items does not contain the complete approved reply text.");
  for (const file of files) {
    if (!bodyText.includes(file.name)) throw new Error(`Sent Items is missing attachment ${file.name}.`);
  }
  const artifact = await capture(page, runId(), "par5-package-sent-verified");
  await page.close();
  return { row: sentRowText, body_verified: true, attachments_verified: files.map((item) => item.name), artifact };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run") || !confirm;
  if (confirm && process.argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --confirm, not both.");
  const mode = confirm ? "confirm" : "dry-run";
  const { action, draft, files, hash } = await loadAction();
  const auditId = runId();
  let page;
  let beforeArtifact = null;
  let createdReply = false;
  let sendClicked = false;
  try {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 10_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("No authenticated JWPub browser context is available.");
    page = context.pages().find((candidate) => candidate.url() === "https://mail.jwpub.org/owa/#path=/mail")
      ?? context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
    if (!page) throw new Error("No authenticated JWPub Mail page is open.");
    await page.bringToFront();
    const target = await openTarget(page, action);
    beforeArtifact = await capture(page, auditId, "par5-package-before");
    const checks = [
      "exact authorised action", "approved unsent draft", "seven attachment paths and hashes", "exact mailbox account",
      "exact Inbox sender", "exact subject", "expected received time", "expected message body", "Reply-to-sender path",
      "no existing live draft",
    ];
    if (dryRun) {
      const audit = await writeAudit({ id: auditId, mode, operation: action.operation, pageKey: action.page_id,
        expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page.url(), title: await page.title(),
        checks, artifact: beforeArtifact, status: "ready", details: { action_id: action.id, manifest_sha256: hash,
          row: target.rowText, final_click: false, attachments: files.map((item) => item.name) } });
      console.log(JSON.stringify({ mode, status: "ready", action: action.id, recipient: action.expected_sender,
        subject: action.expected_subject, attachments: files.map((item) => item.name), manifest_sha256: hash, audit }, null, 2));
      return;
    }

    await clickReplyToSender(page, target);
    createdReply = true;
    const editor = await exactlyOneVisible(page.getByRole("textbox", { name: "Message body", exact: true }), "reply message body");
    await editor.fill(draft.body);
    const compose = editor.locator('xpath=ancestor::*[.//button[@aria-label="Send"]][1]');
    await assertDanielOnly(compose);
    await attachFilesSequentially(compose, files);

    // Fresh-state gate immediately before the single final Send click.
    assertMailDestination(page.url());
    if ((await page.title()) !== action.expected_account_title) throw new Error("Mailbox account changed before Send.");
    await exactlyOneVisible(page.getByText(action.expected_body_text, { exact: true }), "original Daniel message immediately before Send");
    if (!canonicalText(await editor.innerText()).startsWith(canonicalText(draft.body))) {
      throw new Error("The live reply body does not begin with the complete approved draft.");
    }
    await assertDanielOnly(compose);
    const freshComposeText = canonicalText(await compose.innerText());
    for (const file of files) {
      if (!freshComposeText.includes(file.name)) throw new Error(`Attachment missing before Send: ${file.name}`);
    }
    const uploadWarning = page.getByText("This action can't be performed while attachments or inline images are being added or removed.", { exact: true });
    if (await uploadWarning.count()) throw new Error("OWA still reported active attachment uploads.");
    // OWA can re-parent its Send control when attachment cards finish
    // rendering. Bind the click to the single visible mailbox Send button,
    // while the gates above still bind the one visible editor and its content.
    const send = await exactlyOneVisible(page.locator('button[aria-label="Send"]'), "primary Send button");
    if (await send.isDisabled()) throw new Error("Send button is disabled after attachment upload.");
    await capture(page, auditId, "par5-package-ready-to-send");
    await send.click();
    sendClicked = true;
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="textbox"][aria-label="Message body"]')]
      .some((element) => element.offsetParent !== null), null, { timeout: 30_000 });

    const verification = await verifySent(context, action, draft, files);
    checks.push("recipient rechecked before Send", "approved body rechecked before Send", "seven uploads stable before Send",
      "original message re-read before Send", "independent Sent Items body and attachment verification");
    const audit = await writeAudit({ id: auditId, mode, operation: action.operation, pageKey: action.page_id,
      expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page.url(), title: await page.title(), checks,
      artifact: verification.artifact, status: "verified", details: { action_id: action.id, manifest_sha256: hash,
        recipient: action.expected_sender, subject: action.expected_subject, attachments: verification.attachments_verified,
        sent_items_body_verified: true } });
    console.log(JSON.stringify({ mode, status: "sent-and-verified", action: action.id, recipient: action.expected_sender,
      subject: action.expected_subject, attachments: verification.attachments_verified, audit }, null, 2));
  } catch (error) {
    if (page && createdReply && !sendClicked) await dismissReply(page).catch(() => {});
    await writeAudit({ id: auditId, mode, operation: "reply-email", pageKey: "jwpub-mail",
      expectedUrl: "https://mail.jwpub.org/owa/#path=/mail", finalUrl: page?.url() ?? null,
      title: page ? await page.title().catch(() => null) : null, checks: [], artifact: beforeArtifact,
      status: "failed", error });
    throw error;
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`S-50 par. 5 reply failed: ${error.message}`);
  process.exit(1);
});
