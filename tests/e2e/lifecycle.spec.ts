import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { confirmDialog, open, watchErrors } from "./helpers";

async function createProject(page: Page, name: string) {
  await open(page, "/projects/");
  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name").fill(name);
  await page.getByTestId("project-client").fill("Acme Ltd");
  await page.getByTestId("save-project").click();
  await expect(page.getByTestId("project-title")).toHaveText(name);
}

test("project → standard workflow → assignment → result → review → handoff", async ({ page }) => {
  const errors = watchErrors(page);
  await createProject(page, "Acme portal");
  const projectUrl = page.url();

  await page.getByRole("tab", { name: /Tasks/ }).click();
  await page.getByTestId("start-workflow").click();
  const rows = page.getByTestId("project-tasks").locator("tbody tr");
  await expect(rows).toHaveCount(13);
  await expect(rows.first()).toContainText("Assigned");
  await expect(rows.nth(1)).toContainText("Backlog");

  // Open the first lifecycle task (requirements) and run it with its AI employee.
  await rows.first().getByRole("link", { name: "Analyse client request and write requirements" }).click();
  await expect(page.getByTestId("task-heading")).toHaveText("Analyse client request and write requirements");
  const taskUrl = page.url();
  await page.getByTestId("run-with-ai").click();
  await expect(page.getByTestId("exec-employee")).toHaveValue("EMP-002");
  await page.getByTestId("exec-instructions").fill("Write the requirements for the Acme customer portal.");
  // Business work defaults to Claude chat; this run uses Claude Code to exercise the terminal flow.
  await expect(page.getByTestId("channel-claude_chat")).toBeChecked();
  await page.getByTestId("channel-claude_code").check();
  await page.getByTestId("create-assignment").click();
  await expect(page.getByTestId("execution-title")).toBeVisible();
  const executionId = new URL(page.url()).searchParams.get("id")!;
  expect(executionId).toMatch(/^EXE-\d{4}$/);
  await expect(page.getByText("Waiting for a Claude session").first()).toBeVisible();

  // The packet carries the employee's own instructions, the task, and the company rules.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-packet").click()]);
  expect(download.suggestedFilename()).toBe(`${executionId}.assignment.json`);
  const packet = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(packet.schema).toBe("aicos.assignment/v1");
  expect(packet.employee.slug).toBe("business-analyst");
  expect(packet.employee.systemInstructions).toContain("You are Oliver Bennett");
  expect(packet.task.acceptanceCriteria.length).toBeGreaterThan(0);
  expect(packet.companyRules).toContain("Budget is $0");
  await expect(page.getByTestId("run-command")).toContainText(`/run-assignment ~/Downloads/${executionId}.assignment.json`);

  await page.getByTestId("mark-started").click();
  await expect(page.getByText("Started in Claude").first()).toBeVisible();

  // An invalid result is rejected with reasons; nothing is recorded.
  await page.getByTestId("result-paste").fill(JSON.stringify({ schema: "aicos.result/v1", executionId, employeeId: "EMP-002", status: "done" }));
  await page.getByTestId("import-result").click();
  await expect(page.getByTestId("import-issues")).toContainText("status");
  await expect(page.getByTestId("no-output")).toBeVisible();

  // A valid result (here wrapped in a chat reply) is imported.
  const result = {
    schema: "aicos.result/v1",
    executionId,
    employeeId: "EMP-002",
    channel: "claude_chat",
    status: "completed",
    startedAt: "2026-11-02T09:00:00Z",
    endedAt: "2026-11-02T10:30:00Z",
    summary: "Requirements baseline with 5 stories.",
    output: "## Requirements\n\n- **FR-1** Customers can log in.\n- **FR-2** Customers can see invoices.",
    logs: [{ at: "2026-11-02T09:05:00Z", message: "Analysed the request" }],
    deliverables: [{ title: "Acme requirements", type: "requirements", location: "docs/acme/requirements.md" }],
    handoff: { to: "EMP-003", note: "Ready for planning" },
  };
  await page.getByTestId("result-paste").fill("Here is my work.\n```json\n" + JSON.stringify(result, null, 2) + "\n```");
  await page.getByTestId("import-result").click();
  await expect(page.getByRole("heading", { name: "Requirements", exact: true })).toBeVisible();
  await expect(page.getByText("Result recorded").first()).toBeVisible();
  await expect(page.getByTestId("work-log")).toContainText("Analysed the request");

  // Review: approve → the task completes and its dependent moves to Assigned.
  await page.getByTestId("approve-output").click();
  await expect(page.getByText("Approved").first()).toBeVisible();
  await page.goto(taskUrl);
  await expect(page.getByText("Completed").first()).toBeVisible();

  await page.goto(projectUrl);
  await page.getByRole("tab", { name: /Tasks/ }).click();
  await expect(page.getByTestId("project-tasks").locator("tbody tr").nth(1)).toContainText("Assigned");

  // Handoff to the Project Manager carries the approved output as upstream context.
  await page.goto(`execution/view/?id=${executionId}`);
  await page.getByTestId("create-handoff").click();
  await page.getByTestId("create-followup").click();
  await expect(page.getByTestId("execution-title")).toContainText("Handoff");
  const [handoffDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-packet").click()]);
  const handoffPacket = JSON.parse(await readFile((await handoffDownload.path())!, "utf8"));
  expect(handoffPacket.employee.id).toBe("EMP-003");
  expect(handoffPacket.upstream[0].executionId).toBe(executionId);

  // The deliverable was recorded and the audit log has the trail.
  await open(page, "/deliverables/");
  await expect(page.getByTestId("deliverable-table")).toContainText("Acme requirements");
  await open(page, "/activity/");
  await page.getByTestId("activity-search").fill(executionId);
  await expect(page.getByTestId("activity-list")).toContainText(`Output of ${executionId} approved`);
  expect(errors).toEqual([]);
});

test("changes requested sends the task back and a revision can be created", async ({ page }) => {
  await open(page, "/execution/new/?task=TSK-0008");
  await page.getByTestId("exec-instructions").fill("Review v1 independently.");
  await page.getByTestId("create-assignment").click();
  await page.waitForURL(/execution\/view\//);
  const executionId = new URL(page.url()).searchParams.get("id")!;
  await page.getByTestId("result-paste").fill(JSON.stringify({ schema: "aicos.result/v1", executionId, employeeId: "EMP-013", status: "completed", output: "Draft review" }));
  await page.getByTestId("import-result").click();
  await page.getByTestId("request-changes").click();
  await expect(page.getByTestId("confirm-ok")).toBeDisabled();
  await confirmDialog(page, "Add the security section.");
  await expect(page.getByText("Changes requested").first()).toBeVisible();
  await page.getByTestId("create-revision").click();
  await page.getByTestId("create-followup").click();
  await expect(page.getByTestId("execution-title")).toContainText("(revision)");

  await open(page, "/tasks/view/?id=TSK-0008");
  await expect(page.getByText("Changes requested").first()).toBeVisible();
});

test("CEO approval unlocks the protected task and its dependents", async ({ page }) => {
  await open(page, "/approvals/");
  await page.getByRole("tab", { name: /COO decides/ }).click();
  const card = page.getByTestId("approval-APR-001");
  await expect(card).toContainText("Public release");
  await page.getByTestId("approve-APR-001").click();
  await confirmDialog(page, "Approved — repository may be public.");
  await page.getByRole("tab", { name: /Decided/ }).click();
  await expect(page.getByTestId("approval-APR-001")).toContainText("Approved");

  await open(page, "/tasks/view/?id=TSK-0006");
  await expect(page.getByText("Completed").first()).toBeVisible();
  await open(page, "/tasks/view/?id=TSK-0007");
  await expect(page.getByText("Assigned").first()).toBeVisible();
  // TSK-0007 is itself protected: it cannot be completed without its own approval.
  await page.getByTestId("move-in_progress").click();
  await page.getByTestId("move-under_review").click();
  await page.getByTestId("move-completed").click();
  await expect(page.getByTestId("toast-error")).toContainText("needs an approved request in the Approval Center");
});

test("rejecting requires a note", async ({ page }) => {
  await open(page, "/approvals/");
  await page.getByRole("tab", { name: /COO decides/ }).click();
  await page.getByTestId("reject-APR-001").click();
  await expect(page.getByTestId("confirm-ok")).toBeDisabled();
  await confirmDialog(page, "Not yet — buy the domain first.");
  await open(page, "/tasks/view/?id=TSK-0006");
  await expect(page.getByText("Changes requested").first()).toBeVisible();
});

test("viewer and operator roles are restricted", async ({ page }) => {
  await open(page, "/settings/");
  await page.getByTestId("role-select").selectOption("operator");
  await open(page, "/approvals/");
  await page.getByRole("tab", { name: /COO decides/ }).click();
  await expect(page.getByText("Only the CEO role can decide approvals.").first()).toBeVisible();
  await expect(page.getByTestId("approve-APR-001")).toHaveCount(0);

  await open(page, "/settings/");
  await page.getByTestId("role-select").selectOption("viewer");
  await open(page, "/projects/");
  await expect(page.getByTestId("new-project")).toHaveCount(0);
  await open(page, "/tasks/view/?id=TSK-0009");
  await expect(page.getByTestId("run-with-ai")).toHaveCount(0);
  await expect(page.getByTestId("move-assigned")).toHaveCount(0);

  await open(page, "/settings/");
  await page.getByTestId("role-select").selectOption("ceo");
  await open(page, "/approvals/");
  await page.getByRole("tab", { name: /COO decides/ }).click();
  await expect(page.getByTestId("approve-APR-001")).toBeVisible();
});

test("dependencies block starting work", async ({ page }) => {
  await open(page, "/tasks/view/?id=TSK-0007");
  await page.getByTestId("move-assigned").click();
  await page.getByTestId("move-in_progress").click();
  await expect(page.getByTestId("toast-error")).toContainText("Complete these tasks first: TSK-0006");
});
