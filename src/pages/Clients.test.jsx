import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// The confirm dialog's own "Delete" button shares its accessible name with
// every row's "Delete" button underneath it -- scope the query to the
// dialog card (identified by its title) to avoid an ambiguous match.
function dialogButton(titleText, buttonName) {
  const dialogCard = screen.getByText(titleText).parentElement;
  return within(dialogCard).getByRole("button", { name: buttonName });
}

const useCurrentWorkspaceMock = vi.fn();
const getClientsMock = vi.fn();
const createClientMock = vi.fn();
const updateClientMock = vi.fn();
const deleteClientMock = vi.fn();

vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../services/clients", () => ({
  getClients: (...a) => getClientsMock(...a),
  createClient: (...a) => createClientMock(...a),
  updateClient: (...a) => updateClientMock(...a),
  deleteClient: (...a) => deleteClientMock(...a),
}));

import Clients from "./Clients";

const CLIENTS = [
  { id: "c1", full_name: "Amira Al-Fahad", phone: "+966500000001", email: "amira@example.com", tier: "Gold", internal_notes: "" },
  { id: "c2", full_name: "Bayan Saleh", phone: "+966500000002", email: "bayan@example.com", tier: "Bronze", internal_notes: "" },
];

function renderClients() {
  return render(
    <MemoryRouter>
      <Clients />
    </MemoryRouter>
  );
}

describe("Clients page", () => {
  beforeEach(() => {
    useCurrentWorkspaceMock.mockReset();
    getClientsMock.mockReset();
    createClientMock.mockReset();
    updateClientMock.mockReset();
    deleteClientMock.mockReset();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
  });

  it("shows loading placeholders while fetching, then renders the client list", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    renderClients();

    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(await screen.findByText("Amira Al-Fahad")).toBeInTheDocument();
    expect(screen.getByText("Bayan Saleh")).toBeInTheDocument();
    expect(getClientsMock).toHaveBeenCalledWith("ws-1");
  });

  it("shows an empty state with no clients yet", async () => {
    getClientsMock.mockResolvedValue([]);
    renderClients();
    expect(await screen.findByText("No clients yet")).toBeInTheDocument();
  });

  it("filters the list by name/phone/email as the search box is typed", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("Amira Al-Fahad");

    await user.type(screen.getByPlaceholderText("Search by name, phone, or email"), "bayan");
    expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument();
    expect(screen.getByText("Bayan Saleh")).toBeInTheDocument();
  });

  it("shows a no-match empty state distinct from the no-clients-at-all state", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("Amira Al-Fahad");

    await user.type(screen.getByPlaceholderText("Search by name, phone, or email"), "nobody-like-this");
    expect(screen.getByText("No clients match your search")).toBeInTheDocument();
  });

  it("shows a service-layer error with a retry action instead of the client list", async () => {
    getClientsMock.mockRejectedValue(new Error("Could not reach the clients table."));
    const refresh = vi.fn();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh });
    const user = userEvent.setup();
    renderClients();

    expect(await screen.findByText("Could not reach the clients table.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("creates a new client via the New client dialog", async () => {
    getClientsMock.mockResolvedValue([]);
    createClientMock.mockResolvedValue({ id: "c3", full_name: "Zainab Noor", phone: "", email: "", tier: "Bronze", internal_notes: null });
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("No clients yet");

    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.type(screen.getByLabelText("Full name"), "Zainab Noor");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createClientMock).toHaveBeenCalledWith({
      full_name: "Zainab Noor",
      phone: null,
      email: null,
      tier: "Bronze",
      internal_notes: null,
      workspace_id: "ws-1",
    }));
    expect(await screen.findByText("Zainab Noor")).toBeInTheDocument();
  });

  it("requires a full name before saving a new client", async () => {
    getClientsMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("No clients yet");

    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("edits an existing client and reflects the update in the list", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    updateClientMock.mockResolvedValue({ ...CLIENTS[0], full_name: "Amira Al-Fahad (VIP)" });
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("Amira Al-Fahad");

    const [editButton] = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButton);
    expect(screen.getByDisplayValue("Amira Al-Fahad")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Full name");
    await user.clear(nameInput);
    await user.type(nameInput, "Amira Al-Fahad (VIP)");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Amira Al-Fahad (VIP)")).toBeInTheDocument();
    expect(updateClientMock).toHaveBeenCalledWith("c1", expect.objectContaining({ full_name: "Amira Al-Fahad (VIP)" }));
  });

  it("deletes a client successfully and removes it from the list", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    deleteClientMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("Amira Al-Fahad");

    const [deleteButton] = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButton);
    await user.click(dialogButton("Delete client?", "Delete"));

    await waitFor(() => expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument());
    expect(deleteClientMock).toHaveBeenCalledWith("c1");
  });

  it("shows a specific message when delete is blocked by a foreign-key violation (existing booking history)", async () => {
    getClientsMock.mockResolvedValue(CLIENTS);
    const fkError = Object.assign(new Error("update or delete on table violates foreign key constraint"), { code: "23503" });
    deleteClientMock.mockRejectedValue(fkError);
    const user = userEvent.setup();
    renderClients();
    await screen.findByText("Amira Al-Fahad");

    const [deleteButton] = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButton);
    await user.click(dialogButton("Delete client?", "Delete"));

    expect(await screen.findByText("This client has appointment or visit history and can't be deleted.")).toBeInTheDocument();
    // The client must still be in the list -- the delete did not silently succeed.
    expect(screen.getByText("Amira Al-Fahad")).toBeInTheDocument();
  });
});
