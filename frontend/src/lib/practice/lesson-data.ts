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

// Raw structure of units and lessons
const RAW_UNITS = [
  {
    id: "unit-1",
    title: "Fingerspelling Foundations",
    color: "#00D4FF", // Neon Cyan
    icon: "✋",
    lessons: [
      { id: "u1-a", title: "Letter A", letters: ["A"], icon: "🅰️", difficulty: 1 },
      { id: "u1-b", title: "Letter B", letters: ["B"], icon: "🅱️", difficulty: 1 },
      { id: "u1-c", title: "Letter C", letters: ["C"], icon: "🅲", difficulty: 1 },
      { id: "u1-d", title: "Letter D", letters: ["D"], icon: "🅳", difficulty: 1 },
      { id: "u1-e", title: "Letter E", letters: ["E"], icon: "🅴", difficulty: 1 },
      { id: "u1-f", title: "Letter F", letters: ["F"], icon: "🅵", difficulty: 1 },
      { id: "u1-g", title: "Letter G", letters: ["G"], icon: "🅶", difficulty: 1 },
      { id: "u1-h", title: "Letter H", letters: ["H"], icon: "🅷", difficulty: 1 },
      { id: "u1-i", title: "Letter I", letters: ["I"], icon: "🅸", difficulty: 1 },
      { id: "u1-j", title: "Letter J", letters: ["J"], icon: "🅹", difficulty: 2 },
      { id: "u1-k", title: "Letter K", letters: ["K"], icon: "🅺", difficulty: 2 },
      { id: "u1-l", title: "Letter L", letters: ["L"], icon: "🅻", difficulty: 2 },
      { id: "u1-m", title: "Letter M", letters: ["M"], icon: "🅼", difficulty: 2 },
      { id: "u1-n", title: "Letter N", letters: ["N"], icon: "🅽", difficulty: 2 },
      { id: "u1-o", title: "Letter O", letters: ["O"], icon: "🅾️", difficulty: 2 },
      { id: "u1-p", title: "Letter P", letters: ["P"], icon: "🅿️", difficulty: 2 },
      { id: "u1-q", title: "Letter Q", letters: ["Q"], icon: "🆪", difficulty: 2 },
      { id: "u1-r", title: "Letter R", letters: ["R"], icon: "🆁", difficulty: 2 },
      { id: "u1-s", title: "Letter S", letters: ["S"], icon: "🆂", difficulty: 2 },
      { id: "u1-t", title: "Letter T", letters: ["T"], icon: "🆃", difficulty: 2 },
      { id: "u1-u", title: "Letter U", letters: ["U"], icon: "🆄", difficulty: 2 },
      { id: "u1-v", title: "Letter V", letters: ["V"], icon: "🆅", difficulty: 2 },
      { id: "u1-w", title: "Letter W", letters: ["W"], icon: "🆆", difficulty: 2 },
      { id: "u1-x", title: "Letter X", letters: ["X"], icon: "🆇", difficulty: 3 },
      { id: "u1-y", title: "Letter Y", letters: ["Y"], icon: "🆈", difficulty: 3 },
      { id: "u1-z", title: "Letter Z", letters: ["Z"], icon: "🆳", difficulty: 3 }
    ]
  },
  {
    id: "unit-2",
    title: "Colors & Description",
    color: "#7C3AED", // Neon Violet
    icon: "🎨",
    lessons: [
      { id: "u2-black", title: "Sign: BLACK", letters: ["BLACK"], icon: "⚫", difficulty: 1 },
      { id: "u2-blue", title: "Sign: BLUE", letters: ["BLUE"], icon: "🔵", difficulty: 1 },
      { id: "u2-white", title: "Sign: WHITE", letters: ["WHITE"], icon: "⚪", difficulty: 1 },
      { id: "u2-pink", title: "Sign: PINK", letters: ["PINK"], icon: "🌸", difficulty: 2 },
      { id: "u2-brown", title: "Sign: BROWN", letters: ["BROWN"], icon: "🟤", difficulty: 2 },
      { id: "u2-purple", title: "Sign: PURPLE", letters: ["PURPLE"], icon: "🟣", difficulty: 2 },
      { id: "u2-orange", title: "Sign: ORANGE", letters: ["ORANGE"], icon: "🟠", difficulty: 2 },
      { id: "u2-color", title: "Sign: COLOR", letters: ["COLOR"], icon: "🌈", difficulty: 1 },
      { id: "u2-thin", title: "Sign: THIN", letters: ["THIN"], icon: "📏", difficulty: 2 },
      { id: "u2-cool", title: "Sign: COOL", letters: ["COOL"], icon: "😎", difficulty: 2 },
      { id: "u2-hot", title: "Sign: HOT", letters: ["HOT"], icon: "🔥", difficulty: 2 },
      { id: "u2-many", title: "Sign: MANY", letters: ["MANY"], icon: "🔢", difficulty: 1 },
      { id: "u2-tall", title: "Sign: TALL", letters: ["TALL"], icon: "🗼", difficulty: 2 },
      { id: "u2-wrong", title: "Sign: WRONG", letters: ["WRONG"], icon: "❌", difficulty: 2 },
      { id: "u2-dark", title: "Sign: DARK", letters: ["DARK"], icon: "🌙", difficulty: 2 }
    ]
  },
  {
    id: "unit-3",
    title: "Greetings & Interaction",
    color: "#00E5FF", // Cyan variant
    icon: "💬",
    lessons: [
      { id: "u3-deaf", title: "Sign: DEAF", letters: ["DEAF"], icon: "👂", difficulty: 1 },
      { id: "u3-fine", title: "Sign: FINE", letters: ["FINE"], icon: "👌", difficulty: 1 },
      { id: "u3-help", title: "Sign: HELP", letters: ["HELP"], icon: "🤝", difficulty: 1 },
      { id: "u3-no", title: "Sign: NO", letters: ["NO"], icon: "🙅", difficulty: 1 },
      { id: "u3-yes", title: "Sign: YES", letters: ["YES"], icon: "🙆", difficulty: 1 },
      { id: "u3-like", title: "Sign: LIKE", letters: ["LIKE"], icon: "❤️", difficulty: 2 },
      { id: "u3-what", title: "Sign: WHAT", letters: ["WHAT"], icon: "❓", difficulty: 2 },
      { id: "u3-hearing", title: "Sign: HEARING", letters: ["HEARING"], icon: "🗣️", difficulty: 2 },
      { id: "u3-language", title: "Sign: LANGUAGE", letters: ["LANGUAGE"], icon: "🌐", difficulty: 2 },
      { id: "u3-later", title: "Sign: LATER", letters: ["LATER"], icon: "⏰", difficulty: 2 },
      { id: "u3-how", title: "Sign: HOW", letters: ["HOW"], icon: "🤔", difficulty: 2 },
      { id: "u3-tell", title: "Sign: TELL", letters: ["TELL"], icon: "💬", difficulty: 2 }
    ]
  },
  {
    id: "unit-4",
    title: "Family & Relations",
    color: "#EC4899", // Neon Pink
    icon: "🏠",
    lessons: [
      { id: "u4-cousin", title: "Sign: COUSIN", letters: ["COUSIN"], icon: "👥", difficulty: 2 },
      { id: "u4-mother", title: "Sign: MOTHER", letters: ["MOTHER"], icon: "👩", difficulty: 1 },
      { id: "u4-woman", title: "Sign: WOMAN", letters: ["WOMAN"], icon: "🚺", difficulty: 1 },
      { id: "u4-man", title: "Sign: MAN", letters: ["MAN"], icon: "🚹", difficulty: 1 },
      { id: "u4-family", title: "Sign: FAMILY", letters: ["FAMILY"], icon: "👨‍👩‍👧‍👦", difficulty: 2 },
      { id: "u4-kiss", title: "Sign: KISS", letters: ["KISS"], icon: "😘", difficulty: 2 },
      { id: "u4-son", title: "Sign: SON", letters: ["SON"], icon: "👦", difficulty: 2 },
      { id: "u4-meet", title: "Sign: MEET", letters: ["MEET"], icon: "🤝", difficulty: 1 },
      { id: "u4-doctor", title: "Sign: DOCTOR", letters: ["DOCTOR"], icon: "🥼", difficulty: 2 },
      { id: "u4-secretary", title: "Sign: SECRETARY", letters: ["SECRETARY"], icon: "💼", difficulty: 2 },
      { id: "u4-accident", title: "Sign: ACCIDENT", letters: ["ACCIDENT"], icon: "⚠️", difficulty: 2 },
      { id: "u4-birthday", title: "Sign: BIRTHDAY", letters: ["BIRTHDAY"], icon: "🎂", difficulty: 2 }
    ]
  },
  {
    id: "unit-5",
    title: "Food & Household Objects",
    color: "#F59E0B", // Neon Gold/Amber
    icon: "🍎",
    lessons: [
      { id: "u5-book", title: "Sign: BOOK", letters: ["BOOK"], icon: "📖", difficulty: 1 },
      { id: "u5-chair", title: "Sign: CHAIR", letters: ["CHAIR"], icon: "🪑", difficulty: 1 },
      { id: "u5-candy", title: "Sign: CANDY", letters: ["CANDY"], icon: "🍬", difficulty: 2 },
      { id: "u5-table", title: "Sign: TABLE", letters: ["TABLE"], icon: "🪵", difficulty: 2 },
      { id: "u5-bed", title: "Sign: BED", letters: ["BED"], icon: "🛏️", difficulty: 1 },
      { id: "u5-bowling", title: "Sign: BOWLING", letters: ["BOWLING"], icon: "🎳", difficulty: 2 },
      { id: "u5-hat", title: "Sign: HAT", letters: ["HAT"], icon: "👒", difficulty: 1 },
      { id: "u5-shirt", title: "Sign: SHIRT", letters: ["SHIRT"], icon: "👕", difficulty: 2 },
      { id: "u5-apple", title: "Sign: APPLE", letters: ["APPLE"], icon: "🍎", difficulty: 1 },
      { id: "u5-corn", title: "Sign: CORN", letters: ["CORN"], icon: "🌽", difficulty: 2 },
      { id: "u5-pizza", title: "Sign: PIZZA", letters: ["PIZZA"], icon: "🍕", difficulty: 2 },
      { id: "u5-jacket", title: "Sign: JACKET", letters: ["JACKET"], icon: "🧥", difficulty: 2 }
    ]
  },
  {
    id: "unit-6",
    title: "Animals & Basic Actions",
    color: "#10B981", // Emerald Green
    icon: "🐕",
    lessons: [
      { id: "u6-drink", title: "Sign: DRINK", letters: ["DRINK"], icon: "🥛", difficulty: 1 },
      { id: "u6-go", title: "Sign: GO", letters: ["GO"], icon: "🚶", difficulty: 1 },
      { id: "u6-walk", title: "Sign: WALK", letters: ["WALK"], icon: "👣", difficulty: 2 },
      { id: "u6-finish", title: "Sign: FINISH", letters: ["FINISH"], icon: "🏁", difficulty: 2 },
      { id: "u6-dog", title: "Sign: DOG", letters: ["DOG"], icon: "🐕", difficulty: 1 },
      { id: "u6-fish", title: "Sign: FISH", letters: ["FISH"], icon: "🐟", difficulty: 2 },
      { id: "u6-study", title: "Sign: STUDY", letters: ["STUDY"], icon: "📚", difficulty: 2 },
      { id: "u6-bird", title: "Sign: BIRD", letters: ["BIRD"], icon: "🐦", difficulty: 1 },
      { id: "u6-cow", title: "Sign: COW", letters: ["COW"], icon: "🐄", difficulty: 2 },
      { id: "u6-dance", title: "Sign: DANCE", letters: ["DANCE"], icon: "💃", difficulty: 2 },
      { id: "u6-eat", title: "Sign: EAT", letters: ["EAT"], icon: "🍽️", difficulty: 1 },
      { id: "u6-play", title: "Sign: PLAY", letters: ["PLAY"], icon: "🎮", difficulty: 2 }
    ]
  },
  {
    id: "unit-7",
    title: "Time & Environment",
    color: "#EF4444", // Bright Red
    icon: "⏰",
    lessons: [
      { id: "u7-year", title: "Sign: YEAR", letters: ["YEAR"], icon: "📅", difficulty: 2 },
      { id: "u7-all", title: "Sign: ALL", letters: ["ALL"], icon: "🌐", difficulty: 1 },
      { id: "u7-now", title: "Sign: NOW", letters: ["NOW"], icon: "⏱️", difficulty: 2 },
      { id: "u7-thanksgiving", title: "Sign: THANKSGIVING", letters: ["THANKSGIVING"], icon: "🦃", difficulty: 3 },
      { id: "u7-can", title: "Sign: CAN", letters: ["CAN"], icon: "🥫", difficulty: 1 },
      { id: "u7-change", title: "Sign: CHANGE", letters: ["CHANGE"], icon: "🔄", difficulty: 2 },
      { id: "u7-enjoy", title: "Sign: ENJOY", letters: ["ENJOY"], icon: "😊", difficulty: 2 },
      { id: "u7-forget", title: "Sign: FORGET", letters: ["FORGET"], icon: "🧠", difficulty: 2 },
      { id: "u7-give", title: "Sign: GIVE", letters: ["GIVE"], icon: "🎁", difficulty: 2 },
      { id: "u7-last", title: "Sign: LAST", letters: ["LAST"], icon: "⏮️", difficulty: 2 },
      { id: "u7-short", title: "Sign: SHORT", letters: ["SHORT"], icon: "📏", difficulty: 2 },
      { id: "u7-time", title: "Sign: TIME", letters: ["TIME"], icon: "🕰️", difficulty: 2 }
    ]
  },
  {
    id: "unit-8",
    title: "Daily Work & Sentence Master",
    color: "#3B82F6", // Royal Blue
    icon: "🎓",
    lessons: [
      { id: "u8-work", title: "Sign: WORK", letters: ["WORK"], icon: "⚒️", difficulty: 2 },
      { id: "u8-africa", title: "Sign: AFRICA", letters: ["AFRICA"], icon: "🌍", difficulty: 2 },
      { id: "u8-basketball", title: "Sign: BASKETBALL", letters: ["BASKETBALL"], icon: "🏀", difficulty: 2 },
      { id: "u8-but", title: "Sign: BUT", letters: ["BUT"], icon: "🔀", difficulty: 2 },
      { id: "u8-cheat", title: "Sign: CHEAT", letters: ["CHEAT"], icon: "🕵️", difficulty: 3 },
      { id: "u8-city", title: "Sign: CITY", letters: ["CITY"], icon: "🏙️", difficulty: 2 },
      { id: "u8-cook", title: "Sign: COOK", letters: ["COOK"], icon: "👨‍🍳", difficulty: 2 },
      { id: "u8-decide", title: "Sign: DECIDE", letters: ["DECIDE"], icon: "🧠", difficulty: 2 },
      { id: "u8-full", title: "Sign: FULL", letters: ["FULL"], icon: "🥃", difficulty: 2 },
      { id: "u8-letter", title: "Sign: LETTER", letters: ["LETTER"], icon: "✉️", difficulty: 2 },
      { id: "u8-medicine", title: "Sign: MEDICINE", letters: ["MEDICINE"], icon: "💊", difficulty: 2 },
      { id: "u8-need", title: "Sign: NEED", letters: ["NEED"], icon: "🛎️", difficulty: 2 },
      { id: "u8-s1", title: "Sentence: BOOK WANT", letters: ["BOOK", "WANT"], icon: "📖", difficulty: 2 },
      { id: "u8-s2", title: "Sentence: SCHOOL GO", letters: ["SCHOOL", "GO"], icon: "🏫", difficulty: 2 },
      { id: "u8-s3", title: "Sentence: WHAT TIME", letters: ["WHAT", "TIME"], icon: "🕰️", difficulty: 2 },
      { id: "u8-s4", title: "Sentence: WHO PLAY", letters: ["WHO", "PLAY"], icon: "👥", difficulty: 2 },
      { id: "u8-s5", title: "Sentence: DOG LIKE PLAY", letters: ["DOG", "LIKE", "PLAY"], icon: "🐕", difficulty: 3 },
      { id: "u8-s6", title: "Sentence: FAMILY EAT NOW", letters: ["FAMILY", "EAT", "NOW"], icon: "👨‍👩‍👧‍👦", difficulty: 3 },
      { id: "u8-s7", title: "Sentence: MOTHER MEET", letters: ["MOTHER", "MEET"], icon: "👩", difficulty: 2 },
      { id: "u8-s8", title: "Sentence: WORK FINISH", letters: ["WORK", "FINISH"], icon: "🏁", difficulty: 2 },
      { id: "u8-s9", title: "Sentence: TELL NOW", letters: ["TELL", "NOW"], icon: "⏱️", difficulty: 2 },
      { id: "u8-s10", title: "Sentence: STUDY WORK", letters: ["STUDY", "WORK"], icon: "📚", difficulty: 2 }
    ]
  }
];

export const UNITS: UnitDefinition[] = [];
export const LESSONS: LessonDefinition[] = [];

let prevLessonId: string | null = null;
RAW_UNITS.forEach((rawUnit) => {
  const lessons: LessonDefinition[] = [];
  rawUnit.lessons.forEach((rawLesson) => {
    const isSentence = rawLesson.letters.length > 1;
    const lessonDef: LessonDefinition = {
      ...rawLesson,
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
