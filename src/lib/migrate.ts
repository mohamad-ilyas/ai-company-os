// Brings a saved company up to date with the built-in workforce and knowledge base
// when they change (new employees, new reporting lines, updated policies).
// Never overwrites something the CEO edited: edited instructions, edited articles,
// and changed department managers are kept.

import { DEPARTMENTS, EMPLOYEES, WORKFORCE_VERSION } from "../data/workforce";
import { KNOWLEDGE } from "../data/knowledge";
import { log, type Ctx } from "./domain";
import type { CompanyState, KnowledgeArticle } from "./types";

const kbNumber = (id: string) => Number(id.replace(/^KB-/, "")) || 0;

export function migrateState(s: CompanyState, now: string): { state: CompanyState; changed: boolean } {
  if ((s.workforceVersion ?? 1) >= WORKFORCE_VERSION) return { state: s, changed: false };

  const editedInstructions = new Set(s.activity.filter((a) => a.key === "instructions_changed").map((a) => a.params.employee));
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
    const managerChanged = s.activity.some((a) => a.key === "settings_changed" && a.params.fields === `${d.id}.manager`);
    return managerChanged && cur ? { ...d, managerId: cur.managerId } : d;
  });

  // Knowledge: refresh built-in articles the CEO hasn't edited; add new ones without clobbering the CEO's own articles.
  const editedArticles = new Set(s.activity.filter((a) => a.key === "article_updated").map((a) => a.params.id));
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

  let next: CompanyState = {
    ...s,
    employees: [...employees, ...extraEmployees],
    departments,
    knowledge,
    counters: { ...s.counters, KB: kbCounter },
    workforceVersion: WORKFORCE_VERSION,
  };
  const ctx: Ctx = { actor: "system", role: "ceo", now };
  next = log(next, ctx, "config", "workforce_updated", { version: String(WORKFORCE_VERSION), count: String(employees.length) });
  return { state: next, changed: true };
}
