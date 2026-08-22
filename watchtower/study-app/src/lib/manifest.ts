import type { StudyManifest } from "../types";

export async function loadStudyManifest(): Promise<StudyManifest> {
  const response = await fetch("/studies/watchtower-manifest.json");
  if (!response.ok) {
    throw new Error(`Could not load Watchtower library: ${response.status}`);
  }
  return response.json() as Promise<StudyManifest>;
}
