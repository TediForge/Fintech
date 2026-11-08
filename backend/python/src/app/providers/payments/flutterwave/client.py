"""Flutterwave REST client and payment operations."""

import asyncio
import base64
import hashlib
import hmac
import json
import math
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from sqlalchemy import text

from database.db_01.connection import get_database_engine
from app.lib.cache import delete_cached_payload, get_cached_payload, store_cached_payload
from app.providers.payments.flutterwave.credentials import (
    FlutterwaveCredentials,
    FlutterwaveMode,
    load_flutterwave_credentials,
)
from app.providers.types import ProviderError

_BASE_URL = "https://api.flutterwave.com/v3"
_REQUEST_TIMEOUT_SECONDS = 30
_SUPPORTED_USSD_BANKS = {
    "044", "050", "070", "011", "214", "058", "030", "082",
    "221", "232", "033", "032", "215", "035", "057", "566",
}
_PAYMENT_TYPES = {
    "card": "card",
    "bank": "bank_transfer",
    "ussd": "debit_ng_account",
    "mobilemoney": "mobilemoney",
    "ach": "ach_payment",
}


class FlutterwaveCardContext(TypedDict):
    userId: int
    environment: Literal["LIVE", "TEST"]
    mode: FlutterwaveMode
    email: str
    fullName: str
    phone: str


class FlutterwaveCardInput(TypedDict, total=False):
    reference: str
    amount: float
    currency: str
    cardNumber: str
    expiryMonth: str
    expiryYear: str
    cvv: str
    cardHolderName: str
    savedCardToken: str
    saveCard: bool


CardAuthType = Literal["pin", "otp", "avs", "avs_noauth"]


@dataclass(frozen=True)
class FlutterwaveFeeQuote:
    amount: str
    currency: str
    method: str
    providerFee: str
    vat: str
    totalFee: str
    source: str
    merchantFee: str | None = None
    flutterwaveFee: str | None = None
    stampDutyFee: str | None = None
    rateConfig: dict[str, float] | None = None


@dataclass(frozen=True)
class FlutterwaveVirtualAccountResult:
    status: Literal["success"]
    message: str
    provider: Literal["flutterwave"]
    account: dict[str, Any]
    environment: FlutterwaveMode | None = None
    attemptRef: str | None = None


