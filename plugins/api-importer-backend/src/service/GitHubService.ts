import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs-extra';
import { LoggerService } from '@backstage/backend-plugin-api';
import { v4 as uuidv4 } from 'uuid';

export class GitHubService {
  private logger: LoggerService;
  private cloneDir: string;
  private git: SimpleGit;

  constructor(logger: LoggerService, cloneDir = '/tmp/backstage-git-clones') {
    this.logger = logger;
    this.cloneDir = cloneDir;
    this.git = simpleGit();
    fs.ensureDirSync(this.cloneDir);
  }

  async cloneRepository(
    repoUrl: string,
    branch = 'main',
    targetPath?: string,
  ): Promise<{ cloneId: string; localPath: string }> {
    const cloneId = uuidv4();
    const localPath = path.join(this.cloneDir, cloneId);

    try {
      this.logger.info(`Cloning repository: ${repoUrl} (branch: ${branch})`);

      await this.git.clone(repoUrl, localPath, ['--depth', '1', '--branch', branch]);

      this.logger.info(`Repository cloned successfully to: ${localPath}`);

      if (targetPath) {
        const fullTargetPath = path.join(localPath, targetPath);
        if (await fs.pathExists(fullTargetPath)) {
          return { cloneId, localPath: fullTargetPath };
        } else {
          this.logger.warn(`Target path ${targetPath} not found, using root`);
        }
      }

      return { cloneId, localPath };
    } catch (error: any) {
      this.logger.error(`Failed to clone repository: ${error.message}`);
      throw new Error(`GitHub clone failed: ${error.message}`);
    }
  }

  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    return null;
  }

  async cleanup(cloneId: string): Promise<void> {
    const clonePath = path.join(this.cloneDir, cloneId);
    
    try {
      await fs.remove(clonePath);
      this.logger.info(`Cleaned up: ${clonePath}`);
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup ${clonePath}: ${error.message}`);
    }
  }
}
