import type { Analysis, Manifest, Run, Skill, PackageInfo, Spec, Validation, VbaModules } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = "error";
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    code = body.code ?? code;
    message = body.message ?? message;
  } catch {
    /* keep defaults */
  }
  throw new ApiError(res.status, code, message);
}

export const getSkills = () => fetch("/api/skills").then((r) => parse<Skill[]>(r));
export const getRun = (id: string) => fetch(`/api/runs/${id}`).then((r) => parse<Run>(r));
export const getVbaModules = (id: string) =>
  fetch(`/api/runs/${id}/artifacts/vba_modules`).then((r) => parse<VbaModules>(r));
export const getAnalysis = (id: string) =>
  fetch(`/api/runs/${id}/artifacts/analysis_model`).then((r) => parse<Analysis>(r));
export const getSpec = (id: string) =>
  fetch(`/api/runs/${id}/artifacts/migration_spec`).then((r) => parse<Spec>(r));
export const specMarkdownUrl = (id: string) => `/api/runs/${id}/spec.md`;
export const getManifest = (id: string) =>
  fetch(`/api/runs/${id}/artifacts/generation_manifest`).then((r) => parse<Manifest>(r));
export const getValidation = (id: string) =>
  fetch(`/api/runs/${id}/artifacts/validation_results`).then((r) => parse<Validation>(r));
export const getPackage = (id: string) =>
  fetch(`/api/runs/${id}/package`).then((r) => parse<PackageInfo>(r));
export const downloadUrl = (id: string) => `/api/runs/${id}/download`;
export const reportUrl = (id: string) => `/api/runs/${id}/report.md`;
export async function getReport(id: string): Promise<string> {
  const res = await fetch(reportUrl(id));
  if (!res.ok) await parse<never>(res);
  return res.text();
}
export async function getAppFile(id: string, path: string): Promise<string> {
  const res = await fetch(`/api/runs/${id}/app-file?path=${encodeURIComponent(path)}`);
  if (!res.ok) await parse<never>(res);
  return res.text();
}

export function startRun(skillId: string, file: File): Promise<{ run_id: string }> {
  const form = new FormData();
  form.append("skill_id", skillId);
  form.append("file", file);
  return fetch("/api/runs", { method: "POST", body: form }).then((r) => parse<{ run_id: string }>(r));
}
