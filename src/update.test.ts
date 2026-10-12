import { describe, expect, it } from "vite-plus/test";
import { updateLabel } from "./update";

describe("updateLabel", () => {
  it("says what the status bar button will do", () => {
    expect(updateLabel("0.5.0", "available")).toBe("Update to 0.5.0");
    expect(updateLabel("0.5.0", "downloading")).toBe("Downloading 0.5.0…");
    expect(updateLabel("0.5.0", "restarting")).toBe("Restarting…");
  });
});
