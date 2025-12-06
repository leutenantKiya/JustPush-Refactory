import { LoggerService } from '@backstage/backend-plugin-api';
import axios, { AxiosInstance } from 'axios';
import {
  KongServiceConfig,
  KongRouteConfig,
  KongPluginConfig,
  KongRegistrationResult,
} from '../types/deployment';

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

export class KongService {
  private client: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: KongConfig,
  ) {
    this.client = axios.create({
      baseURL: config.adminUrl,
      headers: config.adminToken
        ? { 'Kong-Admin-Token': config.adminToken }
        : {},
    });
  }

  async registerApi(
    uploadId: string,
    serviceUrl: string,
    openApiSpec: OpenApiSpec,
    plugins?: KongPluginConfig[],
  ): Promise<KongRegistrationResult> {
    this.logger.info(`Registering API for ${uploadId} with Kong Gateway`);

    try {
      const serviceName = `justpush-${uploadId}`;

      const serviceConfig: KongServiceConfig = {
        name: serviceName,
        url: serviceUrl,
        retries: 5,
        connectTimeout: 60000,
        writeTimeout: 60000,
        readTimeout: 60000,
      };

      const serviceId = await this.createService(serviceConfig);

      const routes = this.generateRoutesFromOpenApi(uploadId, openApiSpec);
      const routeIds: string[] = [];

      for (const route of routes) {
        const routeId = await this.createRoute(serviceId, route);
        routeIds.push(routeId);
      }

      if (plugins && plugins.length > 0) {
        for (const plugin of plugins) {
          await this.addPlugin(serviceId, plugin);
        }
      }

      const apiKey = await this.generateApiKey(uploadId);

      const gatewayUrl = `${this.config.gatewayUrl}/${uploadId}`;

      this.logger.info(`Successfully registered API ${uploadId} at ${gatewayUrl}`);

      return {
        serviceId,
        routeIds,
        apiKey,
        gatewayUrl,
      };
    } catch (error: any) {
      this.logger.error(`Failed to register API with Kong`, { error });
      throw new Error(`Kong registration failed: ${error.message}`);
    }
  }

  private async createService(
    config: KongServiceConfig,
  ): Promise<string> {
    try {
      const response = await this.client.post('/services', {
        name: config.name,
        url: config.url,
        retries: config.retries,
        connect_timeout: config.connectTimeout,
        write_timeout: config.writeTimeout,
        read_timeout: config.readTimeout,
      });

      const serviceId = response.data.id;
      this.logger.info(`Created Kong service: ${config.name} (${serviceId})`);
      return serviceId;
    } catch (error: any) {
      if (error.response?.status === 409) {
        const existingService = await this.getServiceByName(config.name);
        if (existingService) {
          this.logger.info(`Service ${config.name} already exists, updating...`);
          await this.client.patch(`/services/${existingService.id}`, {
            url: config.url,
            retries: config.retries,
            connect_timeout: config.connectTimeout,
            write_timeout: config.writeTimeout,
            read_timeout: config.readTimeout,
          });
          return existingService.id;
        }
      }
      throw error;
    }
  }

  private async getServiceByName(name: string): Promise<{ id: string } | null> {
    try {
      const response = await this.client.get(`/services/${name}`);
      return response.data;
    } catch {
      return null;
    }
  }

  private async createRoute(
    serviceId: string,
    config: KongRouteConfig,
  ): Promise<string> {
    try {
      const response = await this.client.post(`/services/${serviceId}/routes`, {
        name: config.name,
        paths: config.paths,
        methods: config.methods,
        strip_path: config.stripPath,
      });

      const routeId = response.data.id;
      this.logger.info(`Created Kong route: ${config.name} (${routeId})`);
      return routeId;
    } catch (error: any) {
      this.logger.error(`Failed to create route ${config.name}`, { error });
      throw error;
    }
  }

  private generateRoutesFromOpenApi(
    uploadId: string,
    openApiSpec: OpenApiSpec,
  ): KongRouteConfig[] {
    const routes: KongRouteConfig[] = [];

    for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
      const methods = Object.keys(pathItem).filter(
        method => !['parameters', 'summary', 'description'].includes(method),
      );

      if (methods.length > 0) {
        const routeName = `justpush-${uploadId}-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const routePath = `/${uploadId}${path}`;

        routes.push({
          name: routeName,
          paths: [routePath],
          methods: methods.map(m => m.toUpperCase()),
          stripPath: false,
        });
      }
    }

    if (routes.length === 0) {
      routes.push({
        name: `justpush-${uploadId}-default`,
        paths: [`/${uploadId}`],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        stripPath: true,
      });
    }

    return routes;
  }

  private async addPlugin(
    serviceId: string,
    plugin: KongPluginConfig,
  ): Promise<void> {
    try {
      await this.client.post(`/services/${serviceId}/plugins`, {
        name: plugin.name,
        config: plugin.config,
      });

      this.logger.info(`Added plugin ${plugin.name} to service ${serviceId}`);
    } catch (error: any) {
      this.logger.error(`Failed to add plugin ${plugin.name}`, { error });
      throw error;
    }
  }

  private async generateApiKey(uploadId: string): Promise<string> {
    try {
      const consumerName = `justpush-${uploadId}`;

      let consumerId: string;
      try {
        const consumerResponse = await this.client.post('/consumers', {
          username: consumerName,
        });
        consumerId = consumerResponse.data.id;
      } catch (error: any) {
        if (error.response?.status === 409) {
          const existingConsumer = await this.client.get(`/consumers/${consumerName}`);
          consumerId = existingConsumer.data.id;
        } else {
          throw error;
        }
      }

      const keyResponse = await this.client.post(
        `/consumers/${consumerId}/key-auth`,
        {},
      );

      const apiKey = keyResponse.data.key;
      this.logger.info(`Generated API key for consumer ${consumerName}`);
      return apiKey;
    } catch (error: any) {
      this.logger.warn(`Failed to generate API key: ${error.message}`);
      return '';
    }
  }

  async updateService(
    uploadId: string,
    serviceUrl: string,
  ): Promise<void> {
    const serviceName = `justpush-${uploadId}`;

    try {
      await this.client.patch(`/services/${serviceName}`, {
        url: serviceUrl,
      });

      this.logger.info(`Updated Kong service ${serviceName} with new URL`);
    } catch (error: any) {
      this.logger.error(`Failed to update Kong service`, { error });
      throw new Error(`Kong update failed: ${error.message}`);
    }
  }

  async deleteService(uploadId: string): Promise<void> {
    const serviceName = `justpush-${uploadId}`;
    const consumerName = `justpush-${uploadId}`;

    try {
      await this.client.delete(`/services/${serviceName}`);
      this.logger.info(`Deleted Kong service ${serviceName}`);

      try {
        await this.client.delete(`/consumers/${consumerName}`);
        this.logger.info(`Deleted Kong consumer ${consumerName}`);
      } catch (error: any) {
        this.logger.warn(`Failed to delete consumer: ${error.message}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to delete Kong service`, { error });
      throw new Error(`Kong deletion failed: ${error.message}`);
    }
  }

  async getServiceMetrics(uploadId: string): Promise<{
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatency: number;
  }> {
    const serviceName = `justpush-${uploadId}`;

    try {
      const response = await this.client.get(`/services/${serviceName}/status`);
      const data = response.data;

      return {
        totalRequests: data.total_requests || 0,
        successRequests: data.success_requests || 0,
        errorRequests: data.error_requests || 0,
        avgLatency: data.avg_latency || 0,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get service metrics: ${error.message}`);
      return {
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        avgLatency: 0,
      };
    }
  }

  async addRateLimitPlugin(
    uploadId: string,
    requestsPerMinute: number,
  ): Promise<void> {
    const serviceName = `justpush-${uploadId}`;

    try {
      await this.client.post(`/services/${serviceName}/plugins`, {
        name: 'rate-limiting',
        config: {
          minute: requestsPerMinute,
          policy: 'local',
        },
      });

      this.logger.info(`Added rate limiting plugin to service ${serviceName}`);
    } catch (error: any) {
      this.logger.error(`Failed to add rate limiting plugin`, { error });
      throw new Error(`Plugin addition failed: ${error.message}`);
    }
  }

  async addCorsPlugin(uploadId: string): Promise<void> {
    const serviceName = `justpush-${uploadId}`;

    try {
      await this.client.post(`/services/${serviceName}/plugins`, {
        name: 'cors',
        config: {
          origins: ['*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          headers: ['Accept', 'Authorization', 'Content-Type'],
          exposed_headers: ['X-Auth-Token'],
          credentials: true,
          max_age: 3600,
        },
      });

      this.logger.info(`Added CORS plugin to service ${serviceName}`);
    } catch (error: any) {
      this.logger.error(`Failed to add CORS plugin`, { error });
      throw new Error(`Plugin addition failed: ${error.message}`);
    }
  }
}
