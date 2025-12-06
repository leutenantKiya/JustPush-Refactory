## ADDED Requirements

### 1. Push OpenAPI Spec to Kong Gateway

The user should be able to push a generated OpenAPI specification to a configured Kong Gateway.

#### Scenario: User successfully pushes a spec to Kong

-   Given the user is on the Importer page and an OpenAPI spec has been generated.
-   When the user clicks the "Push to Kong" button.
-   Then the system shows a loading indicator.
-   And the system sends the `uploadId` to the backend.
-   And the backend uses the `uploadId` to retrieve the spec and registers it with Kong, creating routes and applying policies.
-   And the system displays a success message to the user.
-   And the Kong registration details are saved with the analysis results.

#### Scenario: Kong registration fails

-   Given the user is on the Importer page and an OpenAPI spec has been generated.
-   When the user clicks the "Push to Kong" button.
-   Then the system shows a loading indicator.
-   And the backend fails to register the spec with Kong (e.g., due to a connection error or invalid spec).
-   And the system displays a detailed error message to the user.

#### Scenario: Kong integration is not configured

-   Given the Kong integration has not been configured in `app-config.yaml`.
-   Then the "Push to Kong" button is not visible on the Importer page.
-   And the existing functionality of the Importer page is unaffected.
