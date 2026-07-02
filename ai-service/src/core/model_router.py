from src.core.providers.base import AIProvider
from src.core.providers.openai_provider import OpenAIProvider
from src.core.providers.anthropic_provider import AnthropicProvider
from src.core.providers.mock_provider import MockProvider
from src.core.providers.ollama_provider import OllamaProvider
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class ModelRouter:
    def __init__(self):
        self.providers: dict[str, AIProvider] = {}

    def register(self, provider: AIProvider):
        self.providers[provider.name] = provider

    def get_provider(self, provider_name: str) -> AIProvider:
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(f"Unknown provider: {provider_name}")
        return provider

    def resolve(self, model: str) -> tuple[AIProvider, str]:
        model_lower = model.lower()

        if model_lower.startswith("gpt") or model_lower.startswith("o1") or model_lower.startswith("o3"):
            if "openai" in self.providers:
                return self.providers["openai"], model

        if model_lower.startswith("claude"):
            if "anthropic" in self.providers:
                return self.providers["anthropic"], model

        if model_lower.startswith("gemini"):
            if "gemini" in self.providers:
                return self.providers["gemini"], model

        if model_lower.startswith("deepseek"):
            if "deepseek" in self.providers:
                return self.providers["deepseek"], model
            if "ollama" in self.providers and "deepseek" in model_lower:
                return self.providers["ollama"], model

        # Ollama models (anything unrecognized might be an Ollama model)
        if "ollama" in self.providers:
            return self.providers["ollama"], model

        if "openai" in self.providers:
            return self.providers["openai"], settings.default_model

        if "mock" in self.providers:
            return self.providers["mock"], "mock-gpt"

        raise ValueError(f"No provider available for model: {model}")

    def smart_route(self, messages: list[dict]) -> tuple[AIProvider, str]:
        total_chars = sum(len(m.get("content", "")) for m in messages)
        last_content = messages[-1].get("content", "").lower() if messages else ""

        coding_keywords = [
            "code", "function", "bug", "refactor", "debug", "compile",
            "error", "exception", "test", "implement", "algorithm",
        ]
        is_coding = any(kw in last_content for kw in coding_keywords)

        # Prefer Ollama when available
        if "ollama" in self.providers:
            model = settings.ollama_coding_model if is_coding else settings.ollama_default_model
            return self.providers["ollama"], model

        if total_chars < 100 and not is_coding:
            model = "gpt-4o-mini" if "openai" in self.providers else settings.default_model
        elif is_coding:
            model = "gpt-4o" if "openai" in self.providers else settings.default_model
        else:
            model = settings.default_model

        return self.resolve(model)


router = ModelRouter()

# Mock provider always registered as fallback
router.register(MockProvider())
logger.info("Mock provider registered")

if settings.openai_api_key:
    router.register(OpenAIProvider())
    logger.info("OpenAI provider registered")

if settings.anthropic_api_key:
    router.register(AnthropicProvider())
    logger.info("Anthropic provider registered")

# Ollama always registered (must be running locally)
try:
    router.register(OllamaProvider(base_url=settings.ollama_base_url))
    logger.info(f"Ollama provider registered ({settings.ollama_base_url})")
except Exception as e:
    logger.warning(f"Could not register Ollama provider: {e}")
