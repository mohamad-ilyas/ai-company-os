import { test as base, expect } from "@playwright/test";

// E2E runs against the production build (cloud sync configured, as deployed). No test may
// reach the real Supabase project: every request to it is stubbed here, and a test can
// install its own handlers (page.route) to simulate the cloud.
export const SUPABASE_HOST = "qdezhdwmjrmpqjgzludj.supabase.co";

export const test = base.extend<{ supabaseCalls: string[] }>({
  supabaseCalls: [
    async ({ context }, use) => {
      const calls: string[] = [];
      await context.route(`https://${SUPABASE_HOST}/**`, (route) => {
        calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "stubbed in tests" }) });
      });
      await use(calls);
    },
    { auto: true },
  ],
});

export { expect };
