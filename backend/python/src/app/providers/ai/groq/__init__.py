"""Public Groq provider interface."""

from functools import lru_cache

from app.providers.ai.groq.client import (
    GROQ_MODELS,
    GroqClient,
    GroqMessage,
    GroqModel,
    GroqModelRegistry,
    GroqResult,
    TranscriptionResult,
)


@lru_cache(maxsize=1)
def get_groq_client() -> GroqClient:
    """Return the shared async Groq adapter using database-managed keys."""
    return GroqClient.from_database()


__all__ = [
    "GROQ_MODELS",
    "GroqClient",
    "GroqMessage",
    "GroqModel",
    "GroqModelRegistry",
    "GroqResult",
    "TranscriptionResult",
    "get_groq_client",
]
