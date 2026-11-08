# D-010: Country Scoping on Verify Submission Routes

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Backend team
- **Scope:** All routes under `src/app/api/user/verify/`
- **Related:** D-001 (Provider Folder Structure & Public Interface), D-004 (Provider-Owned Credentials), D-006 (Services Packaging for Document & Notification)

## Context

Verification requirements differ per country. Nigeria uses NIN, BVN, CAC
business registration, and Nigerian address evidence. Ghana uses the Ghana
Card number and Ghanaian business registration. The payload shape, the
provider adapter, and the review workflow are country-specific.

The existing `api/user/kyc/routes.py` serves the authenticated user's KYC
tier and status from db-01. It does not accept submissions. The verify
service at `services/verify/<country>/<type>/` owns submission and
persistence to db-02.

Without a country-enforcement rule, the following drift is expected:

- A Ghanaian user submits a Nigerian NIN to `POST /user/verify/ng/nin`
  because the route does not check the user's country. The NIN is stored
  as pending, review staff cannot decide it, and the user's tier never
  progresses.
- A developer copies `ng/nin/routes.py` to `gh/nin/routes.py` and forgets
  to change the country argument, so a Ghanaian endpoint accepts Nigerian
  users.
- A route accepts any authenticated user because the developer used
  `require_user` directly and did not know the country rule existed.
- The country check is duplicated inline in each route file, drifts over
  time, and one route silently drops it.
- A mismatched submission returns `404`, leaking the existence of the
  endpoint to users who are not eligible for it.

We need a single, explicit rule that every verify submission route follows,
and a mechanism that makes forgetting it a test failure rather than a
production bug.

## Decision

**A user can only submit verification for the country code on their account.
Every verify submission route is country-scoped in its path and enforces the
user's `users.countryCode` via a shared FastAPI dependency. Mismatch is `403`.**

### Route layout

```text
src/app/api/user/
├── kyc/
│   └── routes.py              # existing status view — unchanged
└── verify/
    ├── __init__.py
    ├── deps.py                # require_country_user(expected)
    ├── ng/
    │   ├── __init__.py
    │   ├── nin/routes.py      # POST /user/verify/ng/nin
    │   ├── bvn/routes.py      # POST /user/verify/ng/bvn
    │   ├── address/routes.py  # POST /user/verify/ng/address
    │   ├── business/routes.py # POST /user/verify/ng/business
    │   └── income/routes.py   # POST /user/verify/ng/income
    └── gh/
        └── __init__.py        # placeholder — no GH routes until scoped
```

### The shared dependency

`api/user/verify/deps.py` defines `require_country_user(expected)` which
returns a FastAPI dependency. The dependency:

1. Depends on `require_user` (authentication).
2. Reads `users.countryCode` for the authenticated user from db-01.
3. Compares the value, uppercased, against the route's country code,
   uppercased.
4. Returns the auth dict on match.
5. Raises `404` if the user row is missing.
6. Raises `403` with a generic message on mismatch.

### Rules

1. **Every verify submission route depends on `require_country_user("<CC>")`.**
   No verify route calls `require_user` directly. Code review rejects any
   verify route that imports `require_user` instead of
   `require_country_user("<CC>")`.

2. **The `<CC>` argument matches the route's folder name.**
   `api/user/verify/ng/**` uses `require_country_user("NG")`. A test in
   `tests/api/user/verify/test_country_enforcement.py` asserts this match
   for every mounted verify route, so a copied route with the wrong
   argument fails CI.

3. **The user's country comes from `users.countryCode`, not from the JWT.**
   JWT claims may be stale if the user's country changed after login. The
   database row is authoritative. Do not read country from a header, a
   query parameter, or the request body.

4. **Mismatch is `403`, not `404`.** The endpoint exists; the user is not
   eligible. `404` would leak the existence question to ineligible users.
   The error message is generic and does not echo the user's country back
   unless the country code is already known to them (which it is — it is
   their own account).

5. **The dependency runs before the body is parsed.** In each route
   signature, `auth: NgUser` appears before the body parameter, so a
   mismatched user gets `403` without their payload being parsed or
   logged.

6. **No country check in the service layer.** `services/verify/ng/**/service.py`
   assumes the caller has validated country. Defense-in-depth in the
   service is a separate decision if ever needed; it is not duplicated
   here.

7. **`api/user/kyc/routes.py` is unchanged.** The status view returns
   whatever the user's row says and does not enforce country. It is a
   read of the user's own record, not a submission.

8. **`gh/` is a placeholder until Ghana providers are scoped.** No empty
   `gh/<type>/` folders are created speculatively. `gh/__init__.py` exists
   with a docstring stating no endpoints are mounted.

## Consequences

### Positive

- A Ghanaian user cannot accidentally submit a Nigerian NIN. The API
  refuses before the payload is read.
- The country check lives in one file. Changing the comparison logic
  (e.g., adding a normalization rule) is a one-line change.
- A copied route with the wrong country argument fails the folder-match
  test in CI.
- Mismatched submissions do not create pending records that review staff
  cannot decide.
- The API surface is self-describing: the path says which country it
  accepts.

### Negative / Trade-offs

- One extra database read per verify submission to fetch
  `users.countryCode`. This is negligible compared to the provider call
  that follows.
- Adding a new country requires a new folder, a new `deps.py` alias, and
  new route files — there is no "just add a query parameter" shortcut.
  Accepted; the payloads differ per country anyway, so a generic
  endpoint would be misleading.
- Cross-country verification (a Ghanaian user submitting a Nigerian BVN
  for a specific product) is not supported by this rule. If it becomes
  a requirement, it is a new decision — not an exception to this one.

## Compliance

- Code review rejects any verify route that uses `require_user` instead
  of `require_country_user`.
- CI runs the folder-match test; a mismatch fails the build.
- The `gh/` placeholder is reviewed when the first GH provider is scoped,
  to confirm the rule is followed there too.

## References

- D-001: Provider Folder Structure & Public Interface
- D-004: Provider-Owned Credentials
- D-006: Services Packaging for Document & Notification
- `src/app/api/user/verify/deps.py` — the shared dependency
- `tests/api/user/verify/test_country_enforcement.py` — the folder-match
  test
