import { getDatabase } from "./auth";
import { projectBuilds, projectReports, projectStats, type ProjectBuild, type ProjectReport } from "./project-status";

export type RuntimeProjectReport = ProjectReport;
export type ProjectRuntimeDocument = { editionDate: string; today: number; total: number; reports: RuntimeProjectReport[]; builds: ProjectBuild[] };
const fallback: ProjectRuntimeDocument = { ...projectStats, reports: projectReports, builds: projectBuilds };
export const PROJECT_RUNTIME_KEY = "smartlingo-project-status";

function valid(value: unknown): value is ProjectRuntimeDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as ProjectRuntimeDocument;
  return /^\d{4}-\d{2}-\d{2}$/.test(doc.editionDate) && Number.isInteger(doc.today) && doc.today >= 0 && Number.isInteger(doc.total) && doc.total >= doc.today && Array.isArray(doc.reports) && doc.reports.every(report => /^\d{4}-\d{2}-\d{2}$/.test(report.date) && typeof report.title?.zh === "string" && typeof report.title?.en === "string" && typeof report.beta?.zh === "string" && typeof report.beta?.en === "string" && Number.isInteger(report.completed) && typeof report.summary?.zh === "string" && typeof report.summary?.en === "string" && Array.isArray(report.validation?.zh) && Array.isArray(report.validation?.en) && typeof report.rollback?.zh === "string" && typeof report.rollback?.en === "string" && typeof report.next?.zh === "string" && typeof report.next?.en === "string") && Array.isArray(doc.builds) && doc.builds.every(build => Number.isInteger(build.version) && build.version > 0 && build.version <= doc.total && /^\d{4}-\d{2}-\d{2}$/.test(build.date) && typeof build.title?.zh === "string" && typeof build.title?.en === "string" && Array.isArray(build.completed?.zh) && Array.isArray(build.completed?.en) && Array.isArray(build.testable?.zh) && Array.isArray(build.testable?.en) && typeof build.commit === "string");
}

export async function getProjectRuntime(): Promise<ProjectRuntimeDocument> {
  try {
    const row = await getDatabase().prepare("SELECT edition_date AS editionDate, payload FROM editorial_documents WHERE kind = ?").bind(PROJECT_RUNTIME_KEY).first<{ editionDate: string; payload: string }>();
    if (!row) return fallback;
    const payload = JSON.parse(row.payload) as unknown;
    if (!valid(payload)) return fallback;
    const runtime = { ...payload, editionDate: row.editionDate };
    if (runtime.editionDate < fallback.editionDate || (runtime.editionDate === fallback.editionDate && runtime.total < fallback.total)) return fallback;
    const reports = new Map(fallback.reports.map(report => [report.date, report]));
    runtime.reports.forEach(report => reports.set(report.date, report));
    const builds = new Map(fallback.builds.map(build => [build.version, build]));
    runtime.builds.forEach(build => builds.set(build.version, build));
    return { ...runtime, reports: [...reports.values()].sort((a, b) => a.date.localeCompare(b.date)), builds: [...builds.values()].sort((a, b) => a.version - b.version) };
  } catch { return fallback; }
}

export function validProjectRuntime(value: unknown): value is ProjectRuntimeDocument { return valid(value); }
