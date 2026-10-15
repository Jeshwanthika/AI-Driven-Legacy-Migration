# Legacy Migration Platform: Phase 4

Upload a `.xlsm` workbook, extract its VBA code with `olevba`, analyze every procedure with Gemini, write a technology-neutral migration spec, then generate an ASP.NET Core 8 Razor Pages app.
Phase 6 graph: `intake_check`, `extractor`, `analyzer`, `spec_architect`, `generator`, `validator`, `packager` (LangGraph). Specification: `docs/MVP_SPEC.md`.

## Requirements
Python 3.11+, Node.js 18+ (20 recommended). The .NET 8 SDK is not needed until Phase 5.

## Backend (PowerShell)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt     # adds google-genai in Phase 2
copy .env.example .env      # then set GEMINI_API_KEY and GEMINI_MODEL in .env
python scripts/check_gemini.py   # confirms the key and model work
python -m pytest            # or: python -m unittest discover -s tests -t .
uvicorn app.main:app_factory --factory --port 8000
```
macOS / Linux: `source .venv/bin/activate` and `cp .env.example .env`.

## Frontend
```powershell
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to port 8000)
```

## Try it
1. Open http://localhost:5173, choose "Excel VBA to ASP.NET Core", pick your `.xlsm`, press Start.
2. The progress panel polls every 2 seconds and shows which chunk is being analyzed.
3. When it finishes you get an Analysis section (procedure table, flags), a Migration spec section (entities, rules, screens, workflows, reports, procedures needing attention) a Generated app section (file list, code view, stubs), a Build check section (result of `dotnet restore` and `dotnet build`, errors with their spec items) a Download section (the ZIP and the migration report) and the extracted VBA.

If your `.env` came from an earlier phase, set `ENABLED_STAGES=intake_check,extractor,analyzer,spec_architect,generator,validator,packager` (the new default).

## Validator (Phase 5)
Runs `dotnet restore` and then `dotnet build --no-restore` on `output/app/<App>.sln`, with a timeout (`DOTNET_TIMEOUT_SEC`, default 300). Needs the .NET 8 SDK on PATH and internet for the first restore.
* The result is `artifacts/validation_results.json` (restore and build status, parsed compiler errors, each linked to the spec items of the file it came from).
* A failed build is **not** a failed run: it raises Warning flags (`BUILD_FAILED`, `BUILD_ERROR`) and the run ends `COMPLETED_WITH_WARNINGS`. The Packager (Phase 6) will still zip the app and list the errors.
* A missing .NET SDK ends the run with a clear message. Building creates `bin/` and `obj/` inside `output/app/`; the Packager leaves them out.

## Packager (Phase 6)
Writes `artifacts/MIGRATION_REPORT.md` and `output/<App>_migration.zip` (Python `zipfile`). The zip contains:
* `MIGRATION_REPORT.md`: summary, build result, stubs and warnings, how to run, limits.
* `app/`: the generated solution. `bin/`, `obj/`, `.vs/`, `*.user` and any `.env` file are never included.
* `docs/`: migration spec (md and json), analysis, generation manifest, build results.

The zip is produced even when the build failed; the report then says so and lists the errors. Download it from the UI or `GET /api/runs/{id}/download`; the report is at `GET /api/runs/{id}/report.md`.

## Testing without Gemini quota
Set `LLM_PROVIDER=mock` in `.env`. The mock model answers offline with valid but generic content (one placeholder `Item` entity, one rule per procedure, every method body throws `NotImplementedException`). It is for checking the pipeline, the build and the UI only; the migration itself is meaningless. Switch back to `LLM_PROVIDER=gemini` for real runs.

## Behaviour to know
* One run at a time. A second upload while a run is active returns HTTP 409.
* Limits: 10 MB upload, 20,000 VBA lines (`MAX_UPLOAD_MB`, `MAX_VBA_LINES`).
* Runs are stored under `backend/workspace/{run_id}/` and deleted after 7 days.
* Macros are never executed. Only `olevba` parses the file.
* Empty modules (sheets with no code) are left out and noted as an Info flag.
* `olevba` reads VBA projects even when they are locked with a project password.
  A password-protected workbook (encrypted file) is rejected at upload.

## How the Analyzer works
* The platform splits each module at procedure boundaries (`Sub`, `Function`, `Property`) and records line numbers itself.
* Procedures are grouped into chunks of up to `CHUNK_MAX_CHARS` (12,000). A procedure is never cut. A larger one is sent whole with an Info flag.
* Each chunk goes to Gemini with the module declarations and the signatures of the other procedures. The model returns role, summary, calls, reads, writes and a support level.
* A rule scan of the coverage matrix (SendKeys, Declare, CreateObject, ADODB, charts, pivots and so on) adds flags even if the model misses them. The weaker support level wins.
* Invalid JSON is re-asked up to `SCHEMA_REASK` times, then the chunk gets a Warning flag and the run continues.
* Rate limits and server errors retry with backoff (`LLM_RETRIES`). `LLM_CALL_DELAY_SECONDS` spaces calls for free-tier limits.
* A bad key or model name stops the run with a clear message. Three unreachable chunks in a row also stop it.
* Every prompt and reply is logged to `workspace/{run_id}/logs/llm/analyzer.jsonl` (never the key).

## How the Spec Architect works
* Input: `analysis_model.json` plus the VBA source. Output: `artifacts/migration_spec.json` and `artifacts/migration_spec.md`.
* The same chunks as the Analyzer go to Gemini, each with the analysis of its procedures. Later chunks are told which entities and rules were already found, so names stay consistent.
* Gemini returns entities (with fields), rules, screens (with controls and actions), workflows and reports. Everything is inferred from code only. Anything it cannot interpret comes back as an open question and becomes a Warning flag. Nothing is guessed.
* The platform then merges duplicates across chunks, normalizes names (PascalCase) and types (string, int, decimal, date, datetime, bool), assigns ids (ENT-001, RUL-001, SCR-001, WFL-001, RPT-001), and checks every `source_ref` against the real procedure ids. Unknown references are removed. An element left with none gets a Warning flag.
* One small extra call asks which entity names mean the same thing (for example Expense and ExpenseRow). Gemini returns only a name mapping and the platform applies it. If that call fails, the spec is kept as is.
* `support` on each element is the weakest support level of the procedures it comes from. `stubs` lists every procedure that is partial or unsupported, taken from the analysis and not from the model. Phase 4 uses it to write `MIGRATION-TODO` stubs.
* A chunk that fails (bad JSON after re-asks, or rate limits) gets a Warning flag and the run continues. If every chunk fails, the run stops.

## How the Generator works
The generated app is written to `backend/workspace/{run_id}/output/app/`. To try it (needs the .NET 8 SDK):
```powershell
cd backend\workspace\<run_id>\output\app\<AppName>
dotnet run
```
* **The platform writes** the solution and project files, `Program.cs`, a JSON-file repository, one entity class per record type, every Razor Page (home, a list-and-add page per entity, one page per screen, Workflows, Reports), and every method signature.
* **Gemini writes only method bodies** for rules, workflows and reports, in batches. Because the signatures are fixed by the platform, pages and logic always refer to each other correctly.
* **Safety checks** on every body: balanced braces, no namespace/type/using declarations, a return value where one is needed, and no processes, reflection, network, native code or file deletion. A body that fails is re-asked, then replaced by a stub.
* **Stubs** are written for unsupported rules, workflows and reports, for PDF and Excel reports (no extra packages are added), and for anything the model failed to produce. A stub throws `NotImplementedException`, carries a `MIGRATION-TODO` comment and quotes the original VBA. The page shows the message instead of crashing.
* `generation_manifest.json` lists every file with the spec items it came from, every stub, and `uncovered_spec_items` (items whose behavior was not generated).
* No workbook data is carried over. Records start empty and live in `Data/*.json`.
* The generated app is not compiled in this phase. Phase 5 runs `dotnet restore` and `dotnet build`.

## API (Phase 4)
`GET /api/skills`, `POST /api/runs` (form: `skill_id`, `file`), `GET /api/runs`, `GET /api/runs/{id}`,
`GET /api/runs/{id}/artifacts/vba_modules`, `GET /api/runs/{id}/artifacts/analysis_model`, `GET /api/runs/{id}/artifacts/migration_spec`, `GET /api/runs/{id}/spec.md`, `GET /api/runs/{id}/artifacts/generation_manifest`, `GET /api/runs/{id}/app-file?path=...`.
