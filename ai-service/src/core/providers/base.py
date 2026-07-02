from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional


class Message:
    def __init__(self, role: str, content: str):
        self.role = role
        self.content = content


class CompletionRequest:
    def __init__(
        self,
        messages: list[Message],
        model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
    ):
        self.messages = messages
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.stream = stream


class CompletionResponse:
    def __init__(self, content: str, model: str, tokens: Optional[int] = None):
        self.content = content
        self.model = model
        self.tokens = tokens


class AIProvider(ABC):
    @abstractmethod
    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        pass

    @abstractmethod
    async def complete_stream(self, request: CompletionRequest) -> AsyncIterator[str]:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass
