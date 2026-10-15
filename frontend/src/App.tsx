import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getAnalysis, getManifest, getPackage, getRun, getSkills, getSpec, getValidation, getVbaModules, startRun } from "./api";
import AnalysisView from "./components/AnalysisView";
import GeneratedView from "./components/GeneratedView";
import PackageView from "./components/PackageView";
import ValidationView from "./components/ValidationView";
import SpecView from "./components/SpecView";
import ProgressPanel from "./components/ProgressPanel";
import UploadForm from "./components/UploadForm";
import VbaViewer from "./components/VbaViewer";
import type { Analysis, Manifest, PackageInfo, Run, Skill, Spec, Validation, VbaModules } from "./types";

const POLL_MS = 2000;

export default function App() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [vba, setVba] = useState<VbaModules | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getSkills().then(setSkills).catch((e) => setLoadError(e.message));
  }, []);

  const stopPolling = () => window.clearTimeout(timer.current);

  const poll = useCallback(async (runId: string) => {
    try {
      const latest = await getRun(runId);
      setRun(latest);
      if (latest.status === "RUNNING") {
        timer.current = window.setTimeout(() => poll(runId), POLL_MS);
        return;
      }
      try {
        setVba(await getVbaModules(runId));
      } catch {
        setVba(null); // the extractor did not finish, so there is nothing to show
      }
      try {
        setAnalysis(await getAnalysis(runId));
      } catch {
        setAnalysis(null); // the analyzer did not finish, or is not enabled
      }
      try {
        setSpec(await getSpec(runId));
      } catch {
        setSpec(null); // the spec architect did not finish, or is not enabled
      }
      try {
        setManifest(await getManifest(runId));
      } catch {
        setManifest(null); // the generator did not finish, or is not enabled
      }
      try {
        setValidation(await getValidation(runId));
      } catch {
        setValidation(null); // the validator did not finish, or is not enabled
      }
      try {
        setPkg(await getPackage(runId));
      } catch {
        setPkg(null); // the packager did not finish, or is not enabled
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Lost contact with the server.");
    }
  }, []);

  useEffect(() => stopPolling, []);

  async function onSubmit(skillId: string, file: File) {
    stopPolling();
    setSubmitting(true);
    setSubmitError(null);
    setRun(null);
    setVba(null);
    setAnalysis(null);
    setSpec(null);
    setManifest(null);
    setValidation(null);
    setPkg(null);
    try {
      const { run_id } = await startRun(skillId, file);
      await poll(run_id);
    } catch (e) {
      setSubmitError(e instanceof ApiError || e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const running = submitting || run?.status === "RUNNING";

  return (
    <main>
      <h1>Legacy Migration Platform</h1>
      {loadError && <p className="error" role="alert">Could not reach the server: {loadError}</p>}
      {!skills && !loadError && <p>Loading...</p>}
      {skills && <UploadForm skills={skills} busy={running} error={submitError} onSubmit={onSubmit} />}
      {run && <ProgressPanel run={run} />}
      {analysis && <AnalysisView data={analysis} />}
      {spec && run && <SpecView data={spec} runId={run.run_id} />}
      {manifest && run && <GeneratedView data={manifest} runId={run.run_id} />}
      {validation && <ValidationView data={validation} />}
      {pkg && run && <PackageView info={pkg} runId={run.run_id} />}
      {vba && <VbaViewer data={vba} />}
    </main>
  );
}
