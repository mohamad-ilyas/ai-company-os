// Brings a saved company up to date with the built-in workforce and knowledge base
// when they change (new employees, new reporting lines, updated policies).
// Never overwrites something the CEO edited: edited instructions, edited articles,
// and changed department managers are kept (state.edited; older saves: the activity log).

import { DEPARTMENTS, EMPLOYEES, WORKFORCE_VERSION } from "../data/workforce";
import { KNOWLEDGE } from "../data/knowledge";
import { log, type Ctx } from "./domain";
import type { CompanyState, EditedRecords, EmployeeId, KnowledgeArticle } from "./types";

const kbNumber = (id: string) => Number(id.replace(/^KB-/, "")) || 0;

/** Edits the CEO made to built-in records. Older saves only have them in the activity log. */
function editedRecords(s: CompanyState): EditedRecords {
  const fromLog: EditedRecords = {
    instructions: s.activity.filter((a) => a.key === "instructions_changed").map((a) => a.params.employee as EmployeeId),
    articles: s.activity.filter((a) => a.key === "article_updated").map((a) => a.params.id),
    managers: s.activity.filter((a) => a.key === "settings_changed" && /\.manager$/.test(a.params.fields ?? "")).map((a) => a.params.fields.replace(/\.manager$/, "")),
  };
  const cur = s.edited ?? { instructions: [], articles: [], managers: [] };
  const merge = <T extends string>(a: T[], b: T[]) => [...new Set([...a, ...b])];
  return {
    instructions: merge(cur.instructions, fromLog.instructions),
    articles: merge(cur.articles, fromLog.articles),
    managers: merge(cur.managers, fromLog.managers),
  };
}

export function migrateState(s: CompanyState, now: string): { state: CompanyState; changed: boolean } {
  const upToDate = (s.workforceVersion ?? 1) >= WORKFORCE_VERSION;
  // Record edit markers once, while the (bounded) activity log still holds them.
  if (upToDate) return s.edited ? { state: s, changed: false } : { state: { ...s, edited: editedRecords(s) }, changed: true };

  const edited = editedRecords(s);
  const editedInstructions = new Set<string>(edited.instructions);
  const employees = EMPLOYEES.map((seed) => {
    const cur = s.employees.find((e) => e.id === seed.id);
    if (!cur) return seed;
    return {
      ...seed,
      availability: cur.availability,
      systemInstructions: editedInstructions.has(seed.id) ? cur.systemInstructions : seed.systemInstructions,
    };
  });
  const extraEmployees = s.employees.filter((e) => !EMPLOYEES.some((x) => x.id === e.id));

  const departments = DEPARTMENTS.map((d) => {
    const cur = s.departments.find((x) => x.id === d.id);
    const managerChanged = edited.managers.includes(d.id);
    return managerChanged && cur ? { ...d, managerId: cur.managerId } : d;
  });

  // Knowledge: refresh built-in articles the CEO hasn't edited; add new ones without clobbering the CEO's own articles.
  const editedArticles = new Set(edited.articles);
  let kbCounter = Math.max(s.counters.KB ?? 0, ...s.knowledge.map((k) => kbNumber(k.id)));
  const knowledge: KnowledgeArticle[] = s.knowledge.map((k) => {
    const seed = KNOWLEDGE.find((x) => x.id === k.id);
    return seed && seed.title === k.title && !editedArticles.has(k.id) ? seed : k;
  });
  for (const seed of KNOWLEDGE) {
    if (knowledge.some((k) => k.title === seed.title)) continue;
    const idTaken = knowledge.some((k) => k.id === seed.id);
    const id = idTaken ? `KB-${String(++kbCounter).padStart(3, "0")}` : seed.id;
    knowledge.push({ ...seed, id });
  }
  kbCounter = Math.max(kbCounter, ...knowledge.map((k) => kbNumber(k.id)));

  // Projects waiting on (or past) a release decision from before releaseApprovalId existed: link their release request.
  const projects = s.projects.map((p) => {
    if (p.releaseApprovalId !== undefined || (p.status !== "awaiting_ceo_approval" && p.status !== "ready_for_delivery")) return p;
    const wanted = p.status === "awaiting_ceo_approval" ? "pending" : "approved";
    const release = s.approvals.filter((a) => a.projectId === p.id && !a.taskId && a.status === wanted).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { ...p, releaseApprovalId: release?.id ?? null };
  });

  let next: CompanyState = {
    ...s,
    projects,
    employees: [...employees, ...extraEmployees],
    departments,
    knowledge,
    counters: { ...s.counters, KB: kbCounter },
    workforceVersion: WORKFORCE_VERSION,
    edited,
  };
  const ctx: Ctx = { actor: "system", role: "ceo", now };
  next = log(next, ctx, "config", "workforce_updated", { version: String(WORKFORCE_VERSION), count: String(employees.length) });
  return { state: next, changed: true };
}
