export type * from "./user";
export type * from "./chat";
export type * from "./project";
export type * from "./agent";
export type * from "./plugin";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface WebSocketMessage {
  type: string;
  channel: string;
  payload: unknown;
  timestamp: Date;
}
