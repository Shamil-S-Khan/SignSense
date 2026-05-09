declare module "fingerpose" {
  export enum Finger {
    Thumb,
    Index,
    Middle,
    Ring,
    Pinky,
  }

  export enum FingerCurl {
    NoCurl,
    HalfCurl,
    FullCurl,
  }

  export enum FingerDirection {
    VerticalUp,
    HorizontalLeft,
    HorizontalRight,
  }

  export class GestureDescription {
    constructor(name: string);
    addCurl(finger: Finger, curl: FingerCurl, confidence: number): void;
    addDirection(finger: Finger, direction: FingerDirection, confidence: number): void;
  }

  export interface GestureEstimate {
    name: string;
    score: number;
  }

  export class GestureEstimator {
    constructor(gestures: GestureDescription[]);
    estimate(landmarks: number[][], minimumScore: number): { gestures: GestureEstimate[] };
  }
}
