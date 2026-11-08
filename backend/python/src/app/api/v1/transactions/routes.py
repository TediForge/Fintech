"""Authenticated transaction history, analytics, leaderboard, and statements."""

import asyncio
import base64
import csv
import io
import json
import logging
import re
from datetime import UTC, date, datetime, timedelta
from importlib.resources import files
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import text

from app.api.deps import require_user
from app.services.document.csv import generate_csv_buffer
from app.services.document.pdf import generate_pdf_buffer
from app.services.document.xlsx import generate_xlsx_buffer
from app.services.notification.mail import enqueue_email_notification
from app.services.notification.push import send_push_notification
from database.db_01.connection import get_database_engine

router = APIRouter()
AuthenticatedUser = Annotated[dict[str, Any], Depends(require_user)]
_LOGGER = logging.getLogger(__name__)
WalletType = Literal["MAIN", "SPEND&SAVE", "CASHBACK"]
StatementFormat = Literal["pdf", "csv", "xlsx"]
WALLETS: tuple[WalletType, ...] = ("MAIN", "SPEND&SAVE", "CASHBACK")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CATEGORY_DATA = json.loads(files("app.data").joinpath("categories.json").read_text())
_CATEGORIES: dict[str, dict[str, Any]] = _CATEGORY_DATA["expenseCategories"]
_INCOME_CATEGORIES: dict[str, dict[str, Any]] = _CATEGORY_DATA["incomeCategories"]


class StatementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    startDate: date
    endDate: date
    delivery: Literal["email", "download"]
    format: StatementFormat


