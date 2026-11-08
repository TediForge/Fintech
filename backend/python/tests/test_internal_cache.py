import pytest

from app.lib.cache import (
    append_cached_payload,
    edit_cached_payload,
    is_successful_cache_response,
    normalize_cache_environment,
    normalize_cache_key,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("rates.NG:USD", "rates.NG:USD"),
        (" transfers:user-1 ", "transfers:user-1"),
    ],
)
def test_normalize_cache_key_accepts_supported_keys(raw, expected) -> None:
    assert normalize_cache_key(raw) == expected


@pytest.mark.parametrize("raw", ["", "../secrets", "white space", "key/part", "a" * 192])
def test_normalize_cache_key_rejects_invalid_keys(raw) -> None:
    with pytest.raises(ValueError):
        normalize_cache_key(raw)


@pytest.mark.parametrize(("raw", "expected"), [("live", "LIVE"), ("TEST", "TEST")])
def test_normalize_cache_environment(raw, expected) -> None:
    assert normalize_cache_environment(raw) == expected


def test_cache_helpers_preserve_existing_payload_shapes(monkeypatch) -> None:
    calls = []

    def mutate(cache_key, ttl_seconds, environment, callback):
        current = {"items": ["existing"], "setting": "before"}
        updated = callback(current)
        calls.append((cache_key, ttl_seconds, environment, updated))
        return {"cacheKey": cache_key, "environment": environment, "expiresAt": "later"}

    monkeypatch.setattr("app.lib.cache._mutate_cached_payload", mutate)
    edit_cached_payload("key", "setting", "after", 60)
    append_cached_payload("key", "items", "new", 30, "TEST")

    assert calls == [
        ("key", 60, "LIVE", {"items": ["existing"], "setting": "after"}),
        ("key", 30, "TEST", {"items": ["existing", "new"], "setting": "before"}),
    ]


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ({"status": "success", "data": {"items": [1]}}, True),
        ({"status": "failed", "data": {"items": [1]}}, False),
        ({"responseCode": "99", "data": {"items": [1]}}, False),
        ({"data": {}}, False),
        ({"data": [1]}, True),
    ],
)
def test_is_successful_cache_response(payload, expected) -> None:
    assert is_successful_cache_response(payload) is expected
