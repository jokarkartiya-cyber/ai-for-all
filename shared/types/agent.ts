export type AgentType =
  | "planner"
  | "coder"
  | "debugger"
  | "tester"
  | "reviewer"
  | "refactor"
  | "documenter"
  | "deployer"
  | "security";

export type AgentStatus = "idle" | "running" | "completed" | "failed" | "paused";

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  model: string;
  temperature: number;
  instructions: string;
  tools: string[];
  progress?: number;
  currentStep?: string;
  createdAt: Date;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: AgentType;
  description: string;
  status: AgentStatus;
  steps: AgentStep[];
  context?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStep {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  action?: string;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentMessage {
  type: "step" | "progress" | "complete" | "error" | "request";
  agentId: string;
  taskId: string;
  content: string;
  timestamp: Date;
}
