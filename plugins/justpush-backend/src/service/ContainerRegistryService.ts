import { LoggerService } from '@backstage/backend-plugin-api';
import Docker from 'dockerode';

export interface RegistryConfig {
  url: string;
  username?: string;
  password?: string;
}

export interface PushProgress {
  status: string;
  progressDetail?: {
    current: number;
    total: number;
  };
  id?: string;
}

export class ContainerRegistryService {
  private docker: Docker;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: RegistryConfig,
  ) {
    this.docker = new Docker();
  }

  async pushImage(imageName: string, imageTag: string): Promise<void> {
    const fullImageName = `${imageName}:${imageTag}`;

    this.logger.info(`Pushing image ${fullImageName} to registry`);

    try {
      const image = this.docker.getImage(fullImageName);

      const authConfig = this.config.username
        ? {
            username: this.config.username,
            password: this.config.password || '',
            serveraddress: this.config.url,
          }
        : undefined;

      const stream = await image.push({
        authconfig: authConfig,
      });

      await this.waitForPush(stream);

      this.logger.info(`Successfully pushed image ${fullImageName}`);
    } catch (error: any) {
      this.logger.error(`Failed to push image ${fullImageName}`, { error });
      throw new Error(`Registry push failed: ${error.message}`);
    }
  }

  async pullImage(imageName: string, imageTag: string): Promise<void> {
    const fullImageName = `${imageName}:${imageTag}`;

    this.logger.info(`Pulling image ${fullImageName} from registry`);

    try {
      const authConfig = this.config.username
        ? {
            username: this.config.username,
            password: this.config.password || '',
            serveraddress: this.config.url,
          }
        : undefined;

      const stream = await this.docker.pull(fullImageName, {
        authconfig: authConfig,
      });

      await this.waitForPull(stream);

      this.logger.info(`Successfully pulled image ${fullImageName}`);
    } catch (error: any) {
      this.logger.error(`Failed to pull image ${fullImageName}`, { error });
      throw new Error(`Registry pull failed: ${error.message}`);
    }
  }

  async imageExists(imageName: string, imageTag: string): Promise<boolean> {
    try {
      const fullImageName = `${imageName}:${imageTag}`;
      const image = this.docker.getImage(fullImageName);
      await image.inspect();
      return true;
    } catch {
      return false;
    }
  }

  async getImageDigest(
    imageName: string,
    imageTag: string,
  ): Promise<string | undefined> {
    try {
      const fullImageName = `${imageName}:${imageTag}`;
      const image = this.docker.getImage(fullImageName);
      const info = await image.inspect();
      return info.RepoDigests?.[0];
    } catch (error: any) {
      this.logger.warn(`Failed to get image digest: ${error.message}`);
      return undefined;
    }
  }

  async tagImage(
    currentImageName: string,
    currentTag: string,
    newImageName: string,
    newTag: string,
  ): Promise<void> {
    try {
      const currentFullName = `${currentImageName}:${currentTag}`;
      const image = this.docker.getImage(currentFullName);
      
      await image.tag({
        repo: newImageName,
        tag: newTag,
      });

      this.logger.info(
        `Tagged ${currentFullName} as ${newImageName}:${newTag}`,
      );
    } catch (error: any) {
      this.logger.error('Failed to tag image', { error });
      throw new Error(`Image tagging failed: ${error.message}`);
    }
  }

  async deleteImage(imageName: string, imageTag: string): Promise<void> {
    try {
      const fullImageName = `${imageName}:${imageTag}`;
      const image = this.docker.getImage(fullImageName);
      await image.remove({ force: true });
      this.logger.info(`Deleted image ${fullImageName}`);
    } catch (error: any) {
      this.logger.warn(`Failed to delete image: ${error.message}`);
    }
  }

  private async waitForPush(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
        (event: PushProgress) => {
          if (event.status) {
            const progress = event.progressDetail
              ? `${event.progressDetail.current}/${event.progressDetail.total}`
              : '';
            this.logger.debug(
              `${event.id || ''} ${event.status} ${progress}`.trim(),
            );
          }
        },
      );
    });
  }

  private async waitForPull(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
        (event: PushProgress) => {
          if (event.status) {
            const progress = event.progressDetail
              ? `${event.progressDetail.current}/${event.progressDetail.total}`
              : '';
            this.logger.debug(
              `${event.id || ''} ${event.status} ${progress}`.trim(),
            );
          }
        },
      );
    });
  }
}
