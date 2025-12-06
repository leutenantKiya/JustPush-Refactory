import { LoggerService } from '@backstage/backend-plugin-api';
import * as path from 'path';
import { DockerBuildService } from './DockerBuildService';
import { ContainerRegistryService, RegistryConfig } from './ContainerRegistryService';
import { K8sDeploymentService, K8sConfig } from './K8sDeploymentService';
import { KongService, KongConfig, OpenApiSpec } from './KongService';
import {
  BuildOptions,
  DeploymentOptions,
  DeploymentMetadata,
  KongPluginConfig,
} from '../types/deployment';

export interface DeploymentManagerConfig {
  uploadDir: string;
  registry: RegistryConfig;
  kubernetes: K8sConfig;
  kong: KongConfig;
}

export interface DeploymentRequest {
  uploadId: string;
  projectType: string;
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
  openApiSpec?: OpenApiSpec;
  kongPlugins?: KongPluginConfig[];
}

export class DeploymentManagerService {
  private dockerBuildService: DockerBuildService;
  private registryService: ContainerRegistryService;
  private k8sService: K8sDeploymentService;
  private kongService: KongService;
  private deployments: Map<string, DeploymentMetadata>;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: DeploymentManagerConfig,
  ) {
    this.dockerBuildService = new DockerBuildService(
      logger,
      config.registry.url,
    );
    this.registryService = new ContainerRegistryService(logger, config.registry);
    this.k8sService = new K8sDeploymentService(logger, config.kubernetes);
    this.kongService = new KongService(logger, config.kong);
    this.deployments = new Map();
  }

  async deploy(request: DeploymentRequest): Promise<DeploymentMetadata> {
    const { uploadId } = request;

    this.logger.info(`Starting deployment pipeline for ${uploadId}`);

    const metadata: DeploymentMetadata = {
      uploadId,
      status: 'building',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.deployments.set(uploadId, metadata);

    try {
      const projectPath = path.join(this.config.uploadDir, uploadId);

      const buildOptions: BuildOptions = {
        uploadId,
        projectPath,
        projectType: (request.projectType || 'nodejs') as 'nodejs' | 'python' | 'java' | 'go',
        framework: request.framework,
      };

      const buildResult = await this.dockerBuildService.buildImage(buildOptions);
      
      metadata.buildInfo = {
        imageId: buildResult.imageId,
        imageName: buildResult.imageName,
        imageTag: buildResult.imageTag,
        buildTime: buildResult.buildTime,
      };
      metadata.status = 'pushing';
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      await this.registryService.pushImage(
        buildResult.imageName,
        buildResult.imageTag,
      );

      metadata.status = 'deploying';
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      const deployOptions: DeploymentOptions = {
        uploadId,
        imageName: buildResult.imageName,
        imageTag: buildResult.imageTag,
        replicas: request.replicas || 1,
        resources: request.resources,
        environment: request.environment,
        ports: request.ports || [{ containerPort: 3000 }],
      };

      const deployResult = await this.k8sService.deploy(deployOptions);

      metadata.k8sNamespace = deployResult.namespace;
      metadata.k8sDeploymentName = deployResult.deploymentName;
      metadata.k8sServiceName = deployResult.serviceName;
      metadata.k8sServiceUrl = deployResult.serviceUrl;
      metadata.status = 'configuring';
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      if (request.openApiSpec) {
        const kongResult = await this.kongService.registerApi(
          uploadId,
          deployResult.serviceUrl,
          request.openApiSpec,
          request.kongPlugins,
        );

        metadata.kongServiceId = kongResult.serviceId;
        metadata.kongRouteIds = kongResult.routeIds;
        metadata.apiKey = kongResult.apiKey;
        metadata.gatewayUrl = kongResult.gatewayUrl;
      }

      const deploymentStatus = await this.k8sService.getDeploymentStatus(
        deployResult.deploymentName,
      );
      metadata.replicas = deploymentStatus.replicas;
      metadata.availableReplicas = deploymentStatus.availableReplicas;

      metadata.status = 'running';
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      this.logger.info(`Successfully deployed ${uploadId}`, {
        gatewayUrl: metadata.gatewayUrl,
      });

      return metadata;
    } catch (error: any) {
      this.logger.error(`Deployment pipeline failed for ${uploadId}`, { error });

      metadata.status = 'failed';
      metadata.error = error.message;
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      await this.rollback(uploadId);

      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  async getDeploymentStatus(uploadId: string): Promise<DeploymentMetadata | undefined> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata) {
      return undefined;
    }

    if (metadata.status === 'running' && metadata.k8sDeploymentName) {
      try {
        const status = await this.k8sService.getDeploymentStatus(
          metadata.k8sDeploymentName,
        );

        metadata.replicas = status.replicas;
        metadata.availableReplicas = status.availableReplicas;
        metadata.updatedAt = new Date().toISOString();
        this.deployments.set(uploadId, metadata);
      } catch (error: any) {
        this.logger.warn(`Failed to update deployment status: ${error.message}`);
      }
    }

    return metadata;
  }

  async getLogs(uploadId: string, tailLines: number = 100): Promise<string[]> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata || !metadata.k8sDeploymentName) {
      throw new Error(`Deployment ${uploadId} not found`);
    }

    try {
      return await this.k8sService.getPodLogs(
        metadata.k8sDeploymentName,
        tailLines,
      );
    } catch (error: any) {
      this.logger.error(`Failed to get logs for ${uploadId}`, { error });
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  async scale(uploadId: string, replicas: number): Promise<void> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata || !metadata.k8sDeploymentName) {
      throw new Error(`Deployment ${uploadId} not found`);
    }

    this.logger.info(`Scaling deployment ${uploadId} to ${replicas} replicas`);

    try {
      await this.k8sService.scaleDeployment(
        metadata.k8sDeploymentName,
        replicas,
      );

      metadata.replicas = replicas;
      metadata.updatedAt = new Date().toISOString();
      this.deployments.set(uploadId, metadata);

      this.logger.info(`Successfully scaled deployment ${uploadId}`);
    } catch (error: any) {
      this.logger.error(`Failed to scale deployment ${uploadId}`, { error });
      throw new Error(`Scaling failed: ${error.message}`);
    }
  }

  async redeploy(uploadId: string): Promise<DeploymentMetadata> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata) {
      throw new Error(`Deployment ${uploadId} not found`);
    }

    this.logger.info(`Redeploying ${uploadId}`);

    await this.delete(uploadId);

    const request: DeploymentRequest = {
      uploadId,
      projectType: 'nodejs',
      replicas: metadata.replicas,
      environment: {},
    };

    return await this.deploy(request);
  }

  async delete(uploadId: string): Promise<void> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata) {
      throw new Error(`Deployment ${uploadId} not found`);
    }

    this.logger.info(`Deleting deployment ${uploadId}`);

    try {
      if (metadata.kongServiceId) {
        await this.kongService.deleteService(uploadId);
      }

      if (metadata.k8sDeploymentName) {
        await this.k8sService.deleteDeployment(metadata.k8sDeploymentName);
      }

      if (metadata.buildInfo) {
        await this.dockerBuildService.removeImage(
          metadata.buildInfo.imageName,
          metadata.buildInfo.imageTag,
        );
      }

      this.deployments.delete(uploadId);

      this.logger.info(`Successfully deleted deployment ${uploadId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete deployment ${uploadId}`, { error });
      throw new Error(`Deletion failed: ${error.message}`);
    }
  }

  private async rollback(uploadId: string): Promise<void> {
    this.logger.warn(`Rolling back deployment ${uploadId}`);

    try {
      await this.delete(uploadId);
    } catch (error: any) {
      this.logger.error(`Rollback failed for ${uploadId}`, { error });
    }
  }

  async listDeployments(): Promise<DeploymentMetadata[]> {
    return Array.from(this.deployments.values());
  }

  async getKongMetrics(uploadId: string): Promise<{
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatency: number;
  }> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata || !metadata.kongServiceId) {
      throw new Error(`Deployment ${uploadId} not found or not registered with Kong`);
    }

    try {
      return await this.kongService.getServiceMetrics(uploadId);
    } catch (error: any) {
      this.logger.error(`Failed to get Kong metrics for ${uploadId}`, { error });
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  async addRateLimiting(
    uploadId: string,
    requestsPerMinute: number,
  ): Promise<void> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata || !metadata.kongServiceId) {
      throw new Error(`Deployment ${uploadId} not found or not registered with Kong`);
    }

    try {
      await this.kongService.addRateLimitPlugin(uploadId, requestsPerMinute);
      this.logger.info(`Added rate limiting to ${uploadId}`);
    } catch (error: any) {
      this.logger.error(`Failed to add rate limiting for ${uploadId}`, { error });
      throw new Error(`Failed to add rate limiting: ${error.message}`);
    }
  }

  async addCors(uploadId: string): Promise<void> {
    const metadata = this.deployments.get(uploadId);

    if (!metadata || !metadata.kongServiceId) {
      throw new Error(`Deployment ${uploadId} not found or not registered with Kong`);
    }

    try {
      await this.kongService.addCorsPlugin(uploadId);
      this.logger.info(`Added CORS to ${uploadId}`);
    } catch (error: any) {
      this.logger.error(`Failed to add CORS for ${uploadId}`, { error });
      throw new Error(`Failed to add CORS: ${error.message}`);
    }
  }
}
