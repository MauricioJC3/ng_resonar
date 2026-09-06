import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser, UserSummary } from "../types";

vi.mock("../api", async () => {
  const actual =
    await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    listUsers: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    adminSetPassword: vi.fn(),
  };
});

import { adminSetPassword, createUser, deleteUser, listUsers } from "../api";
import UsersAdminView from "./UsersAdminView";

const admin: AuthUser = {
  id: 1,
  username: "root",
  role: "superadmin",
  mustChangePassword: false,
};
const plainUser: AuthUser = { ...admin, id: 3, username: "alice", role: "user" };

const bob: UserSummary = {
  id: 2,
  username: "bob",
  role: "user",
  mustChangePassword: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listUsers).mockResolvedValue([]);
  vi.mocked(createUser).mockResolvedValue({ ...bob, username: "carol" });
  vi.mocked(deleteUser).mockResolvedValue({ ok: true });
  vi.mocked(adminSetPassword).mockResolvedValue({ ok: true });
});

describe("UsersAdminView", () => {
  it("renders nothing for a non-superadmin and never fetches the list", () => {
    const { container } = render(<UsersAdminView user={plainUser} />);
    expect(container).toBeEmptyDOMElement();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("creates a user through createUser()", async () => {
    render(<UsersAdminView user={admin} />);
    await waitFor(() => expect(listUsers).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Nombre de usuario"), {
      target: { value: "carol" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Contraseña temporal (mín. 12)"),
      { target: { value: "carol-temp-pass-1" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith("carol", "carol-temp-pass-1"),
    );
  });

  it("deletes a user through deleteUser() after confirmation", async () => {
    vi.mocked(listUsers).mockResolvedValue([bob]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<UsersAdminView user={admin} />);
    await screen.findByText("bob");

    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(2));
  });

  it("sets a user's password through adminSetPassword()", async () => {
    vi.mocked(listUsers).mockResolvedValue([bob]);
    vi.spyOn(window, "prompt").mockReturnValue("bob-new-pass-123456");

    render(<UsersAdminView user={admin} />);
    await screen.findByText("bob");

    fireEvent.click(
      screen.getByRole("button", { name: /cambiar contraseña/i }),
    );

    await waitFor(() =>
      expect(adminSetPassword).toHaveBeenCalledWith(2, "bob-new-pass-123456"),
    );
  });
});
