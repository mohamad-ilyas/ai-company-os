import { expect, type Page } from "@playwright/test";

/** Collects uncaught errors and console errors so every test can assert a clean console. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Paths are relative to the base URL (no leading slash) so the /ai-company-os base path is kept. */
export async function open(page: Page, path: string) {
  await page.goto(path.replace(/^\//, ""));
  await expect(page.locator("main")).toBeVisible();
}

export async function confirmDialog(page: Page, note?: string) {
  if (note !== undefined) await page.getByTestId("confirm-note").fill(note);
  await page.getByTestId("confirm-ok").click();
}
