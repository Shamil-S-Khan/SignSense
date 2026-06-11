export interface LessonDefinition {
  id: string;
  title: string;
  letters: string[];
  unlockAfter: string | null;
  supportsDetection: string[];
  guidedOnly: string[];
  xp: number;
  icon: string;
  difficulty: number;
  isSentence?: boolean;
}

export interface UnitDefinition {
  id: string;
  title: string;
  color: string;
  icon: string;
  lessons: LessonDefinition[];
}

export const GUIDED_ONLY_LETTERS = ["J", "Z"] as const;
export const DETECTABLE_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y"
] as const;

export const ALL_REFERENCE_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
] as const;

// Raw structure of units and lessons (grouped & consolidated)
const RAW_UNITS = [
  {
    id: "unit-1",
    title: "Fingerspelling Foundations",
    color: "#00D4FF", // Neon Cyan
    icon: "✋",
    lessons: [
      { id: "u1-1", title: "Alphabet A-E", letters: ["A", "B", "C", "D", "E"], icon: "🅰️", difficulty: 1 },
      { id: "u1-2", title: "Alphabet F-J", letters: ["F", "G", "H", "I", "J"], icon: "🅵", difficulty: 2 },
      { id: "u1-3", title: "Alphabet K-O", letters: ["K", "L", "M", "N", "O"], icon: "🅺", difficulty: 2 },
      { id: "u1-4", title: "Alphabet P-T", letters: ["P", "Q", "R", "S", "T"], icon: "🅿️", difficulty: 2 },
      { id: "u1-5", title: "Alphabet U-Z", letters: ["U", "V", "W", "X", "Y", "Z"], icon: "🆄", difficulty: 3 },
      { id: "u1-quiz", title: "Milestone Quiz: Alphabet", letters: ["A", "E", "I", "O", "U", "Y", "C", "L", "S", "W"], icon: "🏆", difficulty: 3 }
    ]
  },
  {
    id: "unit-2",
    title: "Colors & Description",
    color: "#7C3AED", // Neon Violet
    icon: "🎨",
    lessons: [
      { id: "u2-1", title: "Primary Colors", letters: ["BLACK", "BLUE", "WHITE", "COLOR"], icon: "🎨", difficulty: 1 },
      { id: "u2-2", title: "Secondary Colors", letters: ["PINK", "BROWN", "PURPLE", "ORANGE"], icon: "🟤", difficulty: 2 },
      { id: "u2-3", title: "Descriptors & Sizes", letters: ["THIN", "TALL", "COOL", "HOT", "MANY", "WRONG", "DARK"], icon: "📏", difficulty: 2 },
      { id: "u2-quiz", title: "Milestone Quiz: Chapter II", letters: ["BLUE", "BROWN", "COLOR", "TALL", "HOT", "DARK"], icon: "🏆", difficulty: 2 }
    ]
  },
  {
    id: "unit-3",
    title: "Greetings & Interaction",
    color: "#00E5FF", // Cyan variant
    icon: "💬",
    lessons: [
      { id: "u3-1", title: "Greetings & Responses", letters: ["DEAF", "FINE", "HELP", "NO", "YES"], icon: "🤝", difficulty: 1 },
      { id: "u3-2", title: "Interaction & Questions", letters: ["LIKE", "WHAT", "HEARING", "LANGUAGE", "LATER", "HOW", "TELL"], icon: "💬", difficulty: 2 },
      { id: "u3-quiz", title: "Milestone Quiz: Greetings", letters: ["FINE", "HELP", "YES", "WHAT", "LATER", "HOW"], icon: "🏆", difficulty: 2 }
    ]
  },
  {
    id: "unit-4",
    title: "Family & Relations",
    color: "#EC4899", // Neon Pink
    icon: "🏠",
    lessons: [
      { id: "u4-1", title: "People & Family", letters: ["COUSIN", "MOTHER", "WOMAN", "MAN", "FAMILY", "SON"], icon: "🏠", difficulty: 2 },
      { id: "u4-2", title: "Social Interaction", letters: ["MEET", "KISS", "DOCTOR", "SECRETARY", "ACCIDENT", "BIRTHDAY"], icon: "🎂", difficulty: 2 },
      { id: "u4-quiz", title: "Milestone Quiz: Family", letters: ["MOTHER", "FAMILY", "MEET", "DOCTOR", "BIRTHDAY"], icon: "🏆", difficulty: 2 }
    ]
  },
  {
    id: "unit-5",
    title: "Food & Household Objects",
    color: "#F59E0B", // Neon Gold/Amber
    icon: "🍎",
    lessons: [
      { id: "u5-1", title: "Home & Objects", letters: ["BOOK", "CHAIR", "TABLE", "BED", "HAT"], icon: "📖", difficulty: 1 },
      { id: "u5-2", title: "Foods & Leisure", letters: ["CANDY", "APPLE", "CORN", "PIZZA", "BOWLING", "SHIRT", "JACKET"], icon: "🍎", difficulty: 2 },
      { id: "u5-quiz", title: "Milestone Quiz: Household", letters: ["BOOK", "TABLE", "APPLE", "PIZZA", "SHIRT"], icon: "🏆", difficulty: 2 }
    ]
  },
  {
    id: "unit-6",
    title: "Animals & Basic Actions",
    color: "#10B981", // Emerald Green
    icon: "🐕",
    lessons: [
      { id: "u6-1", title: "Daily Actions", letters: ["DRINK", "GO", "WALK", "FINISH", "EAT", "PLAY"], icon: "🚶", difficulty: 1 },
      { id: "u6-2", title: "Animals & Hobbies", letters: ["DOG", "FISH", "BIRD", "COW", "STUDY", "DANCE"], icon: "🐕", difficulty: 2 },
      { id: "u6-quiz", title: "Milestone Quiz: Animals", letters: ["DRINK", "GO", "DOG", "BIRD", "PLAY", "DANCE"], icon: "🏆", difficulty: 2 }
    ]
  },
  {
    id: "unit-7",
    title: "Time & Environment",
    color: "#EF4444", // Bright Red
    icon: "⏰",
    lessons: [
      { id: "u7-1", title: "Time Concepts", letters: ["YEAR", "NOW", "TIME", "LAST"], icon: "⏰", difficulty: 2 },
      { id: "u7-2", title: "Expressions & Actions", letters: ["ALL", "CAN", "CHANGE", "ENJOY", "FORGET", "GIVE", "SHORT", "THANKSGIVING"], icon: "🔄", difficulty: 2 },
      { id: "u7-quiz", title: "Milestone Quiz: Time", letters: ["YEAR", "NOW", "CAN", "FORGET", "GIVE", "THANKSGIVING"], icon: "🏆", difficulty: 3 }
    ]
  },
  {
    id: "unit-8",
    title: "Daily Work & Sentence Master",
    color: "#3B82F6", // Royal Blue
    icon: "🎓",
    lessons: [
      { id: "u8-1", title: "Concepts & Activities", letters: ["WORK", "AFRICA", "BASKETBALL", "BUT", "CHEAT", "CITY", "COOK", "DECIDE", "FULL", "LETTER", "MEDICINE", "NEED"], icon: "🎓", difficulty: 2 },
      { id: "u8-2", title: "Sentence Basics", letters: ["BOOK WANT", "SCHOOL GO", "WHAT TIME", "WHO PLAY"], icon: "💬", difficulty: 2, isSentence: true },
      { id: "u8-3", title: "Complex Sentences", letters: ["DOG LIKE PLAY", "FAMILY EAT NOW", "MOTHER MEET", "WORK FINISH", "TELL NOW", "STUDY WORK"], icon: "💬", difficulty: 3, isSentence: true },
      { id: "u8-quiz", title: "Milestone Quiz: Sentence Master", letters: ["WORK", "COOK", "BOOK WANT", "WHAT TIME", "FAMILY EAT NOW", "STUDY WORK"], icon: "🏆", difficulty: 3, isSentence: true }
    ]
  }
];

