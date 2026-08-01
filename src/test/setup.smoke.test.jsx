// Minimal smoke test for the Phase 15 Step 2 test foundation itself --
// proves Vitest, jsdom, React Testing Library, and the jest-dom matchers
// are wired together correctly. Not a test of any application behavior;
// Step 3+ adds those. Safe to remove once real tests exist and this
// wiring is implicitly exercised by them.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>Hello, BeautyRoute tests</p>;
}

describe("test foundation smoke test", () => {
  it("renders a component and asserts on it via jest-dom", () => {
    render(<Hello />);
    expect(screen.getByText("Hello, BeautyRoute tests")).toBeInTheDocument();
  });
});
