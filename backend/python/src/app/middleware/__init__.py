"""Application-wide middleware."""

from app.middleware.authentication import AuthenticationMiddleware
from app.middleware.maintenance import MaintenanceMiddleware

__all__ = ["AuthenticationMiddleware", "MaintenanceMiddleware"]
