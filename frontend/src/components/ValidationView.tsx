import type { Validation } from "../types";

const HEADLINE: Record<Validation["result"], string> = {
  passed: "The app restored and built without errors.",
  build_failed: "The app does not compile yet.",
  restore_failed: "Packages could not be restored, so the app was not built.",
  timed_out: "The build did not finish in time.",
};

export default function ValidationView({ data }: { data: Validation }) {
  const tail = data.result === "restore_failed" ? data.restore.output_tail : data.build.output_tail;
  return (
    <section className="card">
      <h2>6. Build check</h2>
      <p className={data.result === "passed" ? "" : "error"} role={data.result === "passed" ? undefined : "alert"}>
        <strong>{HEADLINE[data.result]}</strong>
      </p>
      <p className="muted">
        .NET SDK {data.dotnet_version}. Restore: {data.restore.status} ({data.restore.seconds}s). Build: {data.build.status} ({data.build.seconds}s).
        {" "}{data.warning_count} compiler warning(s), {data.errors.length} error(s).
      </p>
      {data.errors.length > 0 && (
        <div className="table-wrap">
        <table className="procs">
          <thead>
            <tr><th>Code</th><th>Message</th><th>File</th><th>Spec</th></tr>
          </thead>
          <tbody>
            {data.errors.map((e, i) => (
              <tr key={i}>
                <td><code>{e.code}</code></td>
                <td>{e.message}</td>
                <td>{e.file ? <code>{e.file}{e.line ? `:${e.line}` : ""}</code> : ""}</td>
                <td>{(e.spec_refs ?? []).map((r) => <code key={r}>{r} </code>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {data.result !== "passed" && tail && (
        <details>
          <summary>Last output from dotnet</summary>
          <pre className="code">{tail}</pre>
        </details>
      )}
    </section>
  );
}
