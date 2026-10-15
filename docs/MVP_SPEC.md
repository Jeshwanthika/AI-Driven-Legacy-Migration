# MVP Specification: Agentic Legacy Migration Platform

**Status:** Draft v1.1, for approval
**Skill covered:** Excel VBA (.xlsm) to ASP.NET Core
**Approach:** Spec-driven. Each phase is specified, approved, built and demonstrated before the next one starts.
**Supersedes:** the pipeline design in `REQUIREMENTS.md` v0.2 and diagrams 01 to 36. Where they disagree, this document wins.

---

## 1. Purpose

Build a web platform that migrates a legacy application from one technology stack to another using an **agentic workflow on LangGraph**. The first skill migrates an Excel workbook with VBA macros into a runnable ASP.NET Core application. The platform is the long-term product, and each skill is a plugin that supplies its own graph.

## 2. Phases

Each phase adds nodes to the same graph. Earlier phases must keep working unchanged.

**Input scope:** the MVP analyzes the **VBA code only**, extracted with `olevba` (D-12). Everything else in the workbook is an enhancement for later (section 16).

| Phase | Flow | What the user sees |
|---|---|---|
| 1 | Upload .xlsm, extract VBA, show VBA in the UI | The extracted modules and source code |
| 2 | Upload .xlsm, extract VBA, **Analyzer** | The above, plus the analysis (procedures, roles, risk flags) |
| 3 | Upload .xlsm, extract VBA, Analyzer, **Spec architect**, **Generator** | The above, plus the migration spec and the generated app files |
| 4 | Generator, **Package**, download | A Download button for the zip and a migration report |
| 5 | Generator, **Validate**, Package | Build and test results shown in the UI and in the report |

## 3. Decisions fixed by the lead

| ID | Decision |
|---|---|
| D-1 | Platform backend is Python, frontend is React. |
| D-2 | The workflow is built with an agentic framework (LangGraph). |
| D-3 | **Intake check** is a plain validation function, not an agent. |
| D-4 | **Extractor** uses `olevba` (oletools). It does not use an LLM. |
| D-5 | **Analyzer**, **Spec architect** and **Generator** are LLM agents. |
| D-6 | **Validation** uses .NET 8 SDK commands. It does not use an LLM. |
| D-7 | No human review and no supervisor in the MVP. |
| D-8 | Output app is ASP.NET Core Razor Pages on .NET 8, with JSON files for data. |
| D-9 | One file is migrated at a time. There is no batch processing. |
| D-10 | Unsupported VBA patterns are flagged and stubbed, never silently dropped, and never fail the whole run. |
| D-11 | The user chooses the migration skill explicitly. The platform never auto-detects it. |
| D-12 | The MVP source is the **VBA code only**, extracted with `olevba`. Sheet data, tables, named ranges and UserForm layouts are not extracted. They are enhancements for later. |

Items removed earlier and still out of scope: checkpointer, event stream, planner, code workers, critic, tool sandbox.

## 4. Assumptions to confirm

These are my choices where no decision was given. Please confirm or change them.

| ID | Assumption | Why |
|---|---|---|
| A-1 | No job queue or worker. A run starts as a background task in the API process. A second upload while a run is active is rejected with HTTP 409. | You process one file at a time. |
| A-2 | "Job" is renamed **migration run**. Its record is a `run.json` file in the run folder. There is no database. | Single user, simplest storage. |
| A-3 | The UI shows progress by polling `GET /api/runs/{id}` every 2 seconds. | No event stream. |
| A-4 | The Python web framework is **FastAPI**. | Not specified. FastAPI fits async and typed schemas. |
| A-5 | The LLM sits behind a small client interface. Provider, model and key come from environment variables. | You will supply the LLM. |
| A-6 | Validation in Phase 5 only **reports** results. There is no automatic repair loop. | Repair was not requested. |
| A-7 | Phase 5 validation runs `dotnet restore`, `dotnet build`, and `dotnet test` if the generator produced a test project. It does not start the app. | You listed .NET commands only. |
| A-8 | Because only code is analyzed, entities, fields and screen controls in the spec are **inferred** from how the VBA uses sheets, ranges, forms and message boxes. The generated app starts with empty JSON data files. | Follows from D-12. |
| A-9 | Run retention is 7 days, then the run folder is deleted. | Not specified. |

