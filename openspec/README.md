# OpenSpec — Spec-Driven Development for `ng_resonar`

This directory holds the SDD (Spec-Driven Development) artifact trail. It is the
file-based persistence backend for this project (Engram was unavailable at init
time, so all SDD state lives here as committable files).

## Layout

```
openspec/
├── config.yaml              SDD config: context, strict_tdd flag, testing capabilities, per-phase rules
├── project.md               Detected stack, architecture, conventions, testing capabilities
├── README.md                This file
├── specs/                   Source-of-truth capability specs (populated as changes are archived)
│   └── {domain}/spec.md
└── changes/                 One folder per in-flight change
    ├── archive/             Completed changes, moved here as YYYY-MM-DD-{change-name}/
    └── {change-name}/
        ├── state.yaml       DAG state (survives compaction)
        ├── exploration.md   (optional) from /sdd-explore
        ├── research.md      (optional) source-backed evidence
        ├── proposal.md      from /sdd-new (propose)
        ├── specs/{domain}/spec.md   delta specs (ADDED / MODIFIED / REMOVED / RENAMED)
        ├── design.md        from design phase
        ├── tasks.md         from tasks phase; checked off by /sdd-apply
        └── verify-report.md from /sdd-verify
```

## Workflow

1. `/sdd-new <change>` — exploration + proposal
2. spec / design / tasks phases — planning artifacts
3. `/sdd-apply [change]` — implement tasks in batches
4. `/sdd-verify [change]` — validate against specs
5. `/sdd-archive [change]` — move change to `changes/archive/` and merge deltas into `specs/`

## Rules

- Create the change directory before writing artifacts.
- If a file exists, read then update — never blind-overwrite.
- `changes/archive/` is an audit trail: never edit or delete archived changes.
- Generated SDD artifacts are written in English regardless of conversation language.
