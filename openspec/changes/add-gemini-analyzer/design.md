# Design: Gemini Analyzer for OpenAPI Spec Generation

## Architecture

The feature will be integrated into the existing `api-importer` plugin.

### Backend (`api-importer-backend`)

A new service, `GeminiAnalyzeService`, will be created. This service will be responsible for:

-   Taking an API URL as input.
-   Making a request to the Gemini API with a prompt to generate an OpenAPI 3.0 spec.
-   Returning the generated spec.

A new route will be added to the `router.ts` to expose this service via a REST API endpoint (e.g., `POST /analyze-api`).

### Frontend (`api-importer`)

The `ImporterComponent` will be updated to include:

-   A text input for the user to enter the API URL.
-   A button to initiate the analysis.
-   A text area to display the generated OpenAPI spec.
-   A download button to save the spec as a file.

## Gemini API Interaction

The `GeminiAnalyzeService` will use the `generative-ai` library to communicate with the Gemini API. A prompt will be constructed to instruct the model to act as an API analyst and generate an OpenAPI 3.0 spec for the provided URL.
