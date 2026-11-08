# M-001: Node-to-Python Migration Gap Audit

- **Date:** 2026-11-08
- **Auditor:** AI assistant using Copilot SDK in VS Code
- **Node source commit:** Unavailable — `backend/node` is not a Git worktree.
- **Python source commit:** Unavailable — `backend/python` is not a Git worktree.
- **Scope:** Migrate active capabilities from `backend/node` to
  `backend/python`. The deprecated PHP application is excluded from scope,
  inventory, and migration-completion criteria. Do not relocate `backend/node`
  until every in-scope gap is implemented and verified.
- **Governing decisions reviewed:** D-001, D-003, D-004, D-005, D-006, D-007,
  D-008.
- **Audit limits:** Git status/log could not be collected because the Node and
  Python source directories have no Git metadata. Generated `__pycache__` and
  `.pyc` entries are excluded from source inventories.

The inventory uses recursive path patterns (for example, `routes/user/**`) to
group files by responsibility. It covers the Node application and the Python
implementation; the deprecated PHP tree is not consulted.

## §A — Node inventory

| Path (relative to `node/src`) | Type | Responsibility | Providers | DB tables | Surface |
|---|---|---|---|---|---|
| `server.ts` | config/entry point | Configures Express, middleware, mounts route trees, starts workers, handles shutdown. | All mounted services | — | `/health`; mounts listed below |
| `config/**` | config | PostgreSQL pool and database row/result types. | PostgreSQL | — | — |
| `middleware/**` | middleware | JWT authentication/authorization and system maintenance gate. | — | `users`, `admins`, `knownDevices`, `adminKnownDevices`, `authRefreshTokens`, `systemSettings` | Applied at protected routers / globally |
| `routes/admin/**` | routes | Admin login/refresh/logout, profile/devices/permissions/settings and workspace operations for customers, transactions, gift cards, feedback, help and referrals. | SMTP, upload, internal libraries | `admins`, `adminSessions`, `authRefreshTokens`, `adminKnownDevices`, `adminCustomerRestrictions`, `transactions`, `giftCardSubmissions`, `featureSuggestions`, support/help and referral tables | `/admin/**` |
| `routes/client/**` | routes | Public client metadata and country lookups. | — | `clientMetadata` where applicable | `/client/metadata/**`, `/client/countries/**` |
| `routes/user/**` | routes | User authentication and verification; account/profile/settings, devices, beneficiaries, compliance/KYC, help/chat, feedback, campaigns, referrals, rewards, subscriptions and wallets/transfers. | TediVerify, Face++, SMTP/FCM/web-push, upload | `users`, auth/session/device, KYC, help/chat, notification, wallet, referral and campaign tables | `/user/**` |
| `routes/v1/accounts/**`, `routes/v1/checkout/**`, `routes/v1/remita/**`, `routes/v1/invoices/**` | routes | Account/checkout/payment initialization, Remita RRR operations and invoice operations. | Flutterwave, Safe Haven, Remita, Sudo Africa, Nomba | `users`, `transactions`, `wallets`, `virtualAccounts`, `userProviderAccounts`, `invoices`, `remitaPayments` | `/v1/accounts/**`, `/v1/checkout/**`, `/v1/remita/**`, `/v1/invoices/**` |
| `routes/v1/banking/**` | routes | Transfers, transaction limits and spend-and-save configuration/operations. | Safe Haven, Sudo Africa | `wallets`, `transactions`, `beneficiaries`, `spendAndSaveSettings`, provider config | `/v1/banking/**` |
| `routes/v1/bills/**` | routes | Validates, initializes and fetches airtime, data, electricity and cable transactions. Scheduled bills are discontinued; VTU Africa is deprecated. | Fafotech | `transactions`, `wallets`, `dataPlans`, `beneficiaries`, `serviceStats` | `/v1/bills/**` |
| `routes/v1/giftcards/**` | routes | Gift-card purchase and sale workflows. | Reloadly | `transactions`, `wallets`, `giftCardSubmissions`, `giftCardPurchaseRequests` | `/v1/giftcards/**` |
| `routes/v1/flights/**`, `routes/v1/stats/**`, `routes/v1/transactions/**` | routes | Flight placeholder, service statistics, transaction history/analysis/leaderboard/details/statements. | Sports/statistics and statement rendering as applicable | `transactions`, `users`, `weeklyLeaderboard`, `serviceStats` | `/v1/flights/**`, `/v1/stats/**`, `/v1/transactions/**`, `/v1/transaction/statement` |
| `routes/v1/webhooks/**` | routes | Receives and dispatches inbound vendor, USSD and TediVerify callbacks. | Fafotech, Flutterwave, Nomba, Remita, Safe Haven, Sudo Africa, TediVerify | `transactions`, `complianceWebhookReceipts`, `userProviderAccounts` and vendor-specific records | `/v1/webhooks/**` |
| `providers/**` | provider adapters | Provider implementations and sub-operations (all 113 files), including `facepp`, `fafotech`, `flutterwave`, `groq`, `nibss`, `nomba`, `reloadly`, `remita`, `safeHaven`, `sports`, `sudoAfrica`, `tediVerify`, `tediwave`, `telco`, and deprecated `vtuAfrica`. `specs/**` files document provider contracts. | Named vendor packages | Provider-owned credential tables, chiefly `apiKeys`, `safeHavenConfig`, `safeHavenCompanyProfile` | Imported by routes, libraries and workers |
| `services/ledger/**` | service | Owns transaction-scoped ledger operations. | — | `transactions`, `wallets` | Internal |
| `lib/**` | lib | Shared account/auth/activity, beneficiary, bills, cache, chat, email, gift-card, invoice, limits, logging, notification, referral, savings, security, statement, statistics, settings, transfer, uploader, wallet and webhook helpers (56 files). | Payment/bill vendors, SMTP/FCM/web-push as used | Tables associated with each helper; includes `cookies`, `emailOutbox`, `userWebhooks` | Internal |
| `tools/**` | service/integration | Notification mailer and push transport implementations, including SMTP, FCM and web-push. | SMTP, Firebase Cloud Messaging, Web Push | `emailOutbox`, `pushTokens`, `userSettings` | Internal |
| `workers/**` | worker/cron | Starts recurring earnings, birthday and TediBloom jobs and shared interval/locking helpers. Scheduled-bill execution has been discontinued. | SMTP/push, Groq, calendar/sports | `users`, `userSettings`, cache table | Interval timers started by `server.ts`; see §F |
| `data/**` | data | Country, gift-card and TediVerify static lookup data (5 files). | — | — | Internal |
| `scripts/**` | script | Runs SQL migration tooling. | PostgreSQL/SSH | Schema/migration target | CLI |
| `tests/**` | tests | Exercises auth, admin permissions, providers, Remita, leaderboards, webhooks and TediVerify registration (8 files). | Fakes | Test fixtures | Test runner |
| `types/**` | types | Express and PDF type declarations. | — | — | Compile-time |

