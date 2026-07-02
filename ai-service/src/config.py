from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_file="../.env", env_file_encoding="utf-8")

    app_name: str = "ai-for-all"
    debug: bool = True

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "ai_for_all"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: Optional[str] = None

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None

    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "codellama"
    ollama_coding_model: str = "codellama"

    default_provider: str = "openai"
    default_model: str = "gpt-4o"
    max_tokens: int = 4096
    temperature: float = 0.7


settings = Settings()
