import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UpgradeRequired } from "./UpgradeRequired";

function renderUpgradeRequired() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<UpgradeRequired />} />
        <Route path="/pricing" element={<div>Pricing page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UpgradeRequired", () => {
  it("renders the expired-trial message and an upgrade CTA, with no payment form/workflow implied", () => {
    renderUpgradeRequired();
    expect(screen.getByText("Your trial has ended")).toBeInTheDocument();
    expect(screen.getByText(/your data is safe and waiting for you/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade Now" })).toBeInTheDocument();
    // No card/payment-detail inputs anywhere on this screen -- it only ever
    // routes to /pricing, which itself has no working purchase flow either
    // (see Pricing.test.jsx).
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });

  it("navigates to /pricing when the CTA is clicked", async () => {
    const user = userEvent.setup();
    renderUpgradeRequired();
    await user.click(screen.getByRole("button", { name: "Upgrade Now" }));
    expect(await screen.findByText("Pricing page")).toBeInTheDocument();
  });
});