Node source inventory counts by top-level area: `config` 2, `data` 5, `lib`
56, `middleware` 2, `providers` 113, `routes` 93, `scripts` 1, `services` 1,
`tests` 8, `tools` 9, `types` 2, `workers` 6, and `server.ts` 1.

## §B — Excluded PHP application

The deprecated PHP application is not a migration source. Older PHP-only
findings retained elsewhere in this historical report are informational only;
they are not migration requirements, blockers, or completion criteria.

## §C — Python inventory

| Path (relative to `python/src/app`) | Layer | Responsibility | External dependencies / data |
|---|---|---|---|
| `main.py`, `config.py`, `core.py`, `exceptions.py`, `__init__.py` | app/config | Creates FastAPI application, registers middleware and routers, and defines centralized settings/core errors. | FastAPI, Pydantic settings, SQLAlchemy |
| `api/**` | api | User routes for beneficiaries, campaigns, compliance, devices, feedback, help/chat, KYC, notifications, profile, referrals, rewards, settings, subscriptions, tiers and wallets; v1 bills, client countries, flights, stats and transactions. | Internal services/providers and DB tables used by each route |
| `providers/**` | providers | External adapters for Groq, Fafotech, Face++, Calendarific, Reloadly, Flutterwave, NIBSS, Nomba, Remita, Safe Haven, Sudo, Football Data, and Nigerian CAC/Accord/Supabase/JRB KYC. Several category/provider directories are empty and are not capabilities. | External APIs; provider-owned credential loaders |
| `services/**` | services | Invoice lifecycle, ledger, PDF document generation, and mail/in-app/push/webhook notification services. SMTP and FCM transports are configured through environment settings. | `transactions`, `wallets`, notification/outbox tables, package templates |
| `middleware/**` (3 files) | middleware | JWT/account/session/device validation and maintenance-mode enforcement. | `users`, `admins`, `knownDevices`, `adminKnownDevices`, `authRefreshTokens`, `systemSettings` |
| `workers/**` | workers | Runs earnings, birthday, TediBloom and email-outbox tasks with shared advisory-lock/interval logic. Scheduled-bill execution is discontinued. | DB, notification services, Groq, calendar/sports, cache |
| `lib/**` (8 files) | lib | Cache, uploader, beneficiary, limits, referrals, statistics and wallet primitives. | DB and internal services |
| `db/**` (4 files) | db | Database connection, repositories and shared query helpers. | SQLAlchemy/PostgreSQL |
| `models/**` (1 file) | models | Package initialization only; no ORM model set was found. | — |
| `data/**` (8 files) | data | Beneficiary/ledger rules and country, category, gift-card, task and verification lookups. | Packaged JSON |
| `scripts/**`, `tools/**`, `routes/**`, `types/**` | tooling/types | Supporting scripts, utilities/types and legacy routing namespace; these do not add equivalents for the missing API/worker surfaces below. | Internal |

Python database ownership and versioned baselines/migrations are split between
`src/database/db_01/` and `src/database/db_02/`; see M-002.

## §D — Coverage matrix

Paths are relative to each backend root. A `**` path covers the files inventoried
in §A/§B.

