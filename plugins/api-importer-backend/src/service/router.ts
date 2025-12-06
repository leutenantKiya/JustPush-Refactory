import express from 'express';
import Router from 'express-promise-router';
import { LoggerService } from '@backstage/backend-plugin-api';
import multer from 'multer';
import { FileExtractorService } from './FileExtractorService';
import { GitHubService } from './GitHubService';
import { ApiDetectorService } from './ApiDetectorService';
import { AnalyzeResponse, GitHubImportRequest, UploadResponse } from '../types/api';

export interface RouterOptions {
  logger: LoggerService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger } = options;

  const router = Router();
  router.use(express.json());

  const fileExtractor = new FileExtractorService(logger);
  const githubService = new GitHubService(logger);
  const apiDetector = new ApiDetectorService(logger, fileExtractor);

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

      logger.info(`Upload processed: ${uploadId}, found ${detectedPaths.length} API paths`);
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

    logger.info(`Analyzing project: ${uploadId}`);

    try {
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

  router.get('/stats', async (_, response) => {
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
    });
  });

  return router;
}
