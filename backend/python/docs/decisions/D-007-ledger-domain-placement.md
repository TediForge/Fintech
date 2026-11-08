# D-007: Ledger Domain Placement

- **Status:** Accepted
- **Date:** 2026-11-08
- **Scope:** Ledger operations and transaction metadata rules
- **Related:** D-001 (Provider Folder Structure & Public Interface), D-005 (Reusable Internal Modules), D-006 (Services Packaging)

## Decision

The ledger is a core business domain and lives in
`src/app/services/ledger/`. It is not an external vendor adapter under
`providers/` or a generic technical primitive under `lib/`.

The package exposes its transaction-scoped operations through
`service.py`, with domain types in `models.py` and errors in `exceptions.py`.
Ledger transaction metadata allowlists live in `src/app/data/ledger.json`.
Beneficiary required and identity keys live in `src/app/data/beneficiaries.json`.

Ledger operations use the existing `transactions` and `wallets` tables and
must update both within the same database transaction. Transaction status
changes for settlement, refund, and reversal remain part of the existing
transaction lifecycle; this decision does not claim the current schema is an
append-only ledger.

## Consequences

- Payments and other business services can depend on `app.services.ledger`.
- Ledger operations preserve atomic wallet and transaction updates.
- Transaction metadata and beneficiary key rules are centrally maintained as
  packaged application data.
- Vendor-specific payment integrations remain under `providers/` per D-001.

## References

- `src/app/services/ledger/service.py`
- `src/app/data/ledger.json`
- `src/app/data/beneficiaries.json`
- `src/database/db_01/schema.sql` — `transactions` and `wallets` tables