| Legacy capability | Legacy path(s) | Python path | Status | Necessity | Gap ref |
|---|---|---|---|---|---|
| HTTP entry point and health check | `node/src/server.ts` | `python/src/app/main.py` | PARTIAL | HIGH | §E.1 |
| Process-wide configuration and middleware | `node/src/config/**`, `node/src/middleware/**`, `node/src/server.ts` | `python/src/app/config.py`, `python/src/app/middleware/**`, `python/src/app/main.py` | PARTIAL | HIGH | §E.20 |
| JWT auth, login/refresh/logout and verification | `node/src/middleware/**`, `node/src/routes/user/auth/**`, `node/src/lib/auth/**` | `python/src/app/middleware/authentication.py`; no user auth routes | PARTIAL | BLOCKER | §E.2 |
| Admin API and permissions | `node/src/routes/admin/**`, `node/src/lib/adminPermissions.ts` | No Python admin routes | MISSING | HIGH | §E.3 |
| Client metadata/countries | `node/src/routes/client/**`, `node/src/data/**` | `python/src/app/api/client/countries/routes.py`; separate metadata parity unverified | PARTIAL | MEDIUM | §E.4 |
| User profile, devices, settings, tiers, feedback, campaigns, rewards, referrals, beneficiaries, help and chat | `node/src/routes/user/**` | `python/src/app/api/user/**`, `python/src/app/lib/**` | PARTIAL | HIGH | §E.5 |
| KYC status/create and compliance record/review lifecycle | `node/src/routes/user/kyc/**`, `node/src/providers/tediVerify/**` | `python/src/app/api/user/kyc/routes.py`, `python/src/app/providers/kyc/ng/**`; no Python compliance storage or active KYC create | PARTIAL | BLOCKER | §E.6 |
| Wallet transfers, limits, spend-and-save, account and checkout flows | `node/src/routes/v1/banking/**`, `node/src/routes/v1/accounts/**`, `node/src/routes/v1/checkout/**` | No matching Python API/service routes | MISSING | BLOCKER | §E.7 |
| Bill purchases, validation and catalog | `node/src/routes/v1/bills/**`, `node/src/providers/fafotech/**` | `python/src/app/api/v1/bills/ng/**`, `python/src/app/providers/bills/ng/fafotech/**` | PARTIAL | BLOCKER | §E.8 |
| Gift-card purchase/sale, invoice and Remita operations | `node/src/routes/v1/giftcards/**`, `node/src/routes/v1/invoices/**`, `node/src/routes/v1/remita/**`, provider folders | Python Reloadly/Remita providers and static `giftcard.json`; no matching transaction API workflows | PARTIAL | HIGH | §E.9 |
| Transaction history, analysis, leaderboard, detail and statement export | `node/src/routes/v1/transactions/**`, `node/src/lib/statement/**` | `python/src/app/api/v1/transactions/routes.py` | PARTIAL | HIGH | §E.10 |
| Inbound payment/KYC/bill/USSD webhooks | `node/src/routes/v1/webhooks/**` | No equivalent inbound vendor webhook routes; Python subscription notification webhook routes manage user registrations | MISSING | BLOCKER | §E.11 |
| Provider adapters: Flutterwave, Safe Haven, Sudo, Nomba, Remita, NIBSS, Reloadly, Fafotech, Face++, Groq, Calendarific and football | `node/src/providers/<vendor>/**` | Corresponding `python/src/app/providers/**` packages | PARTIAL | HIGH | §E.19 |
| Public Nigerian KYC providers | `node/src/providers/tediVerify/**` | `python/src/app/providers/kyc/ng/{nin,business,tax}/**` | PARTIAL | HIGH | §E.6 |
| VTU Africa provider operations | `node/src/providers/vtuAfrica/**` | Intentionally excluded; VTU Africa is deprecated | DEPRECATED | — | — |
| TediVerify vendor operations | `node/src/providers/tediVerify/**` | No equivalent Python provider package for all operations | PARTIAL | HIGH | §E.12 |
| Direct telco adapters | `node/src/providers/telco/**` | Empty `python/src/app/providers/telco/` namespace | NEEDS-OWNER-INPUT | HIGH* | §E.12 |
| Shared cache and file uploader | `node/src/lib/{cache,uploader}/**` | `python/src/app/lib/{cache.py,uploader.py}` | PARTIAL | MEDIUM | §E.19 |
| Ledger/wallet transaction primitives | `node/src/services/ledger/**` | `python/src/app/services/ledger/**` | PARTIAL | HIGH | §E.19 |
| Scheduled earnings, birthday and TediBloom workers | `node/src/workers/{earnings,birthdays,tediBloom}.ts` | `python/src/app/workers/cron/{earnings,birthdays,tedibloom}.py` | PARTIAL | HIGH | §E.13 |
| Scheduled-bill worker | `node/src/workers/scheduledBills.ts` | Intentionally discontinued; no Python worker or schedule table | DISCONTINUED | — | §E.8 |
| Email outbox queue and delivery worker | `node/src/lib/email/outbox.ts`, `node/src/tools/notification/mailer/**` | Python mail renderer/service and statement enqueue path; no outbox consumer | PARTIAL | HIGH | §E.14 |
| Flight route behavior | `node/src/routes/v1/flights/index.ts` | `python/src/app/api/v1/flights/routes.py` | MIGRATED | — | — |
| Service statistics | `node/src/routes/v1/stats/index.ts` | `python/src/app/api/v1/stats/routes.py` | PARTIAL | MEDIUM | §E.5 |
| Client-visible error response contracts | `node/src/server.ts`, `node/src/routes/**` | `python/src/app/main.py`, `python/src/app/api/**` | DIFFERENT | HIGH | §E.21 |
| Node provider specs, tests, and scripts | `node/src/providers/**/specs/**`, `node/src/tests/**`, `node/src/scripts/**` | Python provider tests and project scripts | PARTIAL | MEDIUM | §E.19 |

