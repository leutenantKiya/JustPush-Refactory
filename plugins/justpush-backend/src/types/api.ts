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

// Kong

export interface KongServiceConfig {
  name: string;
  url: string;
  retries?: number;
  connectTimeout?: number;
  writeTimeout?: number;
  readTimeout?: number;
}

export interface KongRouteConfig {
  name: string;
  paths: string[];
  methods: string[];
  stripPath?: boolean;
}

export interface KongPluginConfig {
  name: string;
  config: Record<string, any>;
}

export interface KongRegistrationResult {
  serviceId: string;
  routeIds: string[];
  apiKey?: string;
  gatewayUrl: string;
}

export interface KongConfig {
  adminUrl: string;
  adminToken?: string;
  gatewayUrl: string;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, any>>;
}