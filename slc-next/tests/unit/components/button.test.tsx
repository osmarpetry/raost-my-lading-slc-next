import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders semantic token classes correctly", () => {
    render(<Button>Start task</Button>);

    const button = screen.getByRole("button", { name: "Start task" });
    expect(button.className).toContain("bg-accent-brand");
    expect(button.className).toContain("text-text-inverse");
    expect(button.className).toContain("rounded-button");
  });
});
