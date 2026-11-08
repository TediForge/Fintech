# D-006: Services Packaging for Document & Notification

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** App-owned capabilities under `src/app/services/`
- **Related:** D-001 (Provider Folder Structure & Public Interface), D-005 (Reusable Internal Modules)

## Context

D-001 governs `src/app/providers/`: external vendor adapters, grouped by
capability and exposing a stable package-level API. The application also owns
capabilities that are not providers, including document generation and
notification orchestration.

Without a packaging rule, document formats and notification channels can drift
into flat modules, shared template folders, or vendor-specific code under
`services/`. Templates need clear ownership, and an external vendor adapter
must remain in `providers/`.

## Decision

**App-owned capabilities live under `services/`, not `providers/`. Each
document format or notification channel is a package, not a module. Templates
live inside the package they belong to. There is no shared `templates/` folder
at the category root.**

### Layout

```text
src/app/services/
├── document/
│   ├── __init__.py
│   ├── pdf/
│   │   ├── __init__.py
│   │   ├── service.py
│   │   └── templates/
│   ├── csv/
│   │   ├── __init__.py
│   │   ├── service.py
│   │   └── templates/
│   └── xlsx/
│       ├── __init__.py
│       ├── service.py
│       └── templates/
└── notification/
    ├── __init__.py
    ├── base.py
    ├── mail/
    │   ├── __init__.py
    │   ├── service.py
    │   └── templates/
    ├── sms/
    │   ├── __init__.py
    │   ├── service.py
    │   └── templates/
    ├── push/
    │   ├── __init__.py
    │   ├── service.py
    │   └── templates/
    └── inapp/
        ├── __init__.py
        ├── service.py
        └── templates/
```

Webhook delivery is a notification service concern implemented in
`notification/webhook/service.py`. A channel or format with no
source implementation is not invented as part of a migration; SMS therefore
remains unimplemented until its behavior is specified.

### Rules

1. **Channel/format packages, not modules.** Each implemented channel or format
   owns a package with its `service.py`. Never split a module and a
   sibling `<name>_templates/` directory.
2. **Templates belong to their package.** A mail template lives under
   `notification/mail/templates/`, never under a shared category-level
   `templates/` folder. A service resolves its own templates; there is no global
   template loader.
3. **Public surface via `__init__.py`.** Package `__init__.py` files re-export
   supported public services and relevant public types. Callers
   use `app.services.notification` or `app.services.document`.
4. **Services own orchestration; providers own vendor contracts.** A service
   that uses an external vendor imports that provider adapter from
   `app.providers/` (D-001). Vendor-specific client/configuration/credentials
   do not belong in `services/`.
5. **Service-level protocol.** `services/notification/base.py` defines a
   `NotificationChannel` protocol for implemented notification channels.
6. **No provider artifacts.** Service packages do not contain provider
   `client.py`, `config.py`, or `credentials.py` files.
7. **Fail-closed vendor credentials.** The Node SMTP, FCM, and web-push
   integrations use environment variables rather than an executable database
   credential lookup. Their Python send operations remain disabled until a
   database credential source is explicitly established under D-004; the
   migration does not read or reuse those environment secrets.

## Consequences

### Positive

- `providers/` remains external vendors and `services/` remains app-owned
  capabilities.
- Each implemented channel or format is independently testable and
  template-scoped.
- Supported document formats are PDF, CSV, and XLSX. Their package names are
  `pdf/`, `csv/`, and `xlsx/`.
- Template names and ownership remain unambiguous.

### Negative / Trade-offs

- The package structure has more directories than flat modules.
- Each package's exports must be updated when its public surface changes.
- Some planned channels and document formats may remain absent until their
  behavior is specified and implemented.

## Compliance

- Reject provider folders for PDF/document generation or notification
  orchestration.
- Reject category-level shared notification/document template directories.
- Reject provider client/configuration/credential artifacts inside
  `services/`.
- Unit tests use fakes and do not require live vendor calls.
- Test runs use `python -B -m pytest` (D-003).

## References

- [D-001: Provider Folder Structure & Public Interface](./D-001-provider-folder-structure.md)
- [D-003: Run Pytest With Bytecode Caching Disabled](./D-003-pytest-bytecode-cache.md)
- [D-005: Reusable Internal Modules](./D-005-reusable-internal-modules.md)
- `src/app/providers/base.py` — provider-neutral protocols
- `src/app/services/notification/base.py` — `NotificationChannel` protocol
