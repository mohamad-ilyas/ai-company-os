import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { open, watchErrors } from "./helpers";

const ROUTES = [
  "/", "/org/", "/employees/", "/employees/profile/?id=EMP-001", "/departments/", "/projects/", "/projects/view/?id=PRJ-001",
  "/tasks/", "/tasks/view/?id=TSK-0006", "/workflow/", "/execution/", "/execution/view/?id=EXE-0001", "/approvals/",
  "/communication/", "/deliverables/", "/knowledge/", "/knowledge/view/?id=KB-002", "/activity/", "/analytics/", "/settings/",
];

test("markdown from stored text never produces script, data, or look-alike internal links", async ({ page }) => {
  await open(page, "/knowledge/");
  await page.getByTestId("new-article").click();
  await page.getByTestId("article-title").fill("Link safety");
  await page.getByTestId("article-body").fill(
    "[a](javascript:alert(1)) [b](data:text/html,x) [c](//evil.example) [d](/\\evil.example) [ok](/tasks/) [ext](https://example.com)",
  );
  await page.getByTestId("save-article").click();
  await expect(page.getByTestId("article-heading")).toHaveText("Link safety");
  const hrefs = await page.locator("main article a, main .space-y-3 a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.some((h) => /^(javascript|data):/i.test(h) || h.startsWith("//") || h.includes("\\") || h.includes("evil"))).toBe(false);
  expect(hrefs).toContain("https://example.com/");
  expect(hrefs.some((h) => h.endsWith("/tasks/"))).toBe(true);
});

test("importing the same team report twice applies it once", async ({ page }) => {
  const report = {
    schema: "aicos.report/v1", reportId: "e2e-dup-0001", sentAt: "2026-11-04T09:00:00Z", source: "claude_code", summary: "x",
    actions: [{ type: "work.record", employeeId: "EMP-002", title: "Dup work", instructions: "x", status: "completed", summary: "s", output: "o" }],
  };
  const importIt = async () => {
    await open(page, "/execution/");
    await page.getByTestId("import-report").click();
    await page.getByTestId("report-paste").fill(JSON.stringify(report));
    await page.getByTestId("apply-report").click();
  };
  await importIt();
  await expect(page.getByTestId("toast-success").last()).toContainText("1 of 1 actions applied");
  await importIt();
  await expect(page.getByTestId("toast-success").last()).toContainText("Already applied earlier");
  await open(page, "/execution/");
  await expect(page.getByText("Dup work")).toHaveCount(1);
});

test("viewers can't import team reports", async ({ page }) => {
  await open(page, "/settings/");
  await page.getByTestId("role-select").selectOption("viewer");
  await open(page, "/execution/");
  await expect(page.getByTestId("import-report")).toHaveCount(0);
});

test.describe("in Arabic", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/");
    await page.getByTestId("toggle-language").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("create and find a task with an Arabic title; errors are in Arabic", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/tasks/");
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title").fill("إعداد خطة الإطلاق للعميل");
    await page.getByTestId("task-assignee").selectOption("EMP-003");
    await page.getByTestId("save-task").click();
    await expect(page.getByTestId("task-heading")).toHaveText("إعداد خطة الإطلاق للعميل");
    await open(page, "/tasks/");
    await page.getByTestId("list-view").click();
    await page.getByTestId("task-search").fill("خطة الإطلاق");
    await expect(page.locator("table tbody tr")).toHaveCount(1);

    await open(page, "/tasks/view/?id=TSK-0007");
    await page.getByTestId("move-assigned").click();
    await page.getByTestId("move-in_progress").click();
    await expect(page.getByTestId("toast-error")).toContainText("أكمل هذه المهام أولًا");
    await expect(page.getByTestId("toast-error")).not.toContainText("errors.");
    expect(errors).toEqual([]);
  });

  test("Message Charlotte keeps Arabic text intact in the Claude link", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url: string) => {
        (window as unknown as { __opened: string[] }).__opened.push(url);
        return {} as Window;
      }) as typeof window.open;
    });
    await open(page, "/communication/");
    await page.getByTestId("ask-coo-text").fill("هل التطبيق جاهز للإطلاق؟");
    await page.getByTestId("ask-coo-send").click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(new URL(opened[0]).searchParams.get("prompt")).toBe("/ask-coo هل التطبيق جاهز للإطلاق؟");
    await expect(page.getByTestId("thread")).toContainText("هل التطبيق جاهز للإطلاق؟");
  });

  test("an AI report with Arabic content is shown as written", async ({ page }) => {
    await open(page, "/execution/");
    await page.getByTestId("import-report").click();
    await page.getByTestId("report-paste").fill(JSON.stringify({
      schema: "aicos.report/v1", reportId: "e2e-ar-0001", sentAt: "2026-11-04T09:00:00Z", source: "claude_code", summary: "x",
      actions: [{ type: "message.post", kind: "decision", authorId: "EMP-001", body: "تم تسليم المرحلة الأولى بنجاح." }],
    }));
    await page.getByTestId("apply-report").click();
    await expect(page.getByTestId("toast-success").last()).toContainText("طُبّق 1 من أصل 1");
    await open(page, "/communication/");
    await page.getByTestId("channel-decision-all").click();
    await expect(page.getByText("تم تسليم المرحلة الأولى بنجاح.")).toBeVisible();
  });
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const mode of ["English, light", "Arabic, dark"] as const) {
    for (const path of ROUTES) {
      test(`no serious or critical violations — ${mode} — ${path}`, async ({ page }) => {
        if (mode === "Arabic, dark") {
          await page.emulateMedia({ colorScheme: "dark" });
          await open(page, "/");
          await page.getByTestId("toggle-language").click();
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        } else {
          await page.emulateMedia({ colorScheme: "light" });
        }
        await open(page, path);
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const problems = result.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(problems).toEqual([]);
      });
    }
  }
});
