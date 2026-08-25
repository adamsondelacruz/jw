import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "tablet-landscape",
      use: {
        browserName: "chromium",
        viewport: { width: 1194, height: 834 },
      },
    },
    {
      name: "tablet-portrait",
      use: {
        browserName: "chromium",
        viewport: { width: 834, height: 1194 },
      },
    },
  ],
});
