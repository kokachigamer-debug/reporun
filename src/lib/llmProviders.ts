// AI provider abstraction (Section 8). Provider-agnostic interface used by the
// optional LLM classification fallback (off by default, bring-your-own-key).
import type { Classification } from "@/types";

export interface ClassificationLLMProvider {
  name: string;
  classify(
    repoTree: string[],
    readme: string | null,
    apiKey: string,
  ): Promise<Classification>;
}

/** Minimal OpenAI-compatible provider (works with OpenAI, OpenRouter, local servers). */
export class OpenAICompatProvider implements ClassificationLLMProvider {
  name = "openai-compatible";
  constructor(private endpoint = "https://api.openai.com/v1") {}

  async classify(
    repoTree: string[],
    readme: string | null,
    apiKey: string,
  ): Promise<Classification> {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You classify GitHub repositories into exactly one of: 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Unsupported'. Respond ONLY with JSON {tier, reason}.",
        },
        {
          role: "user",
          content: `Files:\n${repoTree.slice(0, 200).join("\n")}\n\nREADME:\n${
            readme?.slice(0, 4000) ?? "(none)"
          }`,
        },
      ],
      temperature: 0,
    };
    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM provider error ${res.status}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(text);
      return {
        tier: parsed.tier,
        reason: parsed.reason ?? "LLM-classified",
        confidence: "low",
      } as Classification;
    } catch {
      return { tier: "Unsupported", reason: "LLM returned unparseable output", confidence: "low" };
    }
  }
}

/** Minimal Anthropic-compatible provider. */
export class AnthropicProvider implements ClassificationLLMProvider {
  name = "anthropic";
  constructor(private endpoint = "https://api.anthropic.com") {}

  async classify(
    repoTree: string[],
    readme: string | null,
    apiKey: string,
  ): Promise<Classification> {
    const res = await fetch(`${this.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Classify this repo into one of Tier 1/Tier 2/Tier 3/Tier 4/Unsupported. Reply ONLY with JSON {tier, reason}. Files:\n${repoTree
              .slice(0, 200)
              .join("\n")}\nREADME:\n${readme?.slice(0, 4000) ?? "(none)"}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM provider error ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "{}";
    try {
      const parsed = JSON.parse(text);
      return {
        tier: parsed.tier,
        reason: parsed.reason ?? "LLM-classified",
        confidence: "low",
      } as Classification;
    } catch {
      return { tier: "Unsupported", reason: "LLM returned unparseable output", confidence: "low" };
    }
  }
}

export const LLM_PROVIDERS: Record<string, () => ClassificationLLMProvider> = {
  "openai-compatible": () => new OpenAICompatProvider(),
  anthropic: () => new AnthropicProvider(),
};
