/**
 * Anthropic API error → client-facing message mapping.
 *
 * Pilot-Eval 2026-04-22 aufgedeckt: HTTP-400-Antworten von Anthropic
 * (z.B. `credit_balance_too_low`, `invalid_api_key`) wurden alle
 * generic auf „Unable to process your request" gemappt — im UI sah
 * der User dann „Die Anfrage ist zu kurz oder das System überlastet",
 * was in die falsche Fehlersuche führt.
 *
 * Dieses Mapping differenziert nach Anthropic-Error-Body-Content, damit
 * Operations-kritische Ursachen (Billing, Auth) klar benannt werden.
 *
 * Gedacht als pure Function ohne Seiteneffekte, damit sie per
 * `scripts/error-mapping-test.ts` gegen realistische Anthropic-Response-
 * Bodies testbar ist.
 */

export type Locale = "de" | "en";

export interface ErrorMapping {
  de: string;
  en: string;
}

/**
 * Maps an Anthropic API error response to a user-facing message pair.
 *
 * @param status HTTP status code returned by Anthropic
 * @param errorBody Raw response body text (may be JSON or plain text)
 * @returns Locale-keyed messages ready to ship to the client
 */
export function mapAnthropicError(status: number, errorBody: string): ErrorMapping {
  // 429 → rate limit / overload (Anthropic uses 429 for both)
  if (status === 429) {
    return {
      de: "Der KI-Dienst ist aktuell überlastet. Bitte in einem Moment nochmal probieren.",
      en: "AI service is temporarily overloaded. Please try again in a moment.",
    };
  }

  // 5xx → server-side unavailability
  if (status >= 500) {
    return {
      de: "Der KI-Dienst ist aktuell nicht erreichbar.",
      en: "AI service is temporarily unavailable.",
    };
  }

  // 400/401/403 → parse body to differentiate billing/auth from generic
  if (status === 400 || status === 401 || status === 403) {
    // Try to parse Anthropic's structured error payload
    let parsed: { error?: { type?: string; message?: string } } | null = null;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      /* body is not JSON — fall through to substring match on raw text */
    }

    const anthropicMsg = parsed?.error?.message ?? errorBody ?? "";
    const anthropicType = parsed?.error?.type ?? "";

    // Credit balance / billing issues — most common 400 in development
    if (/credit[\s_-]*balance/i.test(anthropicMsg) || /billing/i.test(anthropicMsg)) {
      return {
        de: "KI-Dienst: Abrechnungsproblem — bitte Administrator kontaktieren.",
        en: "AI service billing issue — please contact administrator.",
      };
    }

    // Authentication errors — misconfigured API key, wrong org, etc.
    if (
      anthropicType === "authentication_error" ||
      /api[\s_-]*key/i.test(anthropicMsg) ||
      /unauthorized|authentication/i.test(anthropicMsg) ||
      status === 401
    ) {
      return {
        de: "KI-Dienst: Authentifizierungsproblem — bitte Administrator kontaktieren.",
        en: "AI service authentication error — please contact administrator.",
      };
    }

    // Permission / forbidden
    if (status === 403 || anthropicType === "permission_error") {
      return {
        de: "KI-Dienst: Zugriff verweigert — bitte Administrator kontaktieren.",
        en: "AI service permission denied — please contact administrator.",
      };
    }

    // Rate limit explicitly in body (some 400s carry this)
    if (/rate[\s_-]*limit/i.test(anthropicMsg)) {
      return {
        de: "KI-Dienst: Rate-Limit erreicht. Bitte kurz warten.",
        en: "AI service rate limit reached. Please wait a moment.",
      };
    }

    // Otherwise: genuinely bad request (malformed input, etc.)
    return {
      de: "Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen.",
      en: "Unable to process your request. Please try again.",
    };
  }

  // Any other status — shouldn't normally happen
  return {
    de: "Unerwarteter Fehler beim KI-Dienst. Bitte erneut versuchen.",
    en: "Unexpected AI service error. Please try again.",
  };
}
