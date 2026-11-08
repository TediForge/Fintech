from typing import Any, get_args, get_type_hints

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import require_user
from app.api.user.verify import deps as verify_deps
from app.api.user.verify.ng.address import routes as address_routes
from app.api.user.verify.ng.business import routes as business_routes
from app.api.user.verify.ng.bvn import routes as bvn_routes
from app.api.user.verify.ng.income import routes as income_routes
from app.api.user.verify.ng.nin import routes as nin_routes


def _client(
    monkeypatch: pytest.MonkeyPatch,
    country_code: str,
    *,
    user_exists: bool = True,
) -> TestClient:
    monkeypatch.setattr(
        verify_deps,
        "query_rows",
        lambda *_args, **_kwargs: (
            [{"countryCode": country_code}] if user_exists else []
        ),
    )
    test_app = FastAPI()
    for route_module in (
        nin_routes,
        bvn_routes,
        address_routes,
        business_routes,
        income_routes,
    ):
        test_app.include_router(route_module.router)
    test_app.dependency_overrides[require_user] = lambda: {
        "user_id": 7,
        "role": "user",
    }
    return TestClient(test_app, raise_server_exceptions=False)


def test_ng_endpoint_rejects_gh_user(monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(monkeypatch, "GH") as client:
        response = client.post("/user/verify/ng/nin/", json={})

    assert response.status_code == 403
    assert "not available" in response.json()["detail"]


def test_ng_endpoint_accepts_ng_user(monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(monkeypatch, "NG") as client:
        response = client.post("/user/verify/ng/nin/", json={})

    assert response.status_code == 500
    assert response.status_code != 403


@pytest.mark.skip(reason="no GH routes mounted")
def test_gh_endpoint_rejects_ng_user(monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(monkeypatch, "NG") as client:
        response = client.post("/user/verify/gh/nin/", json={})

    assert response.status_code == 403


def test_country_code_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(monkeypatch, "ng") as client:
        response = client.post("/user/verify/ng/nin/", json={})

    assert response.status_code == 500
    assert response.status_code != 403


def test_missing_user_returns_404(monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(monkeypatch, "NG", user_exists=False) as client:
        response = client.post("/user/verify/ng/nin/", json={})

    assert response.status_code == 404


@pytest.mark.parametrize(
    "route_module,handler_name",
    [
        (nin_routes, "submit_nin"),
        (bvn_routes, "submit_bvn"),
        (address_routes, "submit_address"),
        (business_routes, "submit_business"),
        (income_routes, "submit_income"),
    ],
)
def test_folder_matches_dependency(
    route_module: Any,
    handler_name: str,
) -> None:
    route = getattr(route_module, handler_name)
    auth_annotation = get_type_hints(route, include_extras=True)["auth"]
    dependency = next(
        item.dependency
        for item in get_args(auth_annotation)[1:]
        if hasattr(item, "dependency")
    )
    country_folder = route_module.router.prefix.split("/")[3]

    assert dependency.expected_country == country_folder.upper()