@router.get("/")
async def transaction_history(
    request: Request,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    page = _positive_query_integer(request.query_params.get("page"), 1, 1_000_000)
    limit = _positive_query_integer(request.query_params.get("limit"), 20, 100)
    wallet_input = request.query_params.get("walletType", "MAIN")
    wallet_types = [value.strip().upper() for value in wallet_input.split(",")]
    if not wallet_types or any(wallet not in WALLETS for wallet in wallet_types):
        raise HTTPException(status_code=400, detail="Invalid wallet type")

    start_date = _parse_query_date(request.query_params.get("startDate"))
    end_date = _parse_query_date(request.query_params.get("endDate"))
    parameters: dict[str, Any] = {
        "user_id": auth["user_id"],
        "environment": auth["environment"],
    }
    clauses = ['"userId" = :user_id', '"environment" = :environment']
    clauses.append(
        f'"walletType" IN ({_bind_list("wallet", wallet_types, parameters)})'
    )
    categories = _split_query_values(request.query_params.get("category"))
    hidden = [
        item
        for item in ("Cashback Debit", "System Adjustment", "Internal Transfer")
        if item not in categories
    ]
    if hidden and "All Categories" not in categories:
        clauses.append(f'"type" NOT IN ({_bind_list("hidden", hidden, parameters)})')
    if categories and "All Categories" not in categories:
        clauses.append(f'"type" IN ({_bind_list("category", categories, parameters)})')
    status = _query_value(request.query_params.get("status"))
    if status and status != "All Status":
        if status.lower() == "success":
            clauses.append("\"status\" IN ('success', 'successful', 'completed')")
        else:
            clauses.append('"status" = :status')
            parameters["status"] = status
    if start_date:
        clauses.append('"createdAt" >= :start_date')
        parameters["start_date"] = datetime.combine(start_date, datetime.min.time())
    if end_date:
        clauses.append('"createdAt" <= :end_date')
        parameters["end_date"] = datetime.combine(end_date, datetime.max.time())
    where_clause = " AND ".join(clauses)

    def fetch() -> tuple[int, list[dict[str, Any]]]:
        with get_database_engine().connect() as connection:
            total = connection.execute(
                text(f'SELECT COUNT(*) FROM "transactions" WHERE {where_clause}'),
                parameters,
            ).scalar_one()
            rows = connection.execute(
                text(
                    """
                    SELECT "id", "psRef", "sessionReference", "amount", "fee",
                           "currency", "type", "direction", "serviceName", "status",
                           "narration", "walletType", "createdAt"
                    FROM "transactions"
                    WHERE """
                    + where_clause
                    + ' ORDER BY "createdAt" DESC LIMIT :limit OFFSET :offset'
                ),
                {**parameters, "limit": limit, "offset": (page - 1) * limit},
            ).mappings()
            return int(total or 0), [dict(row) for row in rows]

    total_records, rows = await asyncio.to_thread(fetch)
    return {
        "status": "success",
        "message": "Transaction history retrieved",
        "count": len(rows),
        "pagination": {
            "totalRecords": total_records,
            "totalPages": (total_records + limit - 1) // limit,
            "currentPage": page,
            "limit": limit,
        },
        "transactions": [_to_transaction(row) for row in rows],
    }


@router.get("/analysis")
async def transaction_analysis(
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT "type", "serviceName", "narration", "amount",
                           "direction", "createdAt"
                    FROM "transactions"
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "walletType" = 'MAIN' AND "status" = 'successful'
                      AND "createdAt" >= DATE_TRUNC(
                          'month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                      )
                    ORDER BY "createdAt" DESC
                    """
                ),
                {"user_id": auth["user_id"], "environment": auth["environment"]},
            ).mappings()
            return [dict(row) for row in rows]

    rows = await asyncio.to_thread(fetch)
    return _build_monthly_analysis(rows, auth["environment"])


@router.get("/leaderboard")
async def transaction_leaderboard(
    request: Request,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    week_start = _parse_query_date(
        request.query_params.get("weekStart"), field_name="weekStart"
    )
    start, end, week_name = _week_context(week_start)
    scope = _query_value(request.query_params.get("scope")) or "top10"
    await asyncio.to_thread(
        _sync_leaderboard_week, auth["environment"], start, end, week_name
    )

    def fetch() -> list[dict[str, Any]]:
        with get_database_engine().connect() as connection:
            if scope != "rank":
                rows = connection.execute(
                    text(
                        """
                        SELECT l."rank", u."firstName", u."middleName", u."gender",
                               l."weekName"
                        FROM "weeklyLeaderboard" l
                        JOIN "users" u ON u."userId" = l."userId"
                        WHERE l."startDate" = :start AND l."environment" = :environment
                        ORDER BY l."rank" ASC, l."totalAmount" DESC
                        LIMIT 10
                        """
                    ),
                    {"start": start, "environment": auth["environment"]},
                ).mappings()
                return [dict(row) for row in rows]
            rows = connection.execute(
                text(
                    """
                    SELECT u."userId", u."firstName", u."middleName", u."gender",
                           SUM(t."amount") AS "totalAmount",
                           RANK() OVER (ORDER BY SUM(t."amount") DESC) AS "rank"
                    FROM "transactions" t
                    JOIN "users" u ON u."userId" = t."userId"
                    WHERE t."status" = 'successful'
                      AND t."environment" = :environment
                      AND t."createdAt" >= :start_at AND t."createdAt" <= :end_at
                    GROUP BY u."userId", u."firstName", u."middleName", u."gender"
                    ORDER BY "totalAmount" DESC
                    LIMIT 10
                    """
                ),
                {
                    "environment": auth["environment"],
                    "start_at": datetime.combine(start, datetime.min.time()),
                    "end_at": datetime.combine(end, datetime.max.time()),
                },
            ).mappings()
            return [dict(row) for row in rows]

    rows = await asyncio.to_thread(fetch)
    if scope != "rank":
        return {
            "success": True,
            "message": "Leaderboard loaded",
            "data": [
                {
                    "rank": int(row["rank"]),
                    "name": f"{row['firstName']} {row['middleName'] or ''}".strip(),
                    "profileImage": None,
                    "gender": row["gender"] or "other",
                    "weekName": row["weekName"],
                }
                for row in rows
            ],
        }
    current = next((row for row in rows if int(row["userId"]) == auth["user_id"]), None)
    return {
        "success": True,
        "message": "User rank retrieved",
        "data": {
            "rank": int(current["rank"]) if current else None,
            "name": (
                f"{current['firstName']} {current['middleName'] or ''}".strip()
                if current
                else "User"
            ),
            "weekName": week_name,
        },
    }


@router.post("/statement")
@router.post("/statements")
async def generate_statement(
    request: Request,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    try:
        payload = StatementRequest.model_validate(await request.json())
    except (ValidationError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="startDate, endDate, delivery, and format are required",
        ) from None
    if payload.endDate < payload.startDate:
        raise HTTPException(
            status_code=400, detail="endDate must not be before startDate"
        )

    def fetch() -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        with get_database_engine().connect() as connection:
            user = (
                connection.execute(
                    text(
                        'SELECT "email", "firstName" FROM "users" '
                        'WHERE "userId" = :user_id LIMIT 1'
                    ),
                    {"user_id": auth["user_id"]},
                )
                .mappings()
                .first()
            )
            rows = connection.execute(
                text(
                    """
                    SELECT "createdAt", "psRef", "serviceName", "amount",
                           "currency", "direction", "status"
                    FROM "transactions"
                    WHERE "userId" = :user_id AND "environment" = :environment
                      AND "walletType" = 'MAIN'
                      AND "createdAt" >= :start_at AND "createdAt" <= :end_at
                    ORDER BY "createdAt" DESC
                    """
                ),
                {
                    "user_id": auth["user_id"],
                    "environment": auth["environment"],
                    "start_at": datetime.combine(
                        payload.startDate, datetime.min.time()
                    ),
                    "end_at": datetime.combine(payload.endDate, datetime.max.time()),
                },
            ).mappings()
            return (dict(user) if user is not None else None), [
                dict(row) for row in rows
            ]

    user, rows = await asyncio.to_thread(fetch)
    if user is None or not user.get("email"):
        raise HTTPException(
            status_code=400, detail="A profile email is required for statements"
        )
    transactions = [_statement_transaction(row) for row in rows]
    output = await asyncio.to_thread(
        _generate_statement_export,
        str(user.get("firstName") or "User"),
        payload.startDate.isoformat(),
        payload.endDate.isoformat(),
        transactions,
        payload.format,
    )
    file_name = statement_file_name(
        payload.startDate.isoformat(), payload.endDate.isoformat(), payload.format
    )
    if payload.delivery == "download":
        return {
            "success": True,
            "message": "Account statement generated successfully",
            "data": {
                "delivery": payload.delivery,
                "format": payload.format,
                "fileName": file_name,
                "mimeType": statement_mime_type(payload.format),
                "contentBase64": base64.b64encode(output).decode("ascii"),
            },
        }
    email_payload = {
        "email": user["email"],
        "subject": "Your Account Statement",
        "message": {
            "title": "Your Account Statement",
            "greeting": True,
            "blocks": [
                {
                    "type": "paragraph",
                    "text": (
                        f"Your statement for {payload.startDate.isoformat()} to "
                        f"{payload.endDate.isoformat()} is attached."
                    ),
                }
            ],
        },
        "attachmentName": file_name,
        "attachmentContent": base64.b64encode(output).decode("ascii"),
        "attachmentType": statement_mime_type(payload.format),
    }
    job_id = await enqueue_email_notification(email_payload)
    try:
        await send_push_notification(
            {
                "phone": auth.get("phone_number"),
                "email": user["email"],
                "title": "e-Statement Generated",
                "message": "Your account statement has been sent to your email address",
            }
        )
    except Exception:
        _LOGGER.warning("Unable to send statement notification", exc_info=True)
    return {
        "success": True,
        "message": "Account statement queued successfully",
        "data": {
            "delivery": payload.delivery,
            "format": payload.format,
            "jobId": job_id,
        },
    }


@router.get("/{transaction_id}")
async def transaction_details(
    transaction_id: str,
    auth: AuthenticatedUser,
) -> dict[str, Any]:
    if not transaction_id.isdigit() or int(transaction_id) <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction id")

    def fetch() -> dict[str, Any] | None:
        with get_database_engine().connect() as connection:
            row = (
                connection.execute(
                    text(
                        """
                    SELECT "id", "psRef", "sessionReference", "amount", "fee",
                           "currency", "type", "direction", "serviceName", "status",
                           "narration", "walletType", "createdAt"
                    FROM "transactions"
                    WHERE "id" = :id AND "userId" = :user_id
                      AND "environment" = :environment
                    LIMIT 1
                    """
                    ),
                    {
                        "id": int(transaction_id),
                        "user_id": auth["user_id"],
                        "environment": auth["environment"],
                    },
                )
                .mappings()
                .first()
            )
            return dict(row) if row is not None else None

    row = await asyncio.to_thread(fetch)
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction record was not found")
    return {
        "status": "success",
        "message": "Transaction details retrieved",
        "details": _to_transaction(row),
    }


def _sync_leaderboard_week(
    environment: str, start: date, end: date, week_name: str
) -> None:
    with get_database_engine().begin() as connection:
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_name, 0))"),
            {"lock_name": f"leaderboard:{environment}:{start.isoformat()}"},
        )
        finalized = connection.execute(
            text(
                """
                SELECT 1 FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = TRUE
                LIMIT 1
                """
            ),
            {"start": start, "environment": environment},
        ).first()
        if finalized:
            return
        connection.execute(
            text(
                """
                DELETE FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = FALSE
                """
            ),
            {"start": start, "environment": environment},
        )
        connection.execute(
            text(
                """
                INSERT INTO "weeklyLeaderboard"
                    ("userId", "environment", "weekName", "startDate", "endDate",
                     "totalAmount", "rank")
                SELECT t."userId", t."environment", :week_name, :start, :end,
                       SUM(t."amount"),
                       RANK() OVER (ORDER BY SUM(t."amount") DESC)
                FROM "transactions" t
                WHERE t."status" = 'successful'
                  AND t."environment" = :environment
                  AND t."createdAt" >= :start_at AND t."createdAt" <= :end_at
                GROUP BY t."userId", t."environment"
                ORDER BY SUM(t."amount") DESC
                LIMIT 10
                """
            ),
            {
                "week_name": week_name,
                "start": start,
                "end": end,
                "environment": environment,
                "start_at": datetime.combine(start, datetime.min.time()),
                "end_at": datetime.combine(end, datetime.max.time()),
            },
        )
        previous_start = start - timedelta(days=7)
        previous_end = previous_start + timedelta(days=6)
        pending = connection.execute(
            text(
                """
                SELECT 1 FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = FALSE
                LIMIT 1
                """
            ),
            {"start": previous_start, "environment": environment},
        ).first()
        if pending:
            winners = connection.execute(
                text(
                    """
                    SELECT u."firstName", u."middleName"
                    FROM "transactions" t
                    JOIN "users" u ON u."userId" = t."userId"
                    WHERE t."status" = 'successful'
                      AND t."environment" = :environment
                      AND t."createdAt" >= :start_at AND t."createdAt" <= :end_at
                    GROUP BY u."userId", u."firstName", u."middleName"
                    ORDER BY SUM(t."amount") DESC, u."userId" ASC
                    LIMIT 3
                    """
                ),
                {
                    "environment": environment,
                    "start_at": datetime.combine(previous_start, datetime.min.time()),
                    "end_at": datetime.combine(previous_end, datetime.max.time()),
                },
            ).mappings()
            names = [
                f"{winner['firstName']} {winner['middleName'] or ''}".strip()
                for winner in winners
            ]
            connection.execute(
                text(
                    """
                    UPDATE "weeklyLeaderboard"
                    SET "firstPlaceWinner" = :first,
                        "secondPlaceWinner" = :second,
                        "thirdPlaceWinner" = :third,
                        "isFinalized" = TRUE
                    WHERE "startDate" = :start AND "environment" = :environment
                      AND "isFinalized" = FALSE
                    """
                ),
                {
                    "first": names[0] if len(names) > 0 else "N/A",
                    "second": names[1] if len(names) > 1 else "N/A",
                    "third": names[2] if len(names) > 2 else "N/A",
                    "start": previous_start,
                    "environment": environment,
                },
            )


def _week_context(value: date | None) -> tuple[date, date, str]:
    current = value or datetime.now(UTC).date()
    start = current - timedelta(days=current.weekday())
    end = start + timedelta(days=6)
    return start, end, f"Week {start.isocalendar().week:02d}, {start.year}"


def _build_monthly_analysis(
    rows: list[dict[str, Any]], environment: str
) -> dict[str, Any]:
    groups: dict[str, dict[str, dict[str, Any]]] = {
        "bills": {},
        "lifestyle": {},
        "transfers": {},
        "services": {},
    }
    for key, definition in _CATEGORIES.items():
        groups[definition["group"]][key] = {
            "icon": definition["icon"],
            "name": definition["name"],
            "totalAmount": 0.0,
            "transactionCount": 0,
        }
    incomes = {
        key: {
            "icon": definition["icon"],
            "name": definition["name"],
            "totalAmount": 0.0,
            "transactionCount": 0,
        }
        for key, definition in _INCOME_CATEGORIES.items()
    }
    expenses_total = income_total = 0.0
    expenses_count = income_count = 0
    classified_expenses = classified_income = 0
    for row in rows:
        amount = abs(float(row["amount"]))
        search = " ".join(
            str(row.get(key) or "") for key in ("type", "serviceName", "narration")
        ).lower()
        direction = str(row.get("direction") or "").lower()
        if direction in {"debit", "dr"}:
            expenses_total += amount
            expenses_count += 1
            match = next(
                (
                    (key, definition)
                    for key, definition in _CATEGORIES.items()
                    if any(alias in search for alias in definition["aliases"])
                ),
                None,
            )
            if match:
                key, definition = match
                item = groups[definition["group"]][key]
                item["totalAmount"] += amount
                item["transactionCount"] += 1
                classified_expenses += 1
        elif direction in {"credit", "cr"}:
            income_total += amount
            income_count += 1
            match_key = next(
                (
                    key
                    for key, definition in _INCOME_CATEGORIES.items()
                    if any(alias in search for alias in definition["aliases"])
                ),
                None,
            )
            if match_key:
                incomes[match_key]["totalAmount"] += amount
                incomes[match_key]["transactionCount"] += 1
                classified_income += 1

    def summary(items: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return {
            "totalAmount": _round(sum(item["totalAmount"] for item in items.values())),
            "transactionCount": sum(
                item["transactionCount"] for item in items.values()
            ),
            "items": items,
        }

    current = datetime.now(UTC).date()
    month_start = current.replace(day=1)
    next_month = (
        date(current.year + 1, 1, 1)
        if current.month == 12
        else date(current.year, current.month + 1, 1)
    )
    month_end = next_month - timedelta(days=1)
    for item_group in [*groups.values(), incomes]:
        for item in item_group.values():
            item["totalAmount"] = _round(item["totalAmount"])
    return {
        "success": True,
        "message": "Monthly transaction analysis retrieved",
        "data": {
            "period": {
                "month": month_start.strftime("%Y-%m"),
                "startDate": month_start.isoformat(),
                "endDate": month_end.isoformat(),
                "timezone": "Africa/Lagos",
            },
            "wallet": {"type": "MAIN", "environment": environment},
            "expenses": {
                "totalAmount": _round(expenses_total),
                "transactionCount": expenses_count,
                "bills": summary(groups["bills"]),
                "lifestyle": summary(groups["lifestyle"]),
                "transfers": summary(groups["transfers"]),
                "services": summary(groups["services"]),
            },
            "income": {
                "totalAmount": _round(income_total),
                "transactionCount": income_count,
                "deposit": incomes["deposit"],
                "rewards": incomes["rewards"],
            },
            "netSavings": _round(income_total - expenses_total),
            "summary": {
                "transactionCount": len(rows),
                "classifiedExpenseCount": classified_expenses,
                "classifiedIncomeCount": classified_income,
            },
        },
    }


def _to_transaction(row: dict[str, Any]) -> dict[str, Any]:
    amount = float(row["amount"])
    return {
        "id": row["id"],
        "reference": row.get("psRef"),
        "sessionReference": row.get("sessionReference"),
        "amount": amount,
        "chargedAmount": amount + float(row.get("fee") or 0),
        "currency": row.get("currency"),
        "transactionType": row.get("type"),
        "direction": row.get("direction"),
        "serviceName": row.get("serviceName"),
        "status": row.get("status"),
        "narration": row.get("narration"),
        "walletType": row.get("walletType"),
        "createdAt": row.get("createdAt"),
    }


def _statement_transaction(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "createdAt": row["createdAt"],
        "reference": row.get("psRef") or "",
        "serviceName": row.get("serviceName") or "",
        "amount": float(row["amount"]),
        "currency": row.get("currency") or "NGN",
        "direction": row.get("direction") or "debit",
        "status": row["status"],
    }


def _generate_statement_export(
    first_name: str,
    start_date: str,
    end_date: str,
    transactions: list[dict[str, Any]],
    format_name: StatementFormat,
) -> bytes:
    headings = [
        "Date",
        "Reference",
        "Service",
        "Amount",
        "Currency",
        "Direction",
        "Status",
    ]
    rows = [
        [
            _iso_value(item["createdAt"]),
            item["reference"],
            item["serviceName"],
            f"{item['amount']:.2f}",
            item["currency"],
            item["direction"],
            item["status"],
        ]
        for item in transactions
    ]
    if format_name == "csv":
        return generate_csv_buffer(rows, headings)
    if format_name == "xlsx":
        return generate_xlsx_buffer(rows, headings)
    document = {
        "pageSize": "A4",
        "pageOrientation": "landscape",
        "pageMargins": [24, 30, 24, 30],
        "styles": {"title": {"fontSize": 16, "bold": True, "margin": [0, 0, 0, 8]}},
        "content": [
            {
                "text": (
                    f"Account Statement: {first_name} ({start_date} to {end_date})"
                ),
                "style": "title",
            },
            {
                "table": {
                    "headerRows": 1,
                    "widths": ["*", "*", "*", "*", "*", "*", "*"],
                    "body": [headings, *rows],
                }
            },
        ],
    }
    return generate_pdf_buffer(document)


def statement_file_name(start_date: str, end_date: str, format_name: str) -> str:
    return f"Account_Statement_{start_date}_{end_date}.{format_name}"


def statement_mime_type(format_name: str) -> str:
    if format_name == "pdf":
        return "application/pdf"
    if format_name == "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return "text/csv; charset=utf-8"


def _csv_safe(value: Any) -> str:
    string_value = str(value)
    return (
        f"'{string_value}"
        if string_value.startswith(("=", "+", "@", "-"))
        else string_value
    )


def _spreadsheet_safe(value: Any) -> str:
    string_value = str(value)
    if string_value.startswith(("=", "+", "-", "@")):
        return f"'{string_value}"
    return string_value


def _iso_value(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).isoformat()
    return str(value)


def _bind_list(prefix: str, values: list[str], parameters: dict[str, Any]) -> str:
    keys = []
    for index, value in enumerate(values):
        key = f"{prefix}_{index}"
        parameters[key] = value
        keys.append(f":{key}")
    return ", ".join(keys)


def _split_query_values(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def _query_value(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _positive_query_integer(value: str | None, fallback: int, maximum: int) -> int:
    try:
        parsed = int(value) if value is not None else fallback
    except ValueError:
        return fallback
    return parsed if 0 < parsed <= maximum else fallback


def _parse_query_date(value: str | None, field_name: str = "date") -> date | None:
    if value is None or not value.strip():
        return None
    if not DATE_PATTERN.fullmatch(value):
        raise HTTPException(
            status_code=400, detail=f"{field_name} must use YYYY-MM-DD format"
        )
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(
            status_code=400, detail=f"{field_name} must use YYYY-MM-DD format"
        ) from error


def _week_context(value: date | None) -> tuple[date, date, str]:
    current = value or datetime.now(UTC).date()
    start = current - timedelta(days=current.weekday())
    end = start + timedelta(days=6)
    return start, end, f"Week {start.isocalendar().week:02d}, {start.year}"


def _round(value: float) -> float:
    return round(value + 1e-12, 2)


def _sync_leaderboard_week(
    environment: str, start: date, end: date, week_name: str
) -> None:
    with get_database_engine().begin() as connection:
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_name, 0))"),
            {"lock_name": f"leaderboard:{environment}:{start.isoformat()}"},
        )
        finalized = connection.execute(
            text(
                """
                SELECT 1 FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = TRUE LIMIT 1
                """
            ),
            {"start": start, "environment": environment},
        ).first()
        if finalized:
            return
        connection.execute(
            text(
                """
                DELETE FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = FALSE
                """
            ),
            {"start": start, "environment": environment},
        )
        connection.execute(
            text(
                """
                INSERT INTO "weeklyLeaderboard"
                    ("userId", "environment", "weekName", "startDate", "endDate",
                     "totalAmount", "rank")
                SELECT t."userId", t."environment", :week_name, :start, :end,
                       SUM(t."amount"),
                       RANK() OVER (ORDER BY SUM(t."amount") DESC)
                FROM "transactions" t
                WHERE t."status" = 'successful'
                  AND t."environment" = :environment
                  AND t."createdAt" >= :start_at AND t."createdAt" <= :end_at
                GROUP BY t."userId", t."environment"
                ORDER BY SUM(t."amount") DESC
                LIMIT 10
                """
            ),
            {
                "week_name": week_name,
                "start": start,
                "end": end,
                "environment": environment,
                "start_at": datetime.combine(start, datetime.min.time()),
                "end_at": datetime.combine(end, datetime.max.time()),
            },
        )
        previous_start = start - timedelta(days=7)
        previous_end = previous_start + timedelta(days=6)
        pending = connection.execute(
            text(
                """
                SELECT 1 FROM "weeklyLeaderboard"
                WHERE "startDate" = :start AND "environment" = :environment
                  AND "isFinalized" = FALSE LIMIT 1
                """
            ),
            {"start": previous_start, "environment": environment},
        ).first()
        if pending:
            winners = connection.execute(
                text(
                    """
                    SELECT u."firstName", u."middleName"
                    FROM "transactions" t
                    JOIN "users" u ON u."userId" = t."userId"
                    WHERE t."status" = 'successful'
                      AND t."environment" = :environment
                      AND t."createdAt" >= :start_at AND t."createdAt" <= :end_at
                    GROUP BY u."userId", u."firstName", u."middleName"
                    ORDER BY SUM(t."amount") DESC, u."userId" ASC
                    LIMIT 3
                    """
                ),
                {
                    "environment": environment,
                    "start_at": datetime.combine(previous_start, datetime.min.time()),
                    "end_at": datetime.combine(previous_end, datetime.max.time()),
                },
            ).mappings()
            names = [
                f"{winner['firstName']} {winner['middleName'] or ''}".strip()
                for winner in winners
            ]
            connection.execute(
                text(
                    """
                    UPDATE "weeklyLeaderboard"
                    SET "firstPlaceWinner" = :first,
                        "secondPlaceWinner" = :second,
                        "thirdPlaceWinner" = :third, "isFinalized" = TRUE
                    WHERE "startDate" = :start AND "environment" = :environment
                      AND "isFinalized" = FALSE
                    """
                ),
                {
                    "first": names[0] if len(names) > 0 else "N/A",
                    "second": names[1] if len(names) > 1 else "N/A",
                    "third": names[2] if len(names) > 2 else "N/A",
                    "start": previous_start,
                    "environment": environment,
                },
            )


def _build_monthly_analysis(
    rows: list[dict[str, Any]], environment: str
) -> dict[str, Any]:
    groups: dict[str, dict[str, dict[str, Any]]] = {
        "bills": {},
        "lifestyle": {},
        "transfers": {},
        "services": {},
    }
    for key, definition in _CATEGORIES.items():
        groups[definition["group"]][key] = {
            "icon": definition["icon"],
            "name": definition["name"],
            "totalAmount": 0.0,
            "transactionCount": 0,
        }
    incomes = {
        key: {
            "icon": definition["icon"],
            "name": definition["name"],
            "totalAmount": 0.0,
            "transactionCount": 0,
        }
        for key, definition in _INCOME_CATEGORIES.items()
    }
    expenses_total = income_total = 0.0
    expenses_count = income_count = classified_expenses = classified_income = 0
    for row in rows:
        amount = abs(float(row["amount"]))
        search = " ".join(
            str(row.get(key) or "") for key in ("type", "serviceName", "narration")
        ).lower()
        direction = str(row.get("direction") or "").lower()
        if direction in {"debit", "dr"}:
            expenses_total += amount
            expenses_count += 1
            match = next(
                (
                    (key, definition)
                    for key, definition in _CATEGORIES.items()
                    if any(alias in search for alias in definition["aliases"])
                ),
                None,
            )
            if match:
                key, definition = match
                item = groups[definition["group"]][key]
                item["totalAmount"] += amount
                item["transactionCount"] += 1
                classified_expenses += 1
        elif direction in {"credit", "cr"}:
            income_total += amount
            income_count += 1
            matched_key = next(
                (
                    key
                    for key, definition in _INCOME_CATEGORIES.items()
                    if any(alias in search for alias in definition["aliases"])
                ),
                None,
            )
            if matched_key:
                incomes[matched_key]["totalAmount"] += amount
                incomes[matched_key]["transactionCount"] += 1
                classified_income += 1

    def summary(items: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return {
            "totalAmount": _round(sum(item["totalAmount"] for item in items.values())),
            "transactionCount": sum(
                item["transactionCount"] for item in items.values()
            ),
            "items": items,
        }

    current = datetime.now(UTC).date()
    month_start = current.replace(day=1)
    next_month = (
        date(current.year + 1, 1, 1)
        if current.month == 12
        else date(current.year, current.month + 1, 1)
    )
    month_end = next_month - timedelta(days=1)
    for item_group in [*groups.values(), incomes]:
        for item in item_group.values():
            item["totalAmount"] = _round(item["totalAmount"])
    return {
        "success": True,
        "message": "Monthly transaction analysis retrieved",
        "data": {
            "period": {
                "month": month_start.strftime("%Y-%m"),
                "startDate": month_start.isoformat(),
                "endDate": month_end.isoformat(),
                "timezone": "Africa/Lagos",
            },
            "wallet": {"type": "MAIN", "environment": environment},
            "expenses": {
                "totalAmount": _round(expenses_total),
                "transactionCount": expenses_count,
                "bills": summary(groups["bills"]),
                "lifestyle": summary(groups["lifestyle"]),
                "transfers": summary(groups["transfers"]),
                "services": summary(groups["services"]),
            },
            "income": {
                "totalAmount": _round(income_total),
                "transactionCount": income_count,
                "deposit": incomes["deposit"],
                "rewards": incomes["rewards"],
            },
            "netSavings": _round(income_total - expenses_total),
            "summary": {
                "transactionCount": len(rows),
                "classifiedExpenseCount": classified_expenses,
                "classifiedIncomeCount": classified_income,
            },
        },
    }


def _to_transaction(row: dict[str, Any]) -> dict[str, Any]:
    amount = float(row["amount"])
    return {
        "id": row["id"],
        "reference": row.get("psRef"),
        "sessionReference": row.get("sessionReference"),
        "amount": amount,
        "chargedAmount": amount + float(row.get("fee") or 0),
        "currency": row.get("currency"),
        "transactionType": row.get("type"),
        "direction": row.get("direction"),
        "serviceName": row.get("serviceName"),
        "status": row.get("status"),
        "narration": row.get("narration"),
        "walletType": row.get("walletType"),
        "createdAt": row.get("createdAt"),
    }


def _statement_transaction(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "createdAt": row["createdAt"],
        "reference": row.get("psRef") or "",
        "serviceName": row.get("serviceName") or "",
        "amount": float(row["amount"]),
        "currency": row.get("currency") or "NGN",
        "direction": row.get("direction") or "debit",
        "status": row["status"],
    }
