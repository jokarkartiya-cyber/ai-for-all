export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: UserRole;
  emailVerified?: boolean;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = "user" | "admin" | "moderator" | "enterprise";

export interface UserSettings {
  theme: "dark" | "light" | "system";
  language: string;
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  aiProvider: string;
  aiModel: string;
  customInstructions?: string;
}

export interface Session {
  id: string;
  userId: string;
  device: string;
  ip: string;
  lastActive: Date;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  provider: string;
  lastUsed?: Date;
  createdAt: Date;
}
