import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "..");
const registerPath = path.join(project, "coordinator", "communications.json");
const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const requestedIds = process.argv.slice(2);
if (!requestedIds.length) throw new Error("Supply one or more explicit communication IDs to send.");
const unknownIds = requestedIds.filter((id) => !register.communications.some((record) => record.id === id));
if (unknownIds.length) throw new Error(`Unknown communication ID(s): ${unknownIds.join(", ")}`);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");
const sent = [];

function bodyFor(record) {
  if (record.variant === "receipt-check") return `Dear Brother Daveson,

I am checking whether you received the convention documents for your assignment as Rooming Overseer Assistant from Brother Wilfredo Calaunan.

Could you please confirm whether you received them and whether you are able to open the files? If anything is missing or cannot be opened, please let me know which documents so we can arrange for them to be forwarded.

Thank you.

Your brother,
Adamson dela Cruz
Convention Committee Coordinator
Auckland NS (TG) — 2026`;
  if (record.variant === "committee-meeting") return `Dear Brothers,

We will have a Convention Committee meeting on Wednesday, 19 August 2026, at 10:00 PM.

The main matters for discussion and decision are:

1. Selecting a Program Overseer Assistant.
2. Selecting an Attendant Overseer to replace Ron Mariano following his appointment as Coordinator Assistant.
3. Reviewing the CO-53 process, including who participates in the observations and postconvention evaluation.

I have attached the meeting agenda and the CO-53 form. Please review both documents before the meeting and consider qualified brothers for the two open assignments.

Zoom meeting details
Join meeting: https://us02web.zoom.us/j/81627326064?pwd=OpPjXo5VzUECMUoA3JxviZ3NstKHwh.1
Meeting chat: https://us02web.zoom.us/launch/jc/81627326064
Meeting ID: 816 2732 6064
Passcode: 2026RC

Please confirm that you are available for the meeting.

Your brother,
Adamson dela Cruz
Convention Committee Coordinator
Auckland NS (TG) — 2026`;
  const greeting = record.to.length > 1 ? "Dear Brothers," : `Dear Brother ${record.to[0].name.split(" ")[0]},`;
  const introduction = record.variant === "committee-assistant"
    ? "Thank you for accepting the appointment to serve as Convention Committee Coordinator Assistant for the Auckland Tagalog Convention at the South Auckland Assembly Hall, 30 October–1 November 2026."
    : `Thank you for accepting the assignment to serve with the ${record.department} for the Auckland Tagalog Convention at the South Auckland Assembly Hall, 30 October–1 November 2026.`;
  const special = record.variant === "committee"
    ? "\nPlease review these committee and event-oversight documents together. The confidential department diagram is a controlled document and must not be forwarded.\n"
    : record.variant === "committee-assistant"
      ? "\nThis package follows your appointment as Convention Committee Coordinator Assistant. Please review the committee and event-oversight material. The confidential department diagram is a controlled document and must not be forwarded.\n"
    : record.variant === "confidential"
      ? "\nThe emergency plan, evacuation material, site plan, and confidential department diagram are controlled operational documents. Please review them with your assistant, keep them secure, and do not forward the confidential diagram.\n"
      : record.id === "information-lost-found"
        ? "\nThe attached M-285 documents apply specifically to the Lost & Found portion of your assignment. Dedicated venue instructions for Information and Volunteer Service were not included in the supplied folder. I will forward further instructions when available.\n"
        : record.id === "rooming"
          ? "\nThe venue folder did not contain dedicated Rooming Department instructions. The facility documents are for venue orientation only and do not replace the current Convention Rooming Guidelines (CO-80). Additional rooming direction will follow when obtained.\n"
          : "";
  return `${greeting}

${introduction}

Attached are CO-1 and the venue instructions, checklist, and supporting documents relevant to your assignment. Please review the material with your assistant(s) and use the checklist to organise the department.
${special}
Please:

1. Confirm that you and your assistants can open all attached files.
2. Review the department manual and checklist together.
3. Identify any staffing, equipment, safety, or scheduling matters requiring committee assistance.
4. Keep these documents within the brothers authorised to use them. CO-1 should not be distributed beyond those authorised in paragraph 1:3; keymen should read only the portions relevant to their assignments.

Please send me an initial status update by ${register.response_due}, including whether the department is adequately staffed, whether assigned brothers have been contacted, any equipment or facility requirements, any safety matters requiring attention, and any assistance needed from the Convention Committee.

Thank you for your willing cooperation and for the work you are doing in support of the convention.

Your brother,
Adamson dela Cruz
Convention Committee Coordinator
Auckland NS (TG) — 2026`;
}

async function visible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i++) if (await locator.nth(i).isVisible()) return locator.nth(i);
  return null;
}

