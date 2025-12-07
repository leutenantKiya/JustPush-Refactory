import express from 'express';
import Router from 'express-promise-router';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import multer from 'multer';
import { FileExtractorService } from './FileExtractorService';
import { GitHubService } from './GitHubService';
import { ApiDetectorService } from './ApiDetectorService';
import { GeminiAnalyzeService } from './GeminiAnalyzeService';
import { KongService } from './KongService';
import { AnalyzeResponse, GitHubImportRequest, UploadResponse } from '../types/api';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

let sharedFileExtractor: FileExtractorService | null = null;
let sharedGitHubService: GitHubService | null = null;
let sharedApiDetector: ApiDetectorService | null = null;
let sharedGeminiService: GeminiAnalyzeService | null = null;
let sharedKongService: KongService | null = null;

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  const router = Router();
  router.use(express.json());

  if (!sharedFileExtractor) {
    sharedFileExtractor = new FileExtractorService(logger);
  }
  if (!sharedGitHubService) {
    const githubConfigs = config.getOptionalConfigArray('integrations.github');
    const githubToken = githubConfigs?.[0]?.getOptionalString('token');
    sharedGitHubService = new GitHubService(logger, '/tmp/backstage-git-clones', githubToken);
  }
  if (!sharedApiDetector) {
    sharedApiDetector = new ApiDetectorService(logger, sharedFileExtractor);
  }
  if (!sharedGeminiService) {
    const geminiApiKey = config.getOptionalString('gemini.apiKey');
    sharedGeminiService = new GeminiAnalyzeService(logger, geminiApiKey);
  }
  if (!sharedKongService) {
    const kongConfig = {
      adminUrl: config.getOptionalString('kong.adminUrl') || 'http://localhost:8001',
      adminToken: config.getOptionalString('kong.adminToken'),
      gatewayUrl: config.getOptionalString('kong.gatewayUrl') || 'http://localhost:8000',
    };
    sharedKongService = new KongService(logger, kongConfig);
  }

  const fileExtractor = sharedFileExtractor;
  const githubService = sharedGitHubService;
  const apiDetector = sharedApiDetector;
  const geminiService = sharedGeminiService;
  const kongService = sharedKongService;

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

      logger.info(`Upload complete: ${uploadId}, ${detectedPaths.length} API paths`);
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
    const { baseUrl, projectName } = request.body as { baseUrl?: string; projectName?: string };
    const extractedPath = fileExtractor.getUploadPath(uploadId);

    try {
      const fs = await import('fs-extra');
      if (!await fs.pathExists(extractedPath)) {
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
          logger.info('Generating OpenAPI spec...');
          
          let existingRoutes: Array<{ path: string; methods: string[]; name: string }> = [];
          if (kongService) {
            try {
              existingRoutes = await kongService.getExistingRoutes();
              logger.info(`Found ${existingRoutes.length} existing routes in Kong`);
            } catch (kongError: any) {
              logger.warn(`Failed to fetch existing Kong routes: ${kongError.message}`);
            }
          }
          
          const shortId = uploadId.substring(0, 8);
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          
          let generatedProjectName: string;
          if (projectName && projectName.trim() !== '') {
            generatedProjectName = projectName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .substring(0, 50);
          } else {
            const frameworks = detectedPaths
              .map(p => p.framework)
              .filter(f => f);
            const uniqueFrameworks = [...new Set(frameworks)];
            
            const pathSegments = detectedPaths
              .flatMap(p => p.path.split('/'))
              .filter(seg => seg && seg !== 'api' && seg.length > 2);
            const commonSegment = pathSegments[0];
            
            if (commonSegment && commonSegment.length > 2) {
              generatedProjectName = `${commonSegment}-api-${shortId}`;
            } else if (uniqueFrameworks.length > 0) {
              generatedProjectName = `${uniqueFrameworks[0]!.toLowerCase()}-api-${shortId}`;
            } else {
              generatedProjectName = `api-${timestamp}-${shortId}`;
            }
          }
          
          const openApiSpec = await geminiService.generateOpenApiFromEndpoints(
            endpoints,
            detectedPaths,
            generatedProjectName,
            baseUrl,
            existingRoutes,
          );
          
          analyzeResponse.openApiSpec = openApiSpec;
          analyzeResponse.geminiMetadata = {
            generatedAt: new Date().toISOString(),
            model: 'gemini-2.5-flash',
          };
          
          logger.info('OpenAPI spec generated');
        } catch (geminiError: any) {
          logger.warn(`OpenAPI generation failed: ${geminiError.message}`);
        }
      }

      logger.info(`Analysis complete: ${endpoints.length} endpoints`);
      return response.json(analyzeResponse);
    } catch (error: any) {
      logger.error('Analysis failed', error);
      return response.status(500).json({
        error: 'Failed to analyze project',
        message: error.message,
      });
    }
  });

  router.post('/check-conflicts/:uploadId', async (request, response) => {
    const { uploadId } = request.params;
    const { openApiSpec } = request.body as { openApiSpec: string };

    if (!openApiSpec) {
      return response.status(400).json({
        error: 'Missing required field',
        message: 'openApiSpec is required',
      });
    }

    logger.info(`Checking conflicts for uploadId: ${uploadId}`);

    try {
      let parsedSpec;
      try {
        parsedSpec = JSON.parse(openApiSpec);
      } catch (parseError) {
        throw new Error('Invalid OpenAPI spec: must be valid JSON');
      }

      const result = await kongService.checkConflicts(uploadId, parsedSpec);

      return response.json({
        hasConflicts: result.hasConflicts,
        conflicts: result.conflicts,
        message: result.hasConflicts
          ? `Found ${result.conflicts.length} conflicting route(s)`
          : 'No conflicts found',
      });
    } catch (error: any) {
      logger.error('Conflict check failed', error);
      return response.status(500).json({
        error: 'Failed to check conflicts',
        message: error.message,
      });
    }
  });

  router.post('/register-kong/:uploadId', async (request, response) => {
    const { uploadId } = request.params;
    const { serviceName, serviceUrl, openApiSpec, projectName } = request.body as {
      serviceName: string;
      serviceUrl: string;
      openApiSpec: string;
      projectName?: string;
    };

    if (!serviceName || !serviceUrl || !openApiSpec) {
      return response.status(400).json({
        error: 'Missing required fields',
        message: 'serviceName, serviceUrl, and openApiSpec are required',
      });
    }

    logger.info(`Registering API to Kong for uploadId: ${uploadId}`);

    try {
      let parsedSpec;
      try {
        parsedSpec = JSON.parse(openApiSpec);
      } catch (parseError) {
        throw new Error('Invalid OpenAPI spec: must be valid JSON');
      }

      let kongServiceName: string;
      if (projectName && projectName.trim() !== '') {
        kongServiceName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);
      } else {
        const specTitle = parsedSpec.info?.title;
        if (specTitle && specTitle.length > 3 && !specTitle.startsWith('api-')) {
          kongServiceName = specTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        } else {
          const shortId = uploadId.substring(0, 8);
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          kongServiceName = `api-${timestamp}-${shortId}`;
        }
      }

      const result = await kongService.registerApi(
        kongServiceName,
        serviceUrl,
        parsedSpec,
      );

      logger.info(`Kong registration successful: ${result.serviceId}`);
      return response.json({
        success: true,
        serviceId: result.serviceId,
        serviceName: serviceName,
        routeCount: result.routeIds.length,
        routeIds: result.routeIds,
        message: `Successfully registered ${result.routeIds.length} routes to Kong Gateway`,
      });
    } catch (error: any) {
      logger.error('Kong registration failed', error);
      return response.status(500).json({
        error: 'Failed to register to Kong Gateway',
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
