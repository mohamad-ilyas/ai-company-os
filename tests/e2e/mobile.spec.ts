import { expect, test } from "./fixtures";
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

test("mobile: what needs the CEO comes first, and the menu shows a count", async ({ page }) => {
  await open(page, "/");
  const card = page.getByTestId("needs-you");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.y, "the Needs-you card is near the top").toBeLessThan(400);
  await expect(card.getByRole("link", { name: /Decisions waiting for you/ })).toBeVisible();
  await expect(page.getByTestId("menu-badge")).toBeVisible();
});

test("mobile: touch targets are at least 44px and form fields don't trigger iOS zoom", async ({ page }) => {
  await open(page, "/approvals/");
  const approve = page.locator("[data-testid^=approve-]").first();
  await expect(approve).toBeVisible();
  expect((await approve.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByTestId("menu-button").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await open(page, "/communication/");
  const fontSize = await page.getByTestId("ask-coo-text").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test("mobile: channel picker above the thread; task filters fold away", async ({ page }) => {
  await open(page, "/communication/");
  await page.getByTestId("channel-picker").selectOption("department|design");
  await expect(page.getByRole("heading", { name: /Design/ }).first()).toBeVisible();
  await open(page, "/tasks/");
  await expect(page.getByRole("combobox", { name: "Status" })).toBeHidden();
  await page.getByTestId("toggle-filters").click();
  await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
});

test("mobile: Arabic layout fits the screen", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/");
  await page.getByTestId("toggle-language").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const path of ["/", "/approvals/", "/communication/", "/tasks/", "/execution/view/?id=EXE-0001", "/settings/"]) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
