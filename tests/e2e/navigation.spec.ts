import { expect, test } from "./fixtures";
import { open, watchErrors } from "./helpers";

// Every route must load directly (hard refresh on GitHub Pages) with a clean console.
const ROUTES: [string, RegExp][] = [
  ["/", /Welcome back/],
  ["/org/", /Organizational chart/],
  ["/employees/", /Employee directory/],
  ["/employees/profile/?id=EMP-001", /Charlotte Ashworth/],
  ["/departments/", /Departments/],
  ["/departments/view/?id=engineering", /Engineering/],
  ["/projects/", /Projects & clients/],
  ["/projects/view/?id=PRJ-001", /AI Company OS — v1 platform/],
  ["/tasks/", /Tasks/],
  ["/tasks/view/?id=TSK-0006", /Publish the repository/],
  ["/workflow/", /Company workflow/],
  ["/execution/", /Execution Center/],
  ["/execution/new/", /New assignment/],
  ["/execution/view/?id=EXE-0001", /Requirements for pickup ordering/],
  ["/approvals/", /CEO Approval Center/],
  ["/communication/", /Internal communication/],
  ["/deliverables/", /Deliverables & files/],
  ["/knowledge/", /Knowledge base/],
  ["/knowledge/view/?id=KB-013", /ADR-001/],
  ["/activity/", /Activity & audit log/],
  ["/analytics/", /Performance & analytics/],
  ["/settings/", /Settings/],
];

for (const [path, heading] of ROUTES) {
  test(`loads ${path} directly`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test("all 15 employees are listed and the org chart links to profiles", async ({ page }) => {
  await open(page, "/employees/");
  await expect(page.getByTestId("employee-table").locator("tbody tr")).toHaveCount(15);
  await page.getByTestId("employee-search").fill("Flaky");
  await expect(page.getByTestId("employee-table").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("employee-table")).toContainText("George Pemberton");

  await open(page, "/org/");
  await expect(page.locator("[data-testid^=org-node-]")).toHaveCount(15);
  await page.getByTestId("org-node-EMP-013").click();
  await expect(page.getByTestId("employee-name")).toHaveText("Eleanor Whitfield");
  await expect(page).toHaveURL(/employees\/profile\/\?id=EMP-013/);
});

test("employee profile shows individual instructions and all tabs", async ({ page }) => {
  await open(page, "/employees/profile/?id=EMP-006");
  await page.getByRole("tab", { name: "Instructions" }).click();
  await expect(page.getByTestId("instructions-text")).toContainText("You are James Whitaker");
  for (const tab of ["Work", "Performance", "Activity", "Profile"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  }
});

test("unknown pages render the 404 page", async ({ page }) => {
  const res = await page.goto("does-not-exist/");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("internal links keep the base path", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("link", { name: "Approval Center" }).first().click();
  await expect(page).toHaveURL(/\/ai-company-os\/approvals\/$/);
});

test("org chart: CEO → Charlotte (COO) → departments; learning tab lists resources", async ({ page }) => {
  await open(page, "/org/");
  await expect(page.getByTestId("org-node-EMP-001")).toContainText("Single point of contact with the CEO");
  await expect(page.getByTestId("org-node-EMP-015")).toContainText("Alexander Whitmore");
  await expect(page.getByTestId("org-node-EMP-014")).toContainText("Edward Langley");
  await open(page, "/employees/profile/?id=EMP-015");
  await page.getByRole("tab", { name: "Learning" }).click();
  await expect(page.getByTestId("learning-resources").locator("li")).toHaveCount(29);
  await expect(page.getByRole("link", { name: /three\.js documentation/ })).toHaveAttribute("href", "https://threejs.org/docs/");
});

test("approvals: CEO sees only their own decisions by default", async ({ page }) => {
  await open(page, "/approvals/");
  await expect(page.getByRole("tab", { name: /Needs you/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("approval-APR-001")).toHaveCount(0);
  await page.getByRole("tab", { name: /COO decides/ }).click();
  await expect(page.getByTestId("approval-APR-001")).toContainText("COO decides");
});
