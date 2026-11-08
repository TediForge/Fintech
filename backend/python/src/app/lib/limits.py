"""Transaction-limit and withdrawal-anomaly checks."""

from datetime import datetime, timezone
from typing import Any, Literal, NotRequired, TypedDict

from sqlalchemy import text

from database.db_01.connection import get_database_engine

LimitDirection = Literal["credit", "debit"]


class LimitDecision(TypedDict):
    status: Literal["allowed", "blocked", "verification_required", "error"]
    message: str
    httpStatus: int
    limitType: NotRequired[str]
    riskType: NotRequired[str]
    actionRequired: NotRequired[str]
    currentTier: NotRequired[str]
    requiredTier: NotRequired[str]


def validate_transaction_limit(
    *,
    user_id: int,
    environment: Literal["LIVE", "TEST"],
    mode: Literal["live", "test"],
    amount: float,
    direction: LimitDirection,
    ip_address: str,
    device_info: str,
) -> LimitDecision:
    with get_database_engine().connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT "kycLevel", "status", "isPnd", "createdAt"
                FROM "users" WHERE "userId" = :user_id LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).mappings().first()
        if user is None:
            return {"status": "error", "message": "Account was not found", "httpStatus": 404}
        if user["status"] != "active" or bool(user["isPnd"]):
            return {"status": "error", "message": "Account is restricted", "httpStatus": 403}

        if mode == "test":
            bypass = connection.execute(
                text(
                    'SELECT "limitsTestBypass" FROM "systemSettings" '
                    'WHERE "id" = \'global\' LIMIT 1'
                )
            ).scalar_one_or_none()
            if bypass is None:
                raise RuntimeError("Global system settings are not initialized")
            if bool(bypass):
                return {
                    "status": "allowed",
                    "message": "Transaction allowed under test limits bypass",
                    "httpStatus": 200,
                }

        tier = str(user["kycLevel"] or "").strip().lower()
        if not tier or tier in {"tier0", "0"}:
            return {
                "status": "blocked",
                "message": "Identity verification is required",
                "httpStatus": 403,
                "actionRequired": "kycUpgrade",
                "currentTier": "tier0",
                "requiredTier": "tier1",
            }

        limits = connection.execute(
            text(
                """
                SELECT "dailyDeposit", "weeklyDeposit", "monthlyDeposit", "yearlyDeposit",
                       "dailyWithdraw", "weeklyWithdraw", "monthlyWithdraw", "yearlyWithdraw"
                FROM "tierLimits" WHERE "tier" = :tier LIMIT 1
                """
            ),
            {"tier": user["kycLevel"]},
        ).mappings().first()
        if limits is None:
            return {"status": "error", "message": "Account limits are unavailable", "httpStatus": 500}

        usage = connection.execute(
            text(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE
                        THEN "amount" ELSE 0 END), 0) AS "dailyTotal",
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('week', CURRENT_TIMESTAMP)
                        THEN "amount" ELSE 0 END), 0) AS "weeklyTotal",
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
                        THEN "amount" ELSE 0 END), 0) AS "monthlyTotal",
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('year', CURRENT_TIMESTAMP)
                        THEN "amount" ELSE 0 END), 0) AS "yearlyTotal"
                FROM "transactions"
                WHERE "userId" = :user_id AND "environment" = :environment
                  AND "status" = 'successful' AND "direction" = :direction
                """
            ),
            {
                "user_id": user_id,
                "environment": environment,
                "direction": direction,
            },
        ).mappings().first()
    if usage is None:
        return {"status": "error", "message": "Transaction history is unavailable", "httpStatus": 500}

    limit_suffix = "Deposit" if direction == "credit" else "Withdraw"
    message_prefix = "deposit" if direction == "credit" else "withdrawal"
    checks = (
        ("daily", usage["dailyTotal"], limits[f"daily{limit_suffix}"]),
        ("weekly", usage["weeklyTotal"], limits[f"weekly{limit_suffix}"]),
        ("monthly", usage["monthlyTotal"], limits[f"monthly{limit_suffix}"]),
        ("yearly", usage["yearlyTotal"], limits[f"yearly{limit_suffix}"]),
    )
    for period, current, limit in checks:
        if float(current) + amount > float(limit):
            return {
                "status": "blocked",
                "message": f"{period} {message_prefix} limit exceeded",
                "httpStatus": 200,
                "limitType": f"{period}_{message_prefix}",
            }

    if direction == "debit":
        anomaly = _detect_debit_anomaly(
            user_id=user_id,
            environment=environment,
            amount=amount,
            ip_address=ip_address,
            device_info=device_info,
            created_at=user["createdAt"],
            daily_limit=float(limits["dailyWithdraw"]),
        )
        if anomaly is not None:
            return anomaly
    return {
        "status": "allowed",
        "message": "Transaction is within your allowed account limits",
        "httpStatus": 200,
    }


def _detect_debit_anomaly(
    *,
    user_id: int,
    environment: str,
    amount: float,
    ip_address: str,
    device_info: str,
    created_at: datetime,
    daily_limit: float,
) -> LimitDecision | None:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = (now - created_at).total_seconds() / 86_400
    if age_days <= 180:
        if age_days < 2 and amount > daily_limit * 0.5:
            return _record_risk(
                user_id,
                amount,
                ip_address,
                device_info,
                "onboarding_protection",
                "High transaction requires verification",
                "MEDIUM",
            )
        if amount >= daily_limit * 0.7:
            return _record_risk(
                user_id,
                amount,
                ip_address,
                device_info,
                "high_transaction_detected",
                "High transaction requires verification",
                "MEDIUM",
            )

    with get_database_engine().connect() as connection:
        history = connection.execute(
            text(
                """
                SELECT
                    SUM(CASE WHEN "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
                        THEN 1 ELSE 0 END) AS "transactionCount",
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
                        THEN "amount" ELSE 0 END), 0) AS "transactionTotal",
                    AVG(CASE WHEN "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                        THEN "amount" END) AS "averageAmount",
                    STDDEV(CASE WHEN "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                        THEN "amount" END) AS "standardDeviation",
                    SUM(CASE WHEN "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                        THEN 1 ELSE 0 END) AS "monthlyCount"
                FROM "transactions"
                WHERE "userId" = :user_id AND "environment" = :environment
                  AND "status" = 'successful' AND "direction" = 'debit'
                """
            ),
            {"user_id": user_id, "environment": environment},
        ).mappings().first()
    if history is None:
        return None
    if (
        int(history["transactionCount"] or 0) >= 5
        and float(history["transactionTotal"] or 0) > daily_limit * 0.3
    ):
        return _record_risk(
            user_id,
            amount,
            ip_address,
            device_info,
            "velocity_spike",
            "Transaction frequency requires verification",
            "HIGH",
        )
    if (
        int(history["monthlyCount"] or 0) >= 15
        and float(history["averageAmount"] or 0) >= 1000
    ):
        average = float(history["averageAmount"])
        deviation = float(history["standardDeviation"] or 0)
        threshold = max(average + 2.5 * deviation, average * 4)
        if amount > threshold and amount > daily_limit * 0.2:
            return _record_risk(
                user_id,
                amount,
                ip_address,
                device_info,
                "high_amount_anomaly",
                "Unusual transaction requires verification",
                "MEDIUM",
            )
    return None


def _record_risk(
    user_id: int,
    amount: float,
    ip_address: str,
    device_info: str,
    risk_type: str,
    message: str,
    severity: str,
) -> LimitDecision:
    with get_database_engine().begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO "riskEvents" ("userId", "riskType", "amount", "ipAddress", "deviceInfo")
                VALUES (:user_id, :risk_type, :amount, :ip_address, :device_info)
                """
            ),
            {
                "user_id": user_id,
                "risk_type": risk_type,
                "amount": amount,
                "ip_address": ip_address,
                "device_info": device_info,
            },
        )
        risk_count = connection.execute(
            text(
                """
                SELECT COUNT(*) FROM "riskEvents"
                WHERE "userId" = :user_id
                  AND "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                """
            ),
            {"user_id": user_id},
        ).scalar_one()
        if int(risk_count) >= 5:
            connection.execute(
                text('UPDATE "users" SET "isPnd" = TRUE WHERE "userId" = :user_id'),
                {"user_id": user_id},
            )
    return {
        "status": "verification_required",
        "message": message,
        "httpStatus": 200,
        "riskType": risk_type,
    }
