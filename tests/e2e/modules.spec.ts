import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { confirmDialog, open, watchErrors } from "./helpers";

test("tasks: create, comment, board and list views", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/tasks/");
  await page.getByTestId("new-task").click();
  await page.getByTestId("task-title").fill("Write onboarding SOP");
  await page.getByTestId("task-assignee").selectOption("EMP-001");
  await page.getByTestId("save-task").click();
  await expect(page.getByTestId("task-heading")).toHaveText("Write onboarding SOP");
  await expect(page.getByText("Assigned").first()).toBeVisible();

  await page.getByTestId("task-comment").fill("Please include the approval policy.");
  await page.getByTestId("post-comment").click();
  await expect(page.getByText("Please include the approval policy.")).toBeVisible();

  await page.getByTestId("edit-task").click();
  await page.getByTestId("task-title").fill("Write onboarding SOP v2");
  await page.getByTestId("save-task").click();
  await expect(page.getByTestId("task-heading")).toHaveText("Write onboarding SOP v2");

  await open(page, "/tasks/");
  await expect(page.getByTestId("task-board")).toContainText("Write onboarding SOP v2");
  await page.getByTestId("list-view").click();
  await page.getByTestId("task-search").fill("onboarding");
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("employee: edit instructions and availability", async ({ page }) => {
  await open(page, "/employees/profile/?id=EMP-004");
  await page.getByRole("tab", { name: "Instructions" }).click();
  await page.getByTestId("edit-instructions").click();
  await page.getByRole("dialog").locator("textarea").fill("You are Imogen Clarke. Updated brief for testing.");
  await page.getByTestId("save-instructions").click();
  await expect(page.getByTestId("instructions-text")).toHaveText("You are Imogen Clarke. Updated brief for testing.");

  await page.getByTestId("availability").selectOption("unavailable");
  await open(page, "/execution/new/");
  await expect(page.getByTestId("exec-employee").locator("option[value=EMP-004]")).toBeDisabled();
});

test("knowledge base: create, search, edit", async ({ page }) => {
  await open(page, "/knowledge/");
  await page.getByTestId("new-article").click();
  await page.getByTestId("article-title").fill("SOP: Client kickoff");
  await page.getByTestId("article-body").fill("## Agenda\n\n- Goals\n- **Scope**");
  await page.getByTestId("save-article").click();
  await expect(page.getByTestId("article-heading")).toHaveText("SOP: Client kickoff");
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await open(page, "/knowledge/");
  await page.getByTestId("kb-search").fill("kickoff");
  await expect(page.getByTestId("kb-list").locator("a")).toHaveCount(1);
});

test("deliverables: record and reject secrets", async ({ page }) => {
  await open(page, "/deliverables/");
  await page.getByTestId("new-deliverable").click();
  await page.getByTestId("deliverable-title").fill("Brand guidelines v1");
  await page.getByTestId("deliverable-location").fill("https://example.com/file?token=abc");
  await page.getByTestId("save-deliverable").click();
  await expect(page.getByTestId("toast-error")).toContainText("secret");
  await page.getByTestId("deliverable-location").fill("docs/brand/guidelines.md");
  await page.getByTestId("save-deliverable").click();
  await expect(page.getByTestId("deliverable-table")).toContainText("Brand guidelines v1");
});

test("communication: post to a department channel", async ({ page }) => {
  await open(page, "/communication/");
  await page.getByTestId("channel-department-design").click();
  await page.getByTestId("compose").fill("Kickoff for the brand refresh is Monday.");
  await page.getByTestId("post-message").click();
  await expect(page.getByTestId("thread")).toContainText("Kickoff for the brand refresh is Monday.");
  await open(page, "/departments/view/?id=design");
  await page.getByRole("tab", { name: "Department discussion" }).click();
  await expect(page.getByTestId("thread")).toContainText("Kickoff for the brand refresh is Monday.");
});

test("settings: export, clear sample data, import restores it", async ({ page }) => {
  await open(page, "/settings/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-json").click()]);
  const path = (await download.path())!;
  const exported = JSON.parse(await readFile(path, "utf8"));
  expect(exported.schema).toBe("aicos.state/v1");
  expect(exported.employees).toHaveLength(13);

  await page.getByTestId("clear-sample").click();
  await confirmDialog(page);
  await open(page, "/projects/");
  await expect(page.getByTestId("project-list")).not.toContainText("Cedar");

  await open(page, "/settings/");
  await page.getByTestId("import-file").setInputFiles(path);
  await confirmDialog(page);
  await expect(page.getByTestId("confirm-ok")).toBeHidden();
  await open(page, "/projects/");
  await expect(page.getByTestId("project-list")).toContainText("Cedar");
});

test("settings: an invalid import is rejected without changing data", async ({ page }) => {
  await open(page, "/settings/");
  await page.getByTestId("import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ schema: "nope" })) });
  await expect(page.getByTestId("toast-error")).toContainText("not a valid export");
  await open(page, "/employees/");
  await expect(page.getByTestId("employee-table").locator("tbody tr")).toHaveCount(13);
});

test("data persists across reloads and tabs", async ({ page, context }) => {
  await open(page, "/settings/");
  await page.getByTestId("founder-name").fill("Mohammed A.");
  await page.getByTestId("save-company").click();
  await page.reload();
  await expect(page.getByTestId("founder-name")).toHaveValue("Mohammed A.");
  const other = await context.newPage();
  await other.goto("");
  await expect(other.getByRole("heading", { level: 1 })).toContainText("Welcome back, Mohammed");
});

test("analytics excludes sample data by default", async ({ page }) => {
  await open(page, "/analytics/");
  const real = await page.getByTestId("kpi-completed").textContent();
  await page.getByLabel("Include sample data").check();
  await expect(page.getByTestId("kpi-completed")).not.toHaveText(real!);
});
