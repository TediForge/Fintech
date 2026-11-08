# D-004: Provider-Owned Credentials

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** All providers under `src/app/providers/`

## Context

Provider integrations store credentials in different database tables and
columns, and even rows in the same table can have different filters,
environment rules, or ordering. A generic/shared credential loader would
either assume a common schema or require provider-specific branching in one
module, obscuring the source-of-truth query and increasing the risk of using
the wrong key, secret, encryption key, webhook hash, or environment.

## Decision

Every provider MUST own a `credentials.py` file in addition to the three
canonical files required by D-001:

```text
<category>/<provider>/
├── __init__.py
├── client.py
├── config.py
└── credentials.py
```

The provider's `credentials.py` is the only provider module that queries the
database for that provider's credentials. It must:

1. Match the Node source's exact table, columns, filters, ordering, and
   environment/tenant lookup behavior.
2. Return an immutable typed credentials object and raise a provider-specific
   error when required credentials are absent or incomplete.
3. Never log or include credential values in error messages.
4. Remain provider-owned; do not centralize credential queries across
   providers, even when some currently use the same table.

The provider `client.py` accepts credentials via its constructor and does not
query the database for credentials. A package-level factory or dependency may
load that provider's credentials and inject them. Public imports remain gated
through the provider's `__init__.py`. If the source provider has no executable
credential lookup, `credentials.py` must document that fact and fail closed
rather than inventing a schema or API contract.

## Verified source mappings

| Provider | Node credential source |
|----------|------------------------|
| Groq | `apiKeys.apiKey`; `service='groq'`, active, ordered by `id` ascending. Load all matching keys for key rotation. |
| Fafotech | `apiKeys.apiKey`; `service='fafotech'`, active, ordered by `id` ascending; use the first matching key. |
| Football-data.org | `apiKeys.apiKey`; `service='footballData'`, active, ordered by `id` ascending; use the first matching key. |
| Face++ | `apiKeys.apiKey`, `secretKey`; `service='facepp'`, active, both fields non-null/non-empty, production first then `id` ascending; use the first matching row. |
| Reloadly gift cards | `apiKeys.apiKey`, `secretKey`; `service='reloadly'`, environment `production` for live or `sandbox` for test, active, `LIMIT 1` without additional ordering. |
| Flutterwave | `apiKeys`: `apiKey`, `secretKey`, `encryptionKey`, `webhookHash`; `service='flutterwave'`, active, environment `production` for live or `test` for test. |
| Safe Haven | `safeHavenConfig`: client ID, key path, URLs and account/callback fields filtered by environment, latest `id`; plus latest `safeHavenCompanyProfile` (`rcNumber`, `identityId`). |
| Sudo Africa | `apiKeys.apiKey`; `service='sudo-africa'`, `credentialType='unified'`, `environment='production'`, active. This lookup is the same for live and test mode. |
| Remita | `apiKeys`: `apiKey`, `secretKey`, `encryptionKey`; `service='remita'`, active, environment `production` for LIVE or `test` for TEST. |
| Nomba | No executable credential lookup exists in the Node provider. Its `credentials.py` documents this and fails closed. |
| NIBSS | No executable credential lookup exists in the Node provider. Its `credentials.py` documents this and fails closed. |

These mappings are evidence from the source at the time of this decision.
Update this table and the owning provider loader if a later Node source
revision changes the lookup.

## Consequences

- Credential schema differences remain local and easy to audit for every
  provider category, not just payments.
- API clients can be tested with injected credentials without a database.
- The canonical D-001 files remain required; `credentials.py` is the
  provider-wide credential module.
- Providers without an executable Node contract stay fail-closed until a
  separate implementation decision establishes their schema and operations.

## Compliance

Code review MUST verify each credential query against its source, ensure the
client itself does not query the database for credentials, and reject shared
credential loaders or environment-variable credentials for database-managed
keys.
