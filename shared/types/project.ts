export interface ProjectFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  content?: string;
  language?: string;
  isDirectory: boolean;
  children?: ProjectFile[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  language: string;
  framework?: string;
  files: number;
  folders: number;
  lastOpened: Date;
  createdAt: Date;
}

export interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
  timestamp: Date;
  userId: string;
}

export interface IndexedFile {
  path: string;
  content: string;
  chunks: string[];
  embedding: number[];
  language: string;
  lastIndexed: Date;
}

export interface Dependency {
  name: string;
  version: string;
  type: "production" | "development" | "peer";
  dependencies?: Dependency[];
}

export interface FileRelationship {
  source: string;
  target: string;
  type: "import" | "require" | "reference" | "inherit";
  line?: number;
}
