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
  expect(exported.employees).toHaveLength(15);

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
  await expect(page.getByTestId("employee-table").locator("tbody tr")).toHaveCount(15);
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

test("team report import: creates project, tasks, work and review attributed to employees", async ({ page }) => {
  const errors = watchErrors(page);
  const report = {
    schema: "aicos.report/v1",
    reportId: "e2e-report-0001",
    sentAt: "2026-11-03T09:40:00Z",
    source: "claude_code_web",
    summary: "Requirements done",
    actions: [
      { type: "project.upsert", key: "lumen-app", name: "Lumen fitness app", client: "Lumen Gym", repoUrl: "https://github.com/mohamad-ilyas/agency-projects/tree/project/lumen-app/projects/lumen-app" },
      { type: "task.upsert", key: "lumen-app/requirements", projectKey: "lumen-app", title: "Lumen requirements", assigneeId: "EMP-002" },
      { type: "task.upsert", key: "lumen-app/build", projectKey: "lumen-app", title: "Lumen build", assigneeId: "EMP-007", dependsOn: ["lumen-app/requirements"] },
      {
        type: "work.record", employeeId: "EMP-002", taskKey: "lumen-app/requirements", title: "Lumen requirements", instructions: "Write them",
        status: "completed", summary: "8 stories", output: "## Lumen requirements\n\n- FR-1 Book a class",
        review: { reviewerId: "EMP-003", decision: "approved", notes: "Good" },
      },
      { type: "message.post", kind: "project", projectKey: "lumen-app", authorId: "EMP-003", body: "Requirements approved — Thomas starts the build." },
      { type: "work.record", employeeId: "EMP-007", taskKey: "lumen-app/build", title: "Self-reviewed", instructions: "x", status: "completed", review: { reviewerId: "EMP-007", decision: "approved" } },
    ],
  };
  await open(page, "/execution/");
  await page.getByTestId("import-report").click();
  await page.getByTestId("report-paste").fill("Report:\n```json\n" + JSON.stringify(report) + "\n```");
  await page.getByTestId("apply-report").click();
  await expect(page.getByTestId("toast-success")).toContainText("6 of 6 actions applied");
  await expect(page.getByTestId("toast-success")).toContainText("self-review ignored");

  await open(page, "/projects/");
  await page.getByRole("link", { name: "Lumen fitness app" }).click();
  await expect(page.getByRole("link", { name: /agency-projects/ })).toBeVisible();
  await page.getByRole("tab", { name: /Tasks/ }).click();
  const rows = page.getByTestId("project-tasks").locator("tbody tr");
  await expect(rows.filter({ hasText: "Lumen requirements" })).toContainText("Completed");
  // The build was self-reviewed, so it stays under review for a real reviewer.
  await expect(rows.filter({ hasText: "Lumen build" })).toContainText("Under review");
  await page.getByRole("tab", { name: "Discussion" }).click();
  await expect(page.getByTestId("thread").first()).toContainText("Thomas starts the build");

  await open(page, "/activity/");
  await page.getByTestId("activity-search").fill("approved");
  await expect(page.getByTestId("activity-list")).toContainText("Sarah Mitchell");
  expect(errors).toEqual([]);
});

test("message Charlotte: records on the direct line and opens Claude with /ask-coo prefilled", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((url: string) => {
      (window as unknown as { __opened: string[] }).__opened.push(url);
      return {} as Window;
    }) as typeof window.open;
  });
  await open(page, "/communication/");
  await expect(page.getByTestId("channel-direct-all")).toHaveAttribute("aria-current", "true");
  await page.getByTestId("ask-coo-text").fill("Urgent: is todo-app live? Pause new work until Friday.");
  await page.getByTestId("ask-coo-send").click();
  await expect(page.getByTestId("thread")).toContainText("Urgent: is todo-app live?");
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(1);
  const url = new URL(opened[0]);
  expect(url.origin + url.pathname).toBe("https://claude.ai/code");
  expect(url.searchParams.get("prompt")).toBe("/ask-coo Urgent: is todo-app live? Pause new work until Friday.");
  expect(url.searchParams.get("repositories")).toBe("mohamad-ilyas/agency-projects");
  await open(page, "/");
  await expect(page.getByText("Urgent: is todo-app live?")).toBeVisible();
});
