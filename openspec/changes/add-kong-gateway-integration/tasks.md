# Tasks: Add Kong Gateway Integration

1.  **Backend: Configuration**
    -   Add a `kong` configuration section to `app-config.yaml`.
    -   Update the backend to read `KONG_ADMIN_URL` and `KONG_ADMIN_TOKEN` from the configuration.

2.  **Backend: `KongService`**
    -   Create the `KongService.ts` file in `plugins/justpush-backend/src/services/`.
    -   Implement the connection logic to the Kong Admin API.
    -   Implement the OpenAPI spec parsing logic.
    -   Implement the logic to create Kong services and routes.
    -   Implement the logic to apply rate-limiting and authentication plugins.
    -   Add error handling and logging.

3.  **Backend: Router**
    -   Create the new `POST /kong/register/:uploadId` endpoint in the backend router.
    -   Integrate the `KongService` with the new endpoint.

4.  **Backend: Data Storage**
    -   Update the data model for analysis results to include Kong registration metadata.
    -   Implement the logic to save this metadata after the registration process.

5.  **Frontend: `ImporterComponent`**
    -   Add the "Push to Kong" button to the UI.
    -   Implement the API call to the new backend endpoint.
    -   Add state management for loading and feedback (success/error messages).

6.  **Testing**
    -   Add unit tests for `KongService`.
    -   Add integration tests for the new `/kong/register/:uploadId` endpoint.
    -   Add frontend tests for the new UI elements and interactions.