## §E — Gap details

### §E.1 — Runtime surface and health check

- **Legacy:** `node/src/server.ts`
- **Python:** `python/src/app/main.py`
- **What's missing/different:** Node exposes `GET /health`. The inspected Python
  app mounts `/v1` and `/user/**` routers but has no matching health route.
  Operational probes and deployment checks expecting the Node path will not
  receive the same response.
- **Impact:** Load balancers, orchestrators and uptime checks.
- **Necessity:** HIGH
- **Recommended action:** extend
- **Owner:** UNASSIGNED

### §E.2 — User authentication lifecycle

- **Legacy:** `node/src/routes/user/auth/**`, `node/src/lib/auth/**`,
  `node/src/middleware/authenticateJwt.ts`.
- **Python:** `python/src/app/middleware/authentication.py`,
  `python/src/app/api/deps.py` (route dependency); no Python login, registration,
  refresh, logout, OTP, PIN, password-reset or face-verification route set.
- **What's missing/different:** Python validates presented JWTs and consults
  users/devices/refresh-session state, but it does not issue or refresh those
  sessions or implement the Node user auth/verification endpoints. Authentication
  middleware alone is not a replacement for the public account lifecycle.
- **Impact:** User onboarding/login, token renewal, password/PIN/OTP recovery,
  device enrollment and all authenticated clients.
- **Necessity:** BLOCKER
- **Recommended action:** migrate
- **Owner:** UNASSIGNED

### §E.3 — Admin API

- **Legacy:** `node/src/routes/admin/**` (including auth, profile, devices,
  permissions, system settings and workspace routes).
- **Python:** No admin route implementation under `python/src/app/api/admin/`.
- **What's missing/different:** Admin operations and per-operation permission
  checks present in Node have no Python HTTP equivalent. Python auth can
  recognize an admin role, but that does not provide admin endpoints or
  authorization policies for them.
- **Impact:** Support and operations teams cannot manage customers,
  transactions, campaigns, feedback, gift-card reviews, help content, referrals,
  permissions or maintenance settings from Python.
- **Necessity:** HIGH
- **Recommended action:** migrate
- **Owner:** UNASSIGNED

### §E.4 — Client metadata and countries

- **Legacy:** `node/src/routes/client/**`, `node/src/data/auth/countries.json`,
  `node/src/data/tediverify/**`.
- **Python:** `python/src/app/api/client/countries/routes.py` is mounted in the
  v1 router and serves the packaged country list. Client metadata parity is
  still unverified.
- **What's missing/different:** The countries endpoint is implemented; compare
  its response contract and migrate any distinct client-metadata behavior.
- **Impact:** Mobile/web clients that load supported countries or metadata
  through the backend.
- **Necessity:** MEDIUM
- **Recommended action:** extend
- **Owner:** UNASSIGNED

### §E.5 — Partial user API parity

- **Legacy:** `node/src/routes/user/**` excluding auth/KYC covered above.
- **Python:** `python/src/app/api/user/**`.
- **What's missing/different:** Python has handlers for many user areas, but
  route presence does not establish parity for the full Node contracts. The
  inspected Python inventory has only read-oriented beneficiary routes, limited
  profile/compliance/settings/device flows, and separate help subpackages; the
  Node surface also includes activity and broader management operations. A
  route-by-route response/method compatibility pass is still required before
  switching clients.
- **Impact:** Existing clients of beneficiary writes, activity, profile/device
  management, campaign/referral operations, support chat and notification
  preferences may observe missing methods or different payloads.
- **Necessity:** HIGH
- **Recommended action:** extend
- **Owner:** UNASSIGNED

### §E.6 — KYC provider wiring and compliance lifecycle

- **Legacy:** `node/src/routes/user/kyc/**`,
  `node/src/providers/tediVerify/**`.
- **Python:** `python/src/app/api/user/kyc/routes.py`,
  `python/src/app/providers/kyc/ng/nin/{accord,supabase}/**`,
  `python/src/app/providers/kyc/ng/business/cac/**`,
  `python/src/app/providers/kyc/ng/tax/jrb/**`.
- **What's missing/different:** The provider adapters do not make the user KYC
  route operational: Python's create-session route returns 503. There is no
  TediVerify adapter equivalent, no Python persistence/review/document workflow
  for NIN, BVN, address, business documents/key persons, and no compliance
  client/admin session API. The Supabase credential is
  provider-specific and must be reconciled with D-001/D-004 configuration rules.
- **Impact:** User verification and account-tier progression, compliance staff
  review, file evidence, business KYC and compliance-client integrations.
- **Necessity:** BLOCKER
- **Recommended action:** migrate and escalate the credential/schema contract
- **Owner:** UNASSIGNED

