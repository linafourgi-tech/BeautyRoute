import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientPortal from "./ClientPortal";

describe("ClientPortal page", () => {
  it("renders a visible 'Prototype' notice naming exactly what's simulated -- this page is still mock-data-backed", () => {
    render(<ClientPortal />);
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    expect(
      screen.getByText("AI analysis and booking are currently simulated and are not yet connected to live backend services.")
    ).toBeInTheDocument();
  });

  it("renders without crashing on the placeholder client identity", () => {
    render(<ClientPortal />);
    // The mocked "logged in" client's first name, from data/mockData.js.
    expect(screen.getByText(/Nour/)).toBeInTheDocument();
  });
});
