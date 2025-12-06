# Project Context

## Purpose
This project aims to serve as a tool that helps developers in developing websites so that they can easily determine the API endpoint route from the files created to make it look proper and neat, as well as not too long in the endpoint.

## Tech Stack
- **Framework:** Backstage (v1.45.0)
- **Language:** TypeScript (v5.8.0)
- **Frontend:** React (v18), Material-UI
- **Backend:** Node.js (v20 or v22), Express.js (via Backstage)
- **Deployment:** Kubernetes
- **AI/ML:** LLM (Gemini)
- **API Management:** Kong (API Gateway)
- **Database:** PostgreSQL (production), SQLite (development)
- **Testing:** Playwright (e2e), Jest (unit/integration via `@backstage/test-utils`), React Testing Library
- **Monorepo Management:** Yarn Workspaces

## Project Conventions

### Code Style
The project uses Prettier and ESLint for code formatting and style enforcement. The configurations are managed by `@backstage/cli`. The general style is consistent with the Backstage project's conventions.

### Architecture Patterns
The project follows the architectural patterns established by Backstage, which includes a monorepo structure with a dedicated frontend app, a backend server, and plugins. The backend is built on a modular plugin architecture, and the frontend is a single-page application that consumes the backend's APIs, often managed and routed through Kong API Gateway. Deployment is orchestrated via Kubernetes, indicating a containerized and potentially microservices-oriented approach. LLM (Gemini) integration suggests intelligent automation, enhanced search, or content generation capabilities within the platform.

#### File Analyzer Plugin
A key feature of this project is the `file-analyzer` plugin. This plugin allows users to upload source files to be analyzed for API endpoints. The architecture of this plugin is composed of:
- **Frontend:** A React-based UI for file upload and results visualization.
- **Backend:** A set of cooperating components:
    - **API:** An entry point that orchestrates the analysis workflow.
    - **Scanner:** A service that uses the Gemini LLM to parse and analyze files.
    - **Result:** A service to store and manage analysis results.
    - **Catalog Controller & Service:** A component to register discovered APIs into the Backstage catalog.

This modular design allows for clear separation of concerns and future extensibility.

### Testing Strategy
- **Unit & Integration Tests:** Written with Jest and React Testing Library. Tests are co-located with the source code. The command `yarn test` runs the tests for all packages.
- **End-to-End Tests:** Written with Playwright. The command `yarn test:e2e` runs the e2e tests.
- **Coverage:** The command `yarn test:all` runs all tests with coverage.

### Git Workflow
The `lint-staged` configuration in `package.json` suggests a pre-commit hook that runs ESLint and Prettier on staged files. The `lint` script runs the linter on changes since `origin/master`. This implies a feature-branch workflow with pull requests to the `master` branch.

## Domain Context
This project is a developer portal. Key domain concepts include:
- **Components:** Reusable pieces of software.
- **Services:** Running instances of software.
- **APIs:** Interfaces for services.
- **Templates:** Used by the scaffolder to create new components.
- **TechDocs:** Documentation for software.

## Important Constraints
- The project must be compatible with the Backstage ecosystem and its plugin architecture.
- The project is built on Node.js and the versions specified in `package.json`.
- Deployment and operational considerations are tied to Kubernetes.
- API management is handled by Kong.

## External Dependencies
- **GitHub:** Used for authentication and scaffolder tasks.
- **Docker:** Used for building and running the backend.
- **Kubernetes:** Orchestrates the deployment and management of services.
- **LLM (Gemini):** Integrated for AI-powered features.
- **Kong (API Gateway):** Manages API traffic and policies.
- **PostgreSQL:** The production database.