### §E.7 — Banking, account and payment flows

- **Legacy:** `node/src/routes/v1/{accounts,banking,checkout,remita,invoices}/**`
  and their payment provider adapters.
- **Python:** Related provider folders exist, but no corresponding
  `python/src/app/api/v1/accounts/`, `banking/`, `checkout/`, `remita/` or
  `invoices/` route/service implementation was found.
- **What's missing/different:** Provider clients cannot replace the Node
  account-opening, transfer, limits, spend-and-save, checkout/payment
  initialization, Remita RRR or invoice APIs without the orchestration,
  ledger/wallet updates, idempotency and response contracts that currently live
  in Node routes.
- **Impact:** Deposits, transfers, account provisioning, checkout and invoice
  collection.
- **Necessity:** BLOCKER
- **Recommended action:** migrate
- **Owner:** UNASSIGNED

### §E.8 — Bill purchases and scheduled-bill execution

- **Legacy:** `node/src/routes/v1/bills/**`, `node/src/providers/fafotech/**`.
  VTU Africa is explicitly deprecated and is not a migration target.
- **Scope decision:** Scheduled bill creation and execution are discontinued.
  Do not migrate the scheduler, `scheduledBills` table, or its worker. Migration
  `db_01/migrations/0002_discontinue_scheduled_bills.sql` removes the legacy
  table from existing databases; the db-01 baseline no longer creates it.
- **Python:** `python/src/app/api/v1/bills/ng/{airtime,data,cable,electricity}/routes.py`,
  `python/src/app/providers/bills/ng/fafotech/**`; no scheduled-bill worker.
- **What's missing/different:** Airtime and data purchases use Fafotech.
  Cable and electricity endpoints return HTTP 503 until Fafotech plan pricing
  and DISCO service-code mappings are configured; no VTU Africa catalog,
  pricing, or adapter is used as a fallback. Scheduled billing is out of scope
  and discontinued.
- **Impact:** Airtime/data/cable/electricity purchase, validation, catalog,
  wallet/ledger settlement. Due scheduled payments are not supported.
- **Necessity:** BLOCKER
- **Recommended action:** configure and verify the Fafotech cable catalog and
  electricity DISCO mappings before enabling those routes.
- **Owner:** bills/provider owner

### §E.9 — Gift cards, invoices and Remita API workflows

- **Legacy:** `node/src/routes/v1/giftcards/**`,
  `node/src/routes/v1/invoices/**`, `node/src/routes/v1/remita/**`.
- **Python:** `python/src/app/providers/goods/reloadly/**`,
  `python/src/app/providers/payments/remita/**`,
  `python/src/app/services/invoice/**`, and `python/src/app/data/giftcard.json`.
- **What's missing/different:** The invoice service is implemented against
  db-01; gift-card purchase/sale orchestration, customer review-state
  transitions, invoice API routes and Remita API endpoints remain missing.
- **Impact:** Gift-card purchase/redemption, Remita payment status and invoice
  consumers.
- **Necessity:** HIGH
- **Recommended action:** migrate
- **Owner:** UNASSIGNED

### §E.10 — Statement delivery contract

- **Legacy:** `node/src/routes/v1/transactions/**`,
  `node/src/lib/statement/{pdf,export}.ts`,
  `node/src/lib/email/outbox.ts`.
- **Python:** `python/src/app/api/v1/transactions/routes.py`,
  `python/src/app/services/document/pdf/**`,
  `python/src/app/services/notification/mail/service.py`,
  `python/src/app/workers/tasks/email/outbox.py`.
- **What's missing/different:** Python implements transaction views and
  statement generation/download, plus an email-outbox task and SMTP transport.
  Verify worker scheduling, retries and end-to-end delivery. Confirm CSV/XLSX/PDF
  format parity against the Node export contract.
- **Impact:** Statement requests, password/recovery or other mail work using
  the outbox, and user notification of delivery.
- **Necessity:** HIGH
- **Recommended action:** extend
- **Owner:** UNASSIGNED

### §E.11 — Inbound webhooks

- **Legacy:** `node/src/routes/v1/webhooks/**`.
- **Python:** `python/src/app/api/user/subscription/notification/routes.py`
  manages user push/webhook subscriptions; no inbound provider callback
  endpoints were found.
- **What's missing/different:** Provider callback verification and transaction
  settlement are distinct from a user's outbound webhook registration. Python
  has no equivalent inbound routes for Flutterwave, Remita, Nomba, Safe Haven,
  Sudo, Fafotech, TediVerify or USSD callback operations.
- **Impact:** Asynchronous payment/bill status updates, compliance
  progression, reconciliation and USSD flows.
- **Necessity:** BLOCKER
- **Recommended action:** migrate
- **Owner:** UNASSIGNED

### §E.12 — Provider coverage outside the Python package set

- **Legacy:** `node/src/providers/{telco,tediVerify,tediwave}/**`.
- **Python:** `python/src/app/providers/**`; `providers/telco` has no adapter
  implementation; TediVerify operation parity remains incomplete.
