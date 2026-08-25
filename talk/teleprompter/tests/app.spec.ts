import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __mockRecognition?: {
      onresult: ((event: Event) => void) | null;
    };
  }
}

test("opens the talk library and loads the highlighted manuscript", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "JW Talk Teleprompter" })).toBeVisible();
  await expect(page.getByText("How Can You Make a Good Name With God?")).toBeVisible();

  await page.getByRole("button", { name: "Open" }).click();

  await expect(page.getByTestId("reader-stage")).toBeVisible();
  await expect(page.getByText("draft-talk-v3.html")).toBeVisible();
  await expect(page.getByTestId("talk-document")).toContainText("How Can You Make a Good Name With God?");
  await expect(page.locator(".kw").first()).toBeVisible();
});

test("reader controls stay usable while moving through the document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open" }).click();

  const documentView = page.getByTestId("document-view");
  await expect(documentView).toBeVisible();

  const before = await documentView.evaluate((element) => element.scrollTop);
  for (let index = 0; index < 8; index += 1) {
    await page.getByTitle("Next paragraph").click();
  }
  await expect
    .poll(() => documentView.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "timed" })).toHaveClass(/active/);
  await page.getByRole("button", { name: "Pause" }).click();
});

test("pdf version can be selected from the talk file list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open" }).click();

  await page.locator(".file-select").selectOption("055-draft-v3-pdf");
  await expect(page.locator("iframe.pdf-frame")).toBeVisible();
});

test("voice mode highlights ahead and fades words already spoken", async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onerror: ((event: Event) => void) | null = null;
      onresult: ((event: Event) => void) | null = null;
      onstart: ((event: Event) => void) | null = null;

      start() {
        window.__mockRecognition = this;
        this.onstart?.(new Event("start"));
      }

      stop() {}
    }

    window.SpeechRecognition = MockSpeechRecognition as typeof window.SpeechRecognition;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("button", { name: "voice" }).click();

  await expect(page.locator(".upcoming-word").first()).toBeVisible();
  await expect(page.locator(".next-word")).toHaveCount(1);

  await page.evaluate(() => {
    const event = new Event("result") as Event & {
      resultIndex: number;
      results: ArrayLike<ArrayLike<{ transcript: string }>>;
    };
    event.resultIndex = 0;
    event.results = [[{ transcript: "walked past a garden and noticed" }]];
    window.__mockRecognition?.onresult?.(event);
  });

  await expect(page.locator(".current-word")).toBeVisible();
  await expect(page.locator(".read-word").first()).toBeVisible();
  await expect(page.locator(".upcoming-word").first()).toBeVisible();
  await expect(page.locator(".next-word")).toHaveCount(1);

  const positions = await page.evaluate(() => ({
    read: Number(document.querySelector<HTMLElement>(".read-word")?.dataset.wordIndex),
    current: Number(document.querySelector<HTMLElement>(".current-word")?.dataset.wordIndex),
    next: Number(document.querySelector<HTMLElement>(".next-word")?.dataset.wordIndex),
  }));
  expect(positions.read).toBeLessThan(positions.current);
  expect(positions.current).toBeLessThan(positions.next);
});
