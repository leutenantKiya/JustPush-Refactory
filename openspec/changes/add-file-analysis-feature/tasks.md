# Tasks: File Upload, Parsing, and Analysis Feature

1.  **Backend Plugin Setup**
    - [ ] Create a new backend plugin named `file-analyzer-backend`.
    - [ ] Add the necessary dependencies for file handling and API creation.

2.  **Backend Component Implementation**
    - [ ] **API Component:**
        - [ ] Create the `POST /api/file-analyzer/analyze` endpoint.
        - [ ] Create the `POST /api/file-analyzer/catalog/register` endpoint.
        - [ ] Implement the orchestration logic to coordinate between the Scanner, Result, and Catalog components.
    - [ ] **Scanner Component:**
        - [ ] Implement the file parsing logic for initial file types (`.ts`, `.js`, `.yaml`, `.json`).
        - [ ] Implement the logic to call the Gemini LLM with the parsed file content.
        - [ ] Develop and refine the prompts for accurate analysis of API endpoints.
        - [ ] Implement the logic to send the analysis results to the Result component.
    - [ ] **Result Component:**
        - [ ] Implement the logic to store and retrieve analysis results.
    - [ ] **Catalog Controller & Service:**
        - [ ] Implement the logic to create new API entities in the Backstage catalog.

3.  **Frontend Plugin Setup**
    - [ ] Create a new frontend plugin named `file-analyzer`.
    - [ ] Add the plugin to the app's navigation and routing.

4.  **Frontend UI Implementation**
    - [ ] Create a file upload component.
    - [ ] Implement the logic to call the backend API.
    - [ ] Display the analysis results in a user-friendly format.
    - [ ] Add a button or UI element to allow users to register the discovered APIs in the catalog.

5.  **Testing**
    - [ ] Add unit tests for each backend component.
    - [ ] Add integration tests for the API endpoints.
    - [ ] Add frontend component tests for the upload UI and results display.
    - [ ] Add e2e tests for the complete file upload, analysis, and catalog registration flow.