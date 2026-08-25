import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTalkDocument } from "./document";
import type { TalkFile } from "../types";

const htmlFile: TalkFile = {
  id: "html",
  name: "talk.html",
  kind: "html",
  role: "manuscript",
  path: "/talk.html",
};

const markdownFile: TalkFile = {
  id: "md",
  name: "talk.md",
  kind: "markdown",
  role: "manuscript",
  path: "/talk.md",
};

describe("loadTalkDocument", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves delivery highlight classes and removes unapproved classes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          '<html><body><p class="bad kw kw-green">Hello <span class="kw kw-orange">Babel</span></p></body></html>',
      })),
    );

    const result = await loadTalkDocument(htmlFile);
    expect(result.kind).toBe("html");
    if (result.kind === "html") {
      expect(result.html).toContain('class="kw kw-green"');
      expect(result.html).toContain('class="kw kw-orange"');
      expect(result.html).toContain('class="talk-word"');
      expect(result.html).toContain("data-word-index");
      expect(result.html).not.toContain("bad");
      expect(result.blockCount).toBe(1);
      expect(result.words.map((word) => word.normalized)).toEqual(["hello", "babel"]);
    }
  });

  it("renders markdown into block-marked html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "# Title\n\nParagraph with **weight**.",
      })),
    );

    const result = await loadTalkDocument(markdownFile);
    expect(result.kind).toBe("html");
    if (result.kind === "html") {
      expect(result.html).toContain("data-block-id");
      expect(result.plainText).toContain("Paragraph with weight");
      expect(result.words.length).toBeGreaterThan(3);
    }
  });

  it("returns pdf documents without fetching text", async () => {
    const result = await loadTalkDocument({
      id: "pdf",
      name: "talk.pdf",
      kind: "pdf",
      path: "/talk.pdf",
    });

    expect(result).toEqual({ kind: "pdf", url: "/talk.pdf" });
  });
});
