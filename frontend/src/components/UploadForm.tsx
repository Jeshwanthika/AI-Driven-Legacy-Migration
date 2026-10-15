import { useState } from "react";
import type { Skill } from "../types";

interface Props {
  skills: Skill[];
  busy: boolean;
  error: string | null;
  onSubmit: (skillId: string, file: File) => void;
}

export default function UploadForm({ skills, busy, error, onSubmit }: Props) {
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const skill = skills.find((s) => s.id === skillId);
  const accept = skill?.extensions.join(",") ?? "";

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (file && skillId) onSubmit(skillId, file);
      }}
    >
      <h2>1. Choose a migration and upload</h2>
      <label>
        Migration skill
        <select value={skillId} onChange={(e) => setSkillId(e.target.value)} disabled={busy}>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {skill && (
        <p className="muted">
          {skill.source_stack} to {skill.target_stack}
        </p>
      )}
      <label>
        File ({accept})
        <input type="file" accept={accept} disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || !file}>
        {busy ? "Working..." : "Start migration"}
      </button>
    </form>
  );
}
