import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "./types";

vi.mock("./api", () => ({
  SESSION_EXPIRED_EVENT: "resonar:session-expired",
  me: vi.fn(),
  logout: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("./state/reset", () => ({ resetStores: vi.fn() }));
vi.mock("./AuthedApp", () => ({
  default: () => <div data-testid="authed-app" />,
}));
vi.mock("./components/LoginView", () => ({
  default: () => <div data-testid="login-view" />,
}));
vi.mock("./components/BootstrapForm", () => ({
  default: () => <div data-testid="bootstrap-form" />,
}));
vi.mock("./components/ChangePasswordView", () => ({
  default: ({ forced }: { forced?: boolean }) => (
    <div data-testid="change-password" data-forced={String(!!forced)} />
  ),
}));

import { me } from "./api";
import App from "./App";
import { resetStores } from "./state/reset";

const user = (mustChangePassword: boolean): AuthUser => ({
  id: 1,
  username: "admin",
  role: "superadmin",
  mustChangePassword,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("App auth gate", () => {
  it("renders the authed app for an authenticated user", async () => {
    vi.mocked(me).mockResolvedValue({ authenticated: true, user: user(false) });
    render(<App />);
    await screen.findByTestId("authed-app");
  });

  it("routes a must_change_password user to the forced change-password view", async () => {
    vi.mocked(me).mockResolvedValue({ authenticated: true, user: user(true) });
    render(<App />);
    const el = await screen.findByTestId("change-password");
    expect(el.dataset.forced).toBe("true");
  });

  it("shows the bootstrap form when bootstrap is available", async () => {
    vi.mocked(me).mockResolvedValue({
      authenticated: false,
      bootstrapAvailable: true,
    });
    render(<App />);
    await screen.findByTestId("bootstrap-form");
  });

  it("shows the login view when unauthenticated and bootstrap is closed", async () => {
    vi.mocked(me).mockResolvedValue({
      authenticated: false,
      bootstrapAvailable: false,
    });
    render(<App />);
    await screen.findByTestId("login-view");
  });

  it("returns to login and resets stores on resonar:session-expired", async () => {
    vi.mocked(me).mockResolvedValue({ authenticated: true, user: user(false) });
    render(<App />);
    await screen.findByTestId("authed-app");

    await act(async () => {
      window.dispatchEvent(new CustomEvent("resonar:session-expired"));
    });

    await screen.findByTestId("login-view");
    expect(resetStores).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last signed-in user when offline (no network reaches the server)", async () => {
    // A previous online session cached this device's last user...
    localStorage.setItem("resonar:lastUser", JSON.stringify(user(false)));
    // ...and now the cold-start /auth/me can't even reach the server: a raw
    // fetch failure has no `.status`, unlike a real HTTP error response.
    vi.mocked(me).mockRejectedValue(new TypeError("Failed to fetch"));

    render(<App />);
    await screen.findByTestId("authed-app");
  });

  it("still shows the login gate when offline with nothing cached for this device", async () => {
    vi.mocked(me).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<App />);
    await screen.findByTestId("login-view");
  });

  it("does not use the offline fallback for a real server error", async () => {
    localStorage.setItem("resonar:lastUser", JSON.stringify(user(false)));
    const serverError = new Error("500 boom") as Error & { status: number };
    serverError.status = 500;
    vi.mocked(me).mockRejectedValue(serverError);

    render(<App />);
    await screen.findByTestId("login-view");
  });

  it("clears the cached user on a real session-expired so a later offline cold start can't reuse a dead session", async () => {
    vi.mocked(me).mockResolvedValue({ authenticated: true, user: user(false) });
    render(<App />);
    await screen.findByTestId("authed-app");

    expect(localStorage.getItem("resonar:lastUser")).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent("resonar:session-expired"));
    });
    await screen.findByTestId("login-view");

    expect(localStorage.getItem("resonar:lastUser")).toBeNull();
  });
});
