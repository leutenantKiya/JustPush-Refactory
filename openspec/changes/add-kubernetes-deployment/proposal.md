# Proposal: Automated API Deployment to Kubernetes with Kong Gateway

## 1. Problem Statement

The current workflow in JustPush ends with the generation of an OpenAPI specification. Developers must then manually perform a series of complex and error-prone tasks to deploy their APIs, including:

-   Containerizing the application.
-   Writing Kubernetes manifests.
-   Configuring CI/CD pipelines.
-   Setting up ingress and API Gateway routing.
-   Implementing security, monitoring, and logging.

This manual process is a significant bottleneck, slowing down the development lifecycle and increasing the risk of misconfiguration and security vulnerabilities.

## 2. Proposed Solution

We propose extending JustPush with an end-to-end, automated deployment pipeline. After an API is analyzed and an OpenAPI spec is generated, users can trigger a "Deploy to Kubernetes" workflow. This pipeline will automatically build a container image, deploy it to a Kubernetes cluster, and configure routing and policies using the Kong API Gateway.

This feature will provide a "push-button" deployment experience, abstracting away the complexities of cloud-native infrastructure and enabling developers to go from code to a production-ready, managed API endpoint in minutes. The entire process will be configurable, observable, and integrated directly within the JustPush UI.

## 3. Implementation Details

### 3.1. Container Build Pipeline

A new `DockerBuildService` will be created to automate the containerization of the uploaded application code.

-   **Project Detection**: The service will analyze the project structure and manifest files (`package.json`, `pom.xml`, `go.mod`, `requirements.txt`) to determine the application type (e.g., Node.js, Java, Go, Python).
-   **Dockerfile Generation**: If no Dockerfile is present, a suitable, production-optimized Dockerfile will be generated based on the detected project type.
-   **Image Build**: The service will use a sandboxed environment to build the Docker image.
-   **Image Push**: A `ContainerRegistryService` will handle pushing the built image to a configured container registry (Docker Hub, GCR, ECR), tagging it with the `uploadId` for versioning and tracking.

### 3.2. Kubernetes Deployment

A new `K8sDeploymentService` will manage all interactions with the Kubernetes cluster.

-   **Manifest Generation**: It will dynamically generate Kubernetes manifests for `Deployment`, `Service`, and `ConfigMap` resources.
-   **Resource Management**: It will apply sensible default resource limits (CPU, memory) based on the detected application size, which can be overridden by the user.
-   **Configuration**: It will support injecting environment variables and secrets (e.g., for database connections, API keys) into the application pods, extracting this information from the OpenAPI specification or user-provided configuration.
-   **Scaling and Health**: It will configure a Horizontal Pod Autoscaler (HPA) for auto-scaling and set up liveness and readiness probes for robust health checking.

### 3.3. Kong Gateway Auto-Configuration

The existing `KongService` will be extended to configure the Kong Gateway after a successful Kubernetes deployment.

-   **Service Registration**: It will create a Kong Service that points to the newly created Kubernetes Service.
-   **Route Generation**: It will parse the OpenAPI specification to create Kong Routes for each path.
-   **Plugin Application**: It will apply a default set of plugins, configurable via `app-config.yaml`:
    -   **Rate Limiting**: Configurable limits per endpoint.
    -   **Authentication**: Support for API Key and JWT, based on the `securitySchemes` in the OpenAPI spec.
    -   **CORS**: Default CORS configuration.
    -   **Request/Response Transformation**: Basic transformations if needed.
-   **API Key Generation**: For developers, a unique API key will be generated and associated with a Kong Consumer, providing immediate access to the deployed API.

### 3.4. UI Enhancements (`ImporterComponent`)

The frontend will be significantly enhanced to provide a seamless user experience for the deployment workflow.

-   **"Deploy to Kubernetes" Button**: This button will appear after OpenAPI generation.
-   **Deployment Progress View**: A real-time view will show the status of each stage: Building, Pushing, Deploying, Configuring.
-   **Deployment Information Dashboard**: After deployment, the UI will display:
    -   The final API Gateway URL from Kong.
    -   The generated developer API key.
    -   Kubernetes pod status and resource usage.
-   **"Manage Deployment" Section**: A new tab or section will allow users to:
    -   View real-time logs from their application pods.
    -   Scale the number of replicas.
    -   Update environment variables and redeploy.
    -   Delete the entire deployment.

### 3.5. Backend Services Structure

The backend will be organized into several new and updated services orchestrated by a `DeploymentManagerService`.

-   `DockerBuildService.ts`: Handles Dockerfile generation and image building.
-   `ContainerRegistryService.ts`: Manages pushing and pulling images.
-   `K8sDeploymentService.ts`: Manages Kubernetes resources.
-   `KongService.ts`: Extended to handle post-deployment configuration.
-   `DeploymentManagerService.ts`: A new orchestrator service that calls the other services in sequence to execute the full deployment pipeline.

