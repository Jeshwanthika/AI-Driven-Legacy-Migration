import { Fragment, useMemo, useState } from "react";
import type { Analysis, Support } from "../types";

const ROLE_LABEL: Record<string, string> = {
  ui_handler: "UI handler",
  event: "Event",
  calculation: "Calculation",
  data_access: "Data access",
  report: "Report",
  utility: "Utility",
};

const SUPPORT_LABEL: Record<Support, string> = {
  supported: "Supported",
  partial: "Partial",
  unsupported: "Unsupported",
};

export default function AnalysisView({ data }: { data: Analysis }) {
  const [filter, setFilter] = useState<Support | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { supported: 0, partial: 0, unsupported: 0 };
    data.procedures.forEach((p) => (c[p.support] += 1));
    return c;
  }, [data]);

  const rows = data.procedures.filter((p) => filter === "all" || p.support === filter);

  return (
    <section className="card">
      <h2>3. Analysis</h2>
      <p className="muted">
        {data.procedures.length} procedures in {data.modules.length} modules. {counts.supported} supported,{" "}
        {counts.partial} partial, {counts.unsupported} unsupported. {data.usage.tokens.toLocaleString()} tokens in{" "}
        {data.usage.calls} model calls.
      </p>

      <ul className="modules-summary">
        {data.modules.map((m) => (
          <li key={m.name}>
            <strong>{m.name}</strong> <span className="muted">({m.type}, {m.procedure_count} procedures)</span>
            {m.summary && <> {m.summary}</>}
          </li>
        ))}
      </ul>

      <label className="inline">
        Show{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value as Support | "all")}>
          <option value="all">all procedures</option>
          <option value="supported">supported</option>
          <option value="partial">partial</option>
          <option value="unsupported">unsupported</option>
        </select>
      </label>

      {rows.length === 0 ? (
        <p>No procedures match.</p>
      ) : (
        <div className="table-wrap">
          <table className="procs">
            <thead>
              <tr>
                <th>Procedure</th>
                <th>Module</th>
                <th>Role</th>
                <th>Support</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => setOpenId(openId === p.id ? null : p.id)} className="clickable">
                    <td>
                      <button type="button" className="link" aria-expanded={openId === p.id}>
                        {p.name}
                      </button>
                      <div className="muted small">{p.kind}, lines {p.start_line}-{p.end_line}</div>
                    </td>
                    <td>{p.module}</td>
                    <td>{ROLE_LABEL[p.role] ?? p.role}</td>
                    <td><span className={`pill ${p.support}`}>{SUPPORT_LABEL[p.support]}</span></td>
                    <td>{p.analyzed ? p.summary : <em>Not analyzed</em>}</td>
                  </tr>
                  {openId === p.id && (
                    <tr className="detail">
                      <td colSpan={5}>
                        <dl>
                          <dt>Reason</dt><dd>{p.support_reason}</dd>
                          <dt>Parameters</dt>
                          <dd>{p.params.length ? p.params.map((a) => `${a.name} As ${a.type}`).join(", ") : "none"}{p.returns ? `, returns ${p.returns}` : ""}</dd>
                          <dt>Calls</dt><dd>{p.calls.join(", ") || "none"}</dd>
                          <dt>Reads</dt><dd>{p.reads.join(", ") || "none"}</dd>
                          <dt>Writes</dt><dd>{p.writes.join(", ") || "none"}</dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Flags ({data.flags.length})</h3>
      {data.flags.length === 0 ? (
        <p>No flags.</p>
      ) : (
        <ul className="flags">
          {data.flags.map((f, i) => (
            <li key={i}>
              <strong>{f.severity}</strong> {f.source_ref && <code>{f.source_ref}</code>} {f.reason}
              {f.snippet && <pre className="snippet">{f.snippet}</pre>}
              {f.suggested_action && <div className="muted small">Suggested: {f.suggested_action}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
