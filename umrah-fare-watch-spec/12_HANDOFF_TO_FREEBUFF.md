# Handoff to Freebuff

## 1. Handoff Outcome

This folder is a documentation-only implementation package for Freebuff. It contains product, architecture, data, UX, scheduler, tests, provider rules, and model instructions. It does not contain web app implementation code from this specification revision.

Freebuff will implement Umrah Fare Watch using DeepSeek V4 Flash 07/31 or GLM 5.2 inside the actual Freebuff scaffold.

## 2. Read Order

Read every canonical document in this exact order:

1. `00_README.md`
2. `01_PRODUCT_REQUIREMENTS.md`
3. `02_LONG_HORIZON_MONITORING.md`
4. `03_TECHNICAL_ARCHITECTURE.md`
5. `04_PROVIDER_AND_DATA_STRATEGY.md`
6. `05_DATA_MODEL_AND_BACKEND.md`
7. `06_UI_UX_SPEC.md`
8. `07_ALERTS_AND_SCHEDULER.md`
9. `08_IMPLEMENTATION_PLAN.md`
10. `09_ACCEPTANCE_TESTS.md`
11. `10_FREEBUFF_MASTER_PROMPT.md`
12. `11_REFERENCE_SOURCES.md`
13. `12_HANDOFF_TO_FREEBUFF.md`

Then read the approved design at `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`. Archived documents are evidence only and are not active requirements.

## 3. Operator Start Procedure

1. Give Freebuff access to the whole `umrah-fare-watch-spec` folder.
2. Open `10_FREEBUFF_MASTER_PROMPT.md` and provide its Prompt section to the selected model.
3. Point the model to the actual application scaffold, which may be a separate folder or Freebuff workspace.
4. Require the scaffold audit response before permitting code changes.
5. Approve only one milestone from `08_IMPLEMENTATION_PLAN.md` at a time.
6. At every checkpoint, retain the model report and exact verification output.

Do not ask the model to build everything in one unreviewed pass.

## 4. Fixed Product Decisions

- Product name remains Umrah Fare Watch.
- Core outcome is the lowest observed complete total from active providers.
- Complete total is party flight plus all-room all-night Makkah stay plus all-room all-night Madinah stay.
- Four flight patterns are supported: two roundtrip and two open-jaw patterns.
- Exact Saudi-local flight datetimes derive hotel dates.
- Ground transfer, visa, meals not in the rate, and personal spending are Not included.
- Flight user horizon is 365 days and technical horizon is 370 days.
- Hotel coverage follows each provider frontier. Current Duffel Stays evidence uses 330 days.
- Mock flight and hotel providers are mandatory.
- Real providers activate one at a time only with official access and evidence.
- Product does not process booking, payment, refund, passport, or visa.
- Community comments remain qualitative input.

Any proposed change to these decisions requires product-owner approval and synchronized spec updates before implementation.

## 5. Required Scaffold Audit

Before coding, Freebuff must report:

- actual framework and package manager;
- folder and module inventory;
- existing backend, database, auth, scheduler, tests, and deployment;
- baseline install, typecheck, lint, test, and build commands with results;
- existing user changes or risky overlaps;
- proposed domain mapping;
- active milestone and exact files;
- provider access that is actually available.

If the scaffold is empty, Freebuff asks for approval before creating one. If it contains work, Freebuff preserves it and does not replace the project wholesale.

## 6. Model Guardrails

For either DeepSeek V4 Flash 07/31 or GLM 5.2:

- keep tasks bounded and name exact files;
- repeat fixed constraints in each milestone prompt;
- require deterministic tests for date and money logic;
- keep mock mode working after each change;
- require runtime schemas for provider payloads;
- ask for command output, not confidence statements;
- prevent style-only rewrites of verified modules;
- reject guessed provider behavior, credentials, live data, or framework;
- prohibit scraping and browser-based production data collection;
- never allow a live or complete claim without evidence.

## 7. Provider Access Checklist

Before a real adapter milestone, confirm:

- approved account or partner access;
- server-side credential configured through secret management;
- official endpoint and version;
- allowed product use case and territory;
- rate limit and retry behavior;
- caching and retention rights;
- attribution requirements;
- booking or redirect rights;
- current frontier or inventory window;
- sanitized server-side smoke test.

If any required item is missing, the adapter remains disabled. Mock mode is the valid development path.

## 8. Stop Conditions

Freebuff must stop the affected milestone and report when:

- application scaffold or expected files are missing;
- a framework choice would overwrite existing work;
- a provider lacks access, credential, rights, or current official documentation;
- product semantics are ambiguous or a requested change alters fixed scope;
- destructive migration, data deletion, or broad rewrite is required;
- secret handling, authorization, money, date, privacy, or audit invariants cannot be met;
- a mandatory acceptance test repeatedly fails;
- only scraping or browser automation would make an integration possible.

Freebuff must not weaken a test, hide a partial total, fabricate evidence, or enable a fake live adapter to continue.

## 9. Evidence Before Completion

Every milestone report must include:

```text
milestone
files changed
behavior delivered
acceptance test IDs
commands
exit codes
relevant output or artifacts
provider mode
security checks
known limitations
next milestone or blocker
```

Before MVP completion, require all Mandatory Release Gate items in `09_ACCEPTANCE_TESTS.md`, production build, mock end-to-end smoke, secret scan, provider smoke evidence for every live claim, responsive evidence at 360px, active provider coverage, and final known limitations.

## 10. Specification Package Verification

From this specification folder, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-spec.ps1
```

Expected result:

```text
PASS: specification package validated (13 canonical files)
```

If it fails, repair the specification inconsistency before implementation proceeds.

## 11. Preserved Source Evidence

The 12 original flight-only numbered documents are preserved under:

```text
archive/2026-08-09-flight-only/
```

`SOURCE_HASHES.sha256` proves their byte-level identity. Do not treat archived requirements as active and do not delete the archive during implementation.

## 12. Definition of Ready for Freebuff

The package is ready when:

- all 13 canonical files exist;
- the validator passes;
- source archive hashes pass;
- no forbidden dash or unresolved marker remains;
- the operator knows which actual scaffold Freebuff will modify;
- provider access state is stated honestly;
- the first authorized action is scaffold audit, not coding.

## 13. Definition of Done for the Future App

The app is done only when the current canonical product behavior is implemented, every mandatory acceptance gate passes, mock mode works without secrets, every live provider claim has redacted server-side evidence, coverage and disclaimers are visible, and no high-severity known defect remains.

Specification readiness does not equal application completion.
