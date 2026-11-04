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
  // Several tests walk all 20 routes; under full parallel load they need more than the default 30 s.
  // Each assertion still fails after 5 s.
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `${BASE}/`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
    // The CEO uses Safari on iPhone: smoke-test every route and the phone journeys in WebKit too.
    { name: "iphone", use: { ...devices["iPhone 15"] }, testMatch: /(mobile|navigation)\.spec/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `node scripts/serve-out.mjs ${PORT}` : `npm run build && node scripts/serve-out.mjs ${PORT}`,
    url: `${BASE}/`,
    // Never test a server left over from an earlier build.
    reuseExistingServer: false,
    timeout: 180_000,
    // The production configuration (cloud sync on, from aicos.config.json) — the build CI tests is the build it deploys.
    // Supabase traffic is stubbed in tests/e2e/fixtures.ts.
    env: { NEXT_PUBLIC_BASE_PATH: "/ai-company-os" },
  },
});
