import type {
  LighthouseInterpretationSkillOutput,
  LighthouseProfiles,
} from "@/lib/shared/scans";

function scoreBandId(score: number) {
  if (score === 100) {
    return "score-100";
  }

  const min = Math.floor(score / 5) * 5;
  const max = Math.min(99, min + 4);
  return `score-${String(min).padStart(2, "0")}${String(max).padStart(2, "0")}`;
}

function pickScores(profiles: LighthouseProfiles, key: "performance" | "accessibility" | "bestPractices" | "seo") {
  return [profiles.mobile, profiles.desktop]
    .map((profile) => profile?.snapshot[key] ?? null)
    .filter((value): value is number => typeof value === "number");
}

function summarizeSpread(label: string, values: number[]) {
  if (values.length === 0) {
    return `${label} score unavailable.`;
  }

  const [first, second] = values;
  if (typeof second !== "number") {
    return `${label} score ${first}.`;
  }

  return `${label} score ${first} mobile / ${second} desktop.`;
}

export async function runLighthouseInterpretationSkill(score: number, profiles: LighthouseProfiles) {
  const performance = pickScores(profiles, "performance");
  const accessibility = pickScores(profiles, "accessibility");
  const seo = pickScores(profiles, "seo");

  const output: LighthouseInterpretationSkillOutput = {
    scoreBandId: scoreBandId(score),
    severity: score < 25 ? "EXTREME" : score < 50 ? "HIGH" : score < 75 ? "MEDIUM" : "LOW",
    summary:
      score < 50
        ? "Lighthouse shows enough friction to hurt first impression and conversion trust."
        : score < 75
          ? "Site is serviceable, but mobile and desktop still leave conversion upside on speed and polish."
          : "Baseline technical quality is solid enough to shift attention toward copy precision and proof timing.",
    conversionRisk:
      score < 50
        ? "Visitors may bounce before they trust offer."
        : score < 75
          ? "Visitors likely stay, but friction still softens confidence."
          : "Risk moderate to low, but proof and clarity still decide conversion.",
    topPerformanceNarratives: [
      summarizeSpread("Performance", performance),
      summarizeSpread("Accessibility", accessibility),
      summarizeSpread("SEO", seo),
    ],
    quickFixIdeas: [
      "Reduce first-screen friction before asking for commitment.",
      "Ship stronger proof near CTA so speed gains support trust.",
      "Fix mobile pain first when mobile trails desktop.",
    ],
  };

  return {
    output,
    promptText: JSON.stringify(output),
  };
}