## 5. Architecture

### 5.1 Stack

| Layer | Choice |
|---|---|
| Frontend | React single-page app, polling the API |
| Backend | Python, FastAPI (A-4) |
| Agent framework | LangGraph (`StateGraph`, conditional edges) |
| VBA extraction | `oletools` (`olevba`) |
| LLM | Provider-agnostic client, supplied by the lead (A-5) |
| Build and validate | .NET 8 SDK on the host, called as subprocesses |
| Storage | Files on disk: one run folder per run |

### 5.2 Components

| Component | Responsibility |
|---|---|
| API layer | Routes, upload handling, request checks, status and file endpoints |
| RunService | Creates the run folder and `run.json`, enforces one active run, starts the graph in the background |
| PluginRegistry | Finds installed skills, returns manifests, builds a skill's graph |
| GraphRunner | Invokes the compiled graph, updates `run.json` after every node, records failures |
| Model gateway | Single door to the LLM: token budget, retries, JSON-schema checking, prompt and response logging |
| Tool layer | The tools each agent may call (file read and write, procedure splitter, template rendering, dotnet commands) |
| Cleanup task | Deletes runs older than the retention period |
| Logger | Structured JSON logs per run and per node, never containing the API key |

### 5.3 Run folder

```
workspace/{run_id}/
  run.json                  status, current node, node list, counters, flags, error
  input/                    the uploaded .xlsm (never executed)
  artifacts/
    vba_modules.json        Phase 1
    analysis_model.json     Phase 2
    migration_spec.json     Phase 3
    migration_spec.md       Phase 3
    generation_manifest.json  Phase 3
    validation_results.json   Phase 5
  output/
    app/                    generated ASP.NET Core solution (Phase 3)
    MIGRATION_REPORT.md     Phase 4
    MIGRATION_REPORT.json   Phase 4
    {name}-aspnetcore.zip   Phase 4
  logs/
    run.log
    llm/{node}.jsonl        every prompt and response
```

## 6. The graph

### 6.1 Nodes

| Node | Type | LLM | Phase |
|---|---|---|---|
| `intake_check` | Validation function | No | 1 |
| `extractor` | Tool node (`olevba`) | No | 1 |
| `analyzer` | LLM agent with tools | Yes | 2 |
| `spec_architect` | LLM agent with tools | Yes | 3 |
| `generator` | LLM agent with tools | Yes | 3 |
| `packager` | Tool node (zip and report) | No | 4 |
| `validator` | Tool node (dotnet commands) | No | 5 |

### 6.2 Edges per phase

```
Phase 1:  START -> intake_check -> extractor -> END
Phase 2:  START -> intake_check -> extractor -> analyzer -> END
Phase 3:  ... analyzer -> spec_architect -> generator -> END
Phase 4:  ... generator -> packager -> END
Phase 5:  ... generator -> validator -> packager -> END
```

After every node a conditional edge checks the state. If the node set a blocker error, the graph goes to `END` with status `FAILED`. Otherwise it continues. The set of wired nodes comes from the setting `ENABLED_STAGES`, so a phase is switched on without editing earlier nodes.

### 6.3 State

`MigrationState` is the single object every node reads and updates. Large data stays on disk and the state holds only paths.

| Field | Type | Meaning |
|---|---|---|
| `run_id` | str | Run identifier |
| `skill_id` | str | Selected skill |
| `workspace_path` | str | Run folder |
| `input_path` | str | Uploaded file |
| `vba_modules_path` | str | Phase 1 artifact |
| `analysis_path` | str | Phase 2 artifact |
| `spec_path` | str | Phase 3 artifact |
| `manifest_path` | str | Phase 3 artifact |
| `validation_path` | str | Phase 5 artifact |
| `zip_path` | str | Phase 4 artifact |
| `flags` | list | Findings from every node |
| `tokens_used` | int | Running total |
| `error` | object or null | Node name and message if a blocker occurred |

## 7. Node specifications

### 7.1 Intake check (Phase 1)

A plain function that runs before the graph starts and returns pass or fail with a reason.

| ID | Requirement |
|---|---|
| FR-IC1 | Reject a missing file, an empty file, or a size over `MAX_UPLOAD_MB` (default 25). |
| FR-IC2 | Reject an extension other than `.xlsm`. |
| FR-IC3 | Open the file as a zip and confirm `xl/workbook.xml` and `xl/vbaProject.bin` exist. |
| FR-IC4 | Reject a corrupt zip or a password-protected VBA project with a clear message. |
| FR-IC5 | A rejected file creates no run. The API returns HTTP 400, 413 or 422 with the reason. |

### 7.2 Extractor (Phase 1)

| ID | Requirement |
|---|---|
| FR-EX1 | Use `olevba` to read all VBA modules from the workbook. Macros are never executed. |
| FR-EX2 | For each module record: name, type (standard, class, sheet, workbook, form), source stream, line count and full code. Type comes from the module's `Attribute` lines, defaulting to standard. |
| FR-EX3 | Record `olevba`'s findings (auto-execute entry points, suspicious keywords, external references) as informational flags. |
| FR-EX4 | A workbook with a VBA project but no code modules completes with a warning flag. |
| FR-EX5 | Write `artifacts/vba_modules.json` and validate it against its schema. |
| FR-EX6 | An unreadable VBA project is a blocker error. |
| FR-EX7 | Only VBA code is extracted. Cell data, tables, named ranges, formulas and UserForm layouts are not read. |

### 7.3 Analyzer (Phase 2)

| ID | Requirement |
|---|---|
| FR-AN1 | For each module, ask the LLM to identify its procedures (Sub, Function, Property) and return JSON matching the analysis schema. |
| FR-AN2 | Large modules are split at procedure boundaries by a simple pattern-based splitter, so each chunk fits the token budget. The LLM never sees a chunk cut mid-procedure. |
| FR-AN3 | For each procedure the LLM returns: name, kind, parameters, return type, role (ui_handler, event, calculation, data_access, report, utility), a one-line summary, the procedures it calls, the sheets, ranges or tables it reads and writes, and a support level (supported, partial, unsupported) with a reason. |
| FR-AN4 | Line numbers are **not** taken from the LLM. The platform finds each procedure header in the module text and records the line range itself. |
| FR-AN5 | Constructs from the coverage matrix (section 10) that are partial or unsupported become flags with severity, source reference, original snippet and suggested action. |
| FR-AN6 | If the response fails schema validation, re-ask with the error message up to `SCHEMA_REASK` times (default 2). If it still fails, flag the chunk and continue. |
| FR-AN7 | Merge chunk results into one model, resolve duplicate names, and write `artifacts/analysis_model.json`. |
| FR-AN8 | The Analyzer sees VBA code only. References to sheets, ranges and form controls come from the code text. The contents of sheets and the layouts of forms are unknown, and the prompt must tell the LLM not to invent them. |

### 7.4 Spec architect (Phase 3)

| ID | Requirement |
|---|---|
| FR-SP1 | Read the analysis and the module source and produce a technology-neutral migration spec: entities and fields, business rules and calculations, screens and their controls, workflows, and reports or exports. Because only code is analyzed, entities, fields and screen controls are inferred from how the code uses sheets, ranges, forms and message boxes, and are marked `inferred`. |
| FR-SP2 | Every spec element carries source references (module and procedure) for traceability. |
| FR-SP3 | The agent may call tools to read analysis data, read VBA source and validate its draft against the schema, looping until the spec is valid or `MAX_AGENT_STEPS` is reached. |
| FR-SP4 | Write `artifacts/migration_spec.json` and a human-readable `migration_spec.md`. |
| FR-SP5 | Items the agent cannot interpret are listed as flags, not guessed. |

### 7.5 Generator (Phase 3)

