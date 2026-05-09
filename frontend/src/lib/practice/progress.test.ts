import { describe, expect, it } from "vitest";
import { completeLesson, computeUpdatedStreak, INITIAL_PROGRESS, isLessonUnlocked, recordLetterSuccess } from "./progress";

describe("progress", () => {
  it("increments streak on consecutive practice days", () => {
    expect(computeUpdatedStreak("2026-05-02", "2026-05-03", 4)).toBe(5);
  });

  it("resets streak after a missed day", () => {
    expect(computeUpdatedStreak("2026-04-30", "2026-05-03", 4)).toBe(1);
  });

  it("records XP, completed letters, and recent stats on success", () => {
    const updated = recordLetterSuccess(INITIAL_PROGRESS, {
      letter: "A",
      xpDelta: 10,
      today: "2026-05-03",
      lessonId: "abc",
      accuracy: 96,
    });

    expect(updated.xp).toBe(10);
    expect(updated.streak).toBe(1);
    expect(updated.completedLetters).toContain("A");
    expect(updated.recentSessionStats[0]?.lessonId).toBe("abc");
  });

  it("unlocks lessons only after their prerequisite is complete", () => {
    expect(isLessonUnlocked(INITIAL_PROGRESS, null)).toBe(true);
    expect(isLessonUnlocked(INITIAL_PROGRESS, "abc")).toBe(false);
    expect(isLessonUnlocked(completeLesson(INITIAL_PROGRESS, "abc"), "abc")).toBe(true);
  });
});
