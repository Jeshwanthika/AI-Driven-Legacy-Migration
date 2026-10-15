import { useEffect, useMemo, useState } from "react";
import { getAppFile } from "../api";
import type { Manifest } from "../types";

export default function GeneratedView({ data, runId }: { data: Manifest; runId: string }) {
  const files = useMemo(() => [...data.files].sort((a, b) => a.path.localeCompare(b.path)), [data]);
  const first = files.find((f) => f.path.endsWith("BusinessRules.Rules.cs")) ?? files.find((f) => f.path === "README.md") ?? files[0];
  const [selected, setSelected] = useState<string | null>(first ? first.path : null);
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setError(null);
    getAppFile(runId, selected)
      .then((t) => !cancelled && setText(t))
      .catch((e) => !cancelled && (setText(""), setError(e instanceof Error ? e.message : "Could not load the file.")));
    return () => {
      cancelled = true;
    };
  }, [runId, selected]);

  const current = files.find((f) => f.path === selected);
  const warnings = data.flags.filter((f) => f.severity !== "Info");

  return (
    <section className="card">
      <h2>5. Generated app</h2>
      <p className="muted">
        {data.app_name}: {data.files.length} files, {data.stubs.length} stubs. {data.usage.tokens.toLocaleString()} tokens in {data.usage.calls} model calls.
        The app is in <code>backend/workspace/{runId}/output/app</code>. Run it with <code>dotnet run</code> inside the {data.app_name} folder.
      </p>

      {(data.stubs.length > 0 || data.uncovered_spec_items.length > 0 || warnings.length > 0) && (
        <>
          <h3>Needs attention</h3>
          <ul className="flags">
            {data.stubs.map((s) => (
              <li key={s.spec_id}>
                <strong>{s.cause === "unsupported" ? "Stub" : "Not generated"}</strong> <code>{s.spec_id}</code> {s.method}: {s.reason}
              </li>
            ))}
            {warnings.filter((f) => f.code !== "GENERATION_FAILED").map((f, i) => (
              <li key={`w${i}`}><strong>{f.severity}</strong> {f.source_ref && <code>{f.source_ref}</code>} {f.reason}</li>
            ))}
          </ul>
        </>
      )}

      <div className="viewer">
        <ul className="modules" aria-label="Generated files">
          {files.map((f) => (
            <li key={f.path}>
              <button type="button" className={f.path === selected ? "active" : ""} onClick={() => setSelected(f.path)}>
                <strong>{f.path.split("/").pop()}</strong>
                {f.is_stub && <span className="pill partial"> stub</span>}
                <div className="muted small">{f.path}</div>
              </button>
            </li>
          ))}
        </ul>
        <div>
          {current && (
            <p className="muted small">
              {current.kind}{current.spec_refs.length > 0 && <> · from {current.spec_refs.map((r) => <code key={r}>{r} </code>)}</>}
            </p>
          )}
          {error ? <p className="error" role="alert">{error}</p> : <pre className="code" aria-label={`Source of ${selected ?? ""}`}>{text}</pre>}
        </div>
      </div>
    </section>
  );
}
