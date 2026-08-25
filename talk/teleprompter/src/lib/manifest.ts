import type { TalkManifest } from "../types";

export async function loadTalkManifest(): Promise<TalkManifest> {
  const response = await fetch("/talks/talk-manifest.json");
  if (!response.ok) {
    throw new Error(`Could not load talk manifest: ${response.status}`);
  }
  return response.json() as Promise<TalkManifest>;
}
