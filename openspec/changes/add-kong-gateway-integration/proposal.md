# Proposal: Add Kong Gateway Integration

This proposal outlines the addition of Kong Gateway integration to JustPush. After generating an OpenAPI specification, users will have the option to "push" this specification to a Kong Gateway. This will automatically register the API's routes and apply pre-configured policies such as rate limiting and authentication directly from the JustPush interface, streamlining the API deployment and management process. This integration is designed to be optional and fully backward-compatible with the existing workflow.
