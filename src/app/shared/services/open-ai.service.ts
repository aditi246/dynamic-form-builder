import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FormField } from '../../features/form-builder/fields-step/fields-step';
import { formatStr } from '../../utils';
import { PROMPTS } from '../constants/prompts.constants';

export interface DocumentAnalysisResult {
  isLikelyTampered: boolean;
  unreadableRegions: { description: string }[];
  hasKeyInfo?: boolean;
}

type ResponsesApiContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; file_id: string };

interface ResponsesApiRequestBody {
  model: string;
  input: Array<{
    role: 'user';
    content: ResponsesApiContent[];
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class OpenAiService {
  private readonly openAiEndpoints = {
    CHAT_COMPLETION: '/v1/chat/completions',
    IMAGE_EDITS: '/v1/images/edits',
    RESPONSES: '/v1/responses',
    FILES: '/v1/files',
  };
  private readonly localStorageKey = 'openAiApiKey';
  constructor(private http: HttpClient) {}

  private getApiKey(): string {
    if (environment.openAiApiKey) {
      return environment.openAiApiKey;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedKey = localStorage.getItem(this.localStorageKey);
      if (storedKey) {
        return storedKey;
      }
    }

    return '';
  }

  private get jsonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.getApiKey()}`,
    });
  }

  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getApiKey()}`,
    });
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Generates text using GPT-3.5-turbo chat completion
   */
  generateText(prompt: string): Observable<any> {
    const body = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: PROMPTS.SYSTEM_MESSAGE,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    };

    return this.http.post(
      `${environment.openAiApiUrl}${this.openAiEndpoints.CHAT_COMPLETION}`,
      body,
      { headers: this.jsonHeaders },
    );
  }

  /**
   * Prepares a formatted prompt for form filling
   */
  prepareFormPrompt(
    userText: string,
    fields: FormField[],
    currentFormValues: any,
  ): string {
    const fieldsDescription = this.buildFieldsDescription(fields);
    const currentValues =
      Object.keys(currentFormValues).length > 0
        ? PROMPTS.CURRENT_VALUES_PREFIX +
          JSON.stringify(currentFormValues, null, 2)
        : '';

    return formatStr(
      PROMPTS.FORM_FILL_INSTRUCTION,
      userText,
      fieldsDescription,
      currentValues,
    );
  }

  /**
   * Checks if an uploaded image is blurry
   */
  checkUploadedImage(file: File): Observable<any> {
    return this.prepareImageContent(file).pipe(
      switchMap((imageContent) => {
        const requestBody = this.buildResponsesApiRequest('gpt-4o-mini', [
          { type: 'input_text', text: PROMPTS.BLURRY_IMAGE_CHECK },
          imageContent,
        ]);
        return this.callResponsesApi(requestBody);
      }),
    );
  }

  /**
   * Extracts data from a file (image or document) to fill form fields
   */
  extractDataFromFile(
    file: File,
    fields: FormField[],
    currentFormValues: any,
  ): Observable<any> {
    const prompt = this.buildFileExtractionPrompt(
      file,
      fields,
      currentFormValues,
    );

    return this.prepareFileContent(file).pipe(
      switchMap((fileContent) => {
        const requestBody = this.buildResponsesApiRequest('gpt-4o-mini', [
          { type: 'input_text', text: prompt },
          fileContent,
        ]);
        return this.callResponsesApi(requestBody);
      }),
    );
  }

  /**
   * Analyzes an image file for quality issues (tampering, unreadable regions)
   */
  analyzeImage(file: File): Observable<DocumentAnalysisResult> {
    return this.prepareImageContent(file).pipe(
      switchMap((imageContent) => {
        const requestBody = this.buildResponsesApiRequest('gpt-4o', [
          { type: 'input_text', text: PROMPTS.DOCUMENT_QUALITY_CHECK },
          imageContent,
        ]);
        return this.callResponsesApi<{ output_text?: string; output?: any }>(
          requestBody,
        );
      }),
      map((response) => this.extractDocumentAnalysisResult(response)),
    );
  }

  /**
   * Analyzes a PDF file for quality issues using AI vision model
   */
  analyzePdf(file: File): Observable<DocumentAnalysisResult> {
    return this.prepareFileContent(file).pipe(
      switchMap((fileContent) => {
        const requestBody = this.buildResponsesApiRequest('gpt-4o', [
          { type: 'input_text', text: PROMPTS.DOCUMENT_QUALITY_CHECK },
          fileContent,
        ]);
        return this.callResponsesApi<{ output_text?: string; output?: any }>(
          requestBody,
        );
      }),
      map((response) => this.extractDocumentAnalysisResult(response)),
    );
  }

  // ============================================================================
  // Private Helper Methods - Request Building
  // ============================================================================

  /**
   * Builds a Responses API request body
   */
  private buildResponsesApiRequest(
    model: string,
    content: ResponsesApiContent[],
  ): ResponsesApiRequestBody {
    return {
      model,
      input: [
        {
          role: 'user',
          content,
        },
      ],
    };
  }

  /**
   * Makes a POST request to the Responses API
   */
  private callResponsesApi<T = any>(
    body: ResponsesApiRequestBody,
  ): Observable<T> {
    return this.http.post<T>(
      `${environment.openAiApiUrl}${this.openAiEndpoints.RESPONSES}`,
      body,
      { headers: this.jsonHeaders },
    );
  }

  /**
   * Prepares image content for Responses API (converts to base64)
   */
  private prepareImageContent(
    file: File,
  ): Observable<{ type: 'input_image'; image_url: string }> {
    return from(this.fileToBase64(file)).pipe(
      map((base64) => ({
        type: 'input_image' as const,
        image_url: `data:${file.type};base64,${base64}`,
      })),
    );
  }

  /**
   * Prepares file content for Responses API (image as base64, documents as file_id)
   */
  private prepareFileContent(
    file: File,
  ): Observable<
    | { type: 'input_image'; image_url: string }
    | { type: 'input_file'; file_id: string }
  > {
    const isImage = file.type.startsWith('image/');
    return isImage
      ? this.prepareImageContent(file)
      : this.uploadFileToOpenAi(file).pipe(
          map((fileId) => ({
            type: 'input_file' as const,
            file_id: fileId,
          })),
        );
  }

  /**
   * Builds the extraction prompt for file data extraction
   */
  private buildFileExtractionPrompt(
    file: File,
    fields: FormField[],
    currentFormValues: any,
  ): string {
    const fieldsDescription = this.buildFieldsDescription(fields);
    const currentValues =
      Object.keys(currentFormValues).length > 0
        ? PROMPTS.CURRENT_VALUES_PREFIX +
          JSON.stringify(currentFormValues, null, 2)
        : '';

    const isImage = file.type.startsWith('image/');
    const promptTemplate = isImage
      ? PROMPTS.FILE_EXTRACTION_IMAGE
      : PROMPTS.FILE_EXTRACTION_DOCUMENT;

    return formatStr(promptTemplate, fieldsDescription, currentValues);
  }

  // ============================================================================
  // Private Helper Methods - Field Description
  // ============================================================================

  /**
   * Builds a human-readable description of form fields
   */
  private buildFieldsDescription(fields: FormField[]): string {
    return fields
      .map((field) => {
        let desc = `- ${field.name} (${field.type}): ${field.label}`;
        if (field.required) {
          desc += ' [REQUIRED]';
        }
        if (field.options && field.options.length > 0) {
          desc += ` - Options: ${field.options.join(', ')}`;
        }
        if (field.validation) {
          const validations: string[] = [];
          if (field.validation.minLength) {
            validations.push(`min length: ${field.validation.minLength}`);
          }
          if (field.validation.maxLength) {
            validations.push(`max length: ${field.validation.maxLength}`);
          }
          if (field.validation.minValue !== undefined) {
            validations.push(`min value: ${field.validation.minValue}`);
          }
          if (field.validation.maxValue !== undefined) {
            validations.push(`max value: ${field.validation.maxValue}`);
          }
          if (field.validation.pattern) {
            validations.push(`pattern: ${field.validation.pattern}`);
          }
          if (validations.length > 0) {
            desc += ` - Validation: ${validations.join(', ')}`;
          }
        }
        return desc;
      })
      .join('\n');
  }

  // ============================================================================
  // Private Helper Methods - File Operations
  // ============================================================================

  /**
   * Uploads a file to OpenAI and returns the file_id for use with Responses API
   */
  private uploadFileToOpenAi(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    // Use assistants purpose so PDFs and other docs are accepted and can be referenced by the Responses API
    formData.append('purpose', 'assistants');

    return this.http
      .post<{
        id: string;
      }>(`${environment.openAiApiUrl}${this.openAiEndpoints.FILES}`, formData, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.id));
  }

  /**
   * Converts a file to base64 string (returns only the base64 part, without data URL prefix)
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============================================================================
  // Private Helper Methods - Response Parsing
  // ============================================================================

  /**
   * Extracts text content from various OpenAI API response formats
   */
  private extractTextFromResponse(response: any): string | null {
    if (!response) return null;

    return (
      response?.output_text ||
      response?.output?.[0]?.content?.[0]?.text ||
      response?.choices?.[0]?.message?.content ||
      null
    );
  }

  /**
   * Parses JSON from a string, with fallback to extracting JSON from text
   */
  private parseJsonSafely(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Extracts and parses document analysis result from API response
   */
  private extractDocumentAnalysisResult(response: any): DocumentAnalysisResult {
    const defaultResult: DocumentAnalysisResult = {
      isLikelyTampered: false,
      unreadableRegions: [],
      hasKeyInfo: false,
    };

    const textContent = this.extractTextFromResponse(response);
    if (!textContent) return defaultResult;

    const payload =
      typeof textContent === 'string'
        ? this.parseJsonSafely(textContent)
        : textContent;

    if (!payload) return defaultResult;

    return {
      isLikelyTampered: Boolean(
        payload.isLikelyTampered ??
          payload.is_likely_tampered ??
          payload.tampered ??
          false,
      ),
      unreadableRegions: Array.isArray(payload.unreadableRegions)
        ? payload.unreadableRegions
        : Array.isArray(payload.unreadable_regions)
          ? payload.unreadable_regions.map((r: any) =>
              typeof r === 'string'
                ? { description: r }
                : { description: r.description || r.desc || String(r) },
            )
          : [],
      hasKeyInfo: Boolean(
        payload.hasKeyInfo ?? payload.has_key_info ?? payload.hasKey ?? false,
      ),
    };
  }
}
