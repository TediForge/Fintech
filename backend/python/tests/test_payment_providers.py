import asyncio

import pytest

from app.providers.payments.flutterwave import FlutterwaveClient, FlutterwaveCredentials
from app.providers.payments.nibss import request_nibss
from app.providers.payments.nomba import NombaClient
from app.providers.payments.remita import RemitaClient, RemitaCredentials, RemitaConfig
from app.providers.payments.safehaven import SafeHavenClient, SafeHavenCredentials
from app.providers.payments.sudo import SudoClient, SudoCredentials
from app.providers.types import ProviderError


def test_flutterwave_card_charge_returns_actual_provider_response(monkeypatch) -> None:
    client = FlutterwaveClient(
        FlutterwaveCredentials(
            public_key="public",
            secret_key="secret",
            encryption_key="123456789012345678901234",
            webhook_hash="webhook",
            environment="test",
        )
    )
    requests = []

    async def fake_request(method, endpoint, payload=None, headers=None):
        requests.append((method, endpoint, payload, headers))
        return {
            "status": "success",
            "data": {"status": "successful", "id": 123, "flw_ref": "flw-ref"},
        }, 200

    monkeypatch.setattr(client, "request", fake_request)

    result = asyncio.run(
        client.initialize_card_charge(
            {
                "userId": 10,
                "environment": "TEST",
                "mode": "test",
                "email": "user@example.test",
                "fullName": "Test User",
                "phone": "08000000000",
            },
            {
                "amount": 100,
                "currency": "NGN",
                "cardNumber": "4111111111111111",
                "expiryMonth": "12",
                "expiryYear": "2030",
                "cvv": "123",
            },
        )
    )

    assert result["status"] == "success"
    assert result["chargeId"] == 123
    assert requests[0][0:2] == ("POST", "charges?type=card")
    assert isinstance(requests[0][2]["client"], str)


def test_safehaven_sandbox_request_avoids_network() -> None:
    client = SafeHavenClient(
        SafeHavenCredentials(
            client_id="client",
            private_key_path="unused",
            base_url="https://sandbox.example",
            company_url="https://company.example",
            callback_url="",
            main_account_number="123",
            rc_number="RC",
            identity_id="identity",
            state="sandbox",
        )
    )

    result = asyncio.run(
        client.execute_request("virtual-accounts", "POST", {"amount": 50})
    )

    assert result["http_code"] == 200
    assert result["data"]["environment"] == "sandbox"
    assert result["data"]["data"]["amount"] == 50


def test_remita_normalizes_provider_response() -> None:
    client = RemitaClient(
        RemitaCredentials(
            api_key="api",
            secret_key="secret",
            merchant_id="merchant",
            environment="TEST",
        ),
        RemitaConfig(),
    )

    result = client.normalize(
        {
            "httpCode": 200,
            "data": {
                "responseCode": "00",
                "responseMsg": "Successful",
                "data": {
                    "RRR": "12345",
                    "amount": "125.50",
                    "currency": "ngn",
                    "payerName": "Test User",
                    "status": "PAID",
                    "transactionId": "ref-1",
                },
            },
        }
    )

    assert result["success"] is True
    assert result["rrr"] == "12345"
    assert result["amount"] == 125.5
    assert result["currency"] == "NGN"
    assert result["reference"] == "ref-1"


def test_sudo_uses_mode_endpoint_and_masks_sensitive_response(monkeypatch) -> None:
    calls = []

    def fake_request(url, method, headers, payload, timeout_seconds):
        calls.append((url, method, headers, payload, timeout_seconds))
        return {"accountNumber": "123456", "token": "private", "ok": True}, 200

    monkeypatch.setattr(
        "app.providers.payments.sudo.client._request_json", fake_request
    )
    client = SudoClient(SudoCredentials("database-key"))

    result = asyncio.run(
        client.request(
            "/accounts",
            "test",
            "POST",
            {"name": "Test"},
            {"country": "NG", "unused": None},
        )
    )

    assert calls[0][0] == "https://api.sandbox.sudo.cards/accounts?country=NG"
    assert calls[0][2]["authorization"] == "Bearer database-key"
    assert result == {
        "data": {"accountNumber": "***", "token": "***", "ok": True},
        "status": 200,
    }


def test_unimplemented_payment_providers_fail_closed() -> None:
    with pytest.raises(ProviderError) as nomba_error:
        NombaClient().check_balance()
    with pytest.raises(ProviderError) as nibss_error:
        request_nibss()

    assert nomba_error.value.status == 501
    assert nibss_error.value.status == 501
