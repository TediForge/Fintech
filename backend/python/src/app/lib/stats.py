"""Atomic service transaction statistics."""

from datetime import datetime
from typing import Literal, TypedDict

from sqlalchemy import text

from database.db_01.connection import get_database_engine

ServiceStatStatus = Literal["success", "successful", "failed", "failure", "refunded"]


class ServiceStat(TypedDict):
    serviceName: str
    successRate: float
    updatedAt: datetime | str


def record_service_stat(service_name: str, status: ServiceStatStatus) -> None:
    name = service_name.strip()
    if not name:
        raise ValueError("service_name must not be empty")
    normalized_status = status.lower()
    successful = int(normalized_status in {"success", "successful"})
    failed = int(normalized_status in {"failed", "failure"})
    refunded = int(normalized_status == "refunded")
    statement = text(
        """
        INSERT INTO "serviceStats"
            ("serviceName", "totalTransactions", "successfulTransactions",
             "failedTransactions", "refundedTransactions", "successRate")
        VALUES (:name, 1, :successful, :failed, :refunded, :success_rate)
        ON CONFLICT ("serviceName") DO UPDATE SET
            "totalTransactions" = "serviceStats"."totalTransactions" + 1,
            "successfulTransactions" =
                "serviceStats"."successfulTransactions" + EXCLUDED."successfulTransactions",
            "failedTransactions" =
                "serviceStats"."failedTransactions" + EXCLUDED."failedTransactions",
            "refundedTransactions" =
                "serviceStats"."refundedTransactions" + EXCLUDED."refundedTransactions",
            "successRate" = ROUND(
                ("serviceStats"."successfulTransactions"
                    + EXCLUDED."successfulTransactions")::numeric
                / ("serviceStats"."totalTransactions" + 1) * 100,
                2
            ),
            "updatedAt" = CURRENT_TIMESTAMP
        """
    )
    with get_database_engine().begin() as connection:
        connection.execute(
            statement,
            {
                "name": name,
                "successful": successful,
                "failed": failed,
                "refunded": refunded,
                "success_rate": successful * 100,
            },
        )


def get_service_stats(service_name: str | None = None) -> list[ServiceStat]:
    statement = """
        SELECT "serviceName", "successRate", "updatedAt"
        FROM "serviceStats"
    """
    parameters: dict[str, str] = {}
    if service_name:
        statement += '\nWHERE "serviceName" = :service_name'
        parameters["service_name"] = service_name
    statement += '\nORDER BY "serviceName" ASC'
    with get_database_engine().connect() as connection:
        rows = connection.execute(text(statement), parameters).mappings()
        return [
            {
                "serviceName": row["serviceName"],
                "successRate": float(row["successRate"]),
                "updatedAt": row["updatedAt"],
            }
            for row in rows
        ]
