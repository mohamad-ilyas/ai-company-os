import type { LinkRef } from "../../lib/types";

// Learning plan per employee: what to keep current on, and where to learn it.
// Every link was checked to be live on 2026-11-02. The weekly learning session
// (/learn) reads these, researches what's new, and updates playbooks/<slug>.md.

export interface LearningPlan {
  focus: string[];
  resources: LinkRef[];
}

export const LEARNING: Record<string, LearningPlan> = {
  coo: {
    focus: ["Delivery flow and release governance", "Operational metrics that predict delivery", "Running small teams with AI assistance"],
    resources: [
      { label: "DORA research (software delivery performance)", url: "https://dora.dev/research/" },
      { label: "Atlassian Team Playbook", url: "https://www.atlassian.com/team-playbook" },
      { label: "Atlassian work management guides", url: "https://www.atlassian.com/work-management" },
      { label: "Harvard Business Review — operations", url: "https://hbr.org/topic/subject/operations-and-supply-chain-management" },
      { label: "Shape Up (Basecamp)", url: "https://basecamp.com/shapeup" },
    ],
  },
  "business-analyst": {
    focus: ["Requirements elicitation and acceptance criteria", "Writing testable user stories", "Discovery for web and mobile products"],
    resources: [
      { label: "IIBA — business analysis body of knowledge", url: "https://www.iiba.org/" },
      { label: "Modern Analyst", url: "https://www.modernanalyst.com/" },
      { label: "User stories (Mountain Goat Software)", url: "https://www.mountaingoatsoftware.com/agile/user-stories" },
      { label: "Gherkin reference (Given/When/Then)", url: "https://cucumber.io/docs/gherkin/reference/" },
      { label: "Nielsen Norman Group articles", url: "https://www.nngroup.com/articles/" },
    ],
  },
  "project-manager": {
    focus: ["Agile and Kanban delivery", "Dependency and risk management", "Status reporting that leaders trust"],
    resources: [
      { label: "The Scrum Guide", url: "https://scrumguides.org/" },
      { label: "The Kanban Guide", url: "https://kanban.university/kanban-guide/" },
      { label: "Atlassian Agile Coach", url: "https://www.atlassian.com/agile" },
      { label: "APM resources (Association for Project Management)", url: "https://www.apm.org.uk/resources/" },
      { label: "Shape Up (Basecamp)", url: "https://basecamp.com/shapeup" },
    ],
  },
  "graphic-designer": {
    focus: ["Brand identity systems", "Arabic and Latin typography", "Accessible colour"],
    resources: [
      { label: "Google Fonts Knowledge (typography)", url: "https://fonts.google.com/knowledge" },
      { label: "Brand New — identity reviews", url: "https://www.underconsideration.com/brandnew/" },
      { label: "Typewolf — type in use", url: "https://www.typewolf.com/" },
      { label: "Smashing Magazine — design", url: "https://www.smashingmagazine.com/category/design/" },
      { label: "WebAIM contrast checker", url: "https://webaim.org/resources/contrastchecker/" },
    ],
  },
  "uiux-designer": {
    focus: ["UX research and usability", "Design systems and tokens", "Accessibility and RTL interfaces"],
    resources: [
      { label: "Nielsen Norman Group articles", url: "https://www.nngroup.com/articles/" },
      { label: "Material Design 3", url: "https://m3.material.io/" },
      { label: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/" },
      { label: "WCAG 2.2 quick reference", url: "https://www.w3.org/WAI/WCAG22/quickref/" },
      { label: "Laws of UX", url: "https://lawsofux.com/" },
    ],
  },
  "tech-lead": {
    focus: ["Architecture and technology choices", "Security by design", "Engineering practices that scale"],
    resources: [
      { label: "Thoughtworks Technology Radar", url: "https://www.thoughtworks.com/radar" },
      { label: "Martin Fowler", url: "https://martinfowler.com/" },
      { label: "Architecture Decision Records", url: "https://adr.github.io/" },
      { label: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" },
      { label: "Google SRE books", url: "https://sre.google/books/" },
    ],
  },
  "mobile-engineer": {
    focus: ["React Native and Expo releases", "iOS and Android platform changes", "Mobile testing and performance"],
    resources: [
      { label: "React Native blog", url: "https://reactnative.dev/blog" },
      { label: "Expo changelog", url: "https://expo.dev/changelog" },
      { label: "Android developers", url: "https://developer.android.com/develop" },
      { label: "Apple developer news", url: "https://developer.apple.com/news/" },
      { label: "React Native Directory (libraries)", url: "https://reactnative.directory/" },
      { label: "Maestro docs (mobile UI tests)", url: "https://docs.maestro.dev/" },
    ],
  },
  "frontend-engineer": {
    focus: ["React and Next.js releases", "Web platform features and performance", "Accessibility and TypeScript"],
    resources: [
      { label: "React blog", url: "https://react.dev/blog" },
      { label: "Next.js blog", url: "https://nextjs.org/blog" },
      { label: "web.dev", url: "https://web.dev/" },
      { label: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/" },
      { label: "TypeScript blog", url: "https://devblogs.microsoft.com/typescript/" },
      { label: "Chrome for Developers blog", url: "https://developer.chrome.com/blog" },
    ],
  },
  "backend-engineer": {
    focus: ["Postgres and Supabase", "API design and security", "Operating services at low cost"],
    resources: [
      { label: "PostgreSQL documentation", url: "https://www.postgresql.org/docs/" },
      { label: "Supabase docs", url: "https://supabase.com/docs" },
      { label: "OWASP API Security Top 10", url: "https://owasp.org/API-Security/" },
      { label: "OpenAPI specification", url: "https://spec.openapis.org/" },
      { label: "Node.js blog", url: "https://nodejs.org/en/blog" },
      { label: "The Twelve-Factor App", url: "https://12factor.net/" },
    ],
  },
  "qa-manager": {
    focus: ["Risk-based test strategy", "Quality metrics and release gates", "Balancing manual and automated testing"],
    resources: [
      { label: "ISTQB", url: "https://www.istqb.org/" },
      { label: "Ministry of Testing", url: "https://www.ministryoftesting.com/" },
      { label: "Google Testing Blog", url: "https://testing.googleblog.com/" },
      { label: "The practical test pyramid (Martin Fowler)", url: "https://martinfowler.com/articles/practical-test-pyramid.html" },
    ],
  },
  "manual-qa": {
    focus: ["Exploratory testing", "Accessibility testing", "Writing reproducible bug reports"],
    resources: [
      { label: "Ministry of Testing", url: "https://www.ministryoftesting.com/" },
      { label: "Satisfice (James Bach) — exploratory testing", url: "https://www.satisfice.com/" },
      { label: "W3C — evaluating accessibility", url: "https://www.w3.org/WAI/test-evaluate/" },
      { label: "WebAIM (accessibility)", url: "https://webaim.org/resources/contrastchecker/" },
    ],
  },
  "qa-automation": {
    focus: ["Playwright and Vitest", "Reliable tests in CI", "Mobile UI automation"],
    resources: [
      { label: "Playwright release notes", url: "https://playwright.dev/docs/release-notes" },
      { label: "Vitest", url: "https://vitest.dev/" },
      { label: "Testing Library", url: "https://testing-library.com/docs/" },
      { label: "GitHub Actions docs", url: "https://docs.github.com/en/actions" },
      { label: "Maestro docs", url: "https://docs.maestro.dev/" },
    ],
  },
  "quality-reviewer": {
    focus: ["Code review practice", "Application security verification", "Supply-chain and dependency risk"],
    resources: [
      { label: "Google engineering practices — code review", url: "https://google.github.io/eng-practices/review/" },
      { label: "OWASP ASVS", url: "https://owasp.org/www-project-application-security-verification-standard/" },
      { label: "CWE Top 25", url: "https://cwe.mitre.org/top25/" },
      { label: "GitHub Advisory Database", url: "https://github.com/advisories" },
      { label: "OpenSSF Scorecard", url: "https://securityscorecards.dev/" },
    ],
  },
  "design-architect": {
    focus: [
      "Experience architecture and design systems",
      "Motion and interaction design (4D)",
      "Real-time 3D for web and mobile",
      "Spatial design",
      "Accessibility of motion and 3D",
      "Design critique and creative direction",
    ],
    resources: [
      { label: "Nielsen Norman Group articles", url: "https://www.nngroup.com/articles/" },
      { label: "Interaction Design Foundation — literature", url: "https://www.interaction-design.org/literature" },
      { label: "Laws of UX", url: "https://lawsofux.com/" },
      { label: "Material Design 3", url: "https://m3.material.io/" },
      { label: "Material motion", url: "https://m3.material.io/styles/motion/overview" },
      { label: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/" },
      { label: "Designing for visionOS (spatial)", url: "https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos" },
      { label: "Design Systems (Figma)", url: "https://www.designsystems.com/" },
      { label: "Figma resource library", url: "https://www.figma.com/resource-library/" },
      { label: "Refactoring UI", url: "https://www.refactoringui.com/" },
      { label: "Inclusive Components", url: "https://inclusive-components.design/" },
      { label: "WCAG 2.2 quick reference", url: "https://www.w3.org/WAI/WCAG22/quickref/" },
      { label: "WCAG — animation from interactions", url: "https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions" },
      { label: "Smashing Magazine — UX design", url: "https://www.smashingmagazine.com/category/ux-design/" },
      { label: "A List Apart", url: "https://alistapart.com/" },
      { label: "Awwwards — best of web design", url: "https://www.awwwards.com/" },
      { label: "Web Animations API (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API" },
      { label: "Motion (animation library)", url: "https://motion.dev/" },
      { label: "GSAP docs", url: "https://gsap.com/docs/" },
      { label: "Rive (interactive animation)", url: "https://rive.app/" },
      { label: "LottieFiles", url: "https://lottiefiles.com/" },
      { label: "three.js documentation", url: "https://threejs.org/docs/" },
      { label: "React Three Fiber", url: "https://r3f.docs.pmnd.rs/" },
      { label: "Babylon.js documentation", url: "https://doc.babylonjs.com/" },
      { label: "WebGL fundamentals", url: "https://webglfundamentals.org/" },
      { label: "glTF (3D asset standard)", url: "https://www.khronos.org/gltf/" },
      { label: "Blender manual", url: "https://docs.blender.org/manual/en/latest/" },
      { label: "Spline (3D design for web)", url: "https://spline.design/" },
      { label: "Poly Haven (CC0 3D assets, HDRIs, textures)", url: "https://polyhaven.com/" },
    ],
  },
  "content-creator": {
    focus: ["UX writing and plain language", "Bilingual content quality", "SEO and launch content"],
    resources: [
      { label: "Google developer documentation style guide", url: "https://developers.google.com/style" },
      { label: "Mailchimp content style guide", url: "https://styleguide.mailchimp.com/" },
      { label: "Nielsen Norman Group — writing for the web", url: "https://www.nngroup.com/topic/writing-web/" },
      { label: "Plain language guidelines", url: "https://www.plainlanguage.gov/guidelines/" },
      { label: "Google Search Central", url: "https://developers.google.com/search/docs" },
      { label: "Content Marketing Institute", url: "https://contentmarketinginstitute.com/" },
    ],
  },
};
