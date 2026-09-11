import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    getSettings: vi.fn(() => new Promise(() => {})), // never resolves — keep the loading render
  };
});

import { reset as resetSettings } from "../state/settings";
import SettingsView from "./SettingsView";

beforeEach(() => {
  resetSettings();
  // SettingsView reads the system theme preference on mount; jsdom has no
  // real matchMedia implementation.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
});

describe("SettingsView quick links", () => {
  it("jumps to Videos and Historial via onNavigate", () => {
    const onNavigate = vi.fn();
    render(
      <SettingsView user={null} onLogout={vi.fn()} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /videos/i }));
    expect(onNavigate).toHaveBeenCalledWith("videos");

    fireEvent.click(screen.getByRole("button", { name: /historial/i }));
    expect(onNavigate).toHaveBeenCalledWith("history");
  });
});
