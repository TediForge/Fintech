import asyncio
import json

import pytest
from app.providers.kyc.ng.business.cac import client as cac_client
from app.providers.kyc.ng.nin.accord import client as accord_client
from app.providers.kyc.ng.nin.supabase import client as supabase_client
from app.providers.kyc.ng.nin.supabase import credentials as supabase_credentials
from app.providers.kyc.ng.nin.supabase.credentials import SupabaseNinCredentials
from app.providers.kyc.ng.tax.jrb import client as jrb_client
from app.providers.types import ProviderError


class _Response:
    def __init__(self, body: dict, status: int = 200) -> None:
        self.status = status
        self._body = json.dumps(body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        return None

    def read(self) -> bytes:
        return self._body


def test_supabase_nin_sends_anon_key_and_validates_response(monkeypatch) -> None:
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return _Response({"success": True, "data": {"verified": True}})

    monkeypatch.setattr(supabase_client, "urlopen", fake_urlopen)
    client = supabase_client.SupabaseNinClient(
        SupabaseNinCredentials(api_key="public-anon-key")
    )

    response = asyncio.run(client.verify_nin("12345678901"))

    request = captured["request"]
    headers = {key.lower(): value for key, value in request.headers.items()}
    assert json.loads(request.data) == {"nin": "12345678901"}
    assert headers["apikey"] == "public-anon-key"
    assert headers["authorization"] == "Bearer public-anon-key"
    assert response["data"] == {"verified": True}


def test_accord_nin_sends_request_without_disabling_tls(monkeypatch) -> None:
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        return _Response({"success": True, "data": {"verified": True}})

    monkeypatch.setattr(accord_client, "urlopen", fake_urlopen)
    response = asyncio.run(accord_client.verify_nin_with_accord("12345678901"))

    assert json.loads(captured["request"].data) == {"nin": "12345678901"}
    assert response["data"] == {"verified": True}


def test_jrb_resolver_sends_legacy_payload_variants(monkeypatch) -> None:
    requests = []

    def fake_request_json(payload):
        requests.append(payload)
        return {
            "data": {
                "tax_id": "TAX-123",
                "tax_residency": "NG",
            }
        }

    monkeypatch.setattr(jrb_client, "_request_json", fake_request_json)
    result = asyncio.run(
        jrb_client.resolve_tax_id_for_nin("12345678901", "Ada", "Okafor", "1990-01-02")
    )

    assert requests[0] == {
        "nin": "12345678901",
        "firstName": "Ada",
        "lastName": "Okafor",
        "dateOfBirth": "02/01/1990",
    }
    assert result == {"taxId": "TAX-123", "taxResidency": "NG"}


def test_cac_search_normalizes_registration_and_matches_exactly(monkeypatch) -> None:
    captured = {}

    def fake_request_json(endpoint, payload, headers):
        captured.update(endpoint=endpoint, payload=payload, headers=headers)
        return [
            {"rcNumber": "12345", "approvedName": "Wrong company"},
            {
                "rcNumber": "1234",
                "approvedName": "Correct company",
                "companyId": "company-id",
                "classificationId": "classification-id",
                "classificationName": "Business name",
                "taxId": "tax-123",
            },
        ], 200

    monkeypatch.setattr(cac_client, "_request_json", fake_request_json)
    result = asyncio.run(
        cac_client.fetch_business_details_by_registration_number("RC-1234")
    )

    assert captured["payload"] == {"SearchType": "RC_NUMBER", "searchTerm": "1234"}
    assert result["approvedName"] == "Correct company"
    assert result["rcNumber"] == "1234"
    assert result["providerReference"]


def test_cac_resolves_missing_tax_id(monkeypatch) -> None:
    calls = []

    def fake_request_json(endpoint, payload, headers):
        calls.append((endpoint, payload))
        if payload is not None:
            return {
                "results": [
                    {
                        "rcNumber": "1234",
                        "companyId": "company id",
                        "classificationId": "type/id",
                    }
                ]
            }, 200
        return {"data": {"tax_id": "CAC-TAX-1"}}, 200

    monkeypatch.setattr(cac_client, "_request_json", fake_request_json)
    result = asyncio.run(
        cac_client.fetch_business_details_by_registration_number("1234")
    )

    assert result["taxId"] == "CAC-TAX-1"
    assert calls[1][0].endswith("company%20id?rc=1234&type=type%2Fid")


def test_nin_adapters_reject_invalid_nin_before_network_call() -> None:
    with pytest.raises(ProviderError) as error:
        asyncio.run(supabase_client.verify_nin_with_supabase("123"))

    assert error.value.status == 400


def test_supabase_credentials_fail_closed_until_key_is_configured(monkeypatch) -> None:
    monkeypatch.setattr(supabase_credentials, "SUPABASE_NIN_ANON_KEY", None)
    with pytest.raises(ProviderError, match="has not been configured"):
        supabase_credentials.load_supabase_nin_credentials()
