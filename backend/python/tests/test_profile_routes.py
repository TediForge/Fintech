from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import require_user
from app.api.user.profile import routes as profile_routes


def test_profile_json_update_normalizes_username_and_returns_profile(
    monkeypatch,
) -> None:
    app = FastAPI()
    app.include_router(profile_routes.router)
    app.dependency_overrides[require_user] = lambda: {"user_id": 7, "role": "user"}
    updates = []
    profile = {"userId": 7, "username": "ada", "avatarBlob": None}

    def update(duplicate_query, statement, value, user_id):
        updates.append((value, user_id))

    monkeypatch.setattr(profile_routes, "_update_profile_field", update)
    monkeypatch.setattr(profile_routes, "_load_profile", lambda _user_id: profile)

    with TestClient(app) as client:
        response = client.patch(
            "/profile", json={"field": "username", "username": "@Ada"}
        )
        protected = client.patch(
            "/profile", json={"field": "firstName", "firstName": "Changed"}
        )

    assert response.status_code == 200
    assert updates == [("ada", 7)]
    assert response.json()["data"]["profile"]["avatarUrl"] is None
    assert protected.status_code == 403


def test_avatar_magic_bytes_are_detected_and_invalid_data_is_rejected() -> None:
    assert profile_routes._detect_avatar_mime(b"\x89PNG\r\n\x1a\nmore") == "image/png"
    assert profile_routes._detect_avatar_mime(b"\xff\xd8\xffmore") == "image/jpeg"
    assert profile_routes._detect_avatar_mime(b"not an image") is None