async function waitForAttachments(page, files) {
  const expected = files.map((filename) => path.basename(filename));
  await page.waitForFunction((names) => {
    const cards = [...document.querySelectorAll('[autoid="_ay_2"]')];
    return names.every((name) => cards.some((card) => {
      const label = card.querySelector(`[title="${CSS.escape(name)}"]`);
      const link = card.querySelector('a[href*="GetFileAttachment"]');
      const progress = card.querySelector('[role="progressbar"]');
      const busy = card.querySelector('[role="marquee"][aria-busy="true"]');
      const error = card.querySelector('.owa-color-neutral-red:not([style*="display: none"])');
      return label && link && !busy && !error && (!progress || getComputedStyle(progress).display === "none");
    }));
  }, expected, { timeout: 120_000 });

  // OWA can expose attachment links shortly before its compose lock clears.
  // Require a stable, quiet interval and verify that all compose controls are enabled.
  await page.waitForTimeout(5_000);
  await page.waitForFunction((count) => {
    const cards = [...document.querySelectorAll('[autoid="_ay_2"]')]
      .filter((card) => card.querySelector('a[href*="GetFileAttachment"]'));
    const activeUploads = document.querySelectorAll('[role="progressbar"]:not([style*="display: none"]), [role="marquee"][aria-busy="true"]');
    const send = [...document.querySelectorAll('button[aria-label="Send"]')]
      .find((button) => button.offsetParent !== null && !button.disabled);
    return cards.length >= count && activeUploads.length === 0 && Boolean(send);
  }, expected.length, { timeout: 30_000 });
}

async function dismissOpenDraft(page) {
  const subject = page.getByPlaceholder("Add a subject");
  if (!(await subject.count())) return;
  const discard = await visible(page.getByRole("button", { name: "Discard", exact: true }));
  if (discard) {
    await discard.click();
    await page.waitForTimeout(500);
    const confirm = await visible(page.getByRole("button", { name: /discard/i }));
    if (confirm) await confirm.click().catch(() => {});
  }
}

async function addRecipients(input, addresses) {
  for (const address of addresses) {
    await input.fill(address);
    const page = input.page();
    const useAddress = page.getByText(`Use this address: ${address}`, { exact: true });
    await useAddress.waitFor({ state: "visible", timeout: 10_000 });
    await useAddress.click();
    await page.waitForTimeout(350);
    if ((await input.inputValue()).trim()) throw new Error(`Recipient did not resolve: ${address}`);
  }
}

try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
  if (!page) throw new Error("No live authenticated JWPub Mail page found.");
  await page.bringToFront();
  await dismissOpenDraft(page);

  for (const record of register.communications) {
    if (!requestedIds.includes(record.id)) continue;
    if (record.status === "Sent") continue;
    const files = record.attachments.map((filename) => path.join(project, filename));
    for (const filename of files) if (!fs.existsSync(filename)) throw new Error(`${record.id}: missing attachment ${filename}`);

    await page.getByRole("button", { name: "New", exact: true }).click();
    const to = page.getByRole("textbox", { name: "To", exact: true });
    await to.waitFor({ state: "visible", timeout: 15_000 });
    await addRecipients(to, record.to.map((person) => person.email));

    if (record.cc.length) {
      const showCc = await visible(page.getByRole("button", { name: "Show Cc", exact: true }));
      if (showCc) await showCc.click();
      const cc = page.getByRole("textbox", { name: "Cc", exact: true });
      await cc.waitFor({ state: "visible", timeout: 10_000 });
      await addRecipients(cc, record.cc.map((person) => person.email));
    }

    const subjectText = record.subject || `2026 Auckland Tagalog Convention — ${record.department} Instructions and Checklist`;
    await page.getByPlaceholder("Add a subject").fill(subjectText);
    await page.getByRole("textbox", { name: "Message body", exact: true }).fill(bodyFor(record));
    await page.locator('input[type="file"][multiple]:not([accept])').setInputFiles(files);
    await waitForAttachments(page, files);

    const sendButton = await visible(page.getByRole("button", { name: "Send", exact: true }));
    if (!sendButton) throw new Error(`${record.id}: no visible Send button`);
    await sendButton.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('input[placeholder="Add a subject"]')]
      .some((input) => input.offsetParent !== null && !input.disabled), null, { timeout: 30_000 });
    const uploadWarning = page.getByText("This action can't be performed while attachments or inline images are being added or removed.", { exact: true });
    if (await uploadWarning.count()) throw new Error(`${record.id}: OWA still reported active attachment uploads`);

    const now = new Date().toISOString();
    record.status = "Sent";
    record.sent_at = now;
    fs.writeFileSync(registerPath, JSON.stringify(register, null, 2) + "\n");
    sent.push({ id: record.id, subject: subjectText, to: record.to.map((p) => p.email), cc: record.cc.map((p) => p.email), attachments: files.length, sent_at: now });
    console.log(`SENT ${record.id} to ${record.to.map((p) => p.email).join(", ")} (${files.length} attachments)`);
    await page.waitForTimeout(800);
  }
  console.log(JSON.stringify({ sent }, null, 2));
} finally {
  // This process connects to a user-owned persistent Chrome session over CDP.
  // Let Node release the transport on exit; browser.close() would terminate the
  // entire dedicated profile and any authenticated tabs still open in it.
}
