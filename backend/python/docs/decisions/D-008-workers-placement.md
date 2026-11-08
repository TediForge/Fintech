# D-008: Workers & Cron Placement

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Backend team
- **Scope:** Background and scheduled execution code
- **Related:** D-001, D-003, D-004, D-005, D-006, D-007

## Context

The backend runs periodic and event-triggered work outside the HTTP request
lifecycle. Workers need a distinct execution boundary so their entry points do
not become mixed with API routes, synchronous services, or provider adapters.

## Decision

Background and scheduled execution code lives under `src/app/workers/`, as a
sibling of `api/`, `services/`, `providers/`, and `lib/`.

```text
src/app/workers/
├── __init__.py
├── __main__.py
├── shared.py
├── cron/
│   ├── __init__.py
│   ├── birthdays.py
│   ├── earnings.py
│   └── tedibloom.py
└── tasks/
    └── ...
```

Rules:

1. Scheduled jobs live in `workers/cron/`; event-triggered asynchronous jobs
   live in `workers/tasks/`. Each task has its own module.
2. Framework initialization and task registration stay separate from task
   implementations. Omit framework setup when no framework is used.
3. Workers call business services rather than duplicating business logic.
   Provider integrations are accessed through services.
4. Cron modules are independently runnable with
   `python -B -m app.workers.cron.<task>`.
5. Worker tests fake the service layer and do not make live network or database
   calls.
6. Development invocations and tests use `python -B` in accordance with D-003.

## Consequences

- Workers have independent entry points and remain separate from API and
  service packages.
- API and scheduled execution can reuse the same business services.
- Tasks can be run and tested individually without introducing a worker
  framework or broker.
- The worker package adds a small amount of structure, accepted for the
  separation it provides.

## Compliance

Code review rejects cron or background entry points inside `api/` or
`services/`, unrelated tasks combined into one module, and workers that access
providers directly. Tests fake services and avoid live external dependencies.

## References

- D-001: Provider Folder Structure & Public Interface
- D-003: Run Pytest With Bytecode Caching Disabled
- D-004: Provider-Owned Credentials
- D-005: Reusable Internal Modules
- D-006: Services Packaging for Document & Notification
- D-007: Ledger Domain Placement
