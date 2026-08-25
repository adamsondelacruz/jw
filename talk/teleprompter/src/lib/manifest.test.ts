import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTalkManifest } from "./manifest";

describe("loadTalkManifest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the static talk manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          talks: [{ id: "055", title: "How Can You Make a Good Name With God?", files: [] }],
        }),
      })),
    );

    const manifest = await loadTalkManifest();
    expect(manifest.talks[0].id).toBe("055");
  });

  it("throws when the manifest cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));

    await expect(loadTalkManifest()).rejects.toThrow("Could not load talk manifest");
  });
});