- **What's missing/different:** The bill and KYC route dependencies cannot call
  all Node provider operations from Python. VTU Africa is deprecated and
  explicitly excluded. The direct telco modules do not have an evidenced
  active Python call site; whether they are still needed should be confirmed
  rather than assumed.
- **Impact:** TediVerify KYC operation parity and any required direct carrier
  integrations.
- **Necessity:** HIGH for TediVerify; unconfirmed for direct telco.
- **Recommended action:** migrate required providers; escalate unused-provider
  status
- **Owner:** UNASSIGNED

### §E.13 — Background execution parity

- **Legacy:** `node/src/workers/{earnings,birthdays,scheduledBills,tediBloom}.ts`,
  `node/src/workers/index.ts`.
- **Python:** `python/src/app/workers/cron/{earnings,birthdays,tedibloom}.py`,
  `python/src/app/workers/__main__.py`, and the email task package.
- **What's missing/different:** Earnings, birthdays and TediBloom have Python
  cron implementations; scheduled bills are discontinued. Worker startup is
  a separate Python entry point, so deployment must run it as well as the API.
- **Impact:** Scheduled jobs if only the API process is deployed.
- **Necessity:** HIGH for worker deployment parity.
- **Recommended action:** extend and confirm deployment wiring
- **Owner:** UNASSIGNED

### §E.14 — Email/push notification delivery

- **Legacy:** `node/src/tools/notification/**`,
  `node/src/lib/email/outbox.ts`.
- **Python:** `python/src/app/services/notification/{mail,push,webhook}/**`;
  `python/src/app/workers/tasks/email/outbox.py`.
- **What's missing/different:** Python now has SMTP and FCM transports and an
  email-outbox task. Web-push parity and production credential provisioning
  remain to be verified; test actual worker scheduling, retry and delivery
  behavior before cutover.
- **Impact:** Password/onboarding/statement mail, push notifications, birthday
  and TediBloom jobs, webhook deliveries.
- **Necessity:** HIGH
- **Recommended action:** verify delivery and complete any remaining channel
  parity
- **Owner:** UNASSIGNED

### §E.15 — Excluded PHP-only VTU Africa betting bridge

Out of scope: this PHP-only endpoint has no Node successor and is not part of
the Node-to-Python migration.

### §E.16 — Excluded PHP-only compliance portal and KYC persistence

Out of scope: these PHP-only routes and runtime-created tables are excluded.
Node-to-Python KYC migration status is tracked in §E.6.

### §E.17 — Excluded PHP onboarding welcome-email reservation

Out of scope: this PHP-only behavior has no Node successor and is not part of
the Node-to-Python migration.

### §E.18 — Excluded PHP sandbox verification probes

Out of scope: these PHP-only test probes are not part of the Node-to-Python
migration.

### §E.19 — Provider/spec/test and route-contract verification

- **Legacy:** `node/src/providers/**/specs/**`, `node/src/tests/**`.
- **Python:** `python/tests/**`, provider package contracts under
  `python/src/app/providers/**`.
- **What's missing/different:** Python has tests and provider contracts, but
  the inventory does not establish migrated behavioral coverage for every Node
  provider sub-operation, shared cache/uploader edge case, ledger invariant,
  callback compatibility fixture, and route response. Do not treat package
  presence as proof of feature parity.
- **Impact:** Regression risk in payment, webhook and user-facing response
  behavior.
- **Necessity:** MEDIUM
- **Recommended action:** extend contract tests as each route/provider is
  migrated
- **Owner:** UNASSIGNED

### §E.20 — Process-wide config and request middleware

- **Legacy:** `node/src/config/**`, `node/src/middleware/**`,
  `node/src/server.ts`, `node/src/lib/logger/**`.
- **Python:** `python/src/app/config.py`, `python/src/app/middleware/**`,
  `python/src/app/main.py`.
- **What's missing/different:** Python has DB/JWT settings and auth/maintenance
  gates, but not Node's process-wide request logger or the same JSON parser
  ordering/body-size and raw-body webhook setup. Node also exposes operational
  settings for SMTP, FCM/web-push, upload host allowlists, TediVerify, transfers
  and logging which are not represented in centralized Python settings. This
  changes request observability, upload/provider readiness and webhook
  signature inputs.
- **Impact:** Every HTTP request, webhook verification, upload and integrations
  relying on those runtime settings.
- **Necessity:** HIGH
- **Recommended action:** extend; define each setting as part of the relevant
  service/provider migration
- **Owner:** UNASSIGNED

### §E.21 — Client-visible error responses

- **Legacy:** `node/src/server.ts`, `node/src/routes/**`.
- **Python:** `python/src/app/main.py`, `python/src/app/api/**`,
  `python/src/app/middleware/**`.
- **What's missing/different:** Node's final Express error handler returns
  HTTP 500 with a `success/message` body, while route-level errors often return
  `status/error/message`. Python has no matching global error handler and
  FastAPI `HTTPException` responses use `detail` by default. These are
  observable client contract differences, not just internal implementation
  details.
- **Impact:** Clients that branch on HTTP status and JSON fields for validation,
  unavailable-provider, and unexpected-error cases.
- **Necessity:** HIGH
- **Recommended action:** decide and implement a compatibility error contract
- **Owner:** UNASSIGNED

## §F — Cross-cutting findings

