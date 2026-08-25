import type { ReaderPreferences, ReaderProgress } from "../types";

const preferenceKey = "jw-teleprompter.preferences";
const progressPrefix = "jw-teleprompter.progress.";
const lastFileKey = "jw-teleprompter.last-file";

export const defaultPreferences: ReaderPreferences = {
  fontScale: 1,
  lineHeight: 1.55,
  theme: "warm",
  targetMinutes: 30,
  speedMultiplier: 1,
  keepAwake: true,
};

export function loadPreferences(): ReaderPreferences {
  const raw = localStorage.getItem(preferenceKey);
  if (!raw) return defaultPreferences;

  try {
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: ReaderPreferences) {
  localStorage.setItem(preferenceKey, JSON.stringify(preferences));
}

export function loadProgress(fileId: string): ReaderProgress | null {
  const raw = localStorage.getItem(`${progressPrefix}${fileId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ReaderProgress;
  } catch {
    return null;
  }
}

export function saveProgress(progress: ReaderProgress) {
  localStorage.setItem(`${progressPrefix}${progress.fileId}`, JSON.stringify(progress));
  localStorage.setItem(lastFileKey, progress.fileId);
}

export function loadLastFileId(): string | null {
  return localStorage.getItem(lastFileKey);
}
