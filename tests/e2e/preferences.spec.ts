import { expect, test } from "@playwright/test";
import { open, watchErrors } from "./helpers";

test("switches to Arabic RTL and back, and the choice survives a reload", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByTestId("toggle-language").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("navigation", { name: "Main" })).toContainText("مركز الموافقات");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("مرحبًا بعودتك");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await open(page, "/tasks/view/?id=TSK-0006");
  await expect(page.getByText("بانتظار موافقة الرئيس التنفيذي").first()).toBeVisible();

  await page.getByTestId("toggle-language").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(errors).toEqual([]);
});

test("theme cycles light → dark → system and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/");
  const html = page.locator("html");
  await page.getByTestId("toggle-theme").click(); // system → light
  await expect(html).not.toHaveClass(/dark/);
  await page.getByTestId("toggle-theme").click(); // light → dark
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByTestId("toggle-theme").click(); // dark → system (light OS)
  await expect(html).not.toHaveClass(/dark/);
});

test("every page renders in Arabic dark mode without errors", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/settings/");
  await page.getByTestId("language-select").selectOption("ar");
  await page.getByTestId("theme-select").selectOption("dark");
  for (const path of ["/", "/org/", "/employees/", "/projects/", "/tasks/", "/execution/", "/approvals/", "/communication/", "/deliverables/", "/knowledge/", "/activity/", "/analytics/", "/workflow/"]) {
    await open(page, path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveClass(/dark/);
  }
  expect(errors).toEqual([]);
});
