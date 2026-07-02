from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.core.gateway import gateway
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str | None = None
    provider: str | None = None
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None


class ChatResponse(BaseModel):
    content: str
    model: str
    tokens: int | None = None


@router.post("/chat", response_model=ChatResponse)
async def chat_completion(req: ChatRequest):
    try:
        result = await gateway.chat(
            messages=req.messages,
            model=req.model,
            provider=req.provider,
            stream=False,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat completion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    try:
        logger.info(f"Chat stream request: model={req.model}, provider={req.provider}, msgs={len(req.messages)}")
        stream = await gateway.chat(
            messages=req.messages,
            model=req.model,
            provider=req.provider,
            stream=True,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )

        async def event_stream():
            async for chunk in stream:
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except ValueError as e:
        logger.error(f"Stream ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Stream failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
