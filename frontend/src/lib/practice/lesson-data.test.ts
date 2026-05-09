import { describe, expect, it } from "vitest";
import { ALL_REFERENCE_LETTERS, getLessonById, isDetectableLetter, isGuidedOnlyLetter, LESSONS } from "./lesson-data";

describe("lesson-data", () => {
  it("covers the full A-Z reference alphabet", () => {
    expect(ALL_REFERENCE_LETTERS).toHaveLength(26);
    expect(ALL_REFERENCE_LETTERS[0]).toBe("A");
    expect(ALL_REFERENCE_LETTERS[25]).toBe("Z");
  });

  it("marks J and Z as guided-only letters", () => {
    expect(isGuidedOnlyLetter("J")).toBe(true);
    expect(isGuidedOnlyLetter("Z")).toBe(true);
    expect(isGuidedOnlyLetter("A")).toBe(false);
  });

  it("exposes lesson metadata with detection support", () => {
    const lesson = getLessonById("jkl");
    expect(lesson).toBeDefined();
    expect(lesson?.guidedOnly).toEqual(["J"]);
    expect(lesson?.supportsDetection).toEqual(["K", "L"]);
    expect(LESSONS).toHaveLength(9);
  });

  it("keeps Y detectable while Z remains guided", () => {
    expect(isDetectableLetter("Y")).toBe(true);
    expect(isDetectableLetter("Z")).toBe(false);
  });
});
