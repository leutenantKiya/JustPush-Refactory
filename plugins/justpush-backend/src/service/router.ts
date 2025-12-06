import express from 'express';
import Router from 'express-promise-router';
import { LoggerService, HttpAuthService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import multer from 'multer';
import { FileExtractorService } from './FileExtractorService';
import { GitHubService } from './GitHubService';
import { ApiDetectorService } from './ApiDetectorService';
import { GeminiAnalyzeService } from './GeminiAnalyzeService';
import { DeploymentManagerService } from './DeploymentManagerService';
import { AnalyzeResponse, GitHubImportRequest, UploadResponse } from '../types/api';
import { DeployRequest, ScaleRequest } from '../types/deployment';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
  httpAuth: HttpAuthService;
}

let sharedFileExtractor: FileExtractorService | null = null;
let sharedGitHubService: GitHubService | null = null;
let sharedApiDetector: ApiDetectorService | null = null;
let sharedGeminiService: GeminiAnalyzeService | null = null;
let sharedDeploymentManager: DeploymentManagerService | null = null;

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config, httpAuth } = options;

  const router = Router();
  router.use(express.json());

  router.use(async (req, _, next) => {
    try {
      await httpAuth.credentials(req, { 
        allow: ['user', 'service'],
        allowLimitedAccess: true 
      });
    } catch (error) {
      logger.debug(`No credentials found, allowing limited access`);
    }
    next();
  });

  if (!sharedFileExtractor) {
    sharedFileExtractor = new FileExtractorService(logger);
    logger.info('Created new FileExtractorService instance');
  }
  if (!sharedGitHubService) {
    let githubToken: string | undefined;
    try {
      const githubConfigs = config.getOptionalConfigArray('integrations.github');
      if (githubConfigs && githubConfigs.length > 0) {
        githubToken = githubConfigs[0].getOptionalString('token');
        if (githubToken) {
          logger.info(`GitHub token configured (length: ${githubToken.length})`);
        } else {
          logger.warn('GitHub token not found in config');
        }
      } else {
        logger.warn('No GitHub integration config found');
      }
    } catch (error: any) {
      logger.error('Error reading GitHub token from config', { error: error.message });
    }
    sharedGitHubService = new GitHubService(logger, '/tmp/backstage-git-clones', githubToken);
    logger.info('Created new GitHubService instance');
  }
  if (!sharedApiDetector) {
    sharedApiDetector = new ApiDetectorService(logger, sharedFileExtractor);
  }
  
  const geminiApiKey = config.getOptionalString('gemini.apiKey');
  if (!sharedGeminiService) {
    sharedGeminiService = new GeminiAnalyzeService(logger, geminiApiKey);
  }

  if (!sharedDeploymentManager) {
    const registryUrl = config.getOptionalString('deployment.registry.url') || 'localhost:5000';
    const registryUser = config.getOptionalString('deployment.registry.username');
    const registryPassword = config.getOptionalString('deployment.registry.password');
    const k8sApiServer = config.getOptionalString('deployment.kubernetes.apiServer') || 'https://kubernetes.default.svc';
    const k8sNamespace = config.getOptionalString('deployment.kubernetes.namespace') || 'justpush';
    const k8sToken = config.getOptionalString('deployment.kubernetes.serviceAccountToken');
    const k8sSkipTls = config.getOptionalBoolean('deployment.kubernetes.skipTlsVerify') || false;
    const kongAdminUrl = config.getOptionalString('deployment.kong.adminUrl') || 'http://kong-admin:8001';
    const kongAdminToken = config.getOptionalString('deployment.kong.adminToken');
    const kongGatewayUrl = config.getOptionalString('deployment.kong.gatewayUrl') || 'http://kong-gateway:8000';

    sharedDeploymentManager = new DeploymentManagerService(logger, {
      uploadDir: '/tmp/backstage-uploads',
      registry: {
        url: registryUrl,
        username: registryUser,
        password: registryPassword,
      },
      kubernetes: {
        apiServer: k8sApiServer,
        namespace: k8sNamespace,
        serviceAccountToken: k8sToken,
        skipTlsVerify: k8sSkipTls,
      },
      kong: {
        adminUrl: kongAdminUrl,
        adminToken: kongAdminToken,
        gatewayUrl: kongGatewayUrl,
      },
    });
    logger.info('Created new DeploymentManagerService instance');
  }

  const fileExtractor = sharedFileExtractor;
  const githubService = sharedGitHubService;
  const apiDetector = sharedApiDetector;
  const geminiService = sharedGeminiService;
  const deploymentManager = sharedDeploymentManager;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (_, file, cb) => {
      if (file.mimetype === 'application/zip' || 
          file.mimetype === 'application/x-zip-compressed' ||
          file.originalname.endsWith('.zip')) {
        cb(null, true);
      } else {
        cb(new Error('Only ZIP files are allowed'));
      }
    },
  });

  router.get('/health', (_, response) => {
    response.json({ status: 'ok' });
  });

  router.post('/upload', upload.single('file') as any, async (request, response) => {
    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' });
    }

    logger.info(`Processing uploaded file: ${request.file.originalname}`);

    try {
      const { uploadId, extractedPath } = await fileExtractor.extractZip(
        request.file.buffer,
      );

      const detectedPaths = await apiDetector.detectApiPaths(extractedPath);

      const allFiles = await fileExtractor.listFiles(extractedPath);

      const uploadResponse: UploadResponse = {
        uploadId,
        extractedPath,
        detectedPaths,
        totalFiles: allFiles.length,
      };

      logger.info(`Upload processed: ${uploadId}, found ${detectedPaths.length} API paths, path: ${extractedPath}`);
      
      const fs = await import('fs-extra');
      const stillExists = await fs.pathExists(extractedPath);
      logger.info(`Directory verification: ${extractedPath} exists = ${stillExists}`);
      
      return response.json(uploadResponse);
    } catch (error: any) {
      logger.error('Upload processing failed', error);
      return response.status(500).json({
        error: 'Failed to process upload',
        message: error.message,
      });
    }
  });

  router.post('/analyze/:uploadId', async (request, response) => {
    const { uploadId } = request.params;
    const extractedPath = fileExtractor.getUploadPath(uploadId);

    logger.info(`[ANALYZE] Starting analysis for uploadId: ${uploadId}`);
    logger.info(`[ANALYZE] Expected path: ${extractedPath}`);

    try {
      const fs = await import('fs-extra');
      const dirExists = await fs.pathExists(extractedPath);
      
      logger.info(`[ANALYZE] Directory exists check: ${dirExists}`);
      
      if (!dirExists) {
        logger.error(`[ANALYZE] Directory not found: ${extractedPath}`);
        
        const uploadsDir = '/tmp/backstage-uploads';
        try {
          const dirs = await fs.readdir(uploadsDir);
          logger.info(`[ANALYZE] Available uploads in ${uploadsDir}: ${dirs.join(', ')}`);
        } catch (e) {
          logger.warn(`[ANALYZE] Could not list uploads directory`);
        }
        
        return response.status(404).json({
          error: 'Project not found',
          message: 'The uploaded project directory no longer exists. Please re-upload your project.',
        });
      }

      const detectedPaths = await apiDetector.detectApiPaths(extractedPath);

      const endpoints = await apiDetector.analyzeEndpoints(extractedPath, detectedPaths);

      const byMethod: Record<string, number> = {};
      const byPath: Record<string, number> = {};

      for (const endpoint of endpoints) {
        byMethod[endpoint.method] = (byMethod[endpoint.method] || 0) + 1;
        
        const pathPrefix = endpoint.path.split('/')[1] || 'root';
        byPath[pathPrefix] = (byPath[pathPrefix] || 0) + 1;
      }

      const analyzeResponse: AnalyzeResponse = {
        detectedPaths,
        endpoints,
        summary: {
          totalEndpoints: endpoints.length,
          byMethod,
          byPath,
        },
      };

      if (endpoints.length > 0 && geminiService) {
        try {
          logger.info('Generating OpenAPI spec with Gemini...');
          const openApiSpec = await geminiService.generateOpenApiFromEndpoints(
            endpoints,
            detectedPaths,
            `API Project ${uploadId}`,
          );
          
          analyzeResponse.openApiSpec = openApiSpec;
          analyzeResponse.geminiMetadata = {
            generatedAt: new Date().toISOString(),
            model: 'gemini-2.5-flash',
          };
          
          logger.info('OpenAPI spec generated successfully');
        } catch (geminiError: any) {
          logger.warn(`Failed to generate OpenAPI spec with Gemini: ${geminiError.message}`);
        }
      }

      logger.info(`Analysis complete: ${endpoints.length} endpoints found`);
      return response.json(analyzeResponse);
    } catch (error: any) {
      logger.error('Analysis failed', error);
      return response.status(500).json({
        error: 'Failed to analyze project',
        message: error.message,
      });
    }
  });

  router.post('/import/github', async (request, response) => {
    const { repoUrl, branch = 'main', path: targetPath } = request.body as GitHubImportRequest;

    if (!repoUrl) {
      return response.status(400).json({ error: 'repoUrl is required' });
    }

    logger.info(`Importing from GitHub: ${repoUrl}`);

    try {
      const parsed = githubService.parseGitHubUrl(repoUrl);
      if (!parsed) {
        return response.status(400).json({ error: 'Invalid GitHub URL' });
      }

      const { cloneId, localPath } = await githubService.cloneRepository(
        repoUrl,
        branch,
        targetPath,
      );

      fileExtractor.registerUpload(cloneId, localPath);

      const detectedPaths = await apiDetector.detectApiPaths(localPath);

      const allFiles = await fileExtractor.listFiles(localPath);

      const uploadResponse: UploadResponse = {
        uploadId: cloneId,
        extractedPath: localPath,
        detectedPaths,
        totalFiles: allFiles.length,
      };

      logger.info(`GitHub import complete: ${cloneId}, found ${detectedPaths.length} API paths`);
      return response.json(uploadResponse);
    } catch (error: any) {
      logger.error('GitHub import failed', error);
      return response.status(500).json({
        error: 'Failed to import from GitHub',
        message: error.message,
      });
    }
  });

  router.delete('/cleanup/:uploadId', async (request, response) => {
    const { uploadId } = request.params;

    logger.info(`Cleaning up: ${uploadId}`);

    try {
      await fileExtractor.cleanup(uploadId);
      response.json({ success: true });
    } catch (error: any) {
      logger.error('Cleanup failed', error);
      response.status(500).json({
        error: 'Failed to cleanup',
        message: error.message,
      });
    }
  });

  router.post('/deploy/:uploadId', async (request, response) => {
    const { uploadId } = request.params;
    const {
      projectType = 'nodejs',
      framework,
      replicas = 1,
      resources,
      environment,
      ports,
      openApiSpec,
      kongPlugins,
    } = request.body as DeployRequest;

    logger.info(`[DEPLOY] Starting deployment for ${uploadId}`);

    try {
      const metadata = await deploymentManager.deploy({
        uploadId,
        projectType,
        framework,
        replicas,
        resources,
        environment,
        ports,
        openApiSpec,
        kongPlugins,
      });

      logger.info(`[DEPLOY] Successfully deployed ${uploadId}`);
      return response.json(metadata);
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to deploy ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to deploy',
        message: error.message,
      });
    }
  });

  router.get('/deploy/:uploadId/status', async (request, response) => {
    const { uploadId } = request.params;

    try {
      const metadata = await deploymentManager.getDeploymentStatus(uploadId);

      if (!metadata) {
        return response.status(404).json({
          error: 'Deployment not found',
        });
      }

      return response.json(metadata);
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to get status for ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to get deployment status',
        message: error.message,
      });
    }
  });

  router.get('/deploy/:uploadId/logs', async (request, response) => {
    const { uploadId } = request.params;
    const tailLines = parseInt(request.query.tail as string) || 100;

    try {
      const logs = await deploymentManager.getLogs(uploadId, tailLines);
      return response.json({ logs });
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to get logs for ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to get logs',
        message: error.message,
      });
    }
  });

  router.put('/deploy/:uploadId/scale', async (request, response) => {
    const { uploadId } = request.params;
    const { replicas } = request.body as ScaleRequest;

    if (!replicas || replicas < 0) {
      return response.status(400).json({
        error: 'Invalid replicas value',
      });
    }

    logger.info(`[DEPLOY] Scaling ${uploadId} to ${replicas} replicas`);

    try {
      await deploymentManager.scale(uploadId, replicas);
      return response.json({ success: true, replicas });
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to scale ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to scale deployment',
        message: error.message,
      });
    }
  });

  router.post('/deploy/:uploadId/redeploy', async (request, response) => {
    const { uploadId } = request.params;

    logger.info(`[DEPLOY] Redeploying ${uploadId}`);

    try {
      const metadata = await deploymentManager.redeploy(uploadId);
      return response.json(metadata);
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to redeploy ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to redeploy',
        message: error.message,
      });
    }
  });

  router.delete('/deploy/:uploadId', async (request, response) => {
    const { uploadId } = request.params;

    logger.info(`[DEPLOY] Deleting deployment ${uploadId}`);

    try {
      await deploymentManager.delete(uploadId);
      return response.json({ success: true });
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to delete ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to delete deployment',
        message: error.message,
      });
    }
  });

  router.get('/deploy/list', async (_, response) => {
    try {
      const deployments = await deploymentManager.listDeployments();
      return response.json({ deployments });
    } catch (error: any) {
      logger.error('[DEPLOY] Failed to list deployments', { error });
      return response.status(500).json({
        error: 'Failed to list deployments',
        message: error.message,
      });
    }
  });

  router.get('/deploy/:uploadId/metrics', async (request, response) => {
    const { uploadId } = request.params;

    try {
      const metrics = await deploymentManager.getKongMetrics(uploadId);
      return response.json(metrics);
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to get metrics for ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to get metrics',
        message: error.message,
      });
    }
  });

  router.post('/deploy/:uploadId/plugins/rate-limit', async (request, response) => {
    const { uploadId } = request.params;
    const { requestsPerMinute } = request.body;

    if (!requestsPerMinute || requestsPerMinute <= 0) {
      return response.status(400).json({
        error: 'Invalid requestsPerMinute value',
      });
    }

    try {
      await deploymentManager.addRateLimiting(uploadId, requestsPerMinute);
      return response.json({ success: true });
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to add rate limiting for ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to add rate limiting',
        message: error.message,
      });
    }
  });

  router.post('/deploy/:uploadId/plugins/cors', async (request, response) => {
    const { uploadId } = request.params;

    try {
      await deploymentManager.addCors(uploadId);
      return response.json({ success: true });
    } catch (error: any) {
      logger.error(`[DEPLOY] Failed to add CORS for ${uploadId}`, { error });
      return response.status(500).json({
        error: 'Failed to add CORS',
        message: error.message,
      });
    }
  });

  router.post('/analyze-api', async (request, response) => {
    const { apiUrl, method, headers } = request.body;

    if (!apiUrl) {
      return response.status(400).json({ error: 'apiUrl is required' });
    }

    logger.info(`Analyzing API with Gemini: ${apiUrl}`);

    try {
      const result = await geminiService.analyzeApi({
        apiUrl,
        method,
        headers,
      });

      logger.info(`API analysis complete for: ${apiUrl}`);
      return response.json(result);
    } catch (error: any) {
      logger.error('Gemini API analysis failed', error);
      return response.status(500).json({
        error: 'Failed to analyze API',
        message: error.message,
      });
    }
  });

  router.get('/stats', async (_, response) => {
    const geminiConfigured = await geminiService.testConnection();
    
    response.json({
      message: 'API Importer Statistics',
      supportedFormats: ['ZIP'],
      supportedSources: ['upload', 'github'],
      maxFileSize: '100MB',
      supportedFrameworks: [
        'Express.js',
        'Fastify',
        'Koa',
        'NestJS',
        'Hapi',
      ],
      features: {
        geminiAnalyzer: geminiConfigured,
      },
    });
  });

  return router;
}
