export interface LessonDefinition {
  id: string;
  title: string;
  letters: string[];
  unlockAfter: string | null;
  supportsDetection: string[];
  guidedOnly: string[];
}

export const GUIDED_ONLY_LETTERS = ["J", "Z"] as const;
export const DETECTABLE_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
] as const;

export const ALL_REFERENCE_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export const LESSONS: LessonDefinition[] = [
  { id: "abc", title: "ABC", letters: ["A", "B", "C"], unlockAfter: null, supportsDetection: ["A", "B", "C"], guidedOnly: [] },
  { id: "def", title: "DEF", letters: ["D", "E", "F"], unlockAfter: "abc", supportsDetection: ["D", "E", "F"], guidedOnly: [] },
  { id: "ghi", title: "GHI", letters: ["G", "H", "I"], unlockAfter: "def", supportsDetection: ["G", "H", "I"], guidedOnly: [] },
  { id: "jkl", title: "JKL", letters: ["J", "K", "L"], unlockAfter: "ghi", supportsDetection: ["K", "L"], guidedOnly: ["J"] },
  { id: "mno", title: "MNO", letters: ["M", "N", "O"], unlockAfter: "jkl", supportsDetection: ["M", "N", "O"], guidedOnly: [] },
  { id: "pqr", title: "PQR", letters: ["P", "Q", "R"], unlockAfter: "mno", supportsDetection: ["P", "Q", "R"], guidedOnly: [] },
  { id: "stu", title: "STU", letters: ["S", "T", "U"], unlockAfter: "pqr", supportsDetection: ["S", "T", "U"], guidedOnly: [] },
  { id: "vwx", title: "VWX", letters: ["V", "W", "X"], unlockAfter: "stu", supportsDetection: ["V", "W", "X"], guidedOnly: [] },
  { id: "yz", title: "YZ", letters: ["Y", "Z"], unlockAfter: "vwx", supportsDetection: ["Y"], guidedOnly: ["Z"] },
] as const;

export function getLessonById(lessonId: string): LessonDefinition | undefined {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

export function isGuidedOnlyLetter(letter: string): boolean {
  return GUIDED_ONLY_LETTERS.includes(letter as (typeof GUIDED_ONLY_LETTERS)[number]);
}

export function isDetectableLetter(letter: string): boolean {
  return DETECTABLE_LETTERS.includes(letter as (typeof DETECTABLE_LETTERS)[number]);
}
