"""Verify service package.

Owns identity, business, and income verification workflows. Country-specific
services live under ng/ and gh/. Provider adapters remain under
app.providers.kyc per D-001.

Legacy flow findings (C:/TediForge/Trash/TediVerify/backend):
- The live service uses mysql2/promise with dbHost, dbPort, dbName, dbUser,
  dbPassword, and dbConnectionLimit (default 10). Its PostgreSQL connection
  settings are migration targets: migrationPgHost, migrationPgPort,
  migrationPgDatabase, migrationPgUser, migrationPgPassword, and migrationPgSsl.
  db-02 therefore expects that explicitly configured PostgreSQL target; it
  does not connect to the legacy MySQL runtime.
- NIN lookup calls Supabase first when its API key is configured, then falls
  back to Accord if Supabase is unavailable or rejects the request. Successful
  identity data may trigger JRB tax-ID resolution. Results are stored in
  kycNin; images are stored through the shared file records.
- BVN is user-submitted and the legacy marked it approved without an external
  provider; the Python service queues it pending instead. Address and income
  are user-submitted with documents and start pending. Business verification
  looks up the CAC record, requires an active company, validates the legacy
  entity-type document and key-person rules packaged as
  app.data.verify_business_ng, and stores kycBusiness,
  kycBusinessDocuments, and kycBusinessKeyPersons.
- User routes under src/routes/user own verification submissions and records.
  Admin routes own review and administration. Client portal routes under
  src/routes/client/{apiKeys,auth,customers,portal,profile,programs,usage,
  webhooks} and their client accounts, API keys, sessions, webhooks, officers,
  and programs are not verification services; those client-role surfaces are
  excluded for future fintech-owned administration. Shared files, auth, and
  event tables serve multiple flows.
- The current TediVerify PostgreSQL schema under src/database/db_02/schema.sql
  is authoritative for db-02 and defines 22 tables. M-001 §F records the older
  25-table PHP inventory; it is historical context, not the current schema to
  migrate. PHP-only activity and review-history tables are out of scope unless
  explicitly restored in a later migration.
"""

from app.services.verify.base import VerificationSubject

__all__ = ["VerificationSubject"]
