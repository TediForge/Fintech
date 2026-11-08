# D-002: Migrating Providers into the Python Backend

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** Provider migrations from the Node backend to `backend/python/src/app/providers/`

## Context

Provider ports must preserve the existing provider behavior while using the
Python backend's package layout. A migration is not an exception to the
provider conventions in [D-001](./D-001-provider-folder-structure.md).
Without stating this explicitly, ports can reproduce a Node directory tree
inside Python (for example, separate `balance/` and `data/` modules) and make
the public interface inconsistent.

## Decision

Every provider migration MUST comply with D-001. In particular:

1. A provider folder contains the canonical `__init__.py`, `client.py`, and
   `config.py`; provider-owned credential modules follow D-004.
2. All provider operations (balance, catalogue, purchase, status, and similar
   operations) are defined in that provider's single `client.py`. Do not port
   source-language subdirectories as Python implementation modules.
3. `__init__.py` only re-exports the supported public API from `client.py` and
   declares it in `__all__`. Consumers import the provider package, not its
   `client` or `config` modules.
4. Fixed provider facts (such as an API endpoint, default timeout, or cache
   duration) are constants in that provider's `client.py`; do not add them as
   centralized or operator-editable settings. `config.py` is reserved for
   values that actually need runtime configuration. Credentials stay in the
   configured credential store, not environment variables or source code.
5. The migration includes tests for the ported behavior and an update to
   provider documentation when the source documentation is no longer accurate.

## Mapping examples

### Fafotech

Node source:

```text
backend/node/src/providers/fafotech/
├── balance/index.ts
└── data/
    ├── fetching/index.ts
    └── initialization/index.ts
```

Python destination:

```text
backend/python/src/app/providers/bills/ng/fafotech/
├── __init__.py
├── client.py       # balance, plan catalogue, and data purchase operations
└── config.py       # runtime-overridable values only; may be minimal
```

Public API pattern:

```python
# __init__.py
from app.providers.bills.ng.fafotech.client import (
    get_data_plan_catalog,
    get_fafotech_balance,
    purchase_data,
)

__all__ = ["get_data_plan_catalog", "get_fafotech_balance", "purchase_data"]

# Consumer
from app.providers.bills.ng.fafotech import get_fafotech_balance, purchase_data
```

### Football data

Node source `backend/node/src/providers/sports/index.ts` maps to the Python
provider package `backend/python/src/app/providers/sports/football/`.
Keep match retrieval and its provider-specific behavior in that package's
`client.py`, and expose its public function from `__init__.py`.

## Consequences

- Existing Node subdirectory boundaries are translated into functions in the
  Python provider's `client.py`, rather than copied as Python modules.
- New and migrated providers have the same stable import surface and remain
  discoverable through D-001's three-file convention.
- The source language's behavior remains the reference for the port, subject
  to Python's established configuration, error, and database patterns.

## Compliance

Code review for provider migrations MUST verify D-001, this decision, and
D-004. The review must check the provider layout, single `client.py`
implementation, package-level exports, provider-owned credentials, and
behavior-focused tests.
