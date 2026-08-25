export type TalkFileKind = "markdown" | "html" | "pdf" | "docx" | "unknown";

export type TalkFileRole =
  | "manuscript"
  | "extemp"
  | "metrics"
  | "resources"
  | "outline";

export type TalkFile = {
  id: string;
  name: string;
  kind: TalkFileKind;
  role?: TalkFileRole;
  version?: string;
  title?: string;
  path: string;
};

export type Talk = {
  id: string;
  number?: string;
  title: string;
  updatedAt?: string;
  estimatedMinutes?: string;
  preferredFileId?: string;
  files: TalkFile[];
};

export type TalkManifest = {
  talks: Talk[];
};

export type ReaderMode = "manual" | "timed" | "voice";

export type ReaderPreferences = {
  fontScale: number;
  lineHeight: number;
  theme: "light" | "warm" | "dark";
  targetMinutes: number;
  speedMultiplier: number;
  keepAwake: boolean;
};

export type ReaderProgress = {
  fileId: string;
  scrollTop: number;
  activeBlockId?: string;
  updatedAt: string;
};
