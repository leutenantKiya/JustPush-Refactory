import { LoggerService } from '@backstage/backend-plugin-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalyzeApiRequest, AnalyzeApiResponse, Endpoint, DetectedPath } from '../types/api';

export class GeminiAnalyzeService {
  private logger: LoggerService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any;

  constructor(logger: LoggerService, apiKey?: string) {
    this.logger = logger;
    
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      this.logger.info('GeminiAnalyzeService initialized with API key');
    } else {
      this.logger.warn('GeminiAnalyzeService initialized without API key - analyze functionality will be disabled');
    }
  }

  async analyzeApi(request: AnalyzeApiRequest): Promise<AnalyzeApiResponse> {
    if (!this.genAI || !this.model) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in environment or config.');
    }

    const { apiUrl, method = 'GET', headers = {} } = request;

    this.logger.info(`Analyzing API: ${apiUrl}`);

    try {
      let apiResponse = '';
      let apiError = '';
      
      try {
        const fetchResponse = await fetch(apiUrl, {
          method,
          headers,
        });
        
        apiResponse = await fetchResponse.text();
        this.logger.info(`Fetched API response: ${apiResponse.substring(0, 200)}...`);
      } catch (error: any) {
        apiError = `Failed to fetch API: ${error.message}`;
        this.logger.warn(apiError);
      }

      const prompt = this.buildPrompt(apiUrl, method, apiResponse, apiError);

      this.logger.info('Calling Gemini API to generate OpenAPI spec...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      const openApiSpec = this.extractOpenApiSpec(generatedText);

      return {
        openApiSpec,
        metadata: {
          analyzedUrl: apiUrl,
          generatedAt: new Date().toISOString(),
          model: 'gemini-2.5-flash',
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to analyze API with Gemini', error);
      throw new Error(`API analysis failed: ${error.message}`);
    }
  }

  private buildPrompt(apiUrl: string, method: string, apiResponse: string, apiError: string): string {
    return `You are an expert API analyst. Your task is to generate a complete and accurate OpenAPI 3.0 specification for the given API endpoint.

API Information:
- URL: ${apiUrl}
- HTTP Method: ${method}
${apiError ? `- Error fetching API: ${apiError}` : `- API Response Sample:\n${apiResponse.substring(0, 1000)}`}

Instructions:
1. Analyze the API URL, method, and response (if available)
2. Generate a complete OpenAPI 3.0 specification in YAML format
3. Include all standard OpenAPI components: info, servers, paths, components
4. Infer request parameters from the URL structure
5. If response data is available, create accurate schema definitions
6. If response is not available due to fetch error, create a reasonable schema based on the URL and common REST patterns
7. Add appropriate descriptions and examples
8. Use proper data types and formats
9. Include security schemes if authentication appears to be required
10. Ensure the spec is valid and complete

Generate ONLY the OpenAPI YAML specification, with no additional explanation or markdown formatting.

OpenAPI Specification:`;
  }

  private extractOpenApiSpec(generatedText: string): string {
    let spec = generatedText.trim();
    
    spec = spec.replace(/^```json\n?/i, '');
    spec = spec.replace(/^```yaml\n?/i, '');
    spec = spec.replace(/^```\n?/, '');
    spec = spec.replace(/\n?```$/, '');
    
    spec = spec.trim();

    const jsonMatch = spec.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      spec = jsonMatch[0];
      
      try {
        const parsed = JSON.parse(spec);
        spec = JSON.stringify(parsed, null, 2);
        this.logger.info('Successfully parsed and formatted OpenAPI JSON spec');
      } catch (error) {
        this.logger.warn('Generated spec is not valid JSON, returning as-is');
      }
    } else if (!spec.startsWith('openapi:') && !spec.startsWith('swagger:') && !spec.startsWith('{')) {
      this.logger.warn('Generated spec format unclear, attempting to find OpenAPI content');
      
      const yamlMatch = spec.match(/(openapi|swagger):[\s\S]*/i);
      if (yamlMatch) {
        spec = yamlMatch[0];
      }
    }

    return spec;
  }

  async testConnection(): Promise<boolean> {
    if (!this.genAI || !this.model) {
      return false;
    }

    try {
      const result = await this.model.generateContent('Say "OK" if you can read this.');
      const response = await result.response;
      const text = response.text();
      return text.length > 0;
    } catch (error) {
      this.logger.error('Gemini API connection test failed', error as Error);
      return false;
    }
  }

  async generateOpenApiFromEndpoints(
    endpoints: Endpoint[],
    detectedPaths: DetectedPath[],
    projectName: string = 'API Project',
    baseUrl?: string,
  ): Promise<string> {
    if (!this.genAI || !this.model) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in environment or config.');
    }

    this.logger.info(`Generating OpenAPI spec from ${endpoints.length} detected endpoints`);

    try {
      const prompt = this.buildEndpointsPrompt(endpoints, detectedPaths, projectName, baseUrl);

      this.logger.info('Calling Gemini API to generate OpenAPI spec from endpoints...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      const openApiSpec = this.extractOpenApiSpec(generatedText);

      this.logger.info('OpenAPI spec generated successfully from endpoints');
      return openApiSpec;
    } catch (error: any) {
      this.logger.error('Failed to generate OpenAPI spec from endpoints', error);
      throw new Error(`OpenAPI generation failed: ${error.message}`);
    }
  }

  private buildEndpointsPrompt(
    endpoints: Endpoint[],
    detectedPaths: DetectedPath[],
    projectName: string,
    baseUrl?: string,
  ): string {
    const endpointsList = endpoints
      .map(e => `  ${e.method} ${e.path} (${e.file}:${e.line})`)
      .join('\n');

    const frameworks = detectedPaths
      .map(p => p.framework)
      .filter(f => f)
      .join(', ');

    const serverUrl = baseUrl || '/api';

    return `You are an expert API documentation specialist. Generate a complete and professional OpenAPI 3.0 specification in JSON format based on the following detected API endpoints.

Project Information:
- Project Name: ${projectName}
- Detected Frameworks: ${frameworks || 'Unknown'}
- Total Endpoints: ${endpoints.length}
- Detected API Paths: ${detectedPaths.map(p => p.path).join(', ')}
- Base URL: ${serverUrl}

Detected Endpoints:
${endpointsList}

Instructions:
1. Generate a complete OpenAPI 3.0 specification in JSON format (not YAML)
2. Create an appropriate info section with:
   - title: "${projectName} API"
   - version: "1.0.0"
   - description: Detailed description of the API's purpose and capabilities
3. **IMPORTANT**: Add a servers section with the base URL:
   "servers": [
     {
       "url": "${serverUrl}",
       "description": "API Base URL"
     }
   ]
4. Define all detected endpoints under the paths section with:
   - operationId: unique identifier for each operation
   - summary: brief description
   - description: detailed explanation of what the endpoint does
   - tags: for grouping related endpoints
   - parameters: path, query, and header parameters with descriptions and types
   - requestBody: for POST/PUT/PATCH with proper schema and examples
   - responses: comprehensive response definitions with schemas and examples
5. Create reusable schemas in components.schemas section:
   - Use proper JSON Schema definitions
   - Include descriptions for each field
   - Add examples for better understanding
   - Use appropriate data types (string, number, boolean, array, object)
6. Add security schemes in components.securitySchemes if authentication is detected
7. Use RESTful conventions and best practices
8. Ensure all $ref references are properly defined
9. Include proper error response schemas (400, 401, 404, 500)

IMPORTANT: Generate ONLY valid JSON format OpenAPI 3.0 specification. Do not include markdown formatting, code blocks, or any explanatory text.

Output must start with { and end with }

OpenAPI Specification (JSON):`;
  }
}
