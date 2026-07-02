from typing import AsyncIterator
from anthropic import AsyncAnthropic
from src.config import settings
from src.core.providers.base import AIProvider, CompletionRequest, CompletionResponse


class AnthropicProvider(AIProvider):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    @property
    def name(self) -> str:
        return "anthropic"

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        response = await self.client.messages.create(
            model=request.model,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )
        return CompletionResponse(
            content=response.content[0].text if response.content else "",
            model=response.model,
            tokens=None,
        )

    async def complete_stream(self, request: CompletionRequest) -> AsyncIterator[str]:
        async with self.client.messages.stream(
            model=request.model,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        ) as stream:
            async for text in stream.text_stream:
                yield text
