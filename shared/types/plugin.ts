export type PluginType = "editor" | "theme" | "tool" | "language" | "ai" | "integration";

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  enabled: boolean;
  path: string;
  icon?: string;
  permissions: string[];
  hooks: PluginHook[];
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority: number;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  main: string;
  permissions: string[];
  hooks: PluginHook[];
  settings?: Record<string, PluginSettingDefinition>;
}

export interface PluginSettingDefinition {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  default?: unknown;
  options?: { label: string; value: unknown }[];
  required?: boolean;
}
