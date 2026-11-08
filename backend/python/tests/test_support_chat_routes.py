import asyncio
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.user.help.chat import routes as chat_routes
from app.api.user.help.chat.routes import (
    ChatAuth,
    _can_transition_support_chat,
    _classify_support_intent,
    _execute_read_tool,
    _normalize_support_reply,
    _parse_chat_id,
    _parse_support_ai_response,
    _require_user,
    _resolve_pending_consent,
    _resolve_support_chat_state,
    chat_websocket_endpoint,
    router,
)
from app.main import app as application


def test_support_chat_routes_expose_expected_endpoints() -> None:
    assert {
        (route.path, tuple(sorted(route.methods or []))) for route in router.routes
    } == {
        ("/", ("GET",)),
        ("/", ("POST",)),
        ("/{chat_id}/messages", ("GET",)),
        ("/{chat_id}/messages", ("POST",)),
        ("/{chat_id}", ("PATCH",)),
    }
    assert not any(route.path == "/realtime-auth" for route in router.routes)
    assert any(
        getattr(route, "path", None) == "/user/help/chat"
        for route in application.router.routes
    )


def test_support_chat_websocket_authenticates_and_broadcasts_custom_events(
    monkeypatch,
) -> None:
    app = FastAPI()
    app.add_api_websocket_route("/user/help/chat", chat_websocket_endpoint)

    async def fake_authenticate(_token):
        return {"role": "user", "user_id": 7, "environment": "LIVE"}

    async def fake_db(function, *args):
        assert function is chat_routes._fetch_one
        assert args[1] == {"chat_id": 19, "user_id": 7}
        return {"id": 19}

    monkeypatch.setattr(chat_routes, "authenticate_access_token", fake_authenticate)
    monkeypatch.setattr(chat_routes, "_db", fake_db)

    with (
        TestClient(app) as client,
        client.websocket_connect(
            "/user/help/chat",
            headers={"Authorization": "Bearer test-token"},
        ) as websocket,
    ):
        websocket.send_json({"action": "join", "chatId": 19})
        assert websocket.receive_json() == {
            "event": "chat.joined",
            "chatId": 19,
        }
        websocket.send_json({"event": "typing", "data": {"active": True}})
        event = websocket.receive_json()

    assert event["event"] == "typing"
    assert event["chatId"] == 19
    assert event["sender"] == {"userId": 7, "role": "user"}
    assert event["data"] == {"active": True}


def test_chat_id_and_state_helpers_validate_transitions() -> None:
    assert _parse_chat_id("12") == 12
    assert _parse_chat_id("012") is None
    assert _parse_chat_id("0") is None
    assert _can_transition_support_chat("waitingIssue", "escalated")
    assert not _can_transition_support_chat("closed", "waitingIssue")
    assert (
        _resolve_support_chat_state(
            "waitingIssue", {"shouldEscalate": True, "requiresConsent": True}
        )
        == "awaitingEscalationConsent"
    )


def test_consent_resolution_and_intent_classification() -> None:
    assert _resolve_pending_consent("awaitingCloseConsent", "yes please") == {
        "reply": "Thank you for contacting Tediwave Support, this ticket is now closed",
        "state": "closed",
    }
    assert _resolve_pending_consent("awaitingEscalationConsent", "not now") == {
        "reply": "Understood, I will continue assisting you here",
        "state": "waitingIssue",
    }
    assert _classify_support_intent("I think my account was hacked") == "fraud"
    assert _classify_support_intent("write me a poem") == "outOfScope"


def test_ai_response_normalization_and_fallback() -> None:
    assert _normalize_support_reply("  Hello!\nThere. ") == "Hello, There,"
    fallback = _parse_support_ai_response("not json", "waitingIssue")
    assert fallback["nextState"] == "waitingIssue"
    assert fallback["reply"]


def test_read_tool_rejects_bad_arguments_without_database_access() -> None:
    result = asyncio.run(
        _execute_read_tool(
            "getTransaction", {"reference": "", "userId": 999}, 1, "LIVE"
        )
    )

    assert result == {"error": "A valid transaction reference is required"}


def test_auth_dependency_requires_user_role() -> None:
    auth = _require_user(
        SimpleNamespace(
            state=SimpleNamespace(
                auth={"userId": 7, "environment": "TEST", "role": "user"}
            )
        )
    )
    assert auth == ChatAuth(user_id=7, environment="TEST", role="user")
    with pytest.raises(HTTPException) as error:
        _require_user(
            SimpleNamespace(
                state=SimpleNamespace(
                    auth={"userId": 7, "environment": "LIVE", "role": "admin"}
                )
            )
        )
    assert error.value.status_code == 403


def test_post_chat_message_persists_and_returns_ai_reply(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(chat_routes.router)
    app.dependency_overrides[chat_routes._require_user] = lambda: ChatAuth(
        user_id=7, environment="LIVE", role="user"
    )

    async def fake_db(function, *args):
        if function is chat_routes._append_user_message:
            return {
                "id": "msg-user",
                "sender": "user",
                "message": args[2],
            }
        if function is chat_routes._get_support_chat_context:
            return {
                "ticketId": "TW-TEST",
                "status": "open",
                "state": "waitingIssue",
                "history": [{"sender": "user", "message": "Hello support"}],
            }
        if function is chat_routes._append_support_ai_reply:
            return {
                "id": "msg-ai",
                "sender": "ai",
                "message": args[2],
            }
        if function is chat_routes._get_recent_support_transactions:
            return []
        raise AssertionError(f"Unexpected database operation: {function.__name__}")

    async def fake_ai(_input):
        return {
            "reply": "I can help with that",
            "suggestions": [],
            "shouldClose": False,
            "shouldEscalate": False,
            "nextState": "waitingIssue",
        }

    async def fake_log(*_args):
        return None

    async def fake_publish(*_args):
        return {"success": True, "configured": True}

    monkeypatch.setattr(chat_routes, "_db", fake_db)
    monkeypatch.setattr(chat_routes, "_generate_support_reply", fake_ai)
    monkeypatch.setattr(chat_routes, "_log_activity", fake_log)
    monkeypatch.setattr(chat_routes, "_publish_chat_event", fake_publish)

    with TestClient(app) as client:
        response = client.post(
            "/1/messages",
            files={"message": (None, "Hello support")},
        )
        json_response = client.post(
            "/1/messages",
            json={"message": "Hello support"},
        )

    assert response.status_code == 201
    assert response.json()["data"]["reply"] == "I can help with that"
    assert response.json()["data"]["ticketId"] == "TW-TEST"
    assert json_response.status_code == 201
