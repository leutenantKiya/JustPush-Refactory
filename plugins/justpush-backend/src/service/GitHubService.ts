import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs-extra';
import { LoggerService } from '@backstage/backend-plugin-api';
import { v4 as uuidv4 } from 'uuid';

export class GitHubService {
  private logger: LoggerService;
  private cloneDir: string;
  private git: SimpleGit;
  private githubToken?: string;

  constructor(logger: LoggerService, cloneDir = '/tmp/backstage-git-clones', githubToken?: string) {
    this.logger = logger;
    this.cloneDir = cloneDir;
    this.githubToken = githubToken;
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

      let authenticatedUrl = repoUrl;
      if (this.githubToken && repoUrl.includes('github.com')) {
        const urlObj = new URL(repoUrl.replace('git@github.com:', 'https://github.com/'));
        authenticatedUrl = `https://${this.githubToken}@${urlObj.host}${urlObj.pathname}`;
      }

      try {
        await this.git.clone(authenticatedUrl, localPath, ['--depth', '1', '--branch', branch]);
      } catch (branchError: any) {
        if (branchError.message.includes('Remote branch') || branchError.message.includes('not found')) {
          this.logger.warn(`Branch '${branch}' not found, trying default branch`);
          await fs.remove(localPath).catch(() => {});
          await this.git.clone(authenticatedUrl, localPath, ['--depth', '1']);
        } else {
          throw branchError;
        }
      }

      this.logger.info(`Repository cloned successfully to: ${localPath}`);

      if (targetPath) {
        const fullTargetPath = path.join(localPath, targetPath);
        if (await fs.pathExists(fullTargetPath)) {
          return { cloneId, localPath: fullTargetPath };
        }
        this.logger.warn(`Target path ${targetPath} not found, using root`);
      }

      return { cloneId, localPath };
    } catch (error: any) {
      this.logger.error(`Failed to clone repository: ${error.message}`);
      
      await fs.remove(localPath).catch(() => {});
      
      if (error.message.includes('not found') || error.message.includes('404')) {
        throw new Error('Repository not found. Please check the URL and make sure the repository exists.');
      } else if (error.message.includes('Authentication failed') || error.message.includes('403')) {
        throw new Error('Authentication failed. The repository may be private and require a GitHub token.');
      } else if (error.message.includes('Could not resolve host')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      
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
