export interface DeploymentMetadata {
  uploadId: string;
  status: 'building' | 'pushing' | 'deploying' | 'configuring' | 'running' | 'failed';
  createdAt: string;
  updatedAt: string;
  buildInfo?: {
    imageId: string;
    imageName: string;
    imageTag: string;
    buildTime: number;
  };
  k8sNamespace?: string;
  k8sDeploymentName?: string;
  k8sServiceName?: string;
  k8sServiceUrl?: string;
  kongServiceId?: string;
  kongRouteIds?: string[];
  apiKey?: string;
  gatewayUrl?: string;
  replicas?: number;
  availableReplicas?: number;
  pods?: Array<{
    name: string;
    status: string;
    restarts: number;
  }>;
  resources?: {
    cpu?: string;
    memory?: string;
  };
  error?: string;
}

export interface BuildOptions {
  uploadId: string;
  projectPath: string;
  projectType: 'nodejs' | 'python' | 'java' | 'go' | 'unknown';
  framework?: string;
}

export interface BuildResult {
  imageId: string;
  imageName: string;
  imageTag: string;
  size: number;
  buildTime: number;
}

export interface DeploymentOptions {
  uploadId: string;
  imageName: string;
  imageTag: string;
  replicas?: number;
  resources?: {
    cpu?: string;
    memory?: string;
  };
  environment?: Record<string, string>;
  ports?: Array<{
    containerPort: number;
    servicePort?: number;
  }>;
}

export interface DeploymentResult {
  namespace: string;
  deploymentName: string;
  serviceName: string;
  serviceUrl: string;
}

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

export interface DeployRequest {
  projectType?: string;
  framework?: string;
  replicas?: number;
  resources?: {
    cpu?: string;
    memory?: string;
  };
  environment?: Record<string, string>;
  ports?: Array<{
    containerPort: number;
    servicePort: number;
  }>;
  openApiSpec?: any;
  kongPlugins?: KongPluginConfig[];
}

export interface ScaleRequest {
  replicas: number;
}
