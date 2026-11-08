"""Groq model catalog and async chat/audio client."""

import asyncio
import random
from dataclasses import dataclass
from io import BytesIO
from typing import Any, NotRequired, TypedDict

from groq import AsyncGroq

from app.providers.ai.groq.credentials import load_groq_credentials

_DEFAULT_MODEL = "openai/gpt-oss-20b"
_DEFAULT_TIMEOUT_MS = 30_000


@dataclass(frozen=True)
class GroqModel:
    id: str
    capabilities: tuple[str, ...]
    priority: int
    max_context: int
    retry_priority: int
    cost_tier: str
    speed: str
    input_formats: tuple[str, ...]
    output_formats: tuple[str, ...]
    available: bool
    fallbacks: tuple[str, ...]


GROQ_MODELS: dict[str, GroqModel] = {
    "openai/gpt-oss-20b": GroqModel(
        id="openai/gpt-oss-20b", capabilities=("text", "json", "reasoning", "classification"),
        priority=90, max_context=131000, retry_priority=1, cost_tier="medium", speed="very-fast",
        input_formats=("text",), output_formats=("json",), available=True,
        fallbacks=("openai/gpt-oss-120b",),
    ),
    "openai/gpt-oss-120b": GroqModel(
        id="openai/gpt-oss-120b", capabilities=("text", "json", "reasoning", "validation", "supervision"),
        priority=100, max_context=131000, retry_priority=1, cost_tier="high", speed="fast",
        input_formats=("text",), output_formats=("json",), available=True,
        fallbacks=("openai/gpt-oss-20b",),
    ),
    "qwen/qwen3.6-27b": GroqModel(
        id="qwen/qwen3.6-27b", capabilities=("text", "json", "vision", "ocr", "multilingual", "reasoning"),
        priority=92, max_context=131000, retry_priority=1, cost_tier="medium", speed="fast",
        input_formats=("text", "image-url", "image-base64"), output_formats=("json",), available=True,
        fallbacks=("openai/gpt-oss-20b",),
    ),
    "groq/compound": GroqModel(
        id="groq/compound", capabilities=("text", "json", "research", "tool-use", "planning"),
        priority=88, max_context=131000, retry_priority=2, cost_tier="high", speed="fast",
        input_formats=("text",), output_formats=("json",), available=True,
        fallbacks=("openai/gpt-oss-20b",),
    ),
    "groq/compound-mini": GroqModel(
        id="groq/compound-mini", capabilities=("text", "json", "research", "planning"),
        priority=84, max_context=131000, retry_priority=2, cost_tier="medium", speed="fast",
        input_formats=("text",), output_formats=("json",), available=True,
        fallbacks=("openai/gpt-oss-20b",),
    ),
    "whisper-large-v3": GroqModel(
        id="whisper-large-v3", capabilities=("audio-transcription", "speech-to-text"),
        priority=91, max_context=0, retry_priority=1, cost_tier="medium", speed="medium",
        input_formats=("audio",), output_formats=("text",), available=True,
        fallbacks=("whisper-large-v3-turbo",),
    ),
    "whisper-large-v3-turbo": GroqModel(
        id="whisper-large-v3-turbo",
        capabilities=("audio-transcription", "speech-to-text", "quick-transcription"),
        priority=87, max_context=0, retry_priority=1, cost_tier="low", speed="very-fast",
        input_formats=("audio",), output_formats=("text",), available=True,
        fallbacks=("whisper-large-v3",),
    ),
}


class GroqModelRegistry:
    """Look up supported models and rank them by capability."""

    def all(self) -> dict[str, GroqModel]:
        return GROQ_MODELS.copy()

    def get(self, model_id: str) -> GroqModel | None:
        return GROQ_MODELS.get(model_id)

    def get_fallbacks(self, model_id: str) -> list[str]:
        model = self.get(model_id)
        return list(model.fallbacks) if model else []

    def get_by_capability(self, capability: str) -> list[GroqModel]:
        return sorted(
            (model for model in GROQ_MODELS.values() if capability in model.capabilities),
            key=lambda model: model.priority,
            reverse=True,
        )


class GroqMessage(TypedDict):
    role: str
    content: Any
    tool_call_id: NotRequired[str]
    name: NotRequired[str]


class GroqResult(TypedDict, total=False):
    success: bool
    content: str
    error: str
    raw: Any
    model: str
    tool_calls: list[dict[str, Any]]
    message: dict[str, Any]


class TranscriptionResult(TypedDict, total=False):
    success: bool
    text: str
    error: str
    raw: Any


