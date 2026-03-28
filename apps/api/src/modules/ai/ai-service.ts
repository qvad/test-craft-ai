/**
 * AI Service for TestCraft
 * Provides AI-powered code generation, data generation, validation, and more
 */

import { logger } from '../../common/logger.js';
import type {
  AIGenerationRequest,
  AIGenerationResponse,
  DataGenerationRequest,
  DataGenerationResponse,
  ValidationRequest,
  ValidationResponse,
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RAGQuery,
  RAGResult,
} from './types.js';
import { ragService } from './rag-service.js';

export class AIService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private provider: string;

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'anthropic';
    this.apiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.AI_MODEL || (this.provider === 'ollama' ? 'llama3' : 'claude-sonnet-4-20250514');

    if (process.env.AI_BASE_URL) {
      this.baseUrl = process.env.AI_BASE_URL;
    } else {
      this.baseUrl = this.provider === 'ollama'
        ? 'http://localhost:11434/api'
        : 'https://api.anthropic.com/v1';
    }
  }

  /**
   * Generate code based on natural language intent
   */
  async generateCode(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    logger.info({ nodeId: request.nodeId, intent: request.intent }, 'Generating code with AI');

    // Build context with RAG if needed
    let ragContext = '';
    if (request.context.ragQuery) {
      const ragResult = await ragService.search({
        query: request.context.ragQuery,
        topK: 5,
      });
      ragContext = ragResult.documents.map(d => d.content).join('\n\n');
    }

    const prompt = this.buildCodeGenerationPrompt(request, ragContext);

    try {
      const response = await this.callAI(prompt, {
        temperature: request.options?.temperature ?? 0.2,
        maxTokens: request.options?.maxTokens ?? 4096,
      });

      return this.parseCodeGenerationResponse(response);
    } catch (error) {
      logger.error({ error, nodeId: request.nodeId }, 'Code generation failed');
      throw error;
    }
  }

  /**
   * Generate test data based on schema
   */
  async generateData(request: DataGenerationRequest): Promise<DataGenerationResponse> {
    logger.info({ count: request.count }, 'Generating test data with AI');

    let ragContext = '';
    if (request.ragContext && request.ragContext.length > 0) {
      const ragResult = await ragService.search({
        query: request.ragContext.join(' '),
        topK: 3,
      });
      ragContext = ragResult.documents.map(d => d.content).join('\n\n');
    }

    const prompt = this.buildDataGenerationPrompt(request, ragContext);

    try {
      const response = await this.callAI(prompt, {
        temperature: 0.7,
        maxTokens: 8192,
      });

      return this.parseDataGenerationResponse(response, request);
    } catch (error) {
      logger.error({ error }, 'Data generation failed');
      throw error;
    }
  }

  /**
   * Validate response using AI
   */
  async validateResponse(request: ValidationRequest): Promise<ValidationResponse> {
    logger.info({ intent: request.intent }, 'Validating response with AI');

    const prompt = this.buildValidationPrompt(request);

    try {
      const response = await this.callAI(prompt, {
        temperature: 0.1,
        maxTokens: 2048,
      });

      return this.parseValidationResponse(response);
    } catch (error) {
      logger.error({ error }, 'AI validation failed');
      throw error;
    }
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> {
    logger.info({ metricsCount: request.metrics.length }, 'Detecting anomalies with AI');

    const prompt = this.buildAnomalyDetectionPrompt(request);

    try {
      const response = await this.callAI(prompt, {
        temperature: 0.1,
        maxTokens: 4096,
      });

      return this.parseAnomalyDetectionResponse(response);
    } catch (error) {
      logger.error({ error }, 'Anomaly detection failed');
      throw error;
    }
  }

  /**
   * Generate embeddings for RAG
   */
  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Use a dedicated embedding model or service
    // For now, we'll use a placeholder that could be replaced with OpenAI, Cohere, etc.
    logger.info({ textCount: request.texts.length }, 'Generating embeddings');

    // Placeholder - in production, use actual embedding API
    const embeddings = request.texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
    );

    return {
      embeddings,
      model: request.model || 'text-embedding-3-small',
      tokensUsed: request.texts.reduce((sum, t) => sum + t.length / 4, 0),
    };
  }

  /**
   * Search RAG knowledge base
   */
  async searchRAG(query: RAGQuery): Promise<RAGResult> {
    return ragService.search(query);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async callAI(
    prompt: string,
    options: { temperature: number; maxTokens: number }
  ): Promise<string> {
    if (this.provider === 'ollama') {
      return this.callOllama(prompt, options);
    }

    if (!this.apiKey) {
      logger.warn('No AI API key configured, using mock response');
      return this.getMockResponse(prompt);
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text || '';
  }

  private async callOllama(
    prompt: string,
    options: { temperature: number; maxTokens: number }
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { message: { content: string } };
      return data.message?.content || '';
    } catch (error) {
      logger.error({ error }, 'Ollama request failed');
      throw error;
    }
  }

  private buildCodeGenerationPrompt(request: AIGenerationRequest, ragContext: string): string {
    const { nodeType, intent, language, context } = request;

    let prompt = `You are an expert ${language} developer generating production-ready code for a test automation platform.

## Task
Generate ${language} code for a ${nodeType} node.

## Intent
${intent}

`;

    if (ragContext) {
      prompt += `## Reference Context (from knowledge base)
${ragContext}

`;
    }

    if (context.databaseSchema) {
      prompt += `## Database Schema
${JSON.stringify(context.databaseSchema, null, 2)}

`;
    }

    if (context.apiSpecification) {
      prompt += `## API Specification
${JSON.stringify(context.apiSpecification, null, 2)}

`;
    }

    if (context.variables) {
      prompt += `## Available Variables
${JSON.stringify(context.variables, null, 2)}

`;
    }

    if (context.previousSteps && context.previousSteps.length > 0) {
      prompt += `## Previous Steps Output
${context.previousSteps.map(s => `- ${s.nodeName}: ${JSON.stringify(s.outputSchema)}`).join('\n')}

`;
    }

    prompt += `## Requirements
1. Generate complete, executable code
2. Use parameterized queries to prevent injection attacks
3. Include proper error handling
4. Include logging
5. Follow ${context.conventions?.namingConvention || 'camelCase'} naming convention
6. Return results in a structured format

## Output Format
Return a JSON object with:
- code: The complete code
- entryPoint: { methodName, signature }
- dependencies: [{ name, version, scope }]
- contracts: { inputs, outputs, sideEffects, exceptions }
- confidence: 0-1 score
- reasoning: Brief explanation

Generate ONLY valid JSON, no markdown or explanations.`;

    return prompt;
  }

  private buildDataGenerationPrompt(request: DataGenerationRequest, ragContext: string): string {
    let prompt = `Generate ${request.count} realistic test data records based on the following schema.

## Schema
${JSON.stringify(request.schema, null, 2)}

`;

    if (ragContext) {
      prompt += `## Context (use this for realistic values)
${ragContext}

`;
    }

    if (request.locale) {
      prompt += `## Locale
Generate data appropriate for: ${request.locale}

`;
    }

    prompt += `## Requirements
1. Generate realistic, diverse data
2. Respect all field constraints (min/max, patterns, etc.)
3. Ensure uniqueness where required
4. Use consistent relationships between fields

Return ONLY a JSON array of ${request.count} objects, no explanations.`;

    return prompt;
  }

  private buildValidationPrompt(request: ValidationRequest): string {
    return `Validate the following response against the expected behavior.

## Response to Validate
${JSON.stringify(request.response, null, 2)}

## Expected Behavior
${request.expectedBehavior}

## Intent
${request.intent}

${request.rules ? `## Additional Rules\n${request.rules.join('\n')}` : ''}

## Output Format
Return a JSON object with:
- isValid: boolean
- confidence: 0-1 score
- issues: [{ severity, message, path?, expected?, actual? }]
- suggestions: string[]

Generate ONLY valid JSON.`;
  }

  private buildAnomalyDetectionPrompt(request: AnomalyDetectionRequest): string {
    return `Analyze the following metrics for anomalies.

## Metrics Data
${JSON.stringify(request.metrics.slice(-100), null, 2)}

## Sensitivity Level
${request.sensitivity}

## Analysis Requirements
1. Calculate baseline statistics for each metric
2. Identify values outside expected ranges
3. Consider seasonality and trends
4. Rate severity of anomalies

## Output Format
Return a JSON object with:
- anomalies: [{ timestamp, metric, value, expectedRange, severity, description }]
- baseline: { metricName: { mean, stdDev, min, max, percentiles } }
- confidence: 0-1 score

Generate ONLY valid JSON.`;
  }

  private parseCodeGenerationResponse(response: string): AIGenerationResponse {
    try {
      const parsed = JSON.parse(response);
      return {
        success: true,
        code: parsed.code || '',
        entryPoint: parsed.entryPoint || { methodName: 'execute', signature: '()' },
        dependencies: parsed.dependencies || [],
        contracts: parsed.contracts || { inputs: [], outputs: [], sideEffects: [], exceptions: [] },
        suggestedTests: parsed.suggestedTests,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
        alternatives: parsed.alternatives,
        tokensUsed: 0,
      };
    } catch (error) {
      logger.error({ error, response }, 'Failed to parse AI response');
      return {
        success: false,
        code: response,
        entryPoint: { methodName: 'execute', signature: '()' },
        dependencies: [],
        contracts: { inputs: [], outputs: [], sideEffects: [], exceptions: [] },
        confidence: 0,
        reasoning: 'Failed to parse structured response',
        tokensUsed: 0,
      };
    }
  }

  private parseDataGenerationResponse(
    response: string,
    request: DataGenerationRequest
  ): DataGenerationResponse {
    try {
      const data = JSON.parse(response);
      return {
        data: Array.isArray(data) ? data : [data],
        schema: request.schema,
        seed: request.seed || Date.now(),
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return {
        data: [],
        schema: request.schema,
        seed: request.seed || Date.now(),
        generatedAt: new Date().toISOString(),
      };
    }
  }

  private parseValidationResponse(response: string): ValidationResponse {
    try {
      return JSON.parse(response);
    } catch {
      return {
        isValid: false,
        confidence: 0,
        issues: [{ severity: 'error', message: 'Failed to parse validation response' }],
        suggestions: [],
      };
    }
  }

  private parseAnomalyDetectionResponse(response: string): AnomalyDetectionResponse {
    try {
      return JSON.parse(response);
    } catch {
      return {
        anomalies: [],
        baseline: {},
        confidence: 0,
      };
    }
  }

  private getMockResponse(prompt: string): string {
    // Return mock responses for testing without API key
    if (prompt.includes('Generate') && prompt.includes('code')) {
      return JSON.stringify({
        code: '// Mock generated code\nfunction execute() { return "Hello from AI"; }',
        entryPoint: { methodName: 'execute', signature: '()' },
        dependencies: [],
        contracts: { inputs: [], outputs: [{ name: 'result', type: 'string' }], sideEffects: [], exceptions: [] },
        confidence: 0.8,
        reasoning: 'Mock response for testing',
      });
    }

    if (prompt.includes('Validate')) {
      return JSON.stringify({
        isValid: true,
        confidence: 0.9,
        issues: [],
        suggestions: ['Consider adding more test cases'],
      });
    }

    return '{}';
  }
}

export const aiService = new AIService();
