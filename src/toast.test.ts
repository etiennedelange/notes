import { describe, expect, it } from "vitest";
import { toastDuration } from "./toast";

describe("toastDuration", () => {
  it("auto-dismisses info toasts after a few seconds", () => {
    expect(toastDuration("info")).toBe(3200);
  });

  it("keeps error toasts on screen until the user dismisses them", () => {
    expect(toastDuration("error")).toBeNull();
  });
});