class GroqClient:
    """Async Groq API client with key rotation and bounded retries."""

    def __init__(
        self,
        keys: list[str] | tuple[str, ...] = (),
        model: str = _DEFAULT_MODEL,
        timeout_ms: int = _DEFAULT_TIMEOUT_MS,
        base_url: str | None = None,
    ) -> None:
        self._keys = tuple(dict.fromkeys(key.strip() for key in keys if key.strip()))
        self._model = model
        self._timeout_ms = timeout_ms
        self._clients = {
            key: AsyncGroq(
                api_key=key,
                base_url=base_url,
                timeout=timeout_ms / 1000,
                max_retries=0,
            )
            for key in self._keys
        }

    @classmethod
    def from_settings(
        cls,
        model: str | None = None,
        timeout_ms: int | None = None,
    ) -> "GroqClient":
        """Compatibility factory; provider credentials are always loaded from the database."""
        return cls.from_database(model=model, timeout_ms=timeout_ms)

    @classmethod
    def from_database(
        cls,
        model: str | None = None,
        timeout_ms: int | None = None,
    ) -> "GroqClient":
        """Create a client using active Groq keys stored in the apiKeys table."""
        return cls(
            keys=load_groq_credentials().api_keys,
            model=model or _DEFAULT_MODEL,
            timeout_ms=timeout_ms if timeout_ms is not None else _DEFAULT_TIMEOUT_MS,
        )

    def get_api_key(self) -> str:
        """Return the first configured key, or an empty string when unconfigured."""
        return self._keys[0] if self._keys else ""

    async def send(
        self,
        messages: list[GroqMessage],
        temperature: float = 0.3,
        max_tokens: int = 500,
        retries: int = 2,
        model: str | None = None,
    ) -> GroqResult:
        return await self._request(messages, temperature, max_tokens, retries, model, False)

    async def send_json(
        self,
        messages: list[GroqMessage],
        temperature: float = 0.3,
        max_tokens: int = 500,
        retries: int = 2,
        model: str | None = None,
    ) -> GroqResult:
        return await self._request(messages, temperature, max_tokens, retries, model, True)

    async def send_with_tools(
        self,
        messages: list[GroqMessage],
        tools: list[dict[str, Any]],
        temperature: float = 0.3,
        max_tokens: int = 500,
        retries: int = 2,
        model: str | None = None,
    ) -> GroqResult:
        return await self._request(messages, temperature, max_tokens, retries, model, False, tools)

    async def transcribe_audio(
        self,
        blob: bytes,
        mime_type: str,
        file_name: str,
        model: str,
    ) -> TranscriptionResult:
        if not self._keys:
            return {"success": False, "text": "", "error": "No API keys configured"}
        try:
            key = random.choice(self._keys)
            audio_file = (file_name, BytesIO(blob), mime_type)
            response = await self._clients[key].audio.transcriptions.create(
                model=model,
                file=audio_file,
                timeout=max(self._timeout_ms, 60_000) / 1000,
            )
            text = response.text if isinstance(response.text, str) else ""
            return {
                "success": bool(text),
                "text": text,
                "raw": response.model_dump(exclude_none=True),
            }
        except Exception as error:
            return {
                "success": False,
                "text": "",
                "error": str(error) or "Provider unavailable",
            }

    async def _request(
        self,
        messages: list[GroqMessage],
        temperature: float,
        max_tokens: int,
        retries: int,
        model: str | None,
        json_response: bool,
        tools: list[dict[str, Any]] | None = None,
    ) -> GroqResult:
        active_model = model or self._model
        if not self._keys:
            return {
                "success": False,
                "content": "",
                "error": "No API keys configured",
                "model": active_model,
            }

        retry_count = max(0, min(5, int(retries)))
        last_error = "Provider unavailable"
        last_raw: Any = None
        for attempt in range(retry_count + 1):
            key = random.choice(self._keys)
            request_options: dict[str, Any] = {
                "model": active_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if json_response:
                request_options["response_format"] = {"type": "json_object"}
            if tools:
                request_options["tools"] = tools
                request_options["tool_choice"] = "auto"
            try:
                response = await self._clients[key].chat.completions.create(**request_options)
                last_raw = response.model_dump(exclude_none=True)
                choice = response.choices[0] if response.choices else None
                message = choice.message if choice else None
                content = message.content if message and isinstance(message.content, str) else ""
                tool_calls = [
                    tool_call.model_dump(exclude_none=True)
                    for tool_call in (message.tool_calls or [])
                ] if message else []
                message_data = message.model_dump(exclude_none=True) if message else {}
                if tool_calls:
                    return {
                        "success": True,
                        "content": content,
                        "tool_calls": tool_calls,
                        "message": message_data,
                        "model": active_model,
                    }
                if content.strip():
                    return {"success": True, "content": content, "model": active_model}
                last_error = "Provider returned an empty response"
            except Exception as error:
                last_error = str(error) or "Provider unavailable"
            if attempt < retry_count:
                await asyncio.sleep(0.25)

        return {
            "success": False,
            "content": "",
            "error": last_error,
            "raw": last_raw,
            "model": active_model,
        }
