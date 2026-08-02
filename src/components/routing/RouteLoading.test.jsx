import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteLoading } from "./RouteLoading";

describe("RouteLoading", () => {
  it("renders a loading indicator", () => {
    render(<RouteLoading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
