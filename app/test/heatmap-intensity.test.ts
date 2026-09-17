import { describe, expect, it } from "vitest";
import { intensityClass } from "../src/renderer/components/screen/dashboard/heatmap-intensity";

describe("intensityClass", () => {
  it("shades the busiest day the strongest and empty days the weakest", () => {
    expect(intensityClass(0, 10)).toBe("bg-surface-hover");
    expect(intensityClass(10, 10)).toBe("bg-accent");
    expect(intensityClass(5, 10)).toBe("bg-accent/50");
  });

  it("returns the weakest shade when there is nothing to compare against", () => {
    expect(intensityClass(3, 0)).toBe("bg-surface-hover");
  });
});
