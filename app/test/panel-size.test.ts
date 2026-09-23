import { describe, expect, it } from "vitest";
import {
  clampPanelSize,
  MIN_PANEL_HEIGHT,
  MIN_SIDE_WIDTH,
} from "../src/renderer/hooks/panel-size";

describe("clampPanelSize", () => {
  const bounds = { width: 1000, height: 800 };

  it("never shrinks a panel below its minimum, even from a collapsed size", () => {
    expect(clampPanelSize("left", 40, bounds)).toBe(MIN_SIDE_WIDTH);
    expect(clampPanelSize("bottom", 10, bounds)).toBe(MIN_PANEL_HEIGHT);
  });

  it("reserves the minimum view width and top height", () => {
    expect(clampPanelSize("left", 900, bounds)).toBe(680);
    expect(clampPanelSize("bottom", 700, bounds)).toBe(560);
  });

  it("keeps the minimum even when the window is smaller than the reserve", () => {
    const tiny = { width: 200, height: 100 };
    expect(clampPanelSize("left", 150, tiny)).toBe(MIN_SIDE_WIDTH);
    expect(clampPanelSize("bottom", 90, tiny)).toBe(MIN_PANEL_HEIGHT);
  });

  it("passes sizes inside the bounds through", () => {
    expect(clampPanelSize("left", 240, bounds)).toBe(240);
    expect(clampPanelSize("bottom", 200, bounds)).toBe(200);
  });
});
