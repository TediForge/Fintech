# TediForge Fintech API

The application package lives under `src/app`. Install the project in
editable mode with `python -m pip install -e .` before running tests or imports.
Install dependencies from `requirements.txt` with
`python -m pip install -r requirements.txt`.

Provider ports follow
[D-001](./docs/decisions/D-001-provider-folder-structure.md) and
[D-002](./docs/decisions/D-002-provider-migration.md). Each provider has
`__init__.py`, `client.py`, `config.py`, and its own `credentials.py` as
required by [D-004](./docs/decisions/D-004-provider-owned-credentials.md).
Provider operations live in one `client.py` and are exported at package level.

Provider credentials are database-managed and loaded by provider-owned
credential modules; do not replace these with shared credential loaders or
environment variables. Face++ and payment providers follow the same rule as
Groq, Fafotech, and football-data.org. Configure database access with
`DATABASE_URL` or the database connection settings. The fintech schema is
packaged at `src/database/db_01/schema.sql`.

The TediVerify database is isolated as `database.db_02`; configure its
PostgreSQL connection with `TEDIVERIFY_DATABASE_HOST`,
`TEDIVERIFY_DATABASE_PORT`, `TEDIVERIFY_DATABASE_NAME`,
`TEDIVERIFY_DATABASE_USER`, `TEDIVERIFY_DATABASE_PASSWORD`, and
`TEDIVERIFY_DATABASE_SSL`. The legacy `migrationPg*` setting names are also
accepted. The legacy service itself runs against MySQL; db-02 uses the
PostgreSQL target from its migration configuration, not that MySQL runtime.
Versioned baseline snapshots and the migration notes are under
`src/database/db_01/migrations/`, `src/database/db_02/migrations/`, and
[`M-002`](./docs/migrations/M-002-verify-database-migration.md). Baseline
scripts are for empty databases only; the project does not yet include a
migration runner.

The payments package includes Flutterwave, Safe Haven, Sudo Africa, Remita,
Nomba, and NIBSS. Nomba and NIBSS remain explicitly unimplemented because the
Node sources do not define executable provider operations or credential
lookups; their adapters fail closed instead of inventing a contract.
Reloadly gift cards are under `app.providers.goods.reloadly`; Reloadly airtime
and utility operations remain fail-closed because their Node implementations
are specification-only.
Flutterwave virtual-account operations require the caller to supply an
`approved_identity_number`; the separate TediVerify integration is not part
of this provider migration and must not be bypassed.

Reusable application primitives live under `src/app/lib/` per
[D-005](./docs/decisions/D-005-reusable-internal-modules.md). Document and
notification capabilities belong under `src/app/services/` per
[D-006](./docs/decisions/D-006-services-packaging.md). The bills API folders
currently contain inert route documentation only; handlers are intentionally
not implemented or mounted yet.

Static application datasets migrated from the Node backend are packaged under
`src/app/data/`: `countries.json`, `giftcard.json`, and `verify.json`.

Run tests with bytecode writing disabled, as required by
[D-003](./docs/decisions/D-003-pytest-bytecode-cache.md):

```bash
python -B -m pytest
```
