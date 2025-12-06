import { LoggerService } from '@backstage/backend-plugin-api';
import * as path from 'path';
import * as fs from 'fs-extra';
import Docker from 'dockerode';
import { BuildOptions, BuildResult } from '../types/deployment';

export class DockerBuildService {
  private docker: Docker;

  constructor(
    private readonly logger: LoggerService,
    private readonly registryUrl: string,
  ) {
    this.docker = new Docker();
  }

  async buildImage(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now();
    const { uploadId, projectPath, projectType, framework } = options;

    this.logger.info(`Building Docker image for ${uploadId}`, {
      projectType,
      framework,
    });

    try {
      await this.ensureDockerfile(projectPath, projectType, framework);

      const imageName = `${this.registryUrl}/justpush-${uploadId}`;
      const imageTag = `${Date.now()}`;
      const fullImageName = `${imageName}:${imageTag}`;

      const stream = await this.docker.buildImage(
        {
          context: projectPath,
          src: await this.getContextFiles(projectPath),
        },
        {
          t: fullImageName,
          buildargs: {
            PROJECT_TYPE: projectType,
          },
        },
      );

      await this.waitForBuild(stream);

      const image = this.docker.getImage(fullImageName);
      const imageInfo = await image.inspect();

      const buildTime = Date.now() - startTime;

      this.logger.info(`Successfully built image ${fullImageName}`, {
        size: imageInfo.Size,
        buildTime,
      });

      return {
        imageId: imageInfo.Id,
        imageName,
        imageTag,
        size: imageInfo.Size,
        buildTime,
      };
    } catch (error: any) {
      this.logger.error(`Failed to build image for ${uploadId}`, { error });
      throw new Error(`Docker build failed: ${error.message}`);
    }
  }

  private async ensureDockerfile(
    projectPath: string,
    projectType: string,
    framework?: string,
  ): Promise<void> {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');

    if (await fs.pathExists(dockerfilePath)) {
      this.logger.info('Using existing Dockerfile');
      return;
    }

    this.logger.info('Generating Dockerfile', { projectType, framework });
    const dockerfile = this.generateDockerfile(projectType, framework);
    await fs.writeFile(dockerfilePath, dockerfile);
  }

  private generateDockerfile(projectType: string, framework?: string): string {
    switch (projectType) {
      case 'nodejs':
        return this.generateNodeJsDockerfile(framework);
      case 'python':
        return this.generatePythonDockerfile(framework);
      case 'java':
        return this.generateJavaDockerfile();
      case 'go':
        return this.generateGoDockerfile();
      default:
        throw new Error(`Unsupported project type: ${projectType}`);
    }
  }

  private generateNodeJsDockerfile(framework?: string): string {
    return `
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
${framework === 'typescript' ? 'RUN npm run build' : ''}

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/${framework === 'typescript' ? 'dist' : '.'} ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "${framework === 'typescript' ? 'dist/index.js' : 'index.js'}"]
`.trim();
  }

  private generatePythonDockerfile(framework?: string): string {
    const cmd =
      framework === 'fastapi'
        ? 'uvicorn main:app --host 0.0.0.0 --port 8000'
        : framework === 'flask'
        ? 'flask run --host=0.0.0.0 --port=8000'
        : 'python main.py';

    return `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ${JSON.stringify(cmd.split(' '))}
`.trim();
  }

  private generateJavaDockerfile(): string {
    return `
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`.trim();
  }

  private generateGoDockerfile(): string {
    return `
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
`.trim();
  }

  private async getContextFiles(projectPath: string): Promise<string[]> {
    const files = await fs.readdir(projectPath);
    return files.filter(
      file => !file.startsWith('.') && file !== 'node_modules',
    );
  }

  private async waitForBuild(stream: NodeJS.ReadableStream): Promise<void> {
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
        (event: any) => {
          if (event.stream) {
            this.logger.debug(event.stream.trim());
          }
          if (event.error) {
            this.logger.error('Build error:', event.error);
          }
        },
      );
    });
  }

  async removeImage(imageName: string, imageTag: string): Promise<void> {
    try {
      const fullImageName = `${imageName}:${imageTag}`;
      const image = this.docker.getImage(fullImageName);
      await image.remove();
      this.logger.info(`Removed image ${fullImageName}`);
    } catch (error: any) {
      this.logger.warn(`Failed to remove image: ${error.message}`);
    }
  }
}
