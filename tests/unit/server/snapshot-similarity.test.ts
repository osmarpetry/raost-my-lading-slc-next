/* @vitest-environment node */

import { computeTextSimilarity, levenshteinDistance } from "@/lib/server/snapshot-similarity";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello world", "hello world")).toBe(0);
  });

  it("returns length of longer string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("counts single character substitutions", () => {
    expect(levenshteinDistance("kitten", "sitten")).toBe(1);
  });

  it("counts insertions and deletions", () => {
    expect(levenshteinDistance("sitting", "kitten")).toBe(3);
  });
});

describe("computeTextSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(computeTextSimilarity("same text", "same text")).toBe(1);
  });

  it("returns 0 when one string is empty and the other is not", () => {
    expect(computeTextSimilarity("", "something")).toBe(0);
    expect(computeTextSimilarity("something", "")).toBe(0);
  });

  it("returns 1 when both strings are empty", () => {
    expect(computeTextSimilarity("", "")).toBe(1);
  });

  it("returns high similarity for nearly identical texts", () => {
    const a = "Build better landing pages with clarity and proof.";
    const b = "Build better landing pages with clarity and trust.";
    const similarity = computeTextSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.9);
  });

  it("returns around 0.8 for texts with ~20% divergence", () => {
    const a = "Transform your workflow with our SaaS platform. Trusted by 10,000+ teams worldwide.";
    const b = "Transform your workflow with our SaaS platform. Trusted by 500+ companies globally.";
    const similarity = computeTextSimilarity(a, b);
    expect(similarity).toBeGreaterThanOrEqual(0.75);
    expect(similarity).toBeLessThan(0.95);
  });

  it("returns low similarity for completely different texts", () => {
    const a = "Cybersecurity talent network for hiring vetted experts.";
    const b = "Organic vegan meal kits delivered to your door weekly.";
    const similarity = computeTextSimilarity(a, b);
    expect(similarity).toBeLessThan(0.5);
  });

  it("matches the 80% threshold behavior for canonical summaries", () => {
    const original = "Hero: Build better pages\nCTA: Start now\nProof: Trusted by teams\nPages: https://example.com/ title=Example h1=Example heading cta=Start now snippet=Build better pages fast.";
    const slightlyChanged = "Hero: Build better pages\nCTA: Start now\nProof: Trusted by companies\nPages: https://example.com/ title=Example h1=Example heading cta=Start now snippet=Build better pages fast.";
    const drasticallyChanged = "Hero: Hire cyber talent\nCTA: Apply today\nProof: Vetted professionals\nPages: https://cyberr.ai/ title=Cyberr h1=Cyber network cta=Join snippet=Cyber security talent network.";

    expect(computeTextSimilarity(original, slightlyChanged)).toBeGreaterThanOrEqual(0.8);
    expect(computeTextSimilarity(original, drasticallyChanged)).toBeLessThan(0.8);
  });
});
