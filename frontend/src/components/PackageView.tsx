import { useEffect, useState } from "react";
import { downloadUrl, getReport } from "../api";
import type { PackageInfo } from "../types";

export default function PackageView({ info, runId }: { info: PackageInfo; runId: string }) {
  const [report, setReport] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    getReport(runId).then((t) => !cancelled && setReport(t)).catch(() => !cancelled && setReport(""));
    return () => {
      cancelled = true;
    };
  }, [runId]);
  const kb = Math.max(1, Math.round(info.size_bytes / 1024));
  return (
    <section className="card">
      <h2>7. Download</h2>
      <p>
        <a className="button" href={downloadUrl(runId)} download={info.file_name}>Download {info.file_name}</a>
        <span className="muted"> {kb} KB</span>
      </p>
      <p className="muted">
        Unzip it and read <code>MIGRATION_REPORT.md</code> first. The app is in the <code>app</code> folder: run <code>dotnet run</code> inside the app project folder.
      </p>
      {report && (
        <details>
          <summary>Migration report</summary>
          <pre className="code">{report}</pre>
        </details>
      )}
    </section>
  );
}
