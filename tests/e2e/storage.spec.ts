import { expect, test } from "./fixtures";
import { open, watchErrors } from "./helpers";

// What happens to data saved in the browser: upgrades of older saves, unreadable data,
// data that outgrew a limit, a full browser storage, and backups.

const STATE = "aicos:state:v1";

/** A company as an older dashboard saved it: no workforce version, no edit markers, without EMP-014/015, with a custom brief. */
async function plantOldCompany(page: import("@playwright/test").Page) {
  await open(page, "/");
  await page.getByTestId("toggle-theme").click(); // any change saves the company to the browser
  const old = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    delete s.workforceVersion;
    delete s.edited;
    delete s.appliedReports;
    s.employees = s.employees
      .filter((e: { id: string }) => e.id !== "EMP-014" && e.id !== "EMP-015")
      .map((e: { id: string; systemInstructions: string }) => (e.id === "EMP-008" ? { ...e, systemInstructions: "My custom brief for Emily" } : e));
    s.activity.unshift({ id: "ACT-99999", at: new Date().toISOString(), actor: "ceo", type: "config", key: "instructions_changed", params: { employee: "EMP-008" }, refType: "employee", refId: "EMP-008" });
    return JSON.stringify(s);
  }, STATE);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STATE, old]);
}

test("an older saved company is upgraded once, keeping the CEO's edits", async ({ page }) => {
  const errors = watchErrors(page);
  await plantOldCompany(page);
  await page.reload();
  await open(page, "/employees/");
  await expect(page.getByTestId("employee-table").locator("tbody tr")).toHaveCount(15);
  await open(page, "/employees/profile/?id=EMP-008");
  await page.getByRole("tab", { name: "Instructions" }).click();
  await expect(page.getByTestId("instructions-text")).toHaveText("My custom brief for Emily");
  const upgrades = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activity.filter((a: { key: string }) => a.key === "workforce_updated").length, STATE);
  expect(await upgrades()).toBe(1);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  expect(await upgrades()).toBe(1);
  expect(errors).toEqual([]);
});

test("unreadable saved data: the app still opens, says so, and keeps the unreadable copy", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem("planted")) {
      localStorage.setItem(key, "{bad");
      sessionStorage.setItem("planted", "1");
    }
  }, STATE);
  await open(page, "/");
  await expect(page.getByTestId("toast-error")).toContainText("couldn't be read");
  expect(await page.evaluate(() => localStorage.getItem("aicos:state:corrupt"))).toBe("{bad");
  // The next sync downloads the cloud copy instead of uploading the starting data over it.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("aicos:cloud:meta") ?? "{}"))).toMatchObject({ owner: null, base: 0, dirty: false });
  expect(errors).toEqual([]);
});

test("text that outgrew a limit is shortened instead of the company being set aside", async ({ page }) => {
  await open(page, "/");
  await page.getByTestId("toggle-theme").click();
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.projects[0].name = "N".repeat(320);
    localStorage.setItem(key, JSON.stringify(s));
  }, STATE);
  await page.reload();
  await expect(page.getByTestId("toast-success")).toContainText("shortened");
  const name = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).projects[0].name, STATE);
  expect(name).toHaveLength(300);
  expect(await page.evaluate(() => localStorage.getItem("aicos:state:corrupt"))).toBeNull();
});

test("a change the loader would reject is refused, not saved", async ({ page }) => {
  await open(page, "/projects/");
  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name").evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
  await page.getByTestId("project-name").fill("P".repeat(400));
  await page.getByTestId("project-client").fill("Client");
  await page.getByTestId("save-project").click();
  await expect(page.getByTestId("toast-error")).toContainText("not saved");
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("aicos:state:corrupt"))).toBeNull();
});

test("full browser storage: the change is reported as not saved", async ({ page }) => {
  await open(page, "/tasks/");
  await page.evaluate((key) => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) throw new DOMException("full", "QuotaExceededError");
      return real.call(this, k, v);
    };
  }, STATE);
  await page.getByTestId("new-task").click();
  await page.getByTestId("task-title").fill("Will not fit");
  await page.getByTestId("task-assignee").selectOption("EMP-001");
  await page.getByTestId("save-task").click();
  await expect(page.getByTestId("toast-error")).toContainText("storage is full");
});

test("backups: an import keeps the previous data, and restoring brings it back", async ({ page }) => {
  await open(page, "/settings/");
  await expect(page.getByTestId("no-backups")).toBeVisible();
  await page.getByTestId("toggle-theme").click();
  // Rename the company, then import an export taken before the rename.
  const before = await page.evaluate((key) => localStorage.getItem(key)!, STATE);
  await page.getByTestId("founder-name").fill("Before Import");
  await page.getByTestId("save-company").click();
  await page.getByTestId("import-file").setInputFiles({ name: "old.json", mimeType: "application/json", buffer: Buffer.from(before) });
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("toast-success").last()).toContainText("imported");
  await page.reload();
  await expect(page.getByTestId("founder-name")).not.toHaveValue("Before Import");
  await expect(page.getByTestId("restore-backup")).toHaveCount(1);
  await page.getByTestId("restore-backup").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("toast-success").last()).toContainText("restored");
  await page.reload();
  await expect(page.getByTestId("founder-name")).toHaveValue("Before Import");
  await expect(page.getByTestId("restore-backup")).toHaveCount(2); // the import's backup + the one taken before restoring
});