### Middleware

- **Finding:** Node globally logs requests, parses JSON (with a larger face
  verification body limit), mounts raw-body webhook middleware before general
  parsers, and applies maintenance checks. Python has JWT and maintenance
  middleware but no equivalent global request logger/body-parser/webhook raw-body
  pipeline. Its route-specific middleware behavior needs to be established when
  webhook routes are ported.
- **Severity:** HIGH

### Auth

- **Finding:** Both Node and Python validate HS256 JWTs and check account,
  device and refresh-token state. Node additionally exposes auth lifecycle
  routes and route-level admin permission checks; Python has no equivalent
  login/refresh/verification routes or admin API. Python cannot replace the
  lifecycle based on middleware parity alone.
- **Severity:** BLOCKER

### Database schema

| Legacy table/schema | Python model/schema | Migration present? | Notes |
|---|---|---|---|
| Node schema: 69 tables in `node/database/schema.sql` | 69 table names in `python/database/schema.sql` | Baseline schema only; no versioned Python migration directory found | Table names match; line comparison showed the Python schema adds `apiKeys_service_active_id_idx`. |
- **Severity:** HIGH; verify the remaining Node/Python schema differences before
  database cutover.

### Scheduled jobs

- **Finding:** Node starts earnings (30-minute default), scheduled bills
  (15-second default), birthdays (5-minute default), and TediBloom (15-minute
  default) workers. Scheduled bills are discontinued by owner decision. Python
  implements earnings, birthdays and TediBloom; worker entry points must be
  deployed separately from the API.
- **Severity:** HIGH for worker process/deployment parity.

### Background tasks / queues

- **Finding:** Node's `emailOutbox` consumer polls every five seconds, claims
  jobs with row locks, retries with backoff and marks final failures. Python
  now has an email outbox task and SMTP transport; verify that its claim,
  retry and terminal-failure behavior matches Node before cutover. Neither tree
  shows a general broker-based queue; Node uses interval workers.
- **Severity:** HIGH

### External providers

| Legacy provider | Legacy path | Python path | Category | Status |
|---|---|---|---|---|
| Flutterwave | `node/src/providers/flutterwave/**` | `python/src/app/providers/payments/flutterwave/**` | payments | PARTIAL; operation-level parity not exhaustively compared; inbound webhook route missing |
| Safe Haven | `node/src/providers/safeHaven/**` | `python/src/app/providers/payments/safehaven/**` | payments | PARTIAL; operation-level parity not exhaustively compared; route/webhook workflows missing |
| Sudo Africa | `node/src/providers/sudoAfrica/**` | `python/src/app/providers/payments/sudo/**` | payments | PARTIAL; operation-level parity not exhaustively compared; inbound webhook route missing |
| Nomba | `node/src/providers/nomba/**` | `python/src/app/providers/payments/nomba/**` | payments | PARTIAL; operation-level parity not exhaustively compared; inbound webhook route missing |
| Remita | `node/src/providers/remita/**` | `python/src/app/providers/payments/remita/**` | payments | PARTIAL; operation-level parity not exhaustively compared; API/webhook workflow missing |
| NIBSS | `node/src/providers/nibss/**` | `python/src/app/providers/payments/nibss/**` | payments | PARTIAL; operation-level parity not exhaustively compared |
| Reloadly | `node/src/providers/reloadly/**` | `python/src/app/providers/goods/reloadly/**` | goods | PARTIAL; operation-level parity not exhaustively compared; buy/sell API workflows missing |
| Fafotech | `node/src/providers/fafotech/**` | `python/src/app/providers/bills/ng/fafotech/**` | bills | PARTIAL; operation-level parity not exhaustively compared; bill route orchestration missing |
| VTU Africa | `node/src/providers/vtuAfrica/**` | — | bills | DEPRECATED; excluded |
| Direct telcos | `node/src/providers/telco/**` | Empty `python/src/app/providers/telco/` namespace | telecom | NEEDS-OWNER-INPUT for necessity |
| TediVerify | `node/src/providers/tediVerify/**` | — | KYC | MISSING |
| Tediwave internal provider | `node/src/providers/tediwave/**` | — | accounts | MISSING with account/checkout APIs |
| Face++ | `node/src/providers/facepp/**` | `python/src/app/providers/biometrics/facepp/**` | biometrics | PARTIAL; provider-level behavior not exhaustively compared; auth/verification routes missing |
| Groq | `node/src/providers/groq/**` | `python/src/app/providers/ai/groq/**` | ai | PARTIAL; provider-level behavior not exhaustively compared |
| Calendarific / sports | `node/src/providers/sports/**`; worker integration | `python/src/app/providers/calendar/calendarific/**`, `sports/football/**` | calendar/sports | PARTIAL; provider-level behavior not exhaustively compared |

### Config

