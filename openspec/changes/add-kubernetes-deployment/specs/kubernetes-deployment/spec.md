## ADDED Requirements

### 1. Full API Deployment to Kubernetes

Users should be able to deploy a generated OpenAPI specification and its associated application code to a Kubernetes cluster with Kong Gateway routing.

#### Scenario: User successfully deploys an application

-   Given the user is on the Importer page and an OpenAPI spec has been generated.
-   When the user clicks the "Deploy to Kubernetes" button.
-   Then the system shows a real-time progress view of the deployment stages (Build, Push, Deploy, Configure).
-   And the system successfully builds a container, pushes it to the registry, deploys it to Kubernetes, and configures Kong.
-   And the system displays a success message with the final API Gateway URL and a generated API key.
-   And the user can view the deployment status, logs, and manage the deployment (scale, redeploy, delete).

#### Scenario: Deployment fails during the build stage

-   Given the user initiates a deployment.
-   When the container build fails (e.g., due to a code error).
-   Then the system stops the pipeline and displays a build failure message with access to the build logs.
-   And the system cleans up any partial resources.

#### Scenario: Deployment fails during the Kubernetes stage

-   Given the user initiates a deployment and the container is built successfully.
-   When the Kubernetes deployment fails (e.g., due to insufficient resources or invalid manifest).
-   Then the system stops the pipeline and displays a Kubernetes deployment failure message.
-   And the system automatically rolls back and deletes any created Kubernetes resources.

### 2. Manage Existing Deployments

Users should be able to view and manage their active deployments.

#### Scenario: User views logs for a deployment

-   Given the user has an active deployment.
-   When the user navigates to the "Manage Deployment" section and clicks "View Logs".
-   Then the system displays a real-time stream of the application's pod logs.

#### Scenario: User scales a deployment

-   Given the user has an active deployment.
-   When the user scales the number of replicas to 3 in the "Manage Deployment" section.
-   Then the system updates the Kubernetes deployment with the new replica count.
-   And the UI reflects the new number of running pods.

### 3. Optional Deployment

The deployment feature should not interfere with the existing spec generation workflow.

#### Scenario: User only wants to generate a spec

-   Given the deployment feature is enabled.
-   When the user uploads code and an OpenAPI spec is generated.
-   Then the user can choose to download the spec and take no further action.
-   And the "Deploy to Kubernetes" button is available but not mandatory to click.
