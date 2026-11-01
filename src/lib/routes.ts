// Detail pages use a query string so runtime-created records work on a static host:
// /tasks/view/?id=TSK-0001 is served from tasks/view/index.html.
export const routes = {
  overview: "/",
  org: "/org/",
  employees: "/employees/",
  employee: (id: string) => `/employees/profile/?id=${encodeURIComponent(id)}`,
  departments: "/departments/",
  department: (id: string) => `/departments/view/?id=${encodeURIComponent(id)}`,
  projects: "/projects/",
  project: (id: string) => `/projects/view/?id=${encodeURIComponent(id)}`,
  tasks: "/tasks/",
  task: (id: string) => `/tasks/view/?id=${encodeURIComponent(id)}`,
  workflow: "/workflow/",
  execution: "/execution/",
  executionNew: (q: { employee?: string; task?: string; project?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => !!v) as [string, string][]);
    const s = p.toString();
    return `/execution/new/${s ? `?${s}` : ""}`;
  },
  executionView: (id: string) => `/execution/view/?id=${encodeURIComponent(id)}`,
  approvals: "/approvals/",
  communication: "/communication/",
  deliverables: "/deliverables/",
  knowledge: "/knowledge/",
  article: (id: string) => `/knowledge/view/?id=${encodeURIComponent(id)}`,
  activity: "/activity/",
  analytics: "/analytics/",
  settings: "/settings/",
};

export function refRoute(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "project":
      return routes.project(id);
    case "task":
      return routes.task(id);
    case "execution":
      return routes.executionView(id);
    case "approval":
      return routes.approvals;
    case "employee":
      return routes.employee(id);
    case "knowledge":
      return routes.article(id);
    case "deliverable":
      return routes.deliverables;
    default:
      return null;
  }
}
