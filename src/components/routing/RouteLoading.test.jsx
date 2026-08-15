import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteLoading } from "./RouteLoading";

describe("RouteLoading", () => {
  it("renders a loading indicator, announced to assistive tech", () => {
    render(<RouteLoading />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  // Design-refinement pass: this is the single Suspense fallback for every
  // route -- public (light) and authenticated (dark) alike -- so it can't
  // know which theme is coming next. It deliberately biases dark: most
  // navigations happen inside the dark authenticated app.
  it("renders on the dark theme, not the light default", () => {
    const { container } = render(<RouteLoading />);
    expect(container.firstChild).toHaveAttribute("data-theme", "dark");
  });
});
