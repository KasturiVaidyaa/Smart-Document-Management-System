"""Google Gemini provider — free tier for personal projects."""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from app.config import Settings
from app.providers.base import BaseEmbedProvider, BaseLLMProvider

logger = logging.getLogger("ragdms.providers.gemini")

_CHAT_FALLBACKS = [
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

_EMBED_FALLBACKS = [
    "gemini-embedding-2",
    "gemini-embedding-001",
    "gemini-embedding-exp-03-07",
    "embedding-001",
]


def _model_candidates(preferred: str, fallbacks: list[str]) -> list[str]:
    names = []
    for name in [preferred, *fallbacks]:
        cleaned = (name or "").strip().removeprefix("models/")
        if cleaned and cleaned not in names:
            names.append(cleaned)
    return names


class GeminiLLMProvider(BaseLLMProvider):
    """Chat completions via Gemini."""

    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_chat_model
        self._resolved_model: str | None = None

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> str:
        contents: list[types.Content] = []
        system_instruction: str | None = None

        for msg in messages:
            role = msg["role"]
            text = msg["content"]
            if role == "system":
                system_instruction = text
            elif role == "user":
                contents.append(
                    types.Content(role="user", parts=[types.Part(text=text)])
                )
            elif role == "assistant":
                contents.append(
                    types.Content(role="model", parts=[types.Part(text=text)])
                )

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        last_error: Exception | None = None
        for model in _model_candidates(self._resolved_model or self._model, _CHAT_FALLBACKS):
            try:
                response = await self._client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
                self._resolved_model = model
                return response.text or ""
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini chat model %s failed: %s", model, exc)
        raise last_error or RuntimeError("Gemini chat failed")


class GeminiEmbedProvider(BaseEmbedProvider):
    """Embeddings via the current Gemini embedContent models."""

    DIMENSION = 768

    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_embed_model
        self._resolved_model: str | None = None

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        last_error: Exception | None = None
        for model in _model_candidates(self._resolved_model or self._model, _EMBED_FALLBACKS):
            try:
                vectors = await self._embed_with_model(model, texts)
                self._resolved_model = model
                logger.info("Using Gemini embedding model %s", model)
                return vectors
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini embed model %s failed: %s", model, exc)

        raise last_error or RuntimeError("Gemini embed failed")

    async def _embed_with_model(self, model: str, texts: list[str]) -> list[list[float]]:
        batch_size = 100
        all_embeddings: list[list[float]] = []
        config = types.EmbedContentConfig(output_dimensionality=self.DIMENSION)

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                result = await self._client.aio.models.embed_content(
                    model=model,
                    contents=batch,
                    config=config,
                )
            except Exception:
                result = await self._client.aio.models.embed_content(
                    model=model,
                    contents=batch,
                )
            if not result.embeddings:
                raise RuntimeError(f"No embeddings returned from {model}")
            all_embeddings.extend([emb.values for emb in result.embeddings])
        return all_embeddings

    @property
    def dimension(self) -> int:
        return self.DIMENSION
