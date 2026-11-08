# D-003: Run Pytest With Bytecode Caching Disabled

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Backend team
- **Scope:** All local development and test execution

## Context

Running `pytest` (or any Python entry point) causes CPython to write
`__pycache__/` directories and `*.pyc` files next to imported modules. In this
project these files can litter the source tree, polluting the working
directory, complicating diffs, and causing unnecessary churn in tooling that
watches the filesystem.

The default behavior can be suppressed for an individual process with
`python -B`, which sets `sys.dont_write_bytecode = True` for that run without
changing any global or system configuration.

We want a single, simple, non-invasive rule that every developer follows when
running tests locally.

## Decision

**Developers MUST run pytest via:**

```bash
python -B -m pytest
```

The `-B` flag disables bytecode writing for that invocation, so no new
`__pycache__` directories or `.pyc` files are created during the test run.

### Instructions

1. **Use `python -B -m pytest`** — not bare `pytest` and not
   `python -m pytest` — for all local test runs.
   ```bash
   # Correct
   python -B -m pytest

   # Avoid — will generate __pycache__
   pytest
   python -m pytest
   ```

2. **Update local scripts, IDE run configurations, and Makefile/`justfile`
   targets** used for testing to include `-B`. Recommended canonical target:
   ```make
   test:
   	python -B -m pytest
   ```

3. **Keep `__pycache__/` and `*.pyc` in `.gitignore`.** The `-B` flag prevents
   new files; `.gitignore` prevents any pre-existing or stray ones from being
   committed. Both are required.

## Consequences

### Positive

- Test runs no longer create `__pycache__` directories anywhere in the source
  tree.
- Working directory stays clean; git status and file watchers are not
  disturbed by cache churn.
- No global environment changes required — the rule is explicit and
  per-command.
- Works identically on Windows, macOS, and Linux, and in CI.

### Negative / Trade-offs

- Test runs that import large modules may be marginally slower on the first
  run because bytecode is recompiled each time. In practice this is negligible
  for this project's test suite.
- Developers must remember the `-B` flag. This is mitigated by wrapping it in
  Makefile / `justfile` targets and IDE run configurations (Instruction 2).

## Compliance

- Code review: any new test-related script, Makefile target, or CI job that
  invokes pytest without `-B` (or without an equivalent
  `PYTHONDONTWRITEBYTECODE=1` in the environment) should be flagged.
- CI may set `PYTHONDONTWRITEBYTECODE=1` in the environment as an equivalent,
  so CI pipelines do not need to repeat `-B` on every command.

## References

- Python docs: [`-B` option](https://docs.python.org/3/using/cmdline.html#cmdoption-B)
  and [`PYTHONDONTWRITEBYTECODE`](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONDONTWRITEBYTECODE)
- Related: [D-001: Provider Folder Structure & Public Interface](./D-001-provider-folder-structure.md)
