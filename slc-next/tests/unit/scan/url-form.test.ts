import { validateTargetUrl } from "@/lib/terminal/format";

describe("scan URL validation", () => {
  it("rejects empty and malformed values", () => {
    expect(validateTargetUrl("")).toEqual({
      ok: false,
      message: "enter a URL before starting the scan",
    });

    expect(validateTargetUrl("not-a-url")).toEqual({
      ok: false,
      message: "that does not look like a valid absolute URL",
    });
  });

  it("accepts absolute http and https URLs", () => {
    expect(validateTargetUrl("https://example.com")).toEqual({
      ok: true,
      url: "https://example.com",
    });
  });
});
