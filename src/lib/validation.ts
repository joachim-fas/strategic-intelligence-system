// === Input Validation ===

export function validateStringLength(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number,
  minLength: number = 0
): { valid: true; value: string } | { valid: false; error: string } {
  if (value === undefined || value === null) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  return { valid: true, value: trimmed };
}

export function validateEnum<T extends string>(
  value: string | undefined | null,
  fieldName: string,
  allowedValues: readonly T[]
): { valid: true; value: T } | { valid: false; error: string } {
  if (!value || !allowedValues.includes(value as T)) {
    return {
      valid: false,
      error: `${fieldName} must be one of: ${allowedValues.join(", ")}`
    };
  }
  return { valid: true, value: value as T };
}

export function validateId(
  value: string | undefined | null,
  fieldName: string = "id"
): { valid: true; value: string } | { valid: false; error: string } {
  if (!value || typeof value !== "string") {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Allow UUIDs, nanoids, and simple alphanumeric IDs
  const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  if (!idPattern.test(value)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true, value };
}

// === Prompt Injection Sanitization ===
export function sanitizeUserInput(input: string): string {
  // Strip content that looks like prompt injection attempts
  let sanitized = input;

  // Remove attempts to inject system/assistant/human role markers
  sanitized = sanitized.replace(/\b(System|Assistant|Human|User)\s*:/gi, "");

  // Remove XML-like tags that could manipulate prompt structure
  sanitized = sanitized.replace(/<\/?(?:system|assistant|human|prompt|instruction|context|role|message)[^>]*>/gi, "");

  // Remove markdown-style role markers
  sanitized = sanitized.replace(/^#{1,3}\s*(System|Instructions?|Prompt|Context)\b/gim, "");

  // Collapse excessive whitespace
  sanitized = sanitized.replace(/\s{10,}/g, " ");

  return sanitized.trim();
}

// === Number Validation ===
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0 && value <= 1;
}
