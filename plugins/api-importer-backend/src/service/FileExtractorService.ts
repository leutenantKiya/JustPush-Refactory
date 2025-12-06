import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'path';
import { LoggerService } from '@backstage/backend-plugin-api';
import { v4 as uuidv4 } from 'uuid';

export class FileExtractorService {
  private uploadDir: string;
  private logger: LoggerService;

  constructor(logger: LoggerService, uploadDir = '/tmp/backstage-uploads') {
    this.logger = logger;
    this.uploadDir = uploadDir;
    fs.ensureDirSync(this.uploadDir);
  }

  async extractZip(zipBuffer: Buffer): Promise<{ uploadId: string; extractedPath: string }> {
    const uploadId = uuidv4();
    const extractPath = path.join(this.uploadDir, uploadId);

    try {
      this.logger.info(`Extracting ZIP to ${extractPath}`);
      
      await fs.ensureDir(extractPath);

      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(extractPath, true);

      this.logger.info(`ZIP extracted successfully: ${extractPath}`);
      
      return {
        uploadId,
        extractedPath: extractPath,
      };
    } catch (error: any) {
      this.logger.error(`Failed to extract ZIP: ${error.message}`);
      throw new Error(`ZIP extraction failed: ${error.message}`);
    }
  }

  async listFiles(dirPath: string, extensions?: string[]): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string) => {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(item)) {
            await walk(fullPath);
          }
        } else {
          if (!extensions || extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(dirPath);
    return files;
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async cleanup(uploadId: string): Promise<void> {
    const extractPath = path.join(this.uploadDir, uploadId);
    
    try {
      await fs.remove(extractPath);
      this.logger.info(`Cleaned up: ${extractPath}`);
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup ${extractPath}: ${error.message}`);
    }
  }

  getUploadPath(uploadId: string): string {
    return path.join(this.uploadDir, uploadId);
  }
}