## 4. Configuration Examples (`app-config.yaml`)

New configuration sections will be added to support the deployment feature.

```yaml
containerRegistry:
  url: ${CONTAINER_REGISTRY_URL}
  username: ${CONTAINER_REGISTRY_USER}
  password: ${CONTAINER_REGISTRY_PASSWORD}

kubernetes:
  apiServer: ${K8S_API_SERVER}
  token: ${K8S_SERVICE_ACCOUNT_TOKEN}
  namespace: "justpush-apps" # Default namespace for deployments

kong:
  adminUrl: ${KONG_ADMIN_URL}
  adminToken: ${KONG_ADMIN_TOKEN}
  gatewayUrl: ${KONG_GATEWAY_URL} # Public URL for APIs
```

## 5. API Contract Changes

Several new endpoints will be added to the backend router to manage the deployment lifecycle.

-   `POST /deploy/:uploadId`: Triggers the entire deployment pipeline.
-   `GET /deploy/:uploadId/status`: Provides real-time status of the deployment.
-   `GET /deploy/:uploadId/logs`: Streams logs from the running application pods.
-   `PUT /deploy/:uploadId/scale`: Scales the Kubernetes deployment to a specified number of replicas.
-   `POST /deploy/:uploadId/redeploy`: Triggers a new deployment with updated configuration.
-   `DELETE /deploy/:uploadId`: Tears down the entire deployment, including K8s resources and Kong configuration.

## 6. Database Schema Updates

The `analyze_results` table/document will be extended to store deployment-related metadata:

-   `dockerImage`: The name and tag of the built container image.
-   `k8sDeploymentInfo`: Metadata about the Kubernetes deployment (namespace, service name, pod names).
-   `kongApiId`: The ID of the registered service/route in Kong.
-   `developerApiKey`: The generated API key for the developer.
-   `deploymentStatus`: The current status of the deployment (e.g., `PENDING`, `BUILDING`, `DEPLOYED`, `FAILED`).
-   `resourceUsage`: Metrics on CPU and memory usage.

## 7. Security & Best Practices

-   **Code Validation**: Uploaded code will be scanned for malicious patterns before any execution.
-   **Sandboxed Builds**: Container builds will run in an isolated, sandboxed environment (e.g., gVisor, Firecracker).
-   **Network Policies**: Default network policies will be applied in Kubernetes to restrict ingress and egress traffic.
-   **Resource Quotas**: Kubernetes resource quotas will be used to limit resource consumption on a per-user or per-deployment basis.
-   **Automated Cleanup**: Failed deployments will trigger an automated cleanup process to remove orphaned resources.
-   **Audit Logging**: All actions taken through the deployment API will be logged for security and auditing purposes.

## 8. Error Handling & Rollback

-   The `DeploymentManagerService` will implement transactional logic. If any step in the pipeline fails (e.g., build, push, deploy), it will trigger a rollback process to clean up any resources that were created.
-   If Kong registration fails, the Kubernetes deployment will be kept running, but a clear warning will be displayed to the user.
-   The system will store previous successful deployment configurations, allowing for a one-click rollback to a last known good state.

## 9. Integration with Terraform

-   **Export to Terraform**: Users will have the option to export the generated Kubernetes manifests and Kong configuration as a reusable Terraform module.
-   **GitOps Support**: The generated manifests can be automatically committed to a Git repository, enabling a GitOps workflow with tools like Argo CD or Flux.

## 10. Backward Compatibility

-   The entire deployment feature will be optional and controlled by a feature flag in the configuration.
-   If not enabled, the existing "analyze-only" workflow will remain the default and will be completely unaffected.
-   Users will always have the choice to only generate the OpenAPI specification without proceeding to deployment.

## 11. Testing Strategy

-   **Unit Tests**: Each new service (`DockerBuildService`, `K8sDeploymentService`, etc.) will have comprehensive unit tests with mocks for external dependencies.
-   **Integration Tests**: Backend integration tests will validate the entire deployment pipeline, using in-memory mocks for Kubernetes and Kong APIs.
-   **End-to-End (E2E) Tests**: E2E tests will be created to simulate a full user workflow in a test environment with a real Kubernetes cluster and Kong instance.

## 12. Migration Guide

This is a new, optional feature. To enable it, administrators will need to:
1.  Enable the feature flag in the `app-config.yaml`.
2.  Provide the necessary configuration for the container registry, Kubernetes cluster, and Kong Gateway.
3.  Ensure the backend has the necessary permissions to access these systems.
No database schema migration is required for existing data, as the new fields will be added to new documents/rows.