- **Finding:** Node depends on runtime settings beyond DB/JWT, including
  `smtpFromName`, `smtpPort`, `smtpSecure`, `smtpUser`, `smtpPassword`,
  `smtpConnectionTimeoutMs`, `smtpGreetingTimeoutMs`, `smtpSocketTimeoutMs`,
  `webPushVapidPublicKey`, `webPushVapidPrivateKey`, `webPushVapidSubject`,
  `fcmServiceAccountJson`, `uploadStoragePath`, `uploadBaseUrl`,
  `uploadRemoteAllowedHosts`, `transferDebitAccountId`, `tediVerifyPortalUrl`,
  `tediVerifyBaseUrl`, `passwordResetUrl`, `passwordSetupUrl`, `logLevel`,
  `logtailSourceToken`, `logtailIngestingHost`, `REMITA_<mode>_*`,
  `SUDO_BRIDGE_ENV_FILE` and `SUDO_SKIP_SSL_VERIFY`, in addition to
  `port`/`nodeEnv`/database/JWT variables and worker interval settings.
  Python central settings cover DB/JWT and worker intervals; provider
  credentials are provider-owned per D-004. SMTP and FCM are configured via
  deployment environment settings; web-push credential parity remains.
  No value parity for every deployment variable was established.
- **Severity:** HIGH for notification/upload/provider workflows.

### Webhooks

- **Finding:** Node exposes inbound callbacks under `/v1/webhooks` for
  Fafotech, Flutterwave, Nomba, Remita, Safe Haven, Sudo Africa, TediVerify,
  and USSD, with raw-body handling where required. Python exposes
  user webhook registration/notification settings, not these provider
  callbacks.
- **Severity:** BLOCKER

### File/data artifacts

- **Finding:** Node's `src/data` contains `auth/countries.json`,
  `giftCards/images.json`, `giftCards/sellGiftCards.json`, and
  `tediverify/{countries,programs}.json`. Python has countries, `giftcard.json`,
  `verify.json`, tasks, ledger and beneficiary data, but no equivalent
  TediVerify country/program data or explicit gift-card image/sell data files.
  Python has a PDF statement service; Node statement exports support PDF, CSV
  and XLSX. Confirm the Python statement format contract before cutover.
- **Severity:** MEDIUM; HIGH if clients consume the missing catalogs.

### Error contracts

- **Finding:** Node's Express final error handler returns HTTP 500 with
  `{"success":false,"message":"Request could not be processed"}`. Node routes
  also use route-specific `{status,error,message}` contracts. Python FastAPI
  raises `HTTPException` for several invalid/unavailable conditions, which
  normally serializes as `{"detail":...}`; its middleware uses
  `success/message` for auth/maintenance errors. Client-visible error bodies
  therefore differ, including Python's 503 KYC-create response.
- **Severity:** HIGH

## §G — TODO/FIXME findings

- **Node:** None relevant found under `node/src`.

## §H — Recommended migration order

1. **BLOCKER — §E.2:** Implement the user auth lifecycle and preserve JWT,
   session, device and response contracts.
2. **BLOCKER — §E.7:** Migrate accounts, checkout, transfers, limits and
   spend-and-save workflows. Depends on the Python ledger and provider
   credential contracts.
3. **BLOCKER — §E.8:** Complete and verify Fafotech bill purchases, ledger
   settlement and transaction limits. Configure cable pricing and electricity
   DISCO mappings before enabling those routes. Scheduled billing and VTU
   Africa are discontinued.
4. **BLOCKER — §E.11:** Migrate and verify inbound payment/bill/KYC/USSD
   webhooks. Depends on provider clients, raw-body signature validation and
   transaction settlement operations.
5. **BLOCKER — §E.6:** Wire KYC provider adapters to session creation,
    persistence, tier progression and compliance review.
6. **HIGH — §E.3:** Migrate admin APIs and permission checks.
7. **HIGH — §E.9:** Migrate gift-card, invoice and Remita API workflows.
8. **HIGH — §E.10/§E.14:** Verify email-outbox consumption, SMTP/FCM delivery
   and statement export formats; implement any remaining web-push parity.
9. **HIGH — §E.13:** Confirm Python worker deployment; retain the existing
    earnings/birthday/TediBloom workers. Scheduled-bill execution is
    discontinued.
10. **HIGH — §E.5/§E.12:** Complete user route parity and required
     TediVerify providers; owner-confirm direct telco integrations.
11. **HIGH — §E.1:** Add `/health` with the expected operational response.
12. **MEDIUM — §E.4/§E.19:** Restore client catalogs as needed and add
     route/provider contract tests.

Dependency graph: authentication and credential contracts precede protected
financial/KYC APIs; ledger precedes payment/bill settlement; provider adapters
and signature validation precede webhook rollout; compliance ownership/schema
decision precedes KYC persistence migration; notification credentials and an
outbox consumer precede reliable queued email delivery.

## §I — Open questions

1. Is the direct telco provider set still called by any production flow, or is
   it unused/deprecated? Affects §E.12; needs the bills owner.
2. What are the approved credential-source and configuration rules for
   SMTP/FCM/web-push and the Supabase public anon key? Affects §E.6 and §E.14;
   needs the platform/security and provider owners.
3. Which Node error body and statement formats are contractual for clients?
   Affects §E.10 and §F Error contracts; needs the API/client owner.
4. Which repository/remote should receive the report commit and follow-up
   issues? All source directories were outside Git worktrees, and the available
   GitHub tools are read-only; the commit and BLOCKER/HIGH issue creation could
   not be performed in this environment.
