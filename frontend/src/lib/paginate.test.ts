import { describe, expect, it } from "vitest";

import { paginate } from "./paginate";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("paginate", () => {
  it("slices a fixed-size page and reports the count", () => {
    const p = paginate(nums(120), 1, 50);
    expect(p.pageCount).toBe(3);
    expect(p.current).toBe(1);
    expect(p.start).toBe(50);
    expect(p.slice).toEqual(nums(100).slice(50));
    expect(p.slice.length).toBe(50);
  });

  it("last page can be short", () => {
    const p = paginate(nums(120), 2, 50);
    expect(p.slice).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
      110, 111, 112, 113, 114, 115, 116, 117, 118, 119]);
  });

  it("clamps an out-of-range page instead of returning nothing", () => {
    expect(paginate(nums(120), 99, 50).current).toBe(2);
    expect(paginate(nums(120), -3, 50).current).toBe(0);
  });

  it("always reports at least one page, even when empty", () => {
    const p = paginate([], 0, 50);
    expect(p.pageCount).toBe(1);
    expect(p.slice).toEqual([]);
  });

  it("does not paginate when everything fits on one page", () => {
    const p = paginate(nums(30), 0, 50);
    expect(p.pageCount).toBe(1);
    expect(p.slice.length).toBe(30);
  });
});