| ID | Requirement |
|---|---|
| FR-GN1 | Copy a fixed project scaffold: `.sln`, `.csproj` (net8.0), `Program.cs`, `appsettings.json`, layout and static files. |
| FR-GN2 | Generate C# model classes for spec entities, a JSON-file repository for each, and empty JSON data files under `Data/`. No workbook data is carried over. |
| FR-GN3 | For each business rule, generate a C# service method. For each screen or workflow, generate a Razor Page and page model. For each report, generate a download handler. |
| FR-GN4 | The agent writes files only through the `write_file` tool, only inside `output/app/`. |
| FR-GN5 | Every unsupported item gets a stub: `// MIGRATION-TODO [UNSUPPORTED-xxx]` with the original VBA in a comment, throwing `NotImplementedException` where behavior is required. |
| FR-GN6 | Write a `README.md` (how to build and run, list of stubs) and `artifacts/generation_manifest.json` mapping every generated file to the spec elements it came from. |
| FR-GN7 | The agent loops while writing files, bounded by `MAX_AGENT_STEPS`. If the limit is reached, remaining spec items are written as stubs and flagged. |

### 7.6 Packager (Phase 4)

| ID | Requirement |
|---|---|
| FR-PK1 | Build `MIGRATION_REPORT.md` and `.json`: counts of modules and procedures, converted, partial and unsupported items, every flag with its detail, token usage, and validation results if Phase 5 ran. |
| FR-PK2 | Zip `output/app/`, the migration spec, the README and the report into `{name}-aspnetcore.zip`. |
| FR-PK3 | Exclude `bin/`, `obj/` and any secret or key file. |
| FR-PK4 | Open the zip once to confirm it is readable. |

### 7.7 Validator (Phase 5)

| ID | Requirement |
|---|---|
| FR-VA1 | Copy `output/app/` to a clean temporary folder. |
| FR-VA2 | Run `dotnet restore` then `dotnet build`, each with a timeout (`DOTNET_TIMEOUT_SEC`, default 300). Capture errors as structured items: file, line, code and message. |
| FR-VA3 | If a test project exists, run `dotnet test` and record passed, failed and skipped counts. |
| FR-VA4 | Write `artifacts/validation_results.json`. A build failure does not stop the run: the status becomes `COMPLETED_WITH_WARNINGS`, the failure is shown in the UI and the report, and the zip is still produced. |
| FR-VA5 | Remove the temporary folder afterwards. |

## 8. Platform requirements

### 8.1 API

| Method and path | Phase | Purpose |
|---|---|---|
| `GET /api/skills` | 1 | List available skills (one entry in the MVP) |
| `POST /api/runs` | 1 | Multipart upload with `skill_id` and `file`. Returns 202 with `run_id`. 400, 413 or 422 for an invalid file. 409 if a run is active. |
| `GET /api/runs/{id}` | 1 | The `run.json` content: status, current node, node list, counters, error |
| `GET /api/runs` | 1 | Recent runs, newest first |
| `GET /api/runs/{id}/artifacts/{name}` | 1 | A JSON artifact: `vba_modules`, `analysis_model`, `migration_spec`, `generation_manifest`, `validation_results` |
| `GET /api/runs/{id}/files` | 3 | File tree of the generated app |
| `GET /api/runs/{id}/files/{path}` | 3 | Content of one generated file |
| `GET /api/runs/{id}/download` | 4 | Stream the zip |

### 8.2 `run.json`

| Field | Meaning |
|---|---|
| `run_id`, `skill_id`, `filename` | Identity |
| `status` | `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED` |
| `current_node` | The node now running |
| `nodes` | List of `{name, status, started_at, finished_at}`, which drives the progress panel |
| `tokens_used` | Total LLM tokens for the run |
| `flags_count` | Number of flags |
| `error` | `{node, message}` if the run failed |
| `started_at`, `finished_at` | Timestamps |

### 8.3 Model gateway

| ID | Requirement |
|---|---|
| FR-LG1 | All LLM calls go through the gateway. Nodes never call a provider directly. |
| FR-LG2 | Enforce a token budget per run (`MAX_TOKENS_PER_RUN`). Exceeding it ends the current node with a blocker error. |
| FR-LG3 | Retry rate-limit and server errors with exponential backoff, up to `LLM_RETRIES` (default 3). |
| FR-LG4 | Check structured outputs against a schema and report the error to the caller for re-asking. |
| FR-LG5 | Log every prompt and response to `logs/llm/{node}.jsonl`. Never log the API key. |

### 8.4 Settings

All settings come from environment variables. Defaults in brackets.

