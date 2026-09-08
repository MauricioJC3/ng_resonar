import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, suggest: vi.fn() };
});

import { suggest } from "../api";
import SearchBox from "./SearchBox";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(suggest).mockResolvedValue(["alpha", "beta", "gamma"]);
});

async function openWithSuggestions() {
  const onSubmit = vi.fn();
  render(<SearchBox placeholder="Buscar" onSubmit={onSubmit} />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "a" } });
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
  return { input, onSubmit };
}

describe("SearchBox keyboard navigation", () => {
  it("ArrowDown highlights suggestions and Enter submits the highlighted one", async () => {
    const { input, onSubmit } = await openWithSuggestions();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /beta/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("beta");
  });

  it("ArrowUp from the top wraps to the last suggestion", async () => {
    const { input } = await openWithSuggestions();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: /gamma/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Enter with nothing highlighted submits the typed text", async () => {
    const { input, onSubmit } = await openWithSuggestions();

    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("a");
  });

  it("Escape closes the dropdown", async () => {
    const { input } = await openWithSuggestions();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });
});
