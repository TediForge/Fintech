# M-002: Verify Services and Split Database Baselines

- **Status:** Implemented; live db-02 migration pending deployment configuration
- **Scope:** `database.db_01`, `database.db_02`, and Nigerian verification workflows
- **Related:** [M-001 migration gap audit](./M-001-migration-gap-audit.md)

## Database ownership

The application migration scope is `backend/node` to `backend/python` only.
The deprecated PHP application is excluded from migration decisions and
completion criteria.

- `db-01` is the fintech PostgreSQL database. Its baseline is the existing
  `src/database/db_01/schema.sql`.
- `db-02` is the current TediVerify PostgreSQL schema copied from
  `C:/TediForge/Trash/TediVerify/backend/database/schema.sql`. The Node
  PostgreSQL schema is authoritative; the older PHP 25-table inventory in
  M-001 is historical and is not merged into db-02.
- The legacy Node service itself connects to MySQL with `dbHost`, `dbPort`,
  `dbName`, `dbUser`, `dbPassword`, and `dbConnectionLimit` (default 10).
  Its `migrationPgHost`, `migrationPgPort`, `migrationPgDatabase`,
  `migrationPgUser`, `migrationPgPassword`, and `migrationPgSsl` settings
  describe the PostgreSQL target used by db-02.
- Python accepts explicit `TEDIVERIFY_DATABASE_*` settings and the legacy
  `migrationPg*` aliases. The database password is optional, SSL is off unless
  configured, and the connection pool defaults to 10 connections with no
  overflow.

## Versioned baseline files

- `src/database/db_01/migrations/0001_baseline.sql` is an exact snapshot of
  `db_01/schema.sql`.
- `src/database/db_02/migrations/0001_baseline.sql` is an exact snapshot of
  the pruned `db_02/schema.sql` for fresh installations.
- `src/database/db_02/migrations/0002_remove_legacy_portal_and_auth.sql`
  upgrades an existing pre-pruning db-02 baseline. It removes legacy portal,
  client/program, secondary-auth, edit-review, and webhook tables, plus
  client/program identifiers on `complianceUsers`.
- These are baseline-install scripts for empty PostgreSQL databases, not
  idempotent incremental upgrades. Do not execute the baseline against an
  existing database. Migration 0002 is intentionally destructive: take a
  verified backup and confirm the target is db-02 before applying it. No
  migration runner or database credentials are part of this change.

## Legacy verification flows confirmed

| Workflow | Legacy/provider behavior | Python service behavior |
|---|---|---|
| NIN | Supabase first when configured; Accord fallback. JRB tax-ID enrichment can follow successful identity lookup. | Same order, normalized identity, optional JRB enrichment, persisted as `awaitingUser`; provider photo data is stored in `complianceFiles` when inline base64 is supplied. |
| BVN | User-submitted; legacy code marked the value approved without an external BVN verifier. | Validates and stores as `pending` for review rather than treating an unverified claim as provider-verified. Face++ comparison requires a separately supplied verified reference image; the legacy BVN record has none. |
| Address | User submits address and supporting document; record starts pending. | Validates address fields and the four legacy document types, stores the document in `complianceFiles`, and persists a pending record. |
| Business | CAC lookup; legacy submission requires an active registration, entity-type-specific documents, and key persons. | CAC lookup, validates the migrated entity-type rules from `app.data.verify_business_ng`, stores documents/key-person IDs and provider details, and queues review as pending. The public CAC lookup does not guarantee director data. |
| Income | User submits occupation, source, range, currency, and documents; record starts pending. | Persists validated user submissions and evidence as pending. Automated bank-statement verification raises HTTP 501 until a real Mono/Creditchek/etc. adapter is migrated. |

db-02 now contains verification records, verification subjects, evidence files,
and file-link tokens only. Legacy client portal, client API-key/officer,
program, admin, OTP, and client/admin/user session tables are removed;
`complianceUsers.clientId`, `programId`, and `externalUserId` are removed as
well. The fintech application is the sole client, and its user session is the
only application session. db-01 owns user authentication and administrative
workflows, not db-02.

The admin edit-request queue is removed with the legacy portal workflow. The
service persists verification records as pending where review is required;
db-01 must own any future review queue and decision workflow.

`complianceFileLinks` is retained: it stores expiring, hashed file-download
tokens and is not an application session or webhook table. `countryCode` is
also retained as a user profile attribute; verification workflows are organized
by country under `app.services.verify`.

## Data and runtime notes

- Persisted records use the existing TediVerify tables:
  `kycNin`, `kycBvn`, `kycAddress`, `kycBusiness`,
  `kycBusinessDocuments`, `kycBusinessKeyPersons`, `kycIncome`, and
  `complianceFiles`.
- `complianceUsers` remains as the db-02 verification subject table. It retains
  its identity, contact, profile, and KYC identifier fields, but no client or
  program linkage.
- The existing schema does not define a BVN reference-image field, a general
  verification event table, or a director lookup table. Service behavior does
  not invent those columns or fabricate provider results.
- Scheduled bill execution has been discontinued. db-01 migration
  `0002_discontinue_scheduled_bills.sql` removes the legacy `scheduledBills`
  table, and the fresh-install baseline no longer creates it. Immediate bill
  purchases are not affected.
- Every persistence call requires a positive `user_id` and non-empty
  `kyc_identifier` through `VerificationSubject`; connection creation remains
  lazy so importing the application does not require db-02 credentials.
- Document bytes must be base64 encoded (or supplied as bytes), non-empty, and
  no larger than 10 MiB.
- Pre-uploaded file IDs are accepted only when they belong to the same user,
  KYC identifier, and verification record type.

## Validation

- Confirmed baseline source and destination schemas match before treating each
  script as a baseline snapshot.
- Run the Python suite with `PYTHONPATH=src python -B -m pytest`.
- Live PostgreSQL application of either baseline remains unverified until
  deployment supplies the intended database endpoints and credentials.
