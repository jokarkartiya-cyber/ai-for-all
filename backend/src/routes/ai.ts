import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { logger } from "../utils/logger";
import type { AuthRequest } from "../middleware/auth";
import { Response } from "express";

const AI_SERVICE_URL = "http://127.0.0.1:8000";

const router = Router();

router.use(authenticate);

const SYSTEM_PROMPTS: Record<string, string> = {
  explain: "You are an expert code explainer. Explain the given code in simple terms: what it does, how it works, key concepts used, and any potential improvements. Be concise but thorough.",
  generate: "You are an expert programmer. Generate clean, production-ready code based on the user's request and any provided context. Include proper error handling and comments.",
  fix: "You are an expert debugger. Analyze the given code for bugs, issues, or edge cases. Provide a fixed version with an explanation of what was wrong and why the fix works.",
  optimize: "You are an expert in code optimization. Analyze the given code for performance bottlenecks, inefficient algorithms, or unnecessary operations. Provide an optimized version with explanation of improvements and their expected impact.",
  refactor: "You are an expert in code refactoring. Improve the given code's structure, readability, and maintainability without changing its behavior. Apply design patterns, reduce duplication, and improve naming.",
  comments: "You are an expert in code documentation. Add clear, professional comments to the given code. Include JSDoc/TSDoc for functions, inline comments for complex logic, and section headers where appropriate.",
  uncomment: "You are a code cleaner. Remove all comments from the given code while preserving the code's functionality exactly. Only remove comments, do not modify any code logic.",
  convert: "You are a polyglot programmer. Convert the given code from its current language to the target language specified by the user. Preserve all logic, handle language-specific idioms appropriately, and note any important differences.",
  tests: "You are an expert in software testing. Generate comprehensive unit tests for the given code. Include edge cases, error conditions, and happy path tests. Use the appropriate testing framework for the language.",
  errors: "You are an expert error analyzer. Explain what the given error means, what typically causes it, and how to fix it. Provide concrete examples of the fix.",
  security: "You are a security expert. Analyze the given code for security vulnerabilities including: injection flaws, XSS, CSRF, insecure authentication, exposed secrets, unsafe deserialization, and dependency issues. Provide fixes for each issue found.",
  complexity: "You are a code quality analyst. Analyze the given code's complexity: cyclomatic complexity, cognitive complexity, coupling, cohesion, and maintainability index. Provide a complexity score and specific recommendations to reduce complexity.",
  performance: "You are a performance engineer. Analyze the given code for performance issues: algorithmic inefficiency, memory leaks, unnecessary allocations, blocking operations, and concurrency problems. Provide specific optimization suggestions with expected impact.",
  sql: "You are a SQL expert. Generate optimized SQL queries based on the user's request and schema context. Include indexing suggestions, explain the query plan, and note any potential performance considerations.",
  regex: "You are a regex expert. Generate regular expressions based on the user's description. Explain how the regex works part by part, note edge cases, and provide test examples.",
  docs: "You are a technical writer. Generate comprehensive documentation for the given code. Include: overview, installation, usage examples, API reference, configuration options, and common troubleshooting.",
  api: "You are an API designer. Design a RESTful or GraphQL API for the given requirements. Include: endpoint definitions, request/response schemas, authentication, error handling, rate limiting, and example usage.",
  readme: "You are a project documentation expert. Generate a complete README.md for the given project. Include: project description, features, installation, usage, configuration, API reference, contributing guidelines, license, and badges.",
  summary: "You are a project analyst. Analyze the given project structure and code to provide a comprehensive summary: architecture overview, key components, data flow, technologies used, and suggestions for improvement.",
  commit: "You are a git expert. Generate a concise, meaningful commit message following conventional commits format. Summarize the changes, explain the motivation, and reference any related issues.",
};

const ACTION_DISPLAY_NAMES: Record<string, string> = {
  explain: "Explain Code",
  generate: "Generate Code",
  fix: "Fix Bugs",
  optimize: "Optimize Code",
  refactor: "Refactor Code",
  comments: "Add Comments",
  uncomment: "Remove Comments",
  convert: "Convert Language",
  tests: "Generate Tests",
  errors: "Explain Errors",
  security: "Security Check",
  complexity: "Complexity Analysis",
  performance: "Performance Tips",
  sql: "SQL Generation",
  regex: "Regex Generation",
  docs: "Generate Docs",
  api: "API Generation",
  readme: "Generate README",
  summary: "Project Summary",
  commit: "Commit Message",
};

