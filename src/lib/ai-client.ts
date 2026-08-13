import OpenAI from "openai";

/** Prefer OpenRouter; fall back to OPENAI_API_KEY for compatibility */
export function hasAIKey() {
  return Boolean(
    (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim(),
  );
}

/** @deprecated use hasAIKey */
export function hasOpenAIKey() {
  return hasAIKey();
}

export function getAIModel() {
  return (
    process.env.AI_MODEL?.trim() ||
    "qwen/qwen3-vl-32b-instruct"
  );
}

export function getAIClient() {
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const baseURL =
    process.env.OPENROUTER_BASE_URL?.trim() ||
    (process.env.OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1"
      : undefined);

  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "AXON Case",
    },
    timeout: 90_000,
    maxRetries: 2,
  });
}
