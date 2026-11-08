-- Remove TediVerify portal, client-program, secondary-auth, review-request,
-- and webhook structures. This is intentionally destructive.
--
-- Back up db-02 before applying: data in these tables and removed user columns
-- is permanently discarded. The fintech database (db-01) owns application
-- users, sessions, and administrative workflows.

DROP TABLE IF EXISTS "complianceKycEditRequests" CASCADE;
DROP TABLE IF EXISTS "complianceUserSessions" CASCADE;
DROP TABLE IF EXISTS "complianceWebhookEvents" CASCADE;
DROP TABLE IF EXISTS "complianceClientWebhooks" CASCADE;
DROP TABLE IF EXISTS "complianceAuthOtps" CASCADE;
DROP TABLE IF EXISTS "complianceAdminSessions" CASCADE;
DROP TABLE IF EXISTS "complianceClientSessions" CASCADE;
DROP TABLE IF EXISTS "complianceClientApiKeys" CASCADE;
DROP TABLE IF EXISTS "complianceClientsOfficer" CASCADE;
DROP TABLE IF EXISTS "compliancePrograms" CASCADE;
DROP TABLE IF EXISTS "complianceAdmins" CASCADE;
DROP TABLE IF EXISTS "complianceClients" CASCADE;

ALTER TABLE "complianceUsers"
  DROP COLUMN IF EXISTS "clientId",
  DROP COLUMN IF EXISTS "programId",
  DROP COLUMN IF EXISTS "externalUserId";

CREATE INDEX IF NOT EXISTS "complianceUsers_idx_compliance_users_email"
  ON "complianceUsers" ("email");
