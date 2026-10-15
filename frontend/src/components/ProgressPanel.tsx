import type { Run } from "../types";

const LABELS: Record<string, string> = {
  intake_check: "Check the file",
  extractor: "Extract VBA code",
  analyzer: "Analyze the code",
  spec_architect: "Write the migration spec",
  generator: "Generate the app",
  validator: "Build the app",
  packager: "Package the zip",
};

const ICON: Record<string, string> = { pending: "○", running: "◐", done: "●", failed: "✕", skipped: "–" };

export default function ProgressPanel({ run }: { run: Run }) {
  const statusText =
    run.status === "RUNNING" ? "Running" :
    run.status === "COMPLETED" ? "Completed" :
    run.status === "COMPLETED_WITH_WARNINGS" ? "Completed with warnings" : "Failed";
  return (
    <section className="card">
      <h2>2. Progress: {statusText}</h2>
      <p className="muted">{run.filename}</p>
      <ol className="steps">
        {run.nodes.map((n) => (
          <li key={n.name} className={`step ${n.status}`}>
            <span className="icon" aria-hidden>{ICON[n.status]}</span>
            {LABELS[n.name] ?? n.name}
            <span className="muted"> ({n.status})</span>
            {n.status === "running" && run.detail && <span className="muted"> {run.detail}</span>}
          </li>
        ))}
      </ol>
      {run.error && (
        <p className="error" role="alert">
          {run.error.node ? `Stopped at ${LABELS[run.error.node] ?? run.error.node}: ` : ""}
          {run.error.message}
        </p>
      )}
    </section>
  );
}
