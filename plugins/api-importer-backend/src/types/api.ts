export interface UploadResponse {
  uploadId: string;
  extractedPath: string;
  detectedPaths: DetectedPath[];
  totalFiles: number;
}

export interface DetectedPath {
  path: string;
  type: 'api' | 'routes' | 'controllers' | 'handlers' | 'endpoints';
  confidence: number;
  files: string[];
  framework?: string;
}

export interface AnalyzeRequest {
  source: 'zip' | 'github';
  data?: {
    githubUrl?: string;
    branch?: string;
    path?: string;
  };
}

export interface AnalyzeResponse {
  detectedPaths: DetectedPath[];
  endpoints: Endpoint[];
  summary: {
    totalEndpoints: number;
    byMethod: Record<string, number>;
    byPath: Record<string, number>;
  };
}

export interface Endpoint {
  method: string;
  path: string;
  file: string;
  line: number;
  handler?: string;
  middleware?: string[];
}

export interface GitHubImportRequest {
  repoUrl: string;
  branch?: string;
  path?: string;
}