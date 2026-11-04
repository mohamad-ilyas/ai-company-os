import type { Department, Employee } from "../../lib/types";
import { coo, businessAnalyst, projectManager } from "./executive";
import { contentCreator, designArchitect, graphicDesigner, uiuxDesigner } from "./design";
import { LEARNING } from "./learning";
import { techLead, mobileEngineer, frontendEngineer, backendEngineer } from "./engineering";
import { qaManager, manualQa, qaAutomation, qualityReviewer } from "./qa";

/** Bump when profiles, reporting lines, or instructions change, so saved companies pick them up. */
export const WORKFORCE_VERSION = 3;

export const EMPLOYEES: Employee[] = [
  coo,
  businessAnalyst,
  projectManager,
  graphicDesigner,
  uiuxDesigner,
  techLead,
  mobileEngineer,
  frontendEngineer,
  backendEngineer,
  qaManager,
  manualQa,
  qaAutomation,
  qualityReviewer,
  contentCreator,
  designArchitect,
].map((e) => ({ ...e, learning: LEARNING[e.slug] }));

export const DEPARTMENTS: Department[] = [
  {
    id: "executive",
    name: { en: "Executive & Operations", ar: "الإدارة التنفيذية والعمليات" },
    description: {
      en: "Runs the company day to day: operations, requirements, and delivery management.",
      ar: "تدير الشركة يوميًا: العمليات، والمتطلبات، وإدارة التسليم.",
    },
    managerId: "EMP-001",
    responsibilities: ["Company operations and reporting", "Client discovery and requirements", "Project planning and delivery", "Escalation to the CEO"],
    colorSlot: 1,
  },
  {
    id: "design",
    name: { en: "Creative & Design", ar: "الإبداع والتصميم" },
    description: {
      en: "Brand identity, product UX, and the design system behind every interface.",
      ar: "الهوية البصرية، وتجربة المستخدم، ونظام التصميم وراء كل واجهة.",
    },
    managerId: "EMP-015",
    responsibilities: ["Design architecture and review of every project's design", "2D, 3D and motion (4D) experience design", "Brand identity and marketing design", "UX research and information architecture", "UI design system and specifications", "Design QA of implemented interfaces", "Content creation and review of everything the team writes"],
    colorSlot: 2,
  },
  {
    id: "engineering",
    name: { en: "Engineering", ar: "الهندسة" },
    description: {
      en: "Architecture, web, mobile, and backend engineering.",
      ar: "البنية المعمارية، وتطوير الويب والجوال والأنظمة الخلفية.",
    },
    managerId: "EMP-006",
    responsibilities: ["Architecture and technical standards", "Web application development", "Mobile application development", "APIs, data, and integrations"],
    colorSlot: 3,
  },
  {
    id: "qa",
    name: { en: "Quality Assurance", ar: "ضمان الجودة" },
    description: {
      en: "Test strategy, manual and automated testing, and independent release review.",
      ar: "استراتيجية الاختبار، والاختبار اليدوي والآلي، والمراجعة المستقلة قبل الإطلاق.",
    },
    managerId: "EMP-010",
    responsibilities: ["QA strategy and release gates", "Manual and exploratory testing", "Automated regression in CI", "Independent quality review"],
    colorSlot: 4,
  },
];
