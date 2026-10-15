import { useState } from "react";
import { specMarkdownUrl } from "../api";
import type { Spec, Support } from "../types";

type Tab = "entities" | "rules" | "screens" | "workflows" | "reports" | "stubs" | "flags";

function Pill({ level }: { level: Support }) {
  return <span className={`pill ${level}`}>{level}</span>;
}

function Refs({ refs }: { refs: string[] }) {
  return <div className="muted small">Source: {refs.length ? refs.map((r) => <code key={r}>{r} </code>) : "none"}</div>;
}

export default function SpecView({ data, runId }: { data: Spec; runId: string }) {
  const [tab, setTab] = useState<Tab>("entities");
  const warnings = data.flags.filter((f) => f.severity !== "Info");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "entities", label: "Entities", count: data.entities.length },
    { id: "rules", label: "Rules", count: data.rules.length },
    { id: "screens", label: "Screens", count: data.screens.length },
    { id: "workflows", label: "Workflows", count: data.workflows.length },
    { id: "reports", label: "Reports", count: data.reports.length },
    { id: "stubs", label: "Needs attention", count: data.stubs.length },
    { id: "flags", label: "Flags", count: warnings.length },
  ];

  return (
    <section className="card">
      <h2>4. Migration spec</h2>
      <p className="muted">
        Inferred from the VBA code only. {data.usage.tokens.toLocaleString()} tokens in {data.usage.calls} model calls.{" "}
        <a href={specMarkdownUrl(runId)} download="migration_spec.md">Download as Markdown</a>
      </p>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === "entities" && (data.entities.length === 0 ? <p>None found.</p> : data.entities.map((e) => (
        <article key={e.id} className="spec-item">
          <h3>{e.id} {e.name} <Pill level={e.support} /> <span className="muted small">{e.inferred ? "inferred" : "explicit in the code"}</span></h3>
          <p>{e.description}</p>
          {e.fields.length > 0 && (
            <div className="table-wrap"><table className="procs">
              <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Notes</th></tr></thead>
              <tbody>{e.fields.map((f) => (
                <tr key={f.name}><td>{f.name}</td><td>{f.type}</td><td>{f.required ? "yes" : "no"}</td><td>{f.notes}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          <Refs refs={e.source_ref} />
        </article>
      )))}

      {tab === "rules" && (data.rules.length === 0 ? <p>None found.</p> : data.rules.map((r) => (
        <article key={r.id} className="spec-item">
          <h3>{r.id} {r.name} <Pill level={r.support} /> <span className="muted small">{r.kind}</span></h3>
          <p>{r.description}</p>
          {r.inputs.length > 0 && <div className="small">Inputs: {r.inputs.map((i) => `${i.name} (${i.type || "?"})`).join(", ")}</div>}
          {r.outputs.length > 0 && <div className="small">Outputs: {r.outputs.map((o) => `${o.name} (${o.type || "?"})`).join(", ")}</div>}
          {r.entities.length > 0 && <div className="small">Entities: {r.entities.join(", ")}</div>}
          <Refs refs={r.source_ref} />
        </article>
      )))}

      {tab === "screens" && (data.screens.length === 0 ? <p>None found.</p> : data.screens.map((s) => (
        <article key={s.id} className="spec-item">
          <h3>{s.id} {s.name} <Pill level={s.support} /> <span className="muted small">{s.inferred ? "inferred" : "explicit in the code"}</span></h3>
          <p>{s.purpose}</p>
          {s.controls.length > 0 && (
            <div className="table-wrap"><table className="procs">
              <thead><tr><th>Control</th><th>Type</th><th>Label</th><th>Bound to</th></tr></thead>
              <tbody>{s.controls.map((c) => (
                <tr key={c.name}><td>{c.name}</td><td>{c.type}</td><td>{c.label}</td><td>{c.binds_to}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          {s.actions.length > 0 && <ul>{s.actions.map((a) => (
            <li key={a.name}><strong>{a.name}</strong>{a.calls ? ` (uses ${a.calls})` : ""}: {a.description}</li>
          ))}</ul>}
          <Refs refs={s.source_ref} />
        </article>
      )))}

      {tab === "workflows" && (data.workflows.length === 0 ? <p>None found.</p> : data.workflows.map((w) => (
        <article key={w.id} className="spec-item">
          <h3>{w.id} {w.name} <Pill level={w.support} /></h3>
          <p>{w.description}</p>
          {w.trigger && <div className="small">Trigger: {w.trigger}</div>}
          <ol>{w.steps.map((st) => <li key={st.order}>{st.description}{st.rule ? <span className="muted"> [{st.rule}]</span> : null}</li>)}</ol>
          <Refs refs={w.source_ref} />
        </article>
      )))}

      {tab === "reports" && (data.reports.length === 0 ? <p>None found.</p> : data.reports.map((r) => (
        <article key={r.id} className="spec-item">
          <h3>{r.id} {r.name} <Pill level={r.support} /> <span className="muted small">{r.format}</span></h3>
          <p>{r.description}</p>
          {r.data_from.length > 0 && <div className="small">Data from: {r.data_from.join(", ")}</div>}
          <Refs refs={r.source_ref} />
        </article>
      )))}

      {tab === "stubs" && (data.stubs.length === 0 ? <p>Every procedure is fully supported.</p> : (
        <div className="table-wrap"><table className="procs">
          <thead><tr><th>Procedure</th><th>Lines</th><th>Level</th><th>Reason</th></tr></thead>
          <tbody>{data.stubs.map((s) => (
            <tr key={s.procedure_id}><td><code>{s.procedure_id}</code></td><td>{s.start_line}-{s.end_line}</td>
              <td><Pill level={s.level} /></td><td>{s.reason}</td></tr>
          ))}</tbody>
        </table></div>
      ))}

      {tab === "flags" && (warnings.length === 0 ? <p>No warnings.</p> : (
        <ul className="flags">{warnings.map((f, i) => (
          <li key={i}><strong>{f.severity}</strong> {f.source_ref && <code>{f.source_ref}</code>} {f.reason}
            {f.suggested_action && <div className="muted small">Suggested: {f.suggested_action}</div>}</li>
        ))}</ul>
      ))}
    </section>
  );
}