class FlutterwaveClient:
    """Flutterwave client with explicitly injected database credentials."""

    def __init__(self, credentials: FlutterwaveCredentials) -> None:
        self.credentials = credentials

    async def request(
        self,
        method: str,
        endpoint: str,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[Any, int]:
        return await asyncio.to_thread(
            self._request_sync, method, endpoint, payload, headers or {}
        )

    def _request_sync(
        self,
        method: str,
        endpoint: str,
        payload: dict[str, Any] | None,
        extra_headers: dict[str, str],
    ) -> tuple[Any, int]:
        request = Request(
            f"{_BASE_URL}/{endpoint.lstrip('/')}",
            data=json.dumps(payload).encode("utf-8")
            if payload is not None and method != "GET"
            else None,
            headers={
                "accept": "application/json",
                "content-type": "application/json",
                "authorization": f"Bearer {self.credentials.secret_key}",
                **extra_headers,
            },
            method=method,
        )
        try:
            with urlopen(request, timeout=_REQUEST_TIMEOUT_SECONDS) as response:
                body = response.read()
                status = response.status
        except HTTPError as error:
            body = error.read()
            status = error.code
        except (TimeoutError, URLError) as error:
            raise ProviderError("Unable to reach Flutterwave", 502) from error
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ProviderError("Flutterwave returned an invalid response", 502) from error
        if status >= 400:
            message = data.get("message") if isinstance(data, dict) else None
            raise ProviderError(
                str(message or "Flutterwave request failed"),
                status if 400 <= status < 500 else 502,
            )
        return data, status

    async def create_customer(self, payload: dict[str, Any]) -> tuple[Any, int]:
        return await self.request("POST", "customers", payload)

    async def quote_fee(
        self,
        amount: float,
        currency: str,
        method: Literal["card", "bank", "ussd", "mobilemoney", "ach"],
        card_first6: str = "",
    ) -> FlutterwaveFeeQuote:
        if not math.isfinite(amount) or amount <= 0:
            raise ProviderError("amount must be greater than zero", 400)
        currency = currency.strip().upper()
        if not re.fullmatch(r"[A-Z]{3,10}", currency):
            raise ProviderError("currency is invalid", 400)
        if method not in _PAYMENT_TYPES:
            raise ProviderError("payment method is invalid", 400)
        normalized_amount = _round_money(amount)
        query = {
            "amount": str(normalized_amount),
            "currency": currency,
            "payment_type": _PAYMENT_TYPES[method],
        }
        first_six = re.sub(r"\D", "", card_first6)
        if method == "card" and len(first_six) >= 6:
            query["card_first6digits"] = first_six[:6]
        try:
            result, _ = await self.request(
                "GET", f"transactions/fee?{urlencode(query)}"
            )
            body = result if isinstance(result, dict) else {}
            data = body.get("data") if isinstance(body.get("data"), dict) else {}
            if body.get("status") == "success" and data.get("fee") is not None:
                provider_fee = _round_money(float(data["fee"]))
                vat = (
                    _round_money(provider_fee * 0.075)
                    if data.get("vat") is None
                    else _round_money(float(data["vat"]))
                )
                return FlutterwaveFeeQuote(
                    amount=_format_money(normalized_amount),
                    currency=currency,
                    method=method,
                    providerFee=_format_money(provider_fee),
                    vat=_format_money(vat),
                    totalFee=_format_money(provider_fee + vat),
                    merchantFee=_format_money(float(data.get("merchant_fee", 0))),
                    flutterwaveFee=_format_money(
                        float(data.get("flutterwave_fee", provider_fee))
                    ),
                    stampDutyFee=_format_money(float(data.get("stamp_duty_fee", 0))),
                    source="flutterwave_fee_api",
                )
        except (ProviderError, TypeError, ValueError):
            pass

        international = (
            method == "card"
            and len(first_six) >= 6
            and first_six[0] not in {"4", "5", "2"}
        )
        local_percent, international_percent, vat_percent = 2.0, 4.8, 7.5
        provider_fee = _round_money(
            normalized_amount
            * (international_percent if international else local_percent)
            / 100
        )
        vat = _round_money(provider_fee * vat_percent / 100)
        return FlutterwaveFeeQuote(
            amount=_format_money(normalized_amount),
            currency=currency,
            method=method,
            providerFee=_format_money(provider_fee),
            vat=_format_money(vat),
            totalFee=_format_money(provider_fee + vat),
            source="fallback_config",
            rateConfig={
                "localPercent": local_percent,
                "internationalPercent": international_percent,
                "vatPercent": vat_percent,
            },
        )

    async def fetch_ussd_banks(self) -> dict[str, Any]:
        result, _ = await self.request("GET", "banks/NG")
        body = result if isinstance(result, dict) else {}
        if body.get("status") != "success":
            raise ProviderError("Failed to fetch banks from payment gateway", 424)
        banks = body.get("data") if isinstance(body.get("data"), list) else []
        data = [
            {"id": item.get("id"), "name": str(item.get("name") or ""), "code": str(item.get("code") or "")}
            for item in banks
            if isinstance(item, dict) and str(item.get("code") or "") in _SUPPORTED_USSD_BANKS
        ]
        data.sort(key=lambda item: item["name"])
        return {
            "success": True,
            "message": "USSD supported banks retrieved successfully",
            "data": data,
            "environment": self.credentials.environment,
        }

    async def initialize_ussd_charge(
        self,
        user_id: int,
        email: str,
        full_name: str,
        amount: float,
        bank_code: str,
        reference: str | None = None,
    ) -> dict[str, Any]:
        if not math.isfinite(amount) or amount <= 0 or not bank_code.strip():
            raise ProviderError("Amount and bank code are required", 400)
        tx_ref = reference.strip() if reference and reference.strip() else f"PS-USSD-{user_id}-{int(datetime.now().timestamp() * 1000)}"
        result, _ = await self.request(
            "POST",
            "charges?type=ussd",
            {
                "amount": amount,
                "currency": "NGN",
                "email": email,
                "tx_ref": tx_ref,
                "type": "ussd",
                "account_bank": bank_code.strip(),
                "fullname": full_name,
            },
        )
        body = result if isinstance(result, dict) else {}
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
        authorization = meta.get("authorization") if isinstance(meta.get("authorization"), dict) else {}
        if body.get("status") != "success":
            raise ProviderError(str(body.get("message") or "Failed to generate USSD code from gateway"), 424)
        code = authorization.get("note") or data.get("payment_code")
        if not code:
            raise ProviderError("USSD code not found in gateway response", 424)
        return {
            "success": True,
            "message": "USSD charge initiated successfully",
            "data": {"txRef": tx_ref, "ussdCode": code},
            "environment": self.credentials.environment,
        }

    async def verify_ussd_payment(self, reference: str) -> dict[str, Any]:
        tx_ref = reference.strip()
        if not tx_ref:
            raise ProviderError("Missing transaction reference", 400)
        result, _ = await self.request(
            "GET",
            f"transactions/verify_by_reference?tx_ref={quote(tx_ref, safe='')}",
        )
        body = result if isinstance(result, dict) else {}
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        if body.get("status") != "success":
            raise ProviderError("Gateway failed to provide a valid verification response", 424)
        status = str(data.get("status") or "unknown")
        return {
            "success": True,
            "message": "USSD payment status verified",
            "data": {
                "paymentStatus": status,
                "gatewayMessage": "Payment Successful"
                if status == "successful"
                else status[:1].upper() + status[1:],
            },
            "environment": self.credentials.environment,
        }

    async def initialize_card_charge(
        self, context: FlutterwaveCardContext, input: FlutterwaveCardInput
    ) -> dict[str, Any]:
        amount = _valid_amount(input.get("amount"))
        currency = _valid_currency(input.get("currency"))
        reference = str(input.get("reference") or "").strip() or _create_reference(context["userId"])
        if str(input.get("savedCardToken") or "").strip():
            result, _ = await self.request(
                "POST",
                "tokenized-charges",
                {
                    "token": str(input["savedCardToken"]).strip(),
                    "currency": currency,
                    "country": "NG",
                    "amount": amount,
                    "email": context["email"],
                    "full_name": context["fullName"],
                    "tx_ref": reference,
                    "redirect_url": _webhook_url(context["environment"]),
                },
            )
            return _normalize_card_response(result, reference)

        card_number = re.sub(r"\D", "", str(input.get("cardNumber") or ""))
        cvv = str(input.get("cvv") or "").strip()
        month = str(input.get("expiryMonth") or "").strip()
        year = str(input.get("expiryYear") or "").strip()
        if not re.fullmatch(r"\d{12,19}", card_number):
            raise ProviderError("cardNumber is invalid", 400)
        if not re.fullmatch(r"\d{3,4}", cvv):
            raise ProviderError("cvv is invalid", 400)
        if not re.fullmatch(r"(0[1-9]|1[0-2])", month):
            raise ProviderError("expiryMonth is invalid", 400)
        if not re.fullmatch(r"\d{2,4}", year):
            raise ProviderError("expiryYear is invalid", 400)
        provider_payload = {
            "card_number": card_number,
            "cvv": cvv,
            "expiry_month": month,
            "expiry_year": year[-2:],
            "currency": currency,
            "amount": amount,
            "email": context["email"],
            "fullname": str(input.get("cardHolderName") or "").strip() or context["fullName"],
            "phone_number": context["phone"],
            "tx_ref": reference,
            "country": "NG",
            "redirect_url": _webhook_url(context["environment"]),
        }
        encrypted = _encrypt_card_payload(json.dumps(provider_payload), self.credentials.encryption_key)
        result, _ = await self.request(
            "POST",
            "charges?type=card",
            {"client": encrypted},
            {"X-Idempotency-Key": reference, "X-Trace-Id": reference},
        )
        if input.get("saveCard"):
            store_card_save_intent(context, reference)
        return _normalize_card_response(result, reference)

    async def authorize_card_charge(
        self, context: FlutterwaveCardContext, input: dict[str, Any]
    ) -> dict[str, Any]:
        reference = str(input.get("reference") or "").strip()
        if not reference:
            raise ProviderError("reference is required", 400)
        auth_type = input.get("authType")
        if auth_type == "otp":
            otp = str(input.get("otp") or "").strip()
            flw_ref = str(input.get("flwRef") or "").strip()
            if not re.fullmatch(r"\d{4,8}", otp) or not flw_ref:
                raise ProviderError("valid otp and flwRef are required", 400)
            result, _ = await self.request(
                "POST", "validate-charge", {"otp": otp, "flw_ref": flw_ref}
            )
            return _normalize_card_response(result, reference)
        pin = str(input.get("pin") or "").strip()
        if auth_type == "pin" and not re.fullmatch(r"\d{4,6}", pin):
            raise ProviderError("pin is invalid", 400)
        billing = input.get("billingAddress") or {}
        if auth_type in {"avs", "avs_noauth"} and not all(
            str(value or "").strip()
            for value in (
                billing.get("line1") or billing.get("address"),
                billing.get("city"),
                billing.get("state"),
                billing.get("country"),
                billing.get("postalCode") or billing.get("zipcode"),
            )
        ):
            raise ProviderError("billing address is required for AVS authorization", 400)
        card_number = re.sub(r"\D", "", str(input.get("cardNumber") or ""))
        cvv = str(input.get("cvv") or "").strip()
        month = str(input.get("expiryMonth") or "").strip()
        year = str(input.get("expiryYear") or "").strip()
        if not (
            re.fullmatch(r"\d{12,19}", card_number)
            and re.fullmatch(r"\d{3,4}", cvv)
            and re.fullmatch(r"(0[1-9]|1[0-2])", month)
            and re.fullmatch(r"\d{2,4}", year)
        ):
            raise ProviderError("cardNumber, expiryMonth, expiryYear, and cvv are required for card authorization", 400)
        if auth_type == "pin":
            authorization = {"mode": "pin", "pin": pin}
        elif auth_type in {"avs", "avs_noauth"}:
            authorization = {
                "mode": "avs_noauth",
                "address": str(billing.get("line1") or billing.get("address")).strip(),
                "city": str(billing["city"]).strip(),
                "state": str(billing["state"]).strip(),
                "country": str(billing["country"]).strip(),
                "zipcode": str(billing.get("postalCode") or billing.get("zipcode")).strip(),
            }
        else:
            raise ProviderError("authType is invalid", 400)
        payload = {
            "card_number": card_number,
            "cvv": cvv,
            "expiry_month": month,
            "expiry_year": year[-2:],
            "currency": _valid_currency(input.get("currency")),
            "amount": _valid_amount(input.get("amount", 0)),
            "email": context["email"],
            "fullname": context["fullName"],
            "phone_number": context["phone"],
            "tx_ref": reference,
            "country": "NG",
            "authorization": authorization,
            "redirect_url": _webhook_url(context["environment"]),
        }
        idempotency = f"{reference}-{auth_type}-{secrets.token_hex(6)}"
        result, _ = await self.request(
            "POST",
            "charges?type=card",
            {"client": _encrypt_card_payload(json.dumps(payload), self.credentials.encryption_key)},
            {"X-Idempotency-Key": idempotency, "X-Trace-Id": idempotency},
        )
        return _normalize_card_response(result, reference)

    async def verify_card_charge(
        self, reference: str, user_id: int | None = None
    ) -> dict[str, Any]:
        tx_ref = reference.strip()
        if not tx_ref:
            raise ProviderError("reference is required", 400)
        result, _ = await self.request(
            "GET",
            f"transactions/verify_by_reference?tx_ref={quote(tx_ref, safe='')}",
        )
        provider = result if isinstance(result, dict) else {}
        data = provider.get("data") if isinstance(provider.get("data"), dict) else {}
        status = str(data.get("status") or provider.get("status") or "").lower()
        if status in {"successful", "success"}:
            card = data.get("card") if isinstance(data.get("card"), dict) else {}
            card_token = str(card.get("token") or data.get("card_token") or "").strip()
            if user_id and card_token and consume_card_save_intent(user_id, tx_ref, self.credentials.environment):
                save_verified_card(
                    user_id,
                    card_token,
                    str(card.get("last_4digits") or card.get("last4") or ""),
                    str(card.get("type") or card.get("network") or "card"),
                    str(card.get("expiry") or f"{card.get('expiry_month') or ''}/{card.get('expiry_year') or ''}"),
                )
            return {
                "status": "success",
                "nextAction": "none",
                "reference": tx_ref,
                "message": "Card charge verified; awaiting webhook processing",
                "data": {
                    "transactionId": data.get("id"),
                    "flwRef": data.get("flw_ref"),
                    "amount": data.get("amount"),
                    "currency": data.get("currency"),
                    "cardToken": card_token or None,
                    "cardLast4": card.get("last_4digits") or card.get("last4"),
                    "cardBrand": card.get("type") or card.get("network") or "card",
                    "cardExpiry": card.get("expiry"),
                },
            }
        if status in {"failed", "cancelled", "error", "declined"}:
            return {
                "status": "failed",
                "nextAction": "none",
                "reference": tx_ref,
                "message": provider.get("message") or "Card charge failed",
            }
        return {
            "status": "pending",
            "nextAction": _next_action(provider),
            "reference": tx_ref,
            "message": "Card charge is not yet successful",
        }

    async def verify_webhook_event(
        self,
        received_hash: str,
        forced_mode: FlutterwaveMode | None = None,
        transaction_id: str = "",
        reference: str = "",
    ) -> dict[str, Any]:
        credentials = self.credentials
        if forced_mode is not None and credentials.environment != forced_mode:
            raise ProviderError("Invalid webhook signature", 401)
        expected = credentials.webhook_hash
        if not expected or not hmac.compare_digest(received_hash, expected):
            raise ProviderError("Invalid webhook signature", 401)
        tx_ref = reference.strip()
        tx_id = transaction_id.strip()
        if not tx_id and not tx_ref:
            return {"mode": credentials.environment, "data": None}
        endpoint = (
            f"transactions/{quote(tx_id, safe='')}/verify"
            if tx_id
            else f"transactions/verify_by_reference?tx_ref={quote(tx_ref, safe='')}"
        )
        result, _ = await self.request("GET", endpoint)
        body = result if isinstance(result, dict) else {}
        data = body.get("data") if isinstance(body.get("data"), dict) else None
        if body.get("status") != "success" or data is None:
            raise ProviderError("Flutterwave transaction could not be verified", 502)
        return {"mode": credentials.environment, "data": data}

    async def create_virtual_account(
        self,
        user_id: int,
        approved_identity_number: str,
        mode: FlutterwaveMode,
    ) -> FlutterwaveVirtualAccountResult:
        user = _load_user(user_id)
        identity = approved_identity_number.strip()
        if not user["firstName"] or not user["email"] or not user["phoneNumber"] or not identity:
            raise ProviderError("Complete profile details and approved BVN or NIN are required", 400)
        environment = "TEST" if mode == "test" else "LIVE"
        bank_like = "%Flutterwave MFB%" if mode == "test" else "%Sterling%"
        existing = _find_virtual_account(user_id, environment, bank_like)
        if existing:
            return _account_result(existing, "virtual account retrieved successfully")
        order_ref = f"PSVA-{user_id}-{secrets.token_hex(6).upper()}"
        full_name = _full_name(user)
        result, _ = await self.request(
            "POST",
            "virtual-account-numbers",
            {
                "email": user["email"],
                "is_permanent": True,
                "bvn": identity,
                "tx_ref": order_ref,
                "phonenumber": user["phoneNumber"],
                "firstname": user["firstName"],
                "lastname": user["lastName"],
                "narration": full_name,
                "bank_code": "090567" if mode == "test" else "232",
            },
        )
        body = result if isinstance(result, dict) else {}
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        if body.get("status") != "success" or not data.get("account_number"):
            raise ProviderError("Flutterwave could not create a virtual account", 424)
        account = {
            "accountNumber": str(data["account_number"]),
            "accountName": str(data.get("account_name") or ""),
            "displayName": f"{full_name} - FLW",
            "bankName": str(data.get("bank_name") or ""),
            "orderRef": order_ref,
            "createdAt": datetime.now(timezone.utc),
        }
        with get_database_engine().begin() as connection:
            connection.execute(
                text('DELETE FROM "virtualAccounts" WHERE "userId"=:user_id AND "provider"=:provider AND "environment"=:environment'),
                {"user_id": user_id, "provider": "flutterwave", "environment": environment},
            )
            connection.execute(
                text(
                    """
                    INSERT INTO "virtualAccounts"
                      ("userId","provider","environment","accountNumber","accountName",
                       "bankName","orderRef","displayName","runStatus","isActive")
                    VALUES (:user_id,'flutterwave',:environment,:account_number,:account_name,
                       :bank_name,:order_ref,:display_name,1,1)
                    """
                ),
                {
                    "user_id": user_id,
                    "environment": environment,
                    "account_number": account["accountNumber"],
                    "account_name": account["accountName"],
                    "bank_name": account["bankName"],
                    "order_ref": order_ref,
                    "display_name": account["displayName"],
                },
            )
        return _account_result(account, "virtual account created successfully", mode)

    async def create_invoice_account(
        self,
        invoice_number: str,
        approved_identity_number: str,
        attempt_reference: str | None = None,
    ) -> FlutterwaveVirtualAccountResult:
        with get_database_engine().connect() as connection:
            invoice = connection.execute(
                text(
                    """
                    SELECT "id","userId","environment","amount","isAmountFixed",
                           "status","expiresAt","payments"
                    FROM "invoices" WHERE "invoiceNumber"=:invoice_number LIMIT 1
                    """
                ),
                {"invoice_number": invoice_number},
            ).mappings().first()
        if invoice is None:
            raise ProviderError("Invoice was not found", 404)
        expiry = invoice["expiresAt"]
        usable = (
            bool(invoice["isAmountFixed"])
            and invoice["status"] in {"pending", "processing", "active"}
            and (expiry is None or expiry > datetime.now())
        )
        if not usable:
            raise ProviderError("Invoice is not available for bank payment", 409)
        reference = attempt_reference.strip() if attempt_reference and attempt_reference.strip() else invoice_number
        if reference != invoice_number and not _pending_invoice_attempt(invoice["payments"], reference):
            raise ProviderError("Bank payment attempt was not found", 404)
        user = _load_user(int(invoice["userId"]))
        identity = approved_identity_number.strip()
        if not user["firstName"] or not user["email"] or not user["phoneNumber"] or not identity:
            raise ProviderError("Complete profile details and approved BVN or NIN are required", 400)
        mode: FlutterwaveMode = "test" if str(invoice["environment"]).upper() == "TEST" else "live"
        environment = "TEST" if mode == "test" else "LIVE"
        existing = _find_invoice_account(int(invoice["userId"]), environment, reference)
        if existing:
            return _account_result(existing, "invoice virtual account retrieved successfully", reference)
        amount = float(invoice["amount"] or 0)
        if not math.isfinite(amount) or amount <= 0:
            raise ProviderError("Invoice amount must be greater than zero", 400)
        name = _full_name(user)
        result, _ = await self.request(
            "POST",
            "virtual-account-numbers",
            {
                "email": user["email"],
                "is_permanent": False,
                "amount": amount,
                "bvn": identity,
                "tx_ref": reference,
                "phonenumber": user["phoneNumber"],
                "firstname": user["firstName"],
                "lastname": user["lastName"],
                "narration": name,
                "bank_code": "090567" if mode == "test" else "232",
            },
        )
        body = result if isinstance(result, dict) else {}
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        if body.get("status") != "success" or not data.get("account_number"):
            raise ProviderError("Flutterwave could not create the invoice virtual account", 424)
        account = {
            "accountNumber": str(data["account_number"]),
            "accountName": str(data.get("account_name") or ""),
            "displayName": f"{name} - FLW",
            "bankName": str(data.get("bank_name") or ""),
            "orderRef": reference,
            "createdAt": datetime.now(timezone.utc),
        }
        with get_database_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO "virtualAccounts"
                      ("userId","provider","environment","accountNumber","accountName",
                       "bankName","orderRef","displayName","runStatus","isActive")
                    VALUES (:user_id,'flutterwave',:environment,:account_number,:account_name,
                       :bank_name,:order_ref,:display_name,1,1)
                    """
                ),
                {
                    "user_id": int(invoice["userId"]),
                    "environment": environment,
                    "account_number": account["accountNumber"],
                    "account_name": account["accountName"],
                    "bank_name": account["bankName"],
                    "order_ref": reference,
                    "display_name": account["displayName"],
                },
            )
            connection.execute(
                text(
                    """
                    UPDATE "invoices"
                    SET "status"='processing',"paymentMethod"='bank',
                        "provider"='flutterwave',"updatedAt"=CURRENT_TIMESTAMP
                    WHERE "id"=:invoice_id
                      AND "status" IN ('pending','processing','active')
                    """
                ),
                {"invoice_id": invoice["id"]},
            )
        return _account_result(account, "invoice virtual account created successfully", mode, reference)


def create_flutterwave_client(mode: FlutterwaveMode) -> FlutterwaveClient:
    return FlutterwaveClient(load_flutterwave_credentials(mode))


async def create_flutterwave_customer(mode: FlutterwaveMode, payload: dict[str, Any]) -> tuple[Any, int]:
    return await create_flutterwave_client(mode).create_customer(payload)


async def quote_flutterwave_fee(mode: FlutterwaveMode, input: dict[str, Any]) -> FlutterwaveFeeQuote:
    return await create_flutterwave_client(mode).quote_fee(
        input["amount"], input["currency"], input["method"], input.get("cardFirst6", "")
    )


async def fetch_ussd_banks(mode: FlutterwaveMode) -> dict[str, Any]:
    return await create_flutterwave_client(mode).fetch_ussd_banks()


async def initialize_ussd_charge(mode: FlutterwaveMode, input: dict[str, Any]) -> dict[str, Any]:
    return await create_flutterwave_client(mode).initialize_ussd_charge(
        input["userId"], input["email"], input["fullName"], input["amount"],
        input["bankCode"], input.get("reference"),
    )


async def verify_ussd_payment(mode: FlutterwaveMode, reference: str) -> dict[str, Any]:
    return await create_flutterwave_client(mode).verify_ussd_payment(reference)


async def initialize_card_charge(context: FlutterwaveCardContext, input: FlutterwaveCardInput) -> dict[str, Any]:
    client = create_flutterwave_client(context["mode"])
    return await client.initialize_card_charge(context, input)


async def authorize_card_charge(context: FlutterwaveCardContext, input: dict[str, Any]) -> dict[str, Any]:
    return await create_flutterwave_client(context["mode"]).authorize_card_charge(context, input)


async def verify_card_charge(mode: FlutterwaveMode, reference: str, user_id: int | None = None) -> dict[str, Any]:
    return await create_flutterwave_client(mode).verify_card_charge(reference, user_id)


async def verify_flutterwave_webhook_event(input: dict[str, Any]) -> dict[str, Any]:
    received_hash = str(input.get("receivedHash") or "")
    forced_mode = input.get("forcedMode")
    if forced_mode is not None:
        return await create_flutterwave_client(forced_mode).verify_webhook_event(
            received_hash, forced_mode, str(input.get("transactionId") or ""),
            str(input.get("reference") or ""),
        )
    for mode in ("live", "test"):
        try:
            return await create_flutterwave_client(mode).verify_webhook_event(
                received_hash, mode, str(input.get("transactionId") or ""),
                str(input.get("reference") or ""),
            )
        except ProviderError as error:
            if error.status != 503:
                raise
    raise ProviderError("Invalid webhook signature", 401)


def list_saved_flutterwave_cards(user_id: int) -> list[dict[str, Any]]:
    statement = text(
        """
        SELECT "id","cardLast4","cardBrand","cardExpiry","createdAt"
        FROM "userSavedCards"
        WHERE "userId"=:user_id AND "deletedAt" IS NULL
        ORDER BY "createdAt" DESC,"id" DESC
        """
    )
    with get_database_engine().connect() as connection:
        rows = connection.execute(statement, {"user_id": user_id}).mappings().all()
    return [
        {
            "id": int(row["id"]),
            "last4": row["cardLast4"],
            "brand": row["cardBrand"],
            "expiry": row["cardExpiry"],
            "createdAt": row["createdAt"],
        }
        for row in rows
    ]


def get_saved_flutterwave_card_token(user_id: int, card_id: int) -> str:
    statement = text(
        """
        SELECT "cardToken" FROM "userSavedCards"
        WHERE "id"=:card_id AND "userId"=:user_id AND "deletedAt" IS NULL
        LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        token = connection.execute(
            statement, {"card_id": card_id, "user_id": user_id}
        ).scalar_one_or_none()
    if not isinstance(token, str) or not token.strip():
        raise ProviderError("Saved card was not found", 404)
    return token.strip()


def remove_saved_flutterwave_card(user_id: int, card_id: int) -> None:
    statement = text(
        """
        UPDATE "userSavedCards" SET "deletedAt"=CURRENT_TIMESTAMP
        WHERE "id"=:card_id AND "userId"=:user_id AND "deletedAt" IS NULL
        """
    )
    with get_database_engine().begin() as connection:
        result = connection.execute(statement, {"card_id": card_id, "user_id": user_id})
    if not result.rowcount:
        raise ProviderError("Saved card was not found", 404)


def save_verified_card(
    user_id: int,
    card_token: str,
    card_last4: str,
    card_brand: str,
    card_expiry: str,
) -> None:
    if not card_token.strip():
        return
    statement = text(
        """
        INSERT INTO "userSavedCards"
            ("userId","cardToken","cardLast4","cardBrand","cardExpiry")
        VALUES (:user_id,:token,:last4,:brand,:expiry)
        ON CONFLICT ("userId","cardToken") DO NOTHING
        """
    )
    with get_database_engine().begin() as connection:
        connection.execute(
            statement,
            {
                "user_id": user_id,
                "token": card_token.strip(),
                "last4": card_last4,
                "brand": card_brand or "card",
                "expiry": card_expiry,
            },
        )


def store_card_save_intent(context: FlutterwaveCardContext, reference: str) -> None:
    key = _card_save_intent_key(reference)
    store_cached_payload(
        key,
        {"userId": context["userId"], "reference": reference},
        15 * 60,
        context["environment"],
    )


def consume_card_save_intent(user_id: int, reference: str, environment: FlutterwaveMode) -> bool:
    key = _card_save_intent_key(reference)
    cache_environment = "TEST" if environment == "test" else "LIVE"
    payload = get_cached_payload(key, cache_environment)
    if not isinstance(payload, dict) or payload.get("userId") != user_id or payload.get("reference") != reference:
        return False
    delete_cached_payload(key, cache_environment)
    return True


async def get_or_create_flutterwave_virtual_account(
    user_id: int,
    mode: FlutterwaveMode,
    approved_identity_number: str = "",
) -> FlutterwaveVirtualAccountResult:
    return await create_flutterwave_client(mode).create_virtual_account(
        user_id, approved_identity_number, mode
    )


async def get_or_create_flutterwave_invoice_account(
    invoice_number: str,
    attempt_reference: str | None = None,
    *,
    approved_identity_number: str = "",
    mode: FlutterwaveMode = "live",
) -> FlutterwaveVirtualAccountResult:
    return await create_flutterwave_client(mode).create_invoice_account(
        invoice_number, approved_identity_number, attempt_reference
    )


def normalize_card_response(value: Any, reference: str) -> dict[str, Any]:
    return _normalize_card_response(value, reference)


def _normalize_card_response(value: Any, reference: str) -> dict[str, Any]:
    provider = value if isinstance(value, dict) else {}
    data = provider.get("data") if isinstance(provider.get("data"), dict) else {}
    provider_status = str(data.get("status") or provider.get("status") or "pending").lower()
    status = (
        "success"
        if provider_status in {"success", "successful"}
        else "failed"
        if provider_status in {"failed", "cancelled", "error", "declined"}
        else "pending"
    )
    return {
        "status": status,
        "nextAction": _next_action(provider) if status == "pending" else "none",
        "chargeId": data.get("id") or data.get("txn_id") or provider.get("id"),
        "flwRef": data.get("flw_ref") or provider.get("flw_ref"),
        "reference": reference,
        "redirectUrl": data.get("redirect_url") or data.get("redirectUrl") or provider.get("redirect_url") or provider.get("redirectUrl"),
        "message": str(provider.get("message") or data.get("processor_response") or "Card charge submitted"),
    }


def _next_action(provider: dict[str, Any]) -> str:
    data = provider.get("data") if isinstance(provider.get("data"), dict) else {}
    auth = provider.get("meta", {}).get("authorization", {}) if isinstance(provider.get("meta"), dict) else {}
    auth_mode = str(auth.get("mode") or data.get("auth_model") or provider.get("auth_model") or "").lower()
    redirect = data.get("redirect_url") or data.get("redirectUrl") or provider.get("redirect_url") or provider.get("redirectUrl")
    if str(data.get("status") or provider.get("status") or "").lower() in {"failed", "cancelled", "error", "declined"}:
        return "none"
    if redirect:
        return "redirect"
    if "pin" in auth_mode:
        return "pin"
    if any(value in auth_mode for value in ("otp", "vbv", "3ds", "secure")):
        return "otp"
    if "avs_noauth" in auth_mode:
        return "avs_noauth"
    if "avs" in auth_mode or "address" in auth_mode:
        return "avs"
    return "none"


def _encrypt_card_payload(payload: str, encryption_key: str) -> str:
    from cryptography.hazmat.primitives import padding
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
    from cryptography.hazmat.primitives.ciphers import Cipher, modes

    raw_key = encryption_key.encode("utf-8")
    try:
        decoded_key = base64.b64decode(encryption_key, validate=True)
    except ValueError:
        decoded_key = b""
    key = raw_key if len(raw_key) == 24 else decoded_key if len(decoded_key) == 24 else None
    if key is None:
        raise ProviderError("Flutterwave encryption key must be 24 bytes", 503)
    padder = padding.PKCS7(TripleDES.block_size).padder()
    padded = padder.update(payload.encode("utf-8")) + padder.finalize()
    try:
        encryptor = Cipher(TripleDES(key), modes.ECB()).encryptor()
        encrypted = encryptor.update(padded) + encryptor.finalize()
    except ValueError as error:
        raise ProviderError("Unable to encrypt Flutterwave card payload", 503) from error
    return base64.b64encode(encrypted).decode("ascii")


def _valid_amount(value: Any) -> float:
    try:
        amount = float(value)
    except (TypeError, ValueError) as error:
        raise ProviderError("amount must be greater than zero", 400) from error
    if not math.isfinite(amount) or amount <= 0 or amount > 100_000_000:
        raise ProviderError("amount must be greater than zero", 400)
    return _round_money(amount)


def _valid_currency(value: Any) -> str:
    currency = str(value or "NGN").strip().upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ProviderError("currency must be a valid three-letter code", 400)
    return currency


def _round_money(value: float) -> float:
    return math.floor((value + 1e-9) * 100 + 0.5) / 100


def _format_money(value: float) -> str:
    return f"{_round_money(value):.2f}"


def _webhook_url(environment: Literal["LIVE", "TEST"]) -> str:
    return f"https://api.paysmart.com.ng/v1/webhooks/flutterwave/{'sandbox.php' if environment == 'TEST' else 'production.php'}"


def _create_reference(user_id: int) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"PS-CARD-{user_id}-{stamp}-{secrets.token_hex(5).upper()}"


def _card_save_intent_key(reference: str) -> str:
    digest = hashlib.sha256(reference.encode("utf-8")).hexdigest()
    return f"flutterwave.card.save.{digest}"


def _load_user(user_id: int) -> dict[str, Any]:
    statement = text(
        """
        SELECT "firstName","middleName","lastName","email","phoneNumber"
        FROM "users" WHERE "userId"=:user_id LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        user = connection.execute(statement, {"user_id": user_id}).mappings().first()
    if user is None:
        raise ProviderError("User profile could not be found", 404)
    return dict(user)


def _full_name(user: dict[str, Any]) -> str:
    return " ".join(
        str(user.get(field) or "").strip()
        for field in ("firstName", "middleName", "lastName")
        if str(user.get(field) or "").strip()
    )


def _find_virtual_account(user_id: int, environment: str, bank_name_pattern: str) -> dict[str, Any] | None:
    statement = text(
        """
        SELECT "accountNumber","accountName","displayName","bankName","orderRef","createdAt"
        FROM "virtualAccounts"
        WHERE "userId"=:user_id AND "provider"='flutterwave'
          AND "environment"=:environment AND "isActive"=1
          AND "bankName" LIKE :bank_name LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement,
            {"user_id": user_id, "environment": environment, "bank_name": bank_name_pattern},
        ).mappings().first()
    return dict(row) if row is not None else None


def _find_invoice_account(user_id: int, environment: str, reference: str) -> dict[str, Any] | None:
    statement = text(
        """
        SELECT "accountNumber","accountName","displayName","bankName","orderRef","createdAt"
        FROM "virtualAccounts"
        WHERE "userId"=:user_id AND "provider"='flutterwave'
          AND "environment"=:environment AND "orderRef"=:reference
          AND "isActive"=1 LIMIT 1
        """
    )
    with get_database_engine().connect() as connection:
        row = connection.execute(
            statement,
            {"user_id": user_id, "environment": environment, "reference": reference},
        ).mappings().first()
    return dict(row) if row is not None else None


def _pending_invoice_attempt(payments: Any, reference: str) -> bool:
    if isinstance(payments, str):
        try:
            payments = json.loads(payments)
        except json.JSONDecodeError:
            return False
    if isinstance(payments, dict):
        payments = list(payments.values())
    if not isinstance(payments, list):
        return False
    return any(
        isinstance(item, dict)
        and item.get("reference") == reference
        and str(item.get("status") or "").lower() in {"pending", "processing"}
        for item in payments
    )


def _account_result(
    row: dict[str, Any],
    message: str,
    environment: FlutterwaveMode | None = None,
    attempt_reference: str | None = None,
) -> FlutterwaveVirtualAccountResult:
    return FlutterwaveVirtualAccountResult(
        status="success",
        message=message,
        provider="flutterwave",
        account={
            "accountNumber": row["accountNumber"],
            "accountName": row.get("displayName") or row.get("accountName") or "Your PaySmart Account",
            "bankName": row["bankName"],
            "createdAt": row.get("createdAt"),
            "orderRef": row.get("orderRef"),
        },
        environment=environment,
        attemptRef=attempt_reference,
    )