function mockCodeResponse(action: string, code: string, instruction: string): string {
  const examples: Record<string, string[]> = {
    explain: [
      "## Code Explanation\n\nThis code defines a function/module that accomplishes the following:\n\n**Purpose**: It processes input data and returns a result.\n\n**Key Components**:\n1. Input validation and parsing\n2. Core logic/algorithm\n3. Output formatting\n\n**How It Works**:\n- The function first validates inputs\n- Then executes the main algorithm\n- Finally returns the processed result\n\n**Potential Improvements**:\n- Add input validation\n- Consider edge cases\n- Extract reusable helper functions",
    ],
    generate: [
      "Here's the generated code:\n\n```typescript\nimport { useState, useEffect } from 'react';\n\ninterface Config {\n  apiKey: string;\n  endpoint: string;\n  timeout?: number;\n}\n\nfunction createService(config: Config) {\n  const { apiKey, endpoint, timeout = 5000 } = config;\n  \n  async function fetchData<T>(path: string): Promise<T> {\n    const response = await fetch(`${endpoint}${path}`, {\n      headers: { Authorization: `Bearer ${apiKey}` },\n      signal: AbortSignal.timeout(timeout),\n    });\n    if (!response.ok) throw new Error(`HTTP ${response.status}`);\n    return response.json();\n  }\n\n  return { fetchData };\n}\n\n// Usage\nconst service = createService({ apiKey: 'sk-...', endpoint: 'https://api.example.com' });\n```\n\nThis implementation includes:\n- Type safety with generics\n- Configurable timeout\n- Proper error handling\n- Clean separation of concerns",
    ],
    fix: [
      "## Bug Fix Analysis\n\n**Issue Found**: The code has a potential null reference error when accessing properties without checking if the object exists.\n\n**Root Cause**: Missing null/undefined checks before property access.\n\n**Fixed Code**:\n\n```typescript\nfunction getUserDisplayName(user: User | null): string {\n  if (!user) return 'Anonymous';\n  return `${user.firstName} ${user.lastName}`.trim() || 'User';\n}\n```\n\n**Changes Made**:\n1. Added null check at the start\n2. Added fallback values\n3. Used optional chaining where appropriate",
    ],
    optimize: [
      "## Performance Optimization\n\n**Issues Found**:\n1. Unnecessary re-renders — component rebuilds on every parent update\n2. Large list rendering without virtualization\n3. Inefficient data structures\n\n**Optimized Code**:\n\n```typescript\nimport { useMemo, useCallback } from 'react';\n\nfunction OptimizedList({ items, onSelect }: Props) {\n  const sortedItems = useMemo(\n    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),\n    [items]\n  );\n\n  const handleSelect = useCallback(\n    (id: string) => onSelect(id),\n    [onSelect]\n  );\n\n  return sortedItems.map(item => (\n    <ListItem key={item.id} item={item} onSelect={handleSelect} />\n  ));\n}\n```\n\n**Improvements**:\n- `useMemo` prevents unnecessary sorting\n- `useCallback` prevents recreating callbacks\n- Memoized components skip re-renders\n- Estimated 40% performance gain for large lists",
    ],
  };

  const responses = examples[action];
  if (responses) return responses[0];

  const fallbacks: Record<string, string> = {
    refactor: "## Refactored Code\n\n**Changes Made**:\n1. Extracted helper functions for better SRP\n2. Improved naming conventions\n3. Added TypeScript interfaces\n4. Reduced nesting with early returns\n\n```typescript\ninterface ProcessResult {\n  data: unknown;\n  success: boolean;\n  error?: string;\n}\n\nfunction processInput(input: string): ProcessResult {\n  if (!input.trim()) {\n    return { data: null, success: false, error: 'Empty input' };\n  }\n  \n  const parsed = parseInput(input);\n  const validated = validateInput(parsed);\n  \n  if (!validated.isValid) {\n    return { data: null, success: false, error: validated.error };\n  }\n  \n  return { data: transform(parsed), success: true };\n}\n```",
    comments: "```typescript\n/**\n * Fetches user data from the API\n * @param userId - The unique identifier of the user\n * @returns Promise resolving to user data\n * @throws {NetworkError} When the API is unreachable\n */\nasync function fetchUserData(userId: string): Promise<UserData> {\n  // Validate input before making the request\n  if (!userId || typeof userId !== 'string') {\n    throw new Error('Invalid user ID');\n  }\n\n  // Configure request with auth headers\n  const response = await fetch(`/api/users/${userId}`, {\n    headers: {\n      'Authorization': `Bearer ${getToken()}`,\n      'Content-Type': 'application/json',\n    },\n  });\n\n  // Handle non-200 responses appropriately\n  if (!response.ok) {\n    // Map HTTP status to meaningful errors\n    if (response.status === 404) throw new NotFoundError('User not found');\n    if (response.status === 401) throw new AuthError('Session expired');\n    throw new ApiError(`Request failed: ${response.status}`);\n  }\n\n  // Parse and return the JSON response\n  return response.json();\n}\n```",
    uncomment: "```typescript\nfunction calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n}\n\nfunction formatCurrency(amount: number): string {\n  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);\n}\n```",
    convert: "## Language Conversion\n\nConverted from the source language to the target language:\n\n```python\n# Python equivalent\ndef calculate_total(items):\n    return sum(item.price * item.quantity for item in items)\n\n\ndef format_currency(amount):\n    return f'${amount:,.2f}'\n```\n\n**Key Differences**:\n1. Python uses snake_case by convention\n2. List comprehensions replace array methods\n3. f-strings provide concise formatting\n4. Dynamic typing removes type annotations",
    tests: "```typescript\nimport { describe, it, expect, vi } from 'vitest';\nimport { calculateTotal, formatCurrency } from './utils';\n\ndescribe('calculateTotal', () => {\n  it('should return 0 for empty items', () => {\n    expect(calculateTotal([])).toBe(0);\n  });\n\n  it('should calculate sum of item prices', () => {\n    const items = [\n      { price: 10, quantity: 2 },\n      { price: 5, quantity: 3 },\n    ];\n    expect(calculateTotal(items)).toBe(35);\n  });\n\n  it('should handle single item', () => {\n    const items = [{ price: 100, quantity: 1 }];\n    expect(calculateTotal(items)).toBe(100);\n  });\n\n  it('should throw for invalid input', () => {\n    expect(() => calculateTotal(null)).toThrow('Invalid items');\n  });\n});\n\ndescribe('formatCurrency', () => {\n  it('should format positive numbers', () => {\n    expect(formatCurrency(1234.5)).toBe('$1,234.50');\n  });\n\n  it('should format zero', () => {\n    expect(formatCurrency(0)).toBe('$0.00');\n  });\n});\n```",
    errors: "## Error Analysis\n\n**Error**: `TypeError: Cannot read properties of undefined (reading 'map')`\n\n**Cause**: The variable being accessed is undefined or null when the code tries to call `.map()` on it.\n\n**Common Scenarios**:\n1. Async data hasn't loaded yet\n2. API returned an unexpected response\n3. Prop/state wasn't passed correctly\n\n**Fix**:\n```typescript\n// Before (broken)\nreturn items.map(item => <li>{item.name}</li>);\n\n// After (fixed)\nreturn (items || []).map(item => <li key={item.id}>{item.name}</li>);\n```\n\n**Prevention**:\n- Always initialize state with default values\n- Use optional chaining: `items?.map()`\n- Add null checks before array operations",
    security: "## Security Analysis\n\n**Vulnerabilities Found**:\n\n### 1. SQL Injection 🔴\nDirect string interpolation in SQL queries\n```typescript\n// Vulnerable\nconst query = `SELECT * FROM users WHERE id = ${userId}`;\n\n// Fixed\nconst query = 'SELECT * FROM users WHERE id = $1';\n```\n\n### 2. XSS 🟡\nRendering user input without sanitization\n```typescript\n// Vulnerable\nelement.innerHTML = userInput;\n\n// Fixed\nelement.textContent = userInput;\n```\n\n### 3. Hardcoded Secrets 🔴\nAPI keys and passwords in source code\n\n### Recommendations\n- Use parameterized queries\n- Implement CSP headers\n- Move secrets to environment variables\n- Add rate limiting\n- Use input validation",
    complexity: "## Complexity Analysis\n\n**Cyclomatic Complexity**: 12 (High — threshold: 10)\n**Cognitive Complexity**: 18 (Very High)\n**Maintainability Index**: 45/100 (Low)\n\n### Problem Areas\n1. Deeply nested conditionals (4 levels)\n2. Single function handles multiple responsibilities\n3. Complex boolean expressions\n\n### Recommendations\n```typescript\n// Extract validation logic\nfunction isValidInput(data: unknown): boolean {\n  return data !== null && typeof data === 'object';\n}\n\n// Extract business rules\nfunction calculateDiscount(price: number, tier: string): number {\n  const discounts: Record<string, number> = {\n    premium: 0.2,\n    gold: 0.15,\n    silver: 0.1,\n  };\n  return price * (discounts[tier] || 0);\n}\n```\n\n**Expected Improvement**: Complexity score reduced from 12 to 4",
    performance: "## Performance Analysis\n\n### Issues Found\n1. **Unnecessary Re-renders** 🟡 — Component re-renders on every keystroke\n2. **Memory Leak** 🔴 — Event listeners not cleaned up\n3. **Large Bundle** 🟡 — Importing entire library instead of tree-shaking\n\n### Recommendations\n```typescript\n// Before: Recalculates on every render\nconst filtered = data.filter(x => x.active).sort(compare);\n\n// After: Memoized computation\nconst filtered = useMemo(\n  () => data.filter(x => x.active).sort(compare),\n  [data]\n);\n\n// Before: Memory leak\nwindow.addEventListener('resize', handleResize);\n\n// After: Cleanup\nuseEffect(() => {\n  window.addEventListener('resize', handleResize);\n  return () => window.removeEventListener('resize', handleResize);\n}, []);\n```\n\n**Expected Impact**: 50% reduction in re-renders, fix memory leak",
    sql: "```sql\n-- Get users with their recent orders\nSELECT \n  u.id,\n  u.name,\n  u.email,\n  COUNT(o.id) AS order_count,\n  SUM(o.total) AS total_spent,\n  MAX(o.created_at) AS last_order_date\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.active = true\n  AND (o.created_at >= NOW() - INTERVAL '30 days' OR o.id IS NULL)\nGROUP BY u.id, u.name, u.email\nHAVING COUNT(o.id) > 0\nORDER BY total_spent DESC\nLIMIT 100;\n\n-- Recommended Indexes\nCREATE INDEX idx_orders_user_id ON orders(user_id);\nCREATE INDEX idx_orders_created_at ON orders(created_at);\nCREATE INDEX idx_users_active ON users(active) WHERE active = true;\n```\n\n**Query Plan Notes**:\n- Uses index scan on users.active\n- Hash join with orders via idx_orders_user_id\n- Sequential scan avoided with proper indexes",
    regex: "```regex\n# Email Validation\n^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$\n\n# URL Detection\nhttps?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()!@:%_\\+.~#?&\\/\\/=]*)\n\n# Phone Number (US)\n\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\n\n# Password Strength (min 8 chars, upper, lower, number, special)\n^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$\n```\n\n**Usage in TypeScript**:\n```typescript\nconst emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;\nconst isValidEmail = emailRegex.test('user@example.com'); // true\n```",
    docs: "# API Documentation\n\n## Overview\nThis module provides a service layer for interacting with external APIs with built-in caching, retry logic, and error handling.\n\n## Installation\n```bash\nnpm install @company/api-service\n```\n\n## Quick Start\n```typescript\nimport { createService } from '@company/api-service';\n\nconst service = createService({\n  apiKey: process.env.API_KEY,\n  baseUrl: 'https://api.example.com',\n});\n\nconst data = await service.getUser('123');\n```\n\n## API Reference\n\n### `createService(config): Service`\nCreates a new API service instance.\n\n| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n| config.apiKey | string | Yes | API authentication key |\n| config.baseUrl | string | Yes | Base URL for API |\n| config.timeout | number | No | Request timeout (default: 5000ms) |\n\n### `service.getUser(id): Promise<User>`\nFetches a user by ID.\n\n## Error Handling\nAll methods throw typed errors:\n- `AuthenticationError` — Invalid API key\n- `NotFoundError` — Resource not found\n- `RateLimitError` — Too many requests\n\n## Configuration\nSet via environment variables:\n- `API_SERVICE_KEY` — Your API key\n- `API_SERVICE_URL` — API base URL",
    api: "# API Design\n\n## RESTful API\n\n### Base URL\n`https://api.example.com/v1`\n\n### Authentication\nBearer token in Authorization header:\n```\nAuthorization: Bearer <token>\n```\n\n### Endpoints\n\n#### Users\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /users | List users |\n| POST | /users | Create user |\n| GET | /users/:id | Get user |\n| PATCH | /users/:id | Update user |\n| DELETE | /users/:id | Delete user |\n\n#### User Object\n```json\n{\n  \"id\": \"string\",\n  \"name\": \"string\",\n  \"email\": \"string\",\n  \"role\": \"user | admin\",\n  \"createdAt\": \"ISO8601\",\n  \"updatedAt\": \"ISO8601\"\n}\n```\n\n### Pagination\n```\nGET /users?page=1&limit=20&sort=name&order=asc\n```\nResponse includes pagination metadata.\n\n### Error Format\n```json\n{\n  \"error\": {\n    \"code\": \"VALIDATION_ERROR\",\n    \"message\": \"Email is required\",\n    \"details\": [{\"field\": \"email\", \"issue\": \"required\"}]\n  }\n}\n```\n\n### Rate Limiting\n- 100 requests per minute per API key\n- Retry-After header included on rate limit",
    readme: `# Project Name\n\n![License](https://img.shields.io/badge/license-MIT-blue.svg)\n![Version](https://img.shields.io/badge/version-1.0.0-green.svg)\n\n## 🚀 Overview\n\nA brief description of your project — what problem it solves and who it's for.\n\n## ✨ Features\n\n- Feature 1: Brief description\n- Feature 2: Brief description\n- Feature 3: Brief description\n\n## 📦 Installation\n\n\`\`\`bash\ngit clone https://github.com/username/project\ncd project\nnpm install\n\`\`\`\n\n## 🔧 Usage\n\n\`\`\`bash\n# Start development server\nnpm run dev\n\n# Build for production\nnpm run build\n\n# Run tests\nnpm test\n\`\`\`\n\n## 🏗️ Configuration\n\nCreate a \`.env\` file:\n\n\`\`\`env\nAPI_KEY=your_key_here\nDATABASE_URL=postgresql://...\n\`\`\`\n\n## 📚 API Documentation\n\nSee [API.md](./API.md) for full documentation.\n\n## 🧪 Testing\n\n\`\`\`bash\nnpm run test        # Unit tests\nnpm run test:e2e    # E2E tests\nnpm run test:coverage  # Coverage report\n\`\`\`\n\n## 🤝 Contributing\n\n1. Fork the repository\n2. Create your feature branch\n3. Commit your changes\n4. Push to the branch\n5. Open a Pull Request\n\n## 📄 License\n\nThis project is licensed under the MIT License.\n\n## 🙏 Acknowledgments\n\n- List of contributors or inspirations`,
    summary: "## Project Summary\n\n### Architecture\nThis project follows a **layered architecture** with:\n- **Frontend**: React SPA with TypeScript, state management via Zustand\n- **Backend**: Express REST API with PostgreSQL\n- **AI Service**: Python FastAPI for AI/ML operations\n\n### Key Components\n1. **Authentication Module** — JWT-based auth with session management\n2. **Chat System** — Real-time streaming AI chat conversations\n3. **Code Editor** — Monaco-based IDE with file management\n4. **User System** — Profile, settings, API keys management\n\n### Data Flow\n```\nUser → Frontend → API Gateway → Backend → Database\n                         ↓\n                    AI Service → OpenAI\n```\n\n### Technologies\n- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS\n- **Backend**: Node.js, Express, PostgreSQL\n- **AI**: Python, FastAPI, OpenAI API\n- **Deployment**: Docker, Render, Vercel\n\n### Suggestions\n- Add caching layer (Redis) for frequently accessed data\n- Implement WebSocket for real-time collaboration\n- Add comprehensive error tracking (Sentry)\n- Set up CI/CD pipeline with automated testing",
    commit: "feat(api): add user authentication endpoint\n\nImplement JWT-based authentication with the following:\n- Login endpoint with email/password validation\n- Token generation and refresh mechanism\n- Password hashing with bcrypt (12 rounds)\n- Rate limiting on failed attempts\n\nCloses #123",
  };

  return fallbacks[action] || "Task completed successfully. Here's the result based on your request.";
}

router.post("/code/action", async (req: AuthRequest, res: Response) => {
  try {
    const { action, code, language, instruction, filePath } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: "Action is required" });
    }

    if ((action === "explain" || action === "fix" || action === "optimize" || action === "refactor" || action === "comments" || action === "uncomment" || action === "convert" || action === "tests" || action === "security" || action === "complexity" || action === "performance") && !code) {
      return res.status(400).json({ success: false, error: "Code is required for this action" });
    }

    // Try the real Python AI service first
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/code/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code, language, instruction, filePath }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, data });
      }
    } catch {
      // Python service unavailable, use mock
    }

    // Fall back to mock response
    const content = mockCodeResponse(action, code || "", instruction || "");
    logger.info("AI code action fallback to mock", { action });

    res.json({
      success: true,
      data: { content, model: "mock" },
    });
  } catch (error) {
    logger.error("Code action failed", { error });
    res.status(500).json({
      success: false,
      error: "Failed to process code action",
    });
  }
});

export default router;
