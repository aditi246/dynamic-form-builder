import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FormField } from '../../features/form-builder/fields-step/fields-step';
import { formatStr } from '../../utils';
import { PROMPTS } from '../constants/prompts.constants';

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {
  private apiKey = environment.openAiApiKey;
  private readonly openAiEndpoints = {
    CHAT_COMPLETION: '/v1/chat/completions',
    IMAGE_EDITS: '/v1/images/edits',
    RESPONSES: '/v1/responses'
  }
  private readonly headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`
  });

  constructor(private http: HttpClient) {}

  generateText(prompt: string): Observable<any> {
    const body = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: PROMPTS.SYSTEM_MESSAGE
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    };

    return this.http.post(`${environment.openAiApiUrl}${this.openAiEndpoints.CHAT_COMPLETION}`, body, { headers: this.headers });
  }

  prepareFormPrompt(userText: string, fields: FormField[], currentFormValues: any): string {
    const fieldsDescription = this.buildFieldsDescription(fields);
    const currentValues = Object.keys(currentFormValues).length > 0
      ? PROMPTS.CURRENT_VALUES_PREFIX + JSON.stringify(currentFormValues, null, 2)
      : '';

    return formatStr(
      PROMPTS.FORM_FILL_INSTRUCTION,
      userText,
      fieldsDescription,
      currentValues
    );
  }

  checkUploadedImage(file: File): Observable<any> {
    return from(this.fileToBase64(file)).pipe(
      switchMap(base64 => {
        const body = {
          model: "gpt-4o-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: PROMPTS.BLURRY_IMAGE_CHECK
                },
                {
                  type: "input_image",
                  image_url: `data:${file.type};base64,${base64}`
                }
              ]
            }
          ]
        };
        return this.http.post(`${environment.openAiApiUrl}${this.openAiEndpoints.RESPONSES}`, body, { headers: this.headers });
      })
    );
  }

  extractDataFromFile(file: File, fields: FormField[], currentFormValues: any): Observable<any> {
    return from(this.fileToBase64(file)).pipe(
      switchMap(base64 => {
        const fieldsDescription = this.buildFieldsDescription(fields);
        const currentValues = Object.keys(currentFormValues).length > 0
          ? PROMPTS.CURRENT_VALUES_PREFIX + JSON.stringify(currentFormValues, null, 2)
          : '';

        const isImage = file.type.startsWith('image/');
        const promptTemplate = isImage ? PROMPTS.FILE_EXTRACTION_IMAGE : PROMPTS.FILE_EXTRACTION_DOCUMENT;
        const prompt = formatStr(promptTemplate, fieldsDescription, currentValues);

        const body = {
          model: "gpt-4o-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt
                },
                {
                  type: isImage ? "input_image" : "input_file",
                  [isImage ? "image_url" : "file_url"]: `data:${file.type};base64,${base64}`
                }
              ]
            }
          ]
        };
        return this.http.post(`${environment.openAiApiUrl}${this.openAiEndpoints.RESPONSES}`, body, { headers: this.headers });
      })
    );
  }

  private buildFieldsDescription(fields: FormField[]): string {
    return fields.map(field => {
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
    }).join('\n');
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

