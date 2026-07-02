from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.core.gateway import gateway
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

SYSTEM_PROMPTS = {
    "explain": (
        "You are an expert code explainer. Explain the following code in detail:\n"
        "- What it does\n"
        "- How it works step by step\n"
        "- Key concepts and patterns used\n"
        "- Potential edge cases or pitfalls\n\n"
        "Be thorough but clear. Assume the reader knows programming basics."
    ),
    "generate": (
        "You are an expert code generator. Based on the user's instruction, "
        "write clean, well-structured code. Provide only the code block(s) needed. "
        "Use the existing code context (if provided) to match style and conventions.\n\n"
        "Return your response as markdown with code blocks. Use ```language for syntax highlighting."
    ),
    "fix": (
        "You are an expert debugger. Analyze the provided code for bugs, issues, "
        "and potential problems. For each issue found:\n"
        "1. Explain the problem\n"
        "2. Show the fixed code in a ```code block\n\n"
        "Focus on logical errors, runtime errors, security issues, and performance problems."
    ),
    "refactor": (
        "You are an expert code refactoring assistant. Analyze the provided code and suggest "
        "improvements for:\n"
        "- Readability and clarity\n"
        "- Performance\n"
        "- Maintainability\n"
        "- Best practices and patterns\n\n"
        "Show the refactored code in ```code blocks with explanations of what changed and why."
    ),
}

class CodeActionRequest(BaseModel):
    action: str
    code: str
    language: str = "typescript"
    instruction: str = ""
    filePath: str = ""


class CodeActionResponse(BaseModel):
    content: str
    model: str


@router.post("/code/action", response_model=CodeActionResponse)
async def code_action(req: CodeActionRequest):
    if req.action not in SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    system_prompt = SYSTEM_PROMPTS[req.action]

    user_parts = []
    if req.filePath:
        user_parts.append(f"File: {req.filePath}")
    user_parts.append(f"Language: {req.language}")
    if req.code:
        user_parts.append(f"\nCode:\n```{req.language}\n{req.code}\n```")
    if req.instruction:
        user_parts.append(f"\nInstruction: {req.instruction}")

    user_content = "\n".join(user_parts)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    try:
        result = await gateway.chat(
            messages=messages,
            stream=False,
        )
        return {"content": result["content"], "model": result["model"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Code action failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
