# D-009: SMTP/FCM Credentials from Environment

- **Status:** Accepted
- **Scope:** Application-wide SMTP email and FCM push transports
- **Related:** D-001, D-004, D-006

## Context

D-001 keeps vendor credentials in the database. SMTP and FCM are shared
deployment infrastructure rather than per-user provider integrations. A
single relay and Firebase project serve the application, so their credentials
are deployment configuration.

## Decision

SMTP and FCM credentials are read from environment variables as a narrow
exception to D-001. Other provider credentials continue to follow D-001.

- SMTP uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, and
  `SMTP_TIMEOUT_SECONDS`.
- FCM uses `FCM_SERVICE_ACCOUNT_JSON` (a file path or inline JSON) and
  `FCM_PROJECT_ID`.
- Email-outbox polling uses `EMAIL_OUTBOX_INTERVAL_SECONDS`,
  `EMAIL_OUTBOX_BATCH_SIZE`, and `EMAIL_OUTBOX_MAX_ATTEMPTS`.
- Missing required settings fail closed; no delivery is reported as successful.
- The exception applies only to shared application transports. If per-tenant
  mail or push credentials are introduced, revisit this decision and D-001.

## Consequences

Deployments must provide transport credentials before sending mail or push
notifications. `.env.example` lists supported variables without credentials.
