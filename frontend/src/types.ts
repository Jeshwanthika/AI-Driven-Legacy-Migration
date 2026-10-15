export interface Skill {
  id: string;
  name: string;
  version: string;
  source_stack: string;
  target_stack: string;
  extensions: string[];
}

export type NodeStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface RunNode {
  name: string;
  status: NodeStatus;
  started_at: string | null;
  finished_at: string | null;
}

export type RunStatus = "RUNNING" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED";

export interface Run {
  run_id: string;
  skill_id: string;
  filename: string;
  status: RunStatus;
  current_node: string | null;
  nodes: RunNode[];
  tokens_used: number;
  flags_count: number;
  error: { node: string | null; message: string } | null;
  detail?: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface Flag {
  code: string;
  severity: "Info" | "Warning" | "Blocker";
  reason: string;
  suggested_action?: string | null;
}

export interface VbaModule {
  name: string;
  type: string;
  stream: string;
  line_count: number;
  code: string;
}

export interface VbaModules {
  source_file: string;
  modules: VbaModule[];
  findings: { type: string; keyword: string; description: string }[];
  flags: Flag[];
}

export type Support = "supported" | "partial" | "unsupported";

export interface AnalysisProcedure {
  id: string;
  module: string;
  name: string;
  kind: string;
  params: { name: string; type: string; optional: boolean }[];
  returns: string | null;
  start_line: number;
  end_line: number;
  role: string;
  summary: string;
  calls: string[];
  reads: string[];
  writes: string[];
  support: Support;
  support_reason: string;
  analyzed: boolean;
}

export interface AnalysisFlag extends Flag {
  support?: Support | null;
  source_ref?: string | null;
  snippet?: string | null;
}

export interface Analysis {
  source_file: string;
  modules: { name: string; type: string; summary: string; line_count: number; procedure_count: number }[];
  procedures: AnalysisProcedure[];
  flags: AnalysisFlag[];
  usage: { tokens: number; calls: number; chunks: number };
}

export interface SpecField { name: string; type: string; required: boolean; notes: string }
export interface SpecBase { id: string; name: string; source_ref: string[]; support: Support }
export interface SpecEntity extends SpecBase { description: string; fields: SpecField[]; inferred: boolean }
export interface SpecRule extends SpecBase {
  kind: string; description: string; inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[]; entities: string[];
}
export interface SpecScreen extends SpecBase {
  purpose: string; inferred: boolean; entities: string[];
  controls: { name: string; type: string; label: string; binds_to: string }[];
  actions: { name: string; description: string; calls: string }[];
}
export interface SpecWorkflow extends SpecBase {
  description: string; trigger: string; steps: { order: number; description: string; rule: string }[];
}
export interface SpecReport extends SpecBase { format: string; description: string; data_from: string[] }
export interface SpecStub {
  procedure_id: string; module: string; name: string; start_line: number; end_line: number;
  level: "partial" | "unsupported"; reason: string;
}
export interface Spec {
  source_file: string;
  notes: string[];
  entities: SpecEntity[];
  rules: SpecRule[];
  screens: SpecScreen[];
  workflows: SpecWorkflow[];
  reports: SpecReport[];
  stubs: SpecStub[];
  flags: AnalysisFlag[];
  usage: { tokens: number; calls: number; chunks: number };
}

export interface ManifestFile { path: string; kind: string; spec_refs: string[]; is_stub: boolean }
export interface Manifest {
  app_name: string;
  files: ManifestFile[];
  stubs: { spec_id: string; method: string; cause: "unsupported" | "generation_failed"; reason: string }[];
  uncovered_spec_items: { id: string; reason: string }[];
  flags: AnalysisFlag[];
  usage: { tokens: number; calls: number; batches: number };
}

export interface BuildStep { status: "ok" | "failed" | "timed_out" | "skipped"; exit_code: number | null; seconds: number; output_tail: string }
export interface BuildError { file?: string; line?: number; column?: number; code: string; message: string; spec_refs?: string[] }
export interface Validation {
  app_name: string;
  dotnet_version: string;
  result: "passed" | "build_failed" | "restore_failed" | "timed_out";
  restore: BuildStep;
  build: BuildStep;
  errors: BuildError[];
  warning_count: number;
}

export interface PackageInfo { file_name: string; size_bytes: number }
