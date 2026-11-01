import { defineConfig, devices } from "@playwright/test";

// E2E runs against the real static export, served the way GitHub Pages serves it
// (under /ai-company-os/, directory index files, 404.html).
const PORT = 4173;
export const BASE = `http://localhost:${PORT}/ai-company-os`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `${BASE}/`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `node scripts/serve-out.mjs ${PORT}` : `npm run build && node scripts/serve-out.mjs ${PORT}`,
    url: `${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEXT_PUBLIC_BASE_PATH: "/ai-company-os" },
  },
});
