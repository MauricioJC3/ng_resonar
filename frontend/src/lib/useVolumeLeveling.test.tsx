import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVolumeLeveling } from "./useVolumeLeveling";

const LEVEL_KEY = "resonar:level";

// jsdom has no Web Audio implementation, so we stand in a minimal fake that
// tracks connect()/disconnect() calls — enough to assert the graph is wired
// (and unwired) the way the hook expects, without asserting on real audio.
class FakeNode {
  connections: FakeNode[] = [];
  connect = vi.fn((target: FakeNode) => {
    this.connections.push(target);
  });
  disconnect = vi.fn(() => {
    this.connections = [];
  });
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  destination = new FakeNode();
  resume = vi.fn();
  close = vi.fn();
  createMediaElementSource = vi.fn(() => new FakeNode());
  createDynamicsCompressor = vi.fn(() => {
    const n = new FakeNode() as FakeNode & {
      threshold: { value: number };
      knee: { value: number };
      ratio: { value: number };
      attack: { value: number };
      release: { value: number };
    };
    n.threshold = { value: 0 };
    n.knee = { value: 0 };
    n.ratio = { value: 0 };
    n.attack = { value: 0 };
    n.release = { value: 0 };
    return n;
  });
  createGain = vi.fn(() => {
    const n = new FakeNode() as FakeNode & { gain: { value: number } };
    n.gain = { value: 0 };
    return n;
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

function audioElementRef() {
  return { current: document.createElement("audio") };
}

beforeEach(() => {
  localStorage.clear();
  FakeAudioContext.instances = [];
  (window as unknown as { AudioContext: unknown }).AudioContext =
    FakeAudioContext;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe("useVolumeLeveling", () => {
  it("reflects the persisted preference on mount", () => {
    localStorage.setItem(LEVEL_KEY, "1");
    const { result } = renderHook(() => useVolumeLeveling(audioElementRef()));
    expect(result.current.leveled).toBe(true);
  });

  it("defaults to off when nothing is persisted", () => {
    const { result } = renderHook(() => useVolumeLeveling(audioElementRef()));
    expect(result.current.leveled).toBe(false);
  });

  it("does not build the AudioContext until turned on", () => {
    // Creating a MediaElementAudioSourceNode permanently claims the <audio>
    // element for that context, so the hook must never do this eagerly on
    // mount — only lazily, the first time leveling is switched on.
    renderHook(() => useVolumeLeveling(audioElementRef()));
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("turning it on persists the preference and routes through the compressor/gain chain", () => {
    const ref = audioElementRef();
    const { result } = renderHook(() => useVolumeLeveling(ref));

    act(() => result.current.toggleLevel());

    expect(result.current.leveled).toBe(true);
    expect(localStorage.getItem(LEVEL_KEY)).toBe("1");

    const ctx = FakeAudioContext.instances[0];
    const src = ctx.createMediaElementSource.mock.results[0].value as FakeNode;
    const comp = ctx.createDynamicsCompressor.mock.results[0]
      .value as FakeNode;
    const gain = ctx.createGain.mock.results[0].value as FakeNode;

    expect(src.connections).toEqual([comp]);
    expect(comp.connections).toEqual([gain]);
    expect(gain.connections).toEqual([ctx.destination]);
  });

  it("turning it off routes the source straight to the destination", () => {
    const ref = audioElementRef();
    const { result } = renderHook(() => useVolumeLeveling(ref));

    act(() => result.current.toggleLevel()); // on
    act(() => result.current.toggleLevel()); // off

    expect(result.current.leveled).toBe(false);
    expect(localStorage.getItem(LEVEL_KEY)).toBe("0");

    const ctx = FakeAudioContext.instances[0];
    const src = ctx.createMediaElementSource.mock.results[0].value as FakeNode;
    const comp = ctx.createDynamicsCompressor.mock.results[0]
      .value as FakeNode;
    const gain = ctx.createGain.mock.results[0].value as FakeNode;

    // Everything is disconnected first, then the source reconnects directly.
    expect(comp.disconnect).toHaveBeenCalled();
    expect(gain.disconnect).toHaveBeenCalled();
    expect(src.connections).toEqual([ctx.destination]);
  });

  it("resume() and close() proxy to the underlying AudioContext once built", () => {
    const ref = audioElementRef();
    const { result } = renderHook(() => useVolumeLeveling(ref));

    act(() => result.current.toggleLevel()); // builds the graph (calls resume once)
    const ctx = FakeAudioContext.instances[0];

    act(() => result.current.resume());
    act(() => result.current.close());

    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
  });

  it("resume() and close() are safe no-ops before the graph is ever built", () => {
    const { result } = renderHook(() => useVolumeLeveling(audioElementRef()));
    expect(() => result.current.resume()).not.toThrow();
    expect(() => result.current.close()).not.toThrow();
  });
});
