## ADDED Requirements

### 1. Generate OpenAPI Spec from URL

The user should be able to enter a URL of an API and get a generated OpenAPI 3.0 specification.

#### Scenario: User provides a valid API URL

-   Given the user is on the API Importer page.
-   When the user enters a valid URL of an API and clicks "Analyze with Gemini".
-   Then the system shows a loading indicator while the analysis is in progress.
-   And the system displays the generated OpenAPI 3.0 spec in a text area.
-   And the user can download the generated spec as a `.yaml` file.

#### Scenario: User provides an invalid URL

-   Given the user is on the API Importer page.
-   When the user enters an invalid URL and clicks "Analyze with Gemini".
-   Then the system shows an error message.
