/* @vitest-environment node */

import { normalizeAndValidateUrl } from "@/server/url-validation";

describe("normalizeAndValidateUrl", () => {
  it("rejects malformed URLs", async () => {
    await expect(normalizeAndValidateUrl("not-a-url")).rejects.toThrow(
      "that does not look like a valid absolute URL",
    );
  });

  it("rejects private and metadata IPs", async () => {
    await expect(normalizeAndValidateUrl("http://127.0.0.1")).rejects.toThrow(
      "private, loopback, and metadata hosts are blocked",
    );
    await expect(normalizeAndValidateUrl("http://169.254.169.254")).rejects.toThrow(
      "private, loopback, and metadata hosts are blocked",
    );
  });

  it("rejects unsafe ports", async () => {
    await expect(normalizeAndValidateUrl("https://example.com:22")).rejects.toThrow(
      "only public web ports are allowed",
    );
  });
});
