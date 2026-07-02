from fastapi import APIRouter
from src.api.chat import router as chat_router
from src.api.code_action import router as code_action_router

router = APIRouter()

router.include_router(chat_router, tags=["chat"])
router.include_router(code_action_router, tags=["code-action"])


@router.get("/providers")
async def list_providers():
    from src.core.model_router import router as model_router

    providers = []
    for name, provider in model_router.providers.items():
        models = []
        if name == "openai":
            models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "o1-mini"]
        elif name == "anthropic":
            models = ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"]
        elif name == "gemini":
            models = ["gemini-1.5-pro", "gemini-1.5-flash"]
        elif name == "deepseek":
            models = ["deepseek-coder", "deepseek-chat"]
        providers.append({"id": name, "name": name.capitalize(), "models": models})

    return {"providers": providers}
