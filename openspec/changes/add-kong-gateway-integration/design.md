# Design: Kong Gateway Integration

## Architecture

The Kong Gateway integration will be implemented by extending the `justpush` frontend plugin and the `justpush-backend` plugin. The integration will be optional and enabled via configuration.

### Frontend (`plugins/justpush`)

The `ImporterComponent.tsx` will be updated to include a "Push to Kong" button. This button will only become active after an OpenAPI specification has been successfully generated and an `uploadId` is available.

-   **UI Changes**: A new button will be added to the UI.
-   **State Management**: The component's state will be extended to manage the Kong registration process, including loading states and success/error messages.
-   **API Interaction**: On button click, the component will make a `POST` request to the new backend endpoint `/kong/register/:uploadId`.

### Backend (`plugins/justpush-backend`)

#### KongService (`plugins/justpush-backend/src/services/KongService.ts`)

A new service, `KongService.ts`, will be created to handle all interactions with the Kong Admin API.

-   **Connection**: It will connect to the Kong Admin API using the URL and optional token from the application configuration.
-   **Spec Parsing**: The service will fetch the OpenAPI spec associated with the `uploadId`. It will parse the spec to extract paths, methods, and other relevant information to create Kong services and routes.
-   **Plugin Application**:
    -   **Rate Limiting**: It will apply a default rate-limiting plugin to the created services or routes.
    -   **Authentication**: It will configure authentication methods (API Key, JWT) based on the OpenAPI spec's security schemes or default settings.
-   **Error Handling**: All interactions with the Kong Admin API will have robust error handling to prevent crashes and provide meaningful feedback to the user.

#### Router (`plugins/justpush-backend/src/service/router.ts`)

A new endpoint will be added to the router:

-   `POST /kong/register/:uploadId`: This endpoint will trigger the Kong registration process. It will use the `KongService` to register the API specification from the given `uploadId`.

### Configuration (`app-config.yaml`)

The application configuration will be updated to include a `kong` section.

```yaml
kong:
  adminUrl: ${KONG_ADMIN_URL}
  adminToken: ${KONG_ADMIN_TOKEN} # optional
```

This allows administrators to configure the Kong integration using environment variables.

### Data Storage

The result of the Kong registration (e.g., success status, service/route IDs) will be stored as part of the analysis results associated with the `uploadId`. This will allow for future tracking and management.
