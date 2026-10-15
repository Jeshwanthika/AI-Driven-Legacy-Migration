import { useState } from "react";
import type { VbaModules } from "../types";

export default function VbaViewer({ data }: { data: VbaModules }) {
  const [selected, setSelected] = useState(0);
  const mod = data.modules[selected];
  return (
    <section className="card">
      <h2>8. Extracted VBA code</h2>
      {data.modules.length === 0 ? (
        <p>No code modules were found in this workbook.</p>
      ) : (
        <div className="viewer">
          <ul className="modules">
            {data.modules.map((m, i) => (
              <li key={m.name}>
                <button type="button" className={i === selected ? "active" : ""} onClick={() => setSelected(i)}>
                  <strong>{m.name}</strong>
                  <span className="muted"> {m.type}, {m.line_count} lines</span>
                </button>
              </li>
            ))}
          </ul>
          <pre className="code" aria-label={`Source of ${mod.name}`}>{mod.code}</pre>
        </div>
      )}
      {data.flags.length > 0 && (
        <>
          <h3>Flags</h3>
          <ul>
            {data.flags.map((f, i) => (
              <li key={i}><strong>{f.severity}</strong> {f.code}: {f.reason}</li>
            ))}
          </ul>
        </>
      )}
      {data.findings.length > 0 && (
        <>
          <h3>olevba findings</h3>
          <ul>
            {data.findings.map((f, i) => (
              <li key={i}>{f.type}: <code>{f.keyword}</code> {f.description}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
