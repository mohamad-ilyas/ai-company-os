import type { Page, Route } from "@playwright/test";
import { expect, test, SUPABASE_HOST } from "./fixtures";
import { open, watchErrors } from "./helpers";

// The production build has cloud sync on. These tests run it against a stubbed Supabase API:
// a signed-out visitor, and a signed-in device that uploads, receives an AI team report,
// applies it, and records the outcome together with the save that contains its changes.

const UID = "11111111-1111-4111-8111-111111111111";
const ROUTES = ["/", "/org/", "/employees/", "/projects/", "/tasks/", "/execution/", "/approvals/", "/communication/", "/knowledge/", "/activity/", "/analytics/", "/settings/"];

test("signed-out visitor: every page works and no company data is sent anywhere", async ({ page, supabaseCalls }) => {
  const errors = watchErrors(page);
  for (const path of ROUTES) await open(page, path);
  await expect(page.getByTestId("github-signin")).toBeVisible();
  expect(supabaseCalls.filter((c) => c.includes("/rest/v1/"))).toEqual([]);
  expect(errors).toEqual([]);
});

function fakeJwt() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", exp, email: "ceo@example.com" })}.c2ln`;
}

interface Cloud {
  row: { state: unknown; revision: number } | null;
  saves: { base: number; outcomes: { id: number; outcome: string }[] }[];
  reports: { id: number; payload: unknown; claimed: boolean }[];
  patches: string[];
}

async function stubSignedInCloud(page: Page, cloud: Cloud) {
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "ceo@example.com", identities: [{ provider: "github" }], app_metadata: {}, user_metadata: {} };
  await page.addInitScript(
    ([session]) => {
      if (!localStorage.getItem("aicos:auth")) localStorage.setItem("aicos:auth", session);
    },
    [JSON.stringify({ access_token: fakeJwt(), refresh_token: "refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })],
  );
  const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
    route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
  await page.route(`https://${SUPABASE_HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === "/auth/v1/user") return json(route, user);
    if (path === "/rest/v1/company_state") {
      const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      const row = cloud.row ? { state: cloud.row.state, revision: cloud.row.revision } : null;
      if (single) return row ? json(route, row) : json(route, { code: "PGRST116", message: "0 rows" }, 406);
      return json(route, row ? [row] : []);
    }
    if (path === "/rest/v1/rpc/save_company_state") {
      const body = req.postDataJSON();
      const current = cloud.row?.revision ?? 0;
      if (Number(body.p_base_revision) !== current) return json(route, { code: "40001", message: "revision conflict" }, 409);
      cloud.row = { state: body.p_state, revision: current + 1 };
      cloud.saves.push({ base: body.p_base_revision, outcomes: body.p_outcomes ?? [] });
      return json(route, cloud.row.revision);
    }
    if (path === "/rest/v1/rpc/claim_agent_reports") {
      const rows = cloud.reports.filter((r) => !r.claimed);
      rows.forEach((r) => (r.claimed = true));
      return json(route, rows.map((r) => ({ id: r.id, received_at: new Date().toISOString(), claimed_at: new Date().toISOString(), outcome: null, outcome_detail: null, payload: r.payload })));
    }
    if (path === "/rest/v1/agent_reports") {
      if (req.method() === "PATCH") {
        cloud.patches.push(url.search);
        return route.fulfill({ status: 204 });
      }
      return json(route, [], 200, { "content-range": "*/0" });
    }
    if (path === "/rest/v1/agent_keys") return json(route, (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? null : []);
    return json(route, { message: `unstubbed ${req.method()} ${path}` }, 404);
  });
}

test("signed-in device: uploads the company, applies a team report, and saves its outcome with the change", async ({ page }) => {
  const errors = watchErrors(page);
  const cloud: Cloud = {
    row: null,
    saves: [],
    patches: [],
    reports: [
      {
        id: 501,
        claimed: false,
        payload: {
          schema: "aicos.report/v1",
          reportId: "cloud-e2e-0001",
          sentAt: "2026-11-04T09:00:00Z",
          source: "claude_code_web",
          summary: "Kick-off",
          actions: [{ type: "project.upsert", key: "cloud-app", name: "Cloud test app", client: "Cloud client" }],
        },
      },
    ],
  };
  await stubSignedInCloud(page, cloud);
  await open(page, "/settings/");
  await expect(page.getByTestId("cloud-account")).toContainText("ceo@example.com");
  // First upload (base 0), then the report is applied and its outcome rides along with the next save.
  await expect.poll(() => cloud.saves.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  expect(cloud.saves[0]).toEqual({ base: 0, outcomes: [] });
  expect(cloud.saves.flatMap((s) => s.outcomes)).toEqual([expect.objectContaining({ id: 501, outcome: "applied" })]);
  expect(cloud.patches, "outcome must not be written separately before the save").toEqual([]);
  const saved = cloud.row!.state as { projects: { name: string }[]; appliedReports: Record<string, number[]> };
  expect(saved.projects.map((p) => p.name)).toContain("Cloud test app");
  expect(saved.appliedReports["cloud-e2e-0001"]).toEqual([0]);
  await open(page, "/projects/");
  await expect(page.getByTestId("project-list")).toContainText("Cloud test app");
  expect(errors).toEqual([]);
});

test("signed-in device with older local data: the newer cloud copy wins and the local copy is kept as a backup", async ({ page }) => {
  const cloud: Cloud = { row: null, saves: [], patches: [], reports: [] };
  // Capture the seed as "the cloud copy", with a different founder name.
  await open(page, "/");
  await page.getByTestId("toggle-theme").click();
  const seed = await page.evaluate(() => JSON.parse(localStorage.getItem("aicos:state:v1")!));
  cloud.row = { state: { ...seed, settings: { ...seed.settings, founderName: "From The Cloud" } }, revision: 9 };
  await page.evaluate(() => localStorage.clear());
  await stubSignedInCloud(page, cloud);
  await open(page, "/settings/");
  await expect(page.getByTestId("toast-success").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("founder-name")).toHaveValue("From The Cloud");
  await expect(page.getByTestId("restore-backup")).toHaveCount(1);
  expect(cloud.saves).toEqual([]);
});
