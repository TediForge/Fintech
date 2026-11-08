from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import require_user
from app.api.user.notifications import routes as notification_routes
from app.main import app


def test_main_routes_use_user_and_v1_prefixes_without_fintech() -> None:
    paths = app.openapi()["paths"]

    assert "/v1/transactions/" in paths
    assert "/user/profile" in paths
    assert "/user/notifications/" in paths
    assert "/user/notifications/{notification_id}" in paths
    assert "/user/notifications/{notification_id}/read" in paths
    assert "/user/help/findus/" in paths
    assert "/user/verify/ng/nin/" in paths
    assert "/user/verify/ng/bvn/" in paths
    assert "/user/verify/ng/address/" in paths
    assert "/user/verify/ng/business/" in paths
    assert "/user/verify/ng/income/" in paths
    assert "/user/kyc/" in paths
    assert "post" not in paths["/user/kyc/"]
    assert "/user/help/support/findUs" not in paths
    assert not any(path.startswith("/fintech/") for path in paths)


def test_notification_routes_use_delete_and_post_without_action_body(monkeypatch) -> None:
    test_app = FastAPI()
    test_app.include_router(
        notification_routes.router, prefix="/user/notifications"
    )
    test_app.dependency_overrides[require_user] = lambda: {
        "user_id": 7,
        "role": "user",
    }
    updates: list[tuple[str, int, str]] = []

    def update(notification_id: str, user_id: int, field: str) -> int:
        updates.append((notification_id, user_id, field))
        return 1

    monkeypatch.setattr(notification_routes, "_update_notification", update)

    with TestClient(test_app) as client:
        deleted = client.delete("/user/notifications/n-1")
        read = client.post("/user/notifications/n-2/read")
        obsolete = client.patch(
            "/user/notifications/n-3", json={"action": "delete"}
        )

    assert deleted.status_code == 200
    assert read.status_code == 200
    assert obsolete.status_code == 405
    assert updates == [
        ("n-1", 7, "isArchived"),
        ("n-2", 7, "isRead"),
    ]
