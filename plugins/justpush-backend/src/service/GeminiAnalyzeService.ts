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
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
    
    spec = spec.replace(/^```yaml\n?/i, '');
    spec = spec.replace(/^```\n?/, '');
    spec = spec.replace(/\n?```$/, '');
    
    spec = spec.trim();

    if (!spec.startsWith('openapi:') && !spec.startsWith('swagger:')) {
      this.logger.warn('Generated spec does not start with openapi: or swagger:, attempting to find it in text');
      
      const match = spec.match(/(openapi|swagger):[\s\S]*/i);
      if (match) {
        spec = match[0];
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
  ): Promise<string> {
    if (!this.genAI || !this.model) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in environment or config.');
    }

    this.logger.info(`Generating OpenAPI spec from ${endpoints.length} detected endpoints`);

    try {
      const prompt = this.buildEndpointsPrompt(endpoints, detectedPaths, projectName);

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
  ): string {
    const endpointsList = endpoints
      .map(e => `  ${e.method} ${e.path} (${e.file}:${e.line})`)
      .join('\n');

    const frameworks = detectedPaths
      .map(p => p.framework)
      .filter(f => f)
      .join(', ');

    return `You are an expert API documentation specialist. Generate a complete OpenAPI 3.0 specification based on the following detected API endpoints from a project analysis.

Project Information:
- Project Name: ${projectName}
- Detected Frameworks: ${frameworks || 'Unknown'}
- Total Endpoints: ${endpoints.length}
- Detected API Paths: ${detectedPaths.map(p => p.path).join(', ')}

Detected Endpoints:
${endpointsList}

Instructions:
1. Generate a complete and valid OpenAPI 3.0 specification in YAML format
2. Create an appropriate info section with title, version, and description
3. Define all detected endpoints under the paths section
4. For each endpoint:
   - Use the detected HTTP method and path
   - Generate appropriate operation descriptions based on the path structure
   - Create reasonable request/response schemas based on RESTful conventions
   - Add parameter definitions for path/query parameters inferred from the URL
5. Create reusable schemas in the components section
6. Add proper tags for grouping related endpoints
7. Include security schemes if authentication patterns are detected
8. Use common REST patterns and conventions for schema generation
9. Ensure all references and schemas are properly defined
10. Make the specification production-ready and comprehensive

Generate ONLY the OpenAPI YAML specification without any additional explanation or markdown formatting.

OpenAPI Specification:`;
  }
}
