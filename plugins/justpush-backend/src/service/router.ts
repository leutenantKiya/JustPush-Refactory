import express from 'express';
import Router from 'express-promise-router';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import multer from 'multer';
import { FileExtractorService } from './FileExtractorService';
import { GitHubService } from './GitHubService';
import { ApiDetectorService } from './ApiDetectorService';
import { GeminiAnalyzeService } from './GeminiAnalyzeService';
import { AnalyzeResponse, GitHubImportRequest, UploadResponse } from '../types/api';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

let sharedFileExtractor: FileExtractorService | null = null;
let sharedGitHubService: GitHubService | null = null;
let sharedApiDetector: ApiDetectorService | null = null;
let sharedGeminiService: GeminiAnalyzeService | null = null;

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

  const fileExtractor = sharedFileExtractor;
  const githubService = sharedGitHubService;
  const apiDetector = sharedApiDetector;
  const geminiService = sharedGeminiService;

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
