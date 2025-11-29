export const PROMPTS = {
  SYSTEM_MESSAGE:
    'You are an expert form optimization AI assistant. Provide concise, accurate responses in the requested format.',

  FORM_FILL_INSTRUCTION: `You are a helpful assistant that fills out forms based on user instructions.

User instruction: "{0}"

Available form fields:
{1}
{2}

Extract relevant information from the user's instruction and map it to the appropriate form fields.
Return a JSON object with field names as keys and values as the extracted data.
Only include fields that have clear values in the user's instruction.
For checkboxes, use true/false. For numbers, use numeric values. For text/select, use strings.

Example format: {"firstName": "John", "lastName": "Doe", "age": 30, "isActive": true}

Return only the JSON object, no additional text.`,

  CURRENT_VALUES_PREFIX: '\nCurrent form values:\n',

  BLURRY_IMAGE_CHECK: `You are a quality checker for user-uploaded photos.
Decide if the image is too blurry to use. If you are able to read stuff from the image then bulrriness score increases and be less strict, if that's the case. 
Return ONLY valid JSON with:
{
  "is_blurry": boolean,
  "blurriness_score": number,
  "reason": string,
  "recommend_reupload": boolean
}`,

  FILE_EXTRACTION_IMAGE: `You are a helpful assistant that extracts information from images to fill out forms.

Available form fields:
{0}
{1}

Extract all relevant information from the image and map it to the appropriate form fields.
Return a JSON object with field names as keys and values as the extracted data.
Only include fields where you can clearly extract values from the image.
For checkboxes, use true/false. For numbers, use numeric values. For text/select, use strings.

Example format: {"firstName": "John", "lastName": "Doe", "age": 30, "isActive": true}

Return only the JSON object, no additional text.`,

  FILE_EXTRACTION_DOCUMENT: `You are a helpful assistant that extracts information from documents to fill out forms.

Available form fields:
{0}
{1}

Extract all relevant information from the document and map it to the appropriate form fields.
Return a JSON object with field names as keys and values as the extracted data.
Only include fields where you can clearly extract values from the document.
For checkboxes, use true/false. For numbers, use numeric values. For text/select, use strings.

Example format: {"firstName": "John", "lastName": "Doe", "age": 30, "isActive": true}

Return only the JSON object, no additional text.`,
};

