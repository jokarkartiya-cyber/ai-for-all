from typing import AsyncIterator
from src.core.providers.base import AIProvider, CompletionRequest, CompletionResponse


MOCK_RESPONSES: dict[str, str] = {
    "explain": """
Here's an explanation of the code:

```typescript
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

This is a **recursive implementation** of the Fibonacci sequence.

**How it works:**
1. **Base case**: If `n` is 0 or 1, return `n` directly
2. **Recursive case**: Return `fibonacci(n-1) + fibonacci(n-2)`

**Time Complexity**: O(2ⁿ) — exponential
**Space Complexity**: O(n) — due to call stack

**💡 Optimization tip**: Use memoization or dynamic programming for better performance.
""",
    "bug": """
Let me analyze the code for bugs:

```typescript
// Potential issue: No input validation
function divide(a: number, b: number): number {
  return a / b; // 🐛 What if b is 0?
}
```

**Found issues:**
1. **Division by zero** — No check for `b === 0`
2. **No type guards** — If called with non-numbers, runtime error

**Fixed version:**
```typescript
function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Cannot divide by zero");
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error("Both arguments must be numbers");
  }
  return a / b;
}
```
""",
    "default": """
I'm **AI for All**, your AI coding assistant! I'm currently running in fallback mode while we connect to the AI provider. I can still help with:

- ✅ Code explanations
- ✅ Bug detection
- ✅ Code generation
- ✅ Project structure analysis
- ✅ File operations

What would you like me to help with?
""",
}


class MockProvider(AIProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        content = request.messages[-1].content.lower() if request.messages else ""
        response = MOCK_RESPONSES["default"]

        if "explain" in content or "what does" in content:
            response = MOCK_RESPONSES["explain"]
        elif "bug" in content or "fix" in content or "error" in content:
            response = MOCK_RESPONSES["bug"]
        elif "hello" in content or "hi" in content or "what is your name" in content or "who are you" in content:
            response = "Hello! I'm **AI for All**, your AI coding assistant. How can I help you today?"

        return CompletionResponse(content=response, model="mock-gpt")

    async def complete_stream(self, request: CompletionRequest) -> AsyncIterator[str]:
        content = request.messages[-1].content.lower() if request.messages else ""
        response = MOCK_RESPONSES["default"]

        if "explain" in content or "what does" in content:
            response = MOCK_RESPONSES["explain"]
        elif "bug" in content or "fix" in content or "error" in content:
            response = MOCK_RESPONSES["bug"]
        elif "hello" in content or "hi" in content or "what is your name" in content or "who are you" in content:
            response = "Hello! I'm **AI for All**, your AI coding assistant. How can I help you today?"

        for word in response.split(" "):
            yield word + " "
