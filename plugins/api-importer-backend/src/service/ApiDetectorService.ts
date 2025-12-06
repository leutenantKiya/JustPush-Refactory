import path from 'path';
import { LoggerService } from '@backstage/backend-plugin-api';
import { DetectedPath, Endpoint } from '../types/api';
import { FileExtractorService } from './FileExtractorService';

export class ApiDetectorService {
  private logger: LoggerService;
  private fileExtractor: FileExtractorService;

  private apiPathPatterns = [
    'src/api',
    'src/routes',
    'api',
    'routes',
    'src/controllers',
    'controllers',
    'src/handlers',
    'handlers',
    'src/endpoints',
    'endpoints',
    'server/api',
    'server/routes',
    'backend/api',
    'backend/routes',
  ];

  private frameworkPatterns = {
    express: /express\(\)|require\(['"]express['"]\)|from ['"]express['"]/,
    fastify: /fastify\(\)|require\(['"]fastify['"]\)|from ['"]fastify['"]/,
    koa: /new Koa\(\)|require\(['"]koa['"]\)|from ['"]koa['"]/,
  };

  private methodPatterns = {
    get: /\.get\s*\(['"`]([^'"`]+)['"`]/g,
    post: /\.post\s*\(['"`]([^'"`]+)['"`]/g,
    put: /\.put\s*\(['"`]([^'"`]+)['"`]/g,
    delete: /\.delete\s*\(['"`]([^'"`]+)['"`]/g,
    patch: /\.patch\s*\(['"`]([^'"`]+)['"`]/g,
    options: /\.options\s*\(['"`]([^'"`]+)['"`]/g,
  };

  constructor(logger: LoggerService, fileExtractor: FileExtractorService) {
    this.logger = logger;
    this.fileExtractor = fileExtractor;
  }

  async detectApiPaths(rootPath: string): Promise<DetectedPath[]> {
    const detectedPaths: DetectedPath[] = [];

    this.logger.info(`Detecting API paths in: ${rootPath}`);

    for (const pattern of this.apiPathPatterns) {
      const fullPath = path.join(rootPath, pattern);
      const exists = await this.pathExists(fullPath);

      if (exists) {
        const files = await this.fileExtractor.listFiles(
          fullPath,
          ['.js', '.ts', '.jsx', '.tsx'],
        );

        if (files.length > 0) {
          const type = this.categorizePathType(pattern);
          const framework = await this.detectFramework(files);

          detectedPaths.push({
            path: pattern,
            type,
            confidence: this.calculateConfidence(pattern, files.length),
            files: files.map(f => path.relative(rootPath, f)),
            framework,
          });
        }
      }
    }

    if (detectedPaths.length === 0) {
      this.logger.info('No API paths found, scanning root level files...');
      const rootFiles = await this.fileExtractor.listFiles(
        rootPath,
        ['.js', '.ts', '.jsx', '.tsx'],
      );

      if (rootFiles.length > 0) {
        const framework = await this.detectFramework(rootFiles);
        
        detectedPaths.push({
          path: '.',
          type: 'api',
          confidence: 0.5,
          files: rootFiles.map(f => path.relative(rootPath, f)).slice(0, 50),
          framework,
        });
      }
    }

    this.logger.info(`Detected ${detectedPaths.length} API path(s)`);
    return detectedPaths.sort((a, b) => b.confidence - a.confidence);
  }

  async analyzeEndpoints(rootPath: string, detectedPaths: DetectedPath[]): Promise<Endpoint[]> {
    const endpoints: Endpoint[] = [];

    for (const detected of detectedPaths) {
      for (const relativeFile of detected.files) {
        const filePath = path.join(rootPath, relativeFile);
        
        try {
          const content = await this.fileExtractor.readFile(filePath);
          const fileEndpoints = this.extractEndpoints(content, relativeFile);
          endpoints.push(...fileEndpoints);
        } catch (error: any) {
          this.logger.warn(`Failed to read file ${relativeFile}: ${error.message}`);
        }
      }
    }

    this.logger.info(`Analyzed ${endpoints.length} endpoint(s)`);
    return endpoints;
  }

  private extractEndpoints(content: string, filePath: string): Endpoint[] {
    const endpoints: Endpoint[] = [];

    for (const [method, pattern] of Object.entries(this.methodPatterns)) {
      pattern.lastIndex = 0;
      let match = pattern.exec(content);

      while (match !== null) {
        const endpointPath = match[1];
        const lineNumber = this.findLineNumber(content, match.index);

        endpoints.push({
          method: method.toUpperCase(),
          path: endpointPath,
          file: filePath,
          line: lineNumber,
        });
        
        match = pattern.exec(content);
      }
    }

    return endpoints;
  }

  private findLineNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  private async detectFramework(files: string[]): Promise<string | undefined> {
    const filesToCheck = files.slice(0, 5);

    for (const file of filesToCheck) {
      try {
        const content = await this.fileExtractor.readFile(file);

        for (const [framework, pattern] of Object.entries(this.frameworkPatterns)) {
          if (pattern.test(content)) {
            return framework;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read file for framework detection ${file}: ${error}`);
      }
    }

    return undefined;
  }

  private categorizePathType(pattern: string): DetectedPath['type'] {
    if (pattern.includes('api')) return 'api';
    if (pattern.includes('routes')) return 'routes';
    if (pattern.includes('controllers')) return 'controllers';
    if (pattern.includes('handlers')) return 'handlers';
    if (pattern.includes('endpoints')) return 'endpoints';
    return 'api';
  }

  private calculateConfidence(pattern: string, fileCount: number): number {
    let confidence = 0.5;

    if (pattern.includes('api')) confidence += 0.2;
    if (pattern.includes('routes')) confidence += 0.15;
    if (pattern.startsWith('src/')) confidence += 0.1;

    if (fileCount > 10) confidence += 0.1;
    if (fileCount > 20) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private async pathExists(checkPath: string): Promise<boolean> {
    const fs = require('fs-extra');
    try {
      await fs.access(checkPath);
      return true;
    } catch {
      return false;
    }
  }
}
