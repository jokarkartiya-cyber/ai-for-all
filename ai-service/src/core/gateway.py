from typing import AsyncIterator
from src.core.model_router import router
from src.core.providers.base import Message, CompletionRequest
from src.config import settings
import logging

logger = logging.getLogger(__name__)


def _resolve(messages: list[dict], model: str | None, provider: str | None) -> tuple:
    if provider and model:
        return router.get_provider(provider), model
    elif model:
        return router.resolve(model)
    else:
        return router.smart_route(messages)


class AIGateway:
    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        provider: str | None = None,
        stream: bool = False,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict | AsyncIterator[str]:
        ai_provider, resolved_model = _resolve(messages, model, provider)
        logger.info(f"Routing to {ai_provider.name}/{resolved_model}")

        req = CompletionRequest(
            messages=[Message(m["role"], m["content"]) for m in messages],
            model=resolved_model,
            temperature=temperature or settings.temperature,
            max_tokens=max_tokens or settings.max_tokens,
            stream=stream,
        )

        if stream:
            return self._stream_with_fallback(messages, ai_provider, req, model, provider)

        try:
            response = await ai_provider.complete(req)
        except Exception as e:
            logger.warning(f"{ai_provider.name} failed: {e}. Trying fallback...")
            fallback_provider, fallback_model = _resolve(messages, None, None)
            if fallback_provider.name != ai_provider.name:
                logger.info(f"Fallback to {fallback_provider.name}/{fallback_model}")
                req.model = fallback_model
                response = await fallback_provider.complete(req)
            else:
                mock = router.get_provider("mock")
                response = await mock.complete(req)

        return {
            "content": response.content,
            "model": response.model,
            "tokens": response.tokens,
        }

    async def _stream_with_fallback(self, messages, provider, request, orig_model, orig_provider):
        try:
            async for chunk in provider.complete_stream(request):
                yield chunk
        except Exception as e:
            logger.warning(f"{provider.name} streaming failed: {e}. Trying fallback...")
            fallback_provider, fallback_model = _resolve(messages, None, None)
            if fallback_provider.name != provider.name:
                logger.info(f"Fallback to {fallback_provider.name}/{fallback_model}")
                request.model = fallback_model
                async for chunk in fallback_provider.complete_stream(request):
                    yield chunk
            else:
                mock = router.get_provider("mock")
                async for chunk in mock.complete_stream(request):
                    yield chunk

gateway = AIGateway()
