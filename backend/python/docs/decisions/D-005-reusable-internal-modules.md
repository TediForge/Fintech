# D-005: Reusable Internal Modules

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** Reusable app-owned technical primitives under `src/app/lib/`

## Context

The application has technical capabilities shared across features, including
database-backed caching and local file persistence. These capabilities are
application code, not command-line tooling. Keeping them in a root `scripts/`
directory would make imports and ownership unclear, while placing cache logic
under `db/` incorrectly couples it to database connection management.

The Node backend already uses an uploader and cache across multiple routes,
workers, and providers. The Python migration should preserve this reuse while
keeping service orchestration and vendor integrations in their established
locations.

## Decision

Reusable, app-owned technical modules live under `src/app/lib/`. In particular:

```text
src/app/lib/
├── cache.py
└── uploader.py
```

`cache.py` owns cache-table operations and uses the database package for
connections. `uploader.py` owns file validation and local file persistence.
Both are imported modules, not command-line entry points.

The root `scripts/` directory is reserved for developer and operations tooling.
External vendor adapters remain under `providers/`, and business orchestration
remains under `services/`.

Each shared module must have one clear responsibility. Avoid generic
`utils.py` collections. Shared helpers ordinarily need at least two real
call sites; direct ports of established, widely used Node capabilities are
also eligible when migrating their existing call sites into Python.

## Consequences

- Reusable capabilities are importable within the `app` package.
- Fintech database access lives in `database/db_01/`; cache behavior is owned
  by `app/lib/cache.py`.
- Uploader and cache concerns remain separate and individually testable.
- Root scripts remain executable development/operations tooling.

## Compliance

- New cache imports use `app.lib.cache`; `database.db_01` does not own or
  re-export cache operations.
- Shared modules must be focused and have a demonstrated reuse case.
- File-upload remote fetches must validate HTTPS, allowlisted hostnames,
  resolved public addresses, redirect destinations, and byte limits.

## References

- [D-001: Provider Folder Structure & Public Interface](./D-001-provider-folder-structure.md)
- [D-002: Migrating Providers into the Python Backend](./D-002-provider-migration.md)
- [D-004: Provider-Owned Credentials](./D-004-provider-owned-credentials.md)