`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `MAX_UPLOAD_MB` [25], `MAX_TOKENS_PER_RUN`, `MAX_AGENT_STEPS` [25], `LLM_RETRIES` [3], `SCHEMA_REASK` [2], `DOTNET_TIMEOUT_SEC` [300], `RETENTION_DAYS` [7], `WORKSPACE_ROOT`, `ENABLED_STAGES`.

### 8.5 UI

| Phase | Screens |
|---|---|
| 1 | Skill selector, upload form, progress panel (node list with status), **VBA viewer** (module list on the left, source code on the right, flags below) |
| 2 | **Analysis tab**: procedure table (name, module, role, support level, summary) and flag list |
| 3 | **Spec tab** (rendered Markdown) and **Generated files tab** (file tree and code view) |
| 4 | Report view and **Download** button |
| 5 | **Validation panel**: restore, build and test results with error list |

## 9. Artifact schemas (field level)

All artifacts carry `schema_version`. JSON Schema files will be written in `schemas/` before the matching phase is built.

**`vba_modules.json`:** `source_file`, `modules[]` (`name`, `type`, `stream`, `line_count`, `code`), `findings[]` (`type`, `keyword`, `description`), `flags[]`.

**`analysis_model.json`:** `modules[]` (`name`, `summary`), `procedures[]` (`id`, `module`, `name`, `kind`, `params[]`, `returns`, `start_line`, `end_line`, `role`, `summary`, `calls[]`, `reads[]`, `writes[]`, `support`, `support_reason`), `flags[]`, `usage` (`tokens`).

**`migration_spec.json`:** `entities[]` (`name`, `fields[]`, `inferred`, `source_ref[]`), `rules[]` (`name`, `description`, `inputs`, `outputs`, `source_ref[]`), `screens[]` (`name`, `controls[]`, `actions[]`, `inferred`, `source_ref[]`), `workflows[]` (`name`, `steps[]`, `source_ref[]`), `reports[]` (`name`, `format`, `source_ref[]`), `flags[]`.

**`generation_manifest.json`:** `files[]` (`path`, `kind`, `spec_refs[]`, `is_stub`), `uncovered_spec_items[]`.

**`validation_results.json`:** `restore` (`ok`, `seconds`), `build` (`ok`, `errors[]`, `warnings`), `tests` (`ran`, `passed`, `failed`, `skipped`).

**Flag object (shared):** `code`, `severity` (Info, Warning, Blocker), `support` (supported, partial, unsupported), `source_ref`, `snippet`, `reason`, `suggested_action`.

## 10. VBA coverage matrix

**Supported (convert):** procedures, functions and parameters; variables, constants, arrays, `Collection`, `Dictionary`, `Type`, `Enum`; `If`, `Select Case`, `For`, `For Each`, `While`, `Do`; string, math, date and conversion functions; `On Error` mapped to try/catch where clear; `Range`, `Cells`, `UsedRange`, `.Value`, `.Formula`, `Find`, `Sort`, `AutoFilter` mapped to entity operations; `MsgBox` and `InputBox` mapped to page messages and inputs; class modules mapped to C# classes.

**Partial (convert and warn):** `Worksheet_Change` cascades; dynamically built range addresses; logic that depends on cell formatting; `Application.*` properties with meaning; file writes through `Open ... For Output` or `FileSystemObject`.

**Unsupported (flag and stub):** COM automation of other applications; Win32 `Declare` calls and external DLLs; ActiveX controls; programmatic charts and pivot tables; `SendKeys`, `Application.OnTime`, clipboard and screen manipulation; ADODB and DAO connections; `Shell` and unknown `CreateObject` calls.

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Reliability:** an unsupported pattern, a bad LLM chunk or a failed build never crashes the platform. It becomes a flag and the run continues where possible. |
| NFR-2 | **Safety of input:** uploaded files and their macros are never executed. The VBA project is only parsed. |
| NFR-3 | **Safety of output:** the Validator builds LLM-generated code on the host with no isolation layer. This is accepted for the MVP on a trusted, single-user machine. Running validation in a container is the first hardening step before wider use. |
| NFR-4 | **Traceability:** every analysis item and generated file traces back to its VBA source through `source_ref` and the manifest. |
| NFR-5 | **Reproducibility:** prompts, model name, temperature and responses are logged for every run. |
| NFR-6 | **Cost control:** one token budget per run, shown in the report. |
| NFR-7 | **Extensibility:** a new skill is a new plugin that supplies a graph. Platform code does not change. |
| NFR-8 | **Privacy:** uploads and outputs are deleted after the retention period. |
| NFR-9 | **Portability:** the generated app builds and runs with only the .NET 8 SDK installed. |
| NFR-10 | **Host requirement:** the platform host needs Python, the .NET 8 SDK, and access to the LLM provider. |

## 12. Acceptance criteria

**Phase 1**
1. Selecting the skill and uploading a valid `.xlsm` creates a run that ends `COMPLETED`.
2. The UI lists every VBA module and shows its full source.
3. A non-`.xlsm`, an empty file, an oversize file, a corrupt file and a workbook without macros each give the specified response.
4. A second upload during a run gets HTTP 409.
5. No macro is ever executed.

**Phase 2**
1. Every procedure in the sample appears in `analysis_model.json` with a role and a support level.
2. Line ranges match the source text.
3. Every unsupported construct in the sample appears as a flag.
4. An invalid LLM response is re-asked, then flagged without failing the run.

**Phase 3**
1. The spec contains the entities, rules and screens identifiable from the sample, each with source references. Entities and screens are marked `inferred`.
2. The generated app exists in `output/app/` with the scaffold, models, repositories, services and pages.
3. Every unsupported item is a `MIGRATION-TODO` stub.
4. The manifest lists every generated file and any uncovered spec items.
5. The generated app starts with empty JSON data files, and no workbook data is carried over.

**Phase 4**
1. The zip downloads and contains the app, README, spec and report, and excludes `bin/` and `obj/`.
2. After unzipping, the lead can open the solution. Whether it builds is judged in Phase 5.

**Phase 5**
1. `dotnet restore` and `dotnet build` results are recorded and shown.
2. A build failure gives `COMPLETED_WITH_WARNINGS`, a visible error list, and still a downloadable zip.
3. The report includes the validation results.

## 13. Out of scope for the MVP

Human review, supervisor, automatic repair, planner, parallel workers, critic, checkpointer and resume, event stream, job queue and batch processing, tool sandbox, starting the generated app for health checks, extraction of sheet data, tables, named ranges and UserForm layouts (see section 16), additional skills, user accounts.

## 14. Spec-driven plan

| Step | Deliverable |
|---|---|
| 1 | This document approved |
| 2 | OpenAPI file for section 8.1 and JSON Schema files for section 9 (Phase 1 first) |
| 3 | Test plan from the acceptance criteria |
| 4 | Build Phase 1, demo, approve |
| 5 | Repeat steps 2 to 4 for Phases 2 to 5 |

## 15. Open items

| ID | Item | Needed by |
|---|---|---|
| O-1 | Resolved by D-12: VBA code only. Sheet and form extraction moved to section 16. | - |
| O-2 | Sample `.xlsm` file | Phase 1 testing |
| O-3 | LLM provider, model and key | Phase 2 |
| O-4 | Confirm assumptions A-1 to A-9 | Before Phase 1 build |

## 16. Enhancements (later, not committed to a phase)

**Known limitation of the MVP:** because only VBA code is analyzed, the generated app will have no workbook data and no real form layouts. Entities, fields and screens are inferred from the code and marked `inferred`, so expect to review and correct them by hand.

| Enhancement | What it adds |
|---|---|
| Sheet and table extraction (`openpyxl`) | Real entities and field types, and seed data in the JSON files |
| UserForm layout extraction | Accurate screens, controls and tab order |
| Named ranges, data validation lists and formulas | Better business rules and dropdown values |
| Detection of charts, pivots and ActiveX | More precise unsupported-item flags |
| Automatic repair loop and supervisor | Build errors fixed or stubbed without manual work |
| Human review of the spec | A pause for approval before generation |
| Health check by running the app | Proof the app starts and each page responds |
| Container isolation for validation | Safe building and running of generated code |
| Additional skills | Other source and target stacks on the same platform |

**Compatibility rule:** enhancements add new artifacts (for example `workbook_data.json` and `forms.json`) and never change the MVP artifacts. The Analyzer, Spec architect and Generator read the new artifacts when they exist and behave as in the MVP when they do not.
