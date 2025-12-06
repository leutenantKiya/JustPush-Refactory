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
  openApiSpec?: string;
  geminiMetadata?: {
    generatedAt: string;
    model: string;
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

export interface UploadMetadata {
  uploadId: string;
  extractedPath: string;
  createdAt: Date;
  lastAccessed: Date;
}

// Gemini

export interface AnalyzeApiRequest {
  apiUrl: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface AnalyzeApiResponse {
  openApiSpec: string;
  metadata: {
    analyzedUrl: string;
    generatedAt: string;
    model: string;
  };
}