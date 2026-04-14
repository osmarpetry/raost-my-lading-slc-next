import type {
  LighthouseProfiles,
  SemanticSnapshot,
  SiteType,
  SiteUnderstandingSkillOutput,
} from "@/lib/shared/scans";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferSiteType(snapshot: SemanticSnapshot): SiteType {
  const haystack = snapshot.canonicalText.toLowerCase();

  if (/\bportfolio\b|\bgithub\b|\bresume\b|\bcv\b|\bfrontend engineer\b|\bfull-stack\b/.test(haystack)) {
    return "PORTFOLIO";
  }

  if (/\bhire\b|\brecruit\b|\bcandidates\b|\btalent\b|\bjob board\b/.test(haystack)) {
    return "RECRUITMENT_PLATFORM";
  }

  if (/\bpricing\b|\btrial\b|\bbook demo\b|\bplatform\b|\bintegrations\b/.test(haystack)) {
    return "SAAS";
  }

  if (/\beducation\b|\blearning\b|\bschool\b|\bkids\b|\bchildren\b|\bstudent\b|\bcurriculum\b|\bacademy\b/.test(haystack)) {
    return "EDUCATION_PLATFORM";
  }

  if (/\bagency\b|\bclient work\b|\bservices\b/.test(haystack)) {
    return "AGENCY";
  }

  if (/\bconsulting\b|\badvisor\b/.test(haystack)) {
    return "CONSULTING";
  }

  if (/\bmarketplace\b|\bvendors\b|\bbuyers\b/.test(haystack)) {
    return "MARKETPLACE";
  }

  if (/\bblog\b|\barticles\b|\bnewsletter\b/.test(haystack)) {
    return "CONTENT";
  }

  return "OTHER";
}

function scoreFromProfiles(
  profiles: LighthouseProfiles,
  pick: (profile: NonNullable<LighthouseProfiles["mobile"]>) => number | null | undefined,
  fallback: number,
) {
  const values = [profiles.mobile, profiles.desktop]
    .map((profile) => (profile ? pick(profile) : null))
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return fallback;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function runSiteUnderstandingSkill(
  snapshot: SemanticSnapshot,
  lighthouseProfiles: LighthouseProfiles,
) {
  const homepage = snapshot.selectedPages[0];
  const siteType = inferSiteType(snapshot);
  const title = homepage?.title ?? "Site";
  const hero = snapshot.hero ?? title;
  const trustBase = scoreFromProfiles(lighthouseProfiles, (profile) => profile.snapshot.accessibility, 70);
  const seoBase = scoreFromProfiles(lighthouseProfiles, (profile) => profile.snapshot.seo, 68);
  const clarityBase = hero.length > 24 ? 72 : 60;
  const homepageFailure = homepage && !homepage.ok ? `Homepage returns HTTP ${homepage.statusCode}.` : null;
  const primaryOffer =
    homepageFailure
      ? "A working landing page response"
      : siteType === "PORTFOLIO"
        ? "Technical credibility and hiring trust"
        : siteType === "RECRUITMENT_PLATFORM"
          ? "Specialized hiring platform and recruitment trust"
          : siteType === "SAAS"
            ? "Software product value proposition"
            : siteType === "EDUCATION_PLATFORM"
              ? "Children's learning platform and educational trust"
              : "Current site offer";
  const targetAudience =
    homepageFailure
      ? ["visitors hitting a broken page"]
      : siteType === "PORTFOLIO"
        ? ["hiring managers", "founders", "recruiters"]
        : siteType === "RECRUITMENT_PLATFORM"
          ? ["recruiters", "hiring managers", "security leaders"]
          : siteType === "EDUCATION_PLATFORM"
            ? ["parents", "teachers", "young learners"]
            : ["buyers", "visitors"];
  const quickWins =
    homepageFailure
      ? [
          "Restore valid HTML response at target URL.",
          "Return users to a usable landing page before tuning copy.",
          "Verify redirects and deploy path match public URL.",
        ]
      : siteType === "PORTFOLIO"
        ? [
            "Add 2 compact case-study cards with outcome and proof link.",
            "Add proof strip near hero with companies, metrics, or shipped work.",
            "Clarify hiring CTA with exact engagement type.",
          ]
        : siteType === "RECRUITMENT_PLATFORM"
          ? [
              "Add buyer proof near CTA with hiring outcomes and case snapshots.",
              "Add compare block against generic alternatives.",
              "Add trust quotes from real recruiters or customers.",
            ]
          : siteType === "EDUCATION_PLATFORM"
            ? [
                "Make the learning outcome promise visible above the fold with age groups and subjects.",
                "Add parent trust signals near the download CTA: awards, educator endorsements, or privacy certifications.",
                "Show a short demo preview or screenshot gallery so visitors see the experience before installing.",
              ]
            : [
              "Move strongest proof closer to first CTA.",
              "Clarify main promise in first visible section.",
              "Trim generic copy and add concrete examples.",
            ];

  const output: SiteUnderstandingSkillOutput = {
    siteType,
    primaryOffer,
    secondaryOffers: [],
    targetAudience,
    userIntent: "convert visitors without changing current business scope",
    brandVoice: "direct editorial",
    coreTopics: snapshot.selectedPages.flatMap((entry) => entry.headings).slice(0, 6),
    evidencePresent: snapshot.selectedPages.flatMap((entry) => entry.proofBlocks).slice(0, 4),
    evidenceMissing: homepageFailure
      ? ["working page response", "usable landing experience", "valid render at submitted URL"]
      : ["clear proof near CTA", "more explicit outcomes", "more direct trust support"],
    likelyConversionGoal:
      siteType === "RECRUITMENT_PLATFORM"
        ? "START_TRIAL"
        : siteType === "PORTFOLIO"
          ? "CONTACT"
          : siteType === "EDUCATION_PLATFORM"
            ? "SIGN_UP"
            : "OTHER",
    businessUnderstandingScore: clampScore(seoBase + 10),
    clarityScore: clampScore(clarityBase),
    trustScore: clampScore(trustBase),
    seoMessageFitScore: clampScore(seoBase),
    compliments: homepageFailure
      ? [
          "Submitted URL resolves and can be diagnosed.",
          "Failure is visible early, which makes root-cause easier to fix.",
          "Once page is restored, scan can analyze real conversion issues.",
        ]
      : [
          "Site already communicates real work instead of empty hype.",
          "Offer feels grounded in actual expertise.",
          "Current copy gives enough signal to tighten proof instead of rewriting everything.",
        ],
    priorityFixes: homepageFailure
      ? [
          `Restore valid landing page response instead of HTTP ${homepage?.statusCode}.`,
          "Make target URL return usable HTML before conversion tuning.",
          "Only optimize copy and proof after operational breakage is fixed.",
        ]
      : [
          "Make main promise easier to understand in first screen.",
          "Move stronger proof closer to CTA.",
          "Replace generic statements with sharper evidence and outcomes.",
        ],
    quickWins0to3Days: quickWins.slice(0, 3),
    summary: homepageFailure
      ? `${homepageFailure} Landing review should start with restoring a usable page.`
      : `${title} appears to be a ${siteType.toLowerCase().replaceAll("_", " ")} focused on ${primaryOffer.toLowerCase()}.`,
    confidence: homepageFailure ? 0.92 : 0.76,
    lowConfidence: false,
  };

  return {
    output,
    promptText: JSON.stringify(output),
  };
}
