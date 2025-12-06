import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'path';
import { LoggerService } from '@backstage/backend-plugin-api';
import { v4 as uuidv4 } from 'uuid';
import { UploadMetadata } from '../types/api';

export class FileExtractorService {
  private uploadDir: string;
  private logger: LoggerService;
  private uploads: Map<string, UploadMetadata>;
  private metadataFile: string;

  constructor(logger: LoggerService, uploadDir = '/tmp/backstage-uploads') {
    this.logger = logger;
    this.uploadDir = uploadDir;
    this.metadataFile = path.join(this.uploadDir, '.metadata.json');
    this.uploads = new Map();
    fs.ensureDirSync(this.uploadDir);
    
    this.loadMetadata();
  }

  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf-8');
        const metadata = JSON.parse(data);
        
        for (const [uploadId, meta] of Object.entries(metadata)) {
          const uploadMeta = meta as any;
          this.uploads.set(uploadId, {
            uploadId,
            extractedPath: uploadMeta.extractedPath,
            createdAt: new Date(uploadMeta.createdAt),
            lastAccessed: new Date(uploadMeta.lastAccessed),
          });
        }
        
        this.logger.info(`Loaded ${this.uploads.size} upload(s) from metadata file`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to load metadata: ${error.message}`);
    }
  }

  private saveMetadata(): void {
    try {
      const metadata: Record<string, any> = {};
      
      for (const [uploadId, meta] of this.uploads.entries()) {
        metadata[uploadId] = {
          uploadId: meta.uploadId,
          extractedPath: meta.extractedPath,
          createdAt: meta.createdAt.toISOString(),
          lastAccessed: meta.lastAccessed.toISOString(),
        };
      }
      
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
      this.logger.debug(`Saved metadata for ${this.uploads.size} upload(s)`);
    } catch (error: any) {
      this.logger.warn(`Failed to save metadata: ${error.message}`);
    }
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
      
      this.uploads.set(uploadId, {
        uploadId,
        extractedPath: extractPath,
        createdAt: new Date(),
        lastAccessed: new Date(),
      });
      
      this.saveMetadata();
      
      this.logger.info(`Stored upload metadata for ${uploadId}, total active uploads: ${this.uploads.size}`);
      
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

    if (!await fs.pathExists(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

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
    const metadata = this.uploads.get(uploadId);
    const extractPath = metadata ? metadata.extractedPath : path.join(this.uploadDir, uploadId);
    
    try {
      await fs.remove(extractPath);
      this.uploads.delete(uploadId);
      this.saveMetadata();
      this.logger.info(`Cleaned up: ${extractPath}, removed from metadata`);
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup ${extractPath}: ${error.message}`);
    }
  }

  getUploadPath(uploadId: string): string {
    const metadata = this.uploads.get(uploadId);
    if (metadata) {
      metadata.lastAccessed = new Date();
      this.saveMetadata();
      this.logger.info(`Upload ${uploadId} accessed, last accessed: ${metadata.lastAccessed}`);
      return metadata.extractedPath;
    } else {
      this.logger.warn(`Upload ${uploadId} not found in metadata, total uploads: ${this.uploads.size}`);
      return path.join(this.uploadDir, uploadId);
    }
  }

  registerUpload(uploadId: string, extractedPath: string): void {
    this.uploads.set(uploadId, {
      uploadId,
      extractedPath,
      createdAt: new Date(),
      lastAccessed: new Date(),
    });
    
    this.saveMetadata();
    this.logger.info(`Registered external upload ${uploadId} at ${extractedPath}, total active uploads: ${this.uploads.size}`);
  }

  async validateUploadPath(uploadId: string): Promise<boolean> {
    const uploadPath = this.getUploadPath(uploadId);
    const exists = await fs.pathExists(uploadPath);
    
    this.logger.info(`Validating upload ${uploadId}: ${uploadPath}, exists: ${exists}`);
    
    return exists;
  }
}
