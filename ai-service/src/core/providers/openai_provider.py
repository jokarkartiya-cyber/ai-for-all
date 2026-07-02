from typing import AsyncIterator
from openai import AsyncOpenAI
from src.config import settings
from src.core.providers.base import AIProvider, CompletionRequest, CompletionResponse


class OpenAIProvider(AIProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def name(self) -> str:
        return "openai"

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        response = await self.client.chat.completions.create(
            model=request.model,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        return CompletionResponse(
            content=response.choices[0].message.content or "",
            model=response.model,
            tokens=response.usage.total_tokens if response.usage else None,
        )

    async def complete_stream(self, request: CompletionRequest) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=request.model,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
