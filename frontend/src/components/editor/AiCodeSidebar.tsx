import { useState, useCallback } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/common";
import api from "@/services/api";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  Code,
  FileCode,
  Wand2,
  Bug,
  RotateCcw,
} from "lucide-react";

type ActionType = "explain" | "generate" | "fix" | "refactor";

interface CodeSuggestion {
  code: string;
  language: string;
  index: number;
}

function extractCodeBlocks(text: string): CodeSuggestion[] {
  const blocks: CodeSuggestion[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  let index = 0;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "plaintext",
      code: match[2].trim(),
      index: index++,
    });
  }
  return blocks;
}

export function AiCodeSidebar({
  onApplyCode,
  getSelectedText,
}: {
  onApplyCode?: (code: string) => void;
  getSelectedText?: () => string;
}) {
  const [action, setAction] = useState<ActionType>("explain");
  const [instruction, setInstruction] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const codeBlocks = response ? extractCodeBlocks(response) : [];

  const handleAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setApplied(new Set());

    const selectedCode = getSelectedText?.() || "";

    try {
      const { data } = await api.post("/ai/code/action", {
        action,
        code: selectedCode,
        instruction,
        language: "typescript",
      });
      setResponse(data.data.content);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "AI service unavailable");
    } finally {
      setLoading(false);
    }
  }, [action, instruction, getSelectedText]);

  const handleApply = (code: string, index: number) => {
    onApplyCode?.(code);
    setApplied((prev) => new Set(prev).add(index));
  };

  const actionButtons: { key: ActionType; label: string; icon: React.ReactNode }[] = [
    { key: "explain", label: "Explain", icon: <FileCode className="h-3.5 w-3.5" /> },
    { key: "generate", label: "Generate", icon: <Wand2 className="h-3.5 w-3.5" /> },
    { key: "fix", label: "Fix", icon: <Bug className="h-3.5 w-3.5" /> },
    { key: "refactor", label: "Refactor", icon: <RotateCcw className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-50 dark:bg-surface-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <Sparkles className="h-4 w-4 text-primary-500" />
        <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
          AI Assistant
        </span>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1">
          {actionButtons.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setAction(key)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors",
                action === key
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 border border-transparent"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {(action === "generate" || action === "fix" || action === "refactor") && (
          <textarea
            className="input text-xs h-16 resize-none"
            placeholder={
              action === "generate"
                ? "Describe what to generate..."
                : action === "fix"
                ? "Describe the issue (optional)..."
                : "Describe refactoring goals..."
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={handleAction}
          loading={loading}
          disabled={loading}
        >
          {action === "explain" ? "Explain Code" : "Generate"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {response && !loading && (
          <div className="space-y-3">
            <div className="prose prose-xs dark:prose-invert max-w-none text-xs text-surface-700 dark:text-surface-300">
              {response.split("```").map((part, i) =>
                i % 2 === 0 ? (
                  <p key={i} className="whitespace-pre-wrap">{part}</p>
                ) : null
              )}
            </div>

            {codeBlocks.map((block) => (
              <div
                key={block.index}
                className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-surface-100 dark:bg-surface-800 text-xs text-surface-500">
                  <span>{block.language}</span>
                  {applied.has(block.index) ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <Check className="h-3 w-3" /> Applied
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleApply(block.code, block.index)}
                        className="btn-ghost p-1 text-primary-500 hover:text-primary-600"
                        title="Apply to editor"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setApplied((prev) => new Set(prev).add(block.index))}
                        className="btn-ghost p-1 text-surface-400 hover:text-surface-600"
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <pre className="p-3 text-xs overflow-x-auto bg-surface-900 text-surface-100">
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {!response && !loading && !error && (
          <div className="text-center py-8">
            <Code className="h-8 w-8 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
            <p className="text-xs text-surface-400">
              Select code in the editor,<br />then choose an action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
