import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
export const PROFILE_DIR = path.join(ROOT, ".browser-profile");
export const ARTIFACTS_DIR = path.join(ROOT, "artifacts");
export const ASSIGNMENTS_FILE = path.join(ROOT, "assignments", "approved-assignments.json");
export const CONVENTION_ID = "5ff3cade-fc3a-4423-bb88-f6bc983a1d1c";
export const EVENT_LABEL = "AUCKLAND NS (TG) - 2026";
export const RESPONSIBILITIES_URL = `https://hub.jw.org/convention-information/en/conventions/${CONVENTION_ID}/responsibilities`;
export const ALLOWED_HOSTS = new Set(["hub.jw.org", "login.jw.org"]);
export const INITIAL_ALLOWED_ROLES = new Set([
  "Accounts Overseer",
  "Accounts Overseer Assistant",
  "Attendant Overseer",
  "Attendant Overseer Assistant(s)",
  "Audio/Video Overseer",
  "Audio/Video Overseer Assistant(s)",
  "Baptism Overseer",
  "Baptism Overseer Assistant(s)",
  "Cleaning Overseer",
  "Cleaning Overseer Assistant(s)",
  "First Aid Overseer",
  "First Aid Overseer Assistant(s)",
  "Information and Volunteer Service Overseer",
  "Information and Volunteer Service Overseer Assistant(s)",
  "Lost and Found and Checkroom Overseer",
  "Lost and Found and Checkroom Assistant(s)",
  "Parking Overseer",
  "Parking Overseer Assistant(s)",
  "Rooming Overseer",
  "Rooming Overseer Assistant",
  "Safety Coordinator",
  "Safety Coordinator Assistant(s)",
]);
