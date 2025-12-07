export interface GeneratedFile {
  filename: string;
  content: string;
  language: string;
  description: string;
}

export interface GenerationResponse {
  files: GeneratedFile[];
  summary: string;
}

export enum TerminalStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'command';
  timestamp: number;
}