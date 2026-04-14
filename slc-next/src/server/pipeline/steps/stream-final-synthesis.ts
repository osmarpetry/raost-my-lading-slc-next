import type {
  LighthouseInterpretationSkillOutput,
  OpenAiProviderStatus,
  PromptPack,
  SemanticSnapshot,
  SiteUnderstandingSkillOutput,
} from "@/lib/shared/scans";
import { buildFinalRoastPayload, buildMergedPrompt } from "@/server/pipeline/prompts/build-merged-prompt";
import { streamOllamaText } from "@/server/ollama";
import { OpenAiProviderError, streamOpenAiText } from "@/server/providers/openai/client";
import { getServerEnv } from "@/server/config/env";

type StreamTextFn = (options: {
  system: string;
  prompt: string;
  onText: (chunk: string) => Promise<void> | void;
}) => Promise<{
  text: string;
  status: OpenAiProviderStatus;
}>;

export async function streamFinalSynthesis({
  snapshotHash,
  promptPack,
  snapshot,
  siteUnderstanding,
  lighthouseInterpretation,
  onText,
  streamText = streamOpenAiText as StreamTextFn,
}: {
  snapshotHash: string;
  promptPack: PromptPack;
  snapshot: SemanticSnapshot;
  siteUnderstanding: SiteUnderstandingSkillOutput;
  lighthouseInterpretation: LighthouseInterpretationSkillOutput;
  onText: (chunk: string) => Promise<void> | void;
  streamText?: StreamTextFn;
}) {
  const mergedPrompt = buildMergedPrompt({
    promptPack,
    snapshot,
    siteUnderstanding,
    lighthouseInterpretation,
  });

  try {
    const { text, status } = await streamText({
      system:
        "You are Roast My Landing final reviewer. Write polished editorial prose. No JSON. No markdown bullets. End final paragraph with tl;dr:",
      prompt: mergedPrompt,
      onText,
    });

    const payload = buildFinalRoastPayload({
      snapshotHash,
      promptPackId: promptPack.id,
      siteUnderstanding,
      lighthouseInterpretation,
      finalText: text,
    });

    return {
      payload,
      mergedPrompt,
      status,
      finalText: payload.finalText,
    };
  } catch (error) {
    if (error instanceof OpenAiProviderError && error.status.source === "disabled") {
      const env = getServerEnv();
      const ollamaText = await streamOllamaText({
        prompt: mergedPrompt,
        fallback:
          "Your landing page has a clear offer, but the hero could be sharper and the proof could appear earlier. tl;dr: tighten headline and bring trust cues higher.",
        onText,
      });

      const payload = buildFinalRoastPayload({
        snapshotHash,
        promptPackId: promptPack.id,
        siteUnderstanding,
        lighthouseInterpretation,
        finalText: ollamaText,
      });

      return {
        payload,
        mergedPrompt,
        status: {
          provider: "openai",
          source: "disabled",
          reason: "OPENAI_API_KEY missing — using Ollama fallback",
          model: env.openai.model,
          latencyMs: null,
        } satisfies OpenAiProviderStatus,
        finalText: payload.finalText,
      };
    }

    if (error instanceof OpenAiProviderError) {
      throw error;
    }

    throw error instanceof Error ? error : new Error("OpenAI final synthesis failed");
  }
}
