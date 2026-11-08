import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.providers.ai.groq import GROQ_MODELS, GroqClient, GroqModelRegistry


def test_model_registry_matches_provider_models_and_fallbacks() -> None:
    registry = GroqModelRegistry()

    assert set(registry.all()) == set(GROQ_MODELS)
    assert registry.get("missing-model") is None
    assert registry.get_fallbacks("openai/gpt-oss-20b") == ["openai/gpt-oss-120b"]
    assert registry.get_fallbacks("missing-model") == []
    assert [model.id for model in registry.get_by_capability("audio-transcription")] == [
        "whisper-large-v3",
        "whisper-large-v3-turbo",
    ]


def test_provider_factory_loads_api_keys_in_database_order(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.providers.ai.groq.client.load_groq_credentials",
        lambda: SimpleNamespace(api_keys=("key-one", "key-two")),
    )

    client = GroqClient.from_settings()

    assert client.get_api_key() == "key-one"
    assert tuple(client._keys) == ("key-one", "key-two")
    assert client._model == "openai/gpt-oss-20b"
    assert client._timeout_ms == 30_000


def test_send_returns_failure_when_no_keys_are_configured() -> None:
    client = GroqClient()

    result = asyncio.run(client.send([{"role": "user", "content": "hello"}]))

    assert result == {
        "success": False,
        "content": "",
        "error": "No API keys configured",
        "model": "openai/gpt-oss-20b",
    }


def test_send_json_retries_and_uses_json_response_format(monkeypatch) -> None:
    client = GroqClient(["key-one"], timeout_ms=1000)
    create = AsyncMock(
        side_effect=[
            RuntimeError("temporary provider error"),
            SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content='{"ok":true}', tool_calls=None, model_dump=lambda **_: {"role": "assistant", "content": '{"ok":true}'})
                    )
                ],
                model_dump=lambda **_: {"choices": []},
            ),
        ]
    )
    client._clients["key-one"].chat.completions.create = create
    sleep = AsyncMock()
    monkeypatch.setattr("app.providers.ai.groq.client.asyncio.sleep", sleep)

    result = asyncio.run(
        client.send_json([{"role": "user", "content": "reply in JSON"}], retries=1)
    )

    assert result["success"] is True
    assert result["content"] == '{"ok":true}'
    assert result["model"] == "openai/gpt-oss-20b"
    assert create.await_count == 2
    assert create.await_args_list[0].kwargs["response_format"] == {"type": "json_object"}
    sleep.assert_awaited_once_with(0.25)


def test_send_with_tools_returns_serialized_tool_calls() -> None:
    client = GroqClient(["key-one"], timeout_ms=1000)
    tool_call = SimpleNamespace(model_dump=lambda **_: {"id": "call-1", "type": "function"})
    message = SimpleNamespace(
        content="",
        tool_calls=[tool_call],
        model_dump=lambda **_: {"role": "assistant", "content": None, "tool_calls": [{"id": "call-1"}]},
    )
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=message)],
        model_dump=lambda **_: {"choices": [{"message": {"tool_calls": [{"id": "call-1"}]}}]},
    )
    create = AsyncMock(return_value=response)
    client._clients["key-one"].chat.completions.create = create

    result = asyncio.run(
        client.send_with_tools(
            [{"role": "user", "content": "look this up"}],
            [{"type": "function", "function": {"name": "lookup"}}],
        )
    )

    assert result["success"] is True
    assert result["tool_calls"] == [{"id": "call-1", "type": "function"}]
    assert create.await_args.kwargs["tool_choice"] == "auto"
    assert create.await_args.kwargs["tools"][0]["function"]["name"] == "lookup"


def test_transcribe_audio_returns_text_and_raw_response() -> None:
    client = GroqClient(["key-one"], timeout_ms=1000)
    transcription = SimpleNamespace(text="recognized words", model_dump=lambda **_: {"text": "recognized words"})
    create = AsyncMock(return_value=transcription)
    client._clients["key-one"].audio.transcriptions.create = create

    result = asyncio.run(
        client.transcribe_audio(b"audio-data", "audio/mpeg", "voice.mp3", "whisper-large-v3-turbo")
    )

    assert result == {
        "success": True,
        "text": "recognized words",
        "raw": {"text": "recognized words"},
    }
    request_file = create.await_args.kwargs["file"]
    assert request_file[0] == "voice.mp3"
    assert request_file[1].read() == b"audio-data"
    assert create.await_args.kwargs["timeout"] == 60
