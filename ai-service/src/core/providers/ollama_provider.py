from typing import AsyncIterator
import httpx
from src.core.providers.base import AIProvider, CompletionRequest, CompletionResponse


OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "deepseek-coder"


class OllamaProvider(AIProvider):
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url

    @property
    def name(self) -> str:
        return "ollama"

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": request.model or DEFAULT_MODEL,
                    "messages": [{"role": m.role, "content": m.content} for m in request.messages],
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_tokens,
                    },
                },
                timeout=120,
            )
            response.raise_for_status()
            data = response.json()
            return CompletionResponse(
                content=data["message"]["content"],
                model=data.get("model", request.model or DEFAULT_MODEL),
                tokens=None,
            )

    async def complete_stream(self, request: CompletionRequest) -> AsyncIterator[str]:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": request.model or DEFAULT_MODEL,
                    "messages": [{"role": m.role, "content": m.content} for m in request.messages],
                    "stream": True,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_tokens,
                    },
                },
                timeout=120,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    import json
                    try:
                        data = json.loads(line)
                        if data.get("done"):
                            break
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                    except json.JSONDecodeError:
                        continue
