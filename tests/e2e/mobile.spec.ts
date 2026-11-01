import { expect, test } from "@playwright/test";
import { open, watchErrors } from "./helpers";

test("mobile: navigation drawer and pages fit the screen", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/");
  await page.getByRole("button", { name: "Menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Execution Center" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Execution Center");
  await expect(drawer).toHaveCount(0);

  for (const path of ["/", "/employees/", "/projects/view/?id=PRJ-001", "/approvals/", "/settings/"]) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
