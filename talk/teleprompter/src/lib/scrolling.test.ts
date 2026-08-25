import { describe, expect, it } from "vitest";
import { clamp, computePixelsPerSecond, estimateProgressPercent } from "./scrolling";

describe("scrolling helpers", () => {
  it("clamps values to a range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("computes timed scrolling speed from a target duration", () => {
    expect(computePixelsPerSecond(1800, 30, 1)).toBe(1);
    expect(computePixelsPerSecond(1800, 30, 1.5)).toBe(1.5);
  });

  it("estimates document progress from scroll geometry", () => {
    expect(estimateProgressPercent(0, 2000, 1000)).toBe(0);
    expect(estimateProgressPercent(500, 2000, 1000)).toBe(50);
    expect(estimateProgressPercent(1400, 2000, 1000)).toBe(100);
  });
});
