# D-001: Provider Folder Structure & Public Interface

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** All external integrations under `src/app/providers/`

## Context

The backend integrates with multiple external providers (payment gateways, KYC vendors, FX rate feeds, AI/LLM services such as Groq). Without a fixed convention, each provider ends up with a different internal layout, exports leak vendor SDK types into business code, and developers must inspect each folder to know where to import from.

We need a uniform, predictable layout so that:

1. Any developer can navigate an unfamiliar provider folder and immediately know where things are.
2. Business logic (`services/`, `api/`) depends on stable, provider-agnostic interfaces, never on vendor SDKs directly.
3. Configuration (API keys, base URLs, timeouts, default models) is not scattered or hardcoded.
4. Provider SDK clients are instantiated once and reused, not created per-request.

## Decision

**Every provider folder MUST contain these three canonical files:**

```text
src/app/providers/<category>/<provider>/
├── __init__.py
├── client.py
└── config.py
```

### Example: Groq

```text
src/app/providers/ai/groq/
├── __init__.py
├── client.py
└── config.py
```

### Responsibilities of each file

| File | Responsibility |
|------|----------------|
| `__init__.py` | The **only** file other modules may import from. Re-exports the public objects via `__all__`. No logic beyond imports and re-exports. |
| `client.py` | Instantiates the provider SDK client (singleton where applicable), defines a `get_<provider>_client()` accessor for dependency injection, and optionally wraps provider calls behind the provider-neutral `Protocol` defined in `providers/base.py`. |
| `config.py` | Provider-specific values that operators must override at runtime. Reads from centralized settings. Fixed provider facts (such as API endpoints, default timeouts, and default model names) remain constants in `client.py`. **Never** hardcodes secrets. |

### Rules

1. **All three files are mandatory** for every provider, even if `config.py` is initially trivial. Uniformity is the point.
2. **`__init__.py` is the public API surface.** Consumers import from `app.providers.<category>.<provider>`, never from `client` or `config` submodules directly.
3. **No provider SDK imports outside the provider folder.** `services/` and `api/` must not import `groq`, `stripe`, `flutterwave`, etc. directly.
4. **`__init__.py` uses `__all__`** to explicitly declare the exported surface.
5. **Client instantiation is module-level or app-startup** (singleton pattern). Do not create a new SDK client per request — SDKs maintain connection pools internally.
6. **`config.py` is only for values that need runtime configuration** and reads from centralized settings (`app/config.py` or equivalent). Fixed provider facts belong as constants in the provider's `client.py`; do not add them as centralized settings. Provider modules do not read `os.environ` directly.
7. **Provider-neutral contracts** live in `app/providers/base.py` (Python `Protocol` or ABC). Provider implementations satisfy those contracts in `client.py`.
8. Additional provider-owned modules are allowed only when required by an accepted decision. Provider credential access follows [D-004](./D-004-provider-owned-credentials.md).

### Naming convention

- Folder name: lowercase provider name (`groq`, `stripe`, `flutterwave`, `smile_id`).
- Category folder: lowercase capability name (`ai`, `payments`, `kyc`,
  `rates`, `calendar`). The `calendar` category covers public holiday,
  bank holiday, and observance lookups (e.g., Calendarific).
- Accessor function: `get_<provider>_client()`.

## Consequences

### Positive

- Any developer opening an unknown provider folder immediately knows where to find configuration, how the client is created, and what is publicly exported.
- Business logic remains provider-agnostic and testable with fake providers.
- Swapping or adding a provider is a mechanical operation: replicate the three-file structure.
- Configuration and secrets have a single, predictable home per provider.
- The `__init__.py` export gate prevents accidental coupling to internal provider details.

### Negative / Trade-offs

- Providers with very small surface areas carry slight overhead (three files instead of one), accepted for uniformity.
- Additional `base.py` protocols must be maintained as new provider categories are added.
- Developers must remember to update `__init__.py` when the public surface changes.

## Compliance

- Code review checklists must reject provider folders missing any of the three files.
- Linting (e.g., import-linter rules) should forbid imports of provider SDKs outside `app/providers/`.
- New provider categories must define their contract in `app/providers/base.py` before the first implementation is merged.

## References

- `app/providers/base.py` — provider-neutral protocols
- `app/config.py` — centralized settings consumed by `config.py` in each provider