export const UNITS: UnitDefinition[] = [];
export const LESSONS: LessonDefinition[] = [];

let prevLessonId: string | null = null;
RAW_UNITS.forEach((rawUnit) => {
  const lessons: LessonDefinition[] = [];
  rawUnit.lessons.forEach((rawLesson) => {
    const isSentence = rawLesson.isSentence || false;
    const lessonDef: LessonDefinition = {
      ...rawLesson,
      isSentence,
      unlockAfter: prevLessonId,
      supportsDetection: rawLesson.letters.filter((l) => !isSentence && !(GUIDED_ONLY_LETTERS as readonly string[]).includes(l)),
      guidedOnly: rawLesson.letters.filter((l) => isSentence || (GUIDED_ONLY_LETTERS as readonly string[]).includes(l)),
      xp: rawLesson.letters.length * 15, // 15 XP per sign inside the lesson
    };
    lessons.push(lessonDef);
    LESSONS.push(lessonDef);
    prevLessonId = rawLesson.id;
  });

  UNITS.push({
    ...rawUnit,
    lessons,
  });
});

export function getLessonById(lessonId: string): LessonDefinition | undefined {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

export function isGuidedOnlyLetter(letter: string): boolean {
  return GUIDED_ONLY_LETTERS.includes(letter as (typeof GUIDED_ONLY_LETTERS)[number]);
}

export function isDetectableLetter(letter: string): boolean {
  return DETECTABLE_LETTERS.includes(letter as (typeof DETECTABLE_LETTERS)[number]);
}
