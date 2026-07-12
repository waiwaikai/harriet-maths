// Single source of truth for content + progress shapes.

export interface WeekSpec {
  id: string;
  term: 3 | 4;
  week: number;
  start: string; // ISO date
  end: string;
  focus: string;
  stage: string;
  conceptId: string;
  /** Flex weeks carry no new content: they absorb drift when behind, or run as revision/extension when on track. */
  flex?: boolean;
}

export interface Spine {
  version: number;
  terms: { term: 3 | 4; start: string; end: string }[];
  weeks: WeekSpec[];
}

export interface Concept {
  id: string;
  title: string;
  stage: string;
  cpaNote: string;
  prerequisites: string[];
}

/** A question with a spoken form and a numeric answer (voice-scorable). */
export interface Item {
  id: string;
  kind: 'story' | 'plain';
  text: string;
  say: string;
  answer: number;
  difficulty: 1 | 2 | 3;
  /** Set on recall/warm-up items so struggle can be attributed to the right concept. */
  conceptId?: string;
}

export interface DemoStep {
  show: string;
  caption: string;
  say: string;
  /** When present, render proper base-10 blocks instead of the `show` text. */
  blocks?: { h: number; t: number; o: number };
}

export interface Demo {
  title: string;
  say: string;
  steps: DemoStep[];
}

/** Parent-facing worked example for the "we do" phase. */
export interface WeDoExample {
  problem: string;
  model: string;
  steps: string[];
  answer: string;
}

export interface Bank {
  bankId: string;
  conceptId: string;
  parentIntro: string;
  watchFor: string;
  demo: Demo;
  weDo: WeDoExample[];
  items: Item[];
  warmupWins: Item[];
}

// ---------- scoring / progress ----------

export type Tier = 'ftr' | 'second-look' | 'parked';

export interface ItemResult {
  itemId: string;
  tier: Tier;
  answer: number;
  heard?: string;
  /** Question text + expected answer, stored so struggled items can be re-asked on Fridays. */
  text?: string;
  expected?: number;
}

/** Parent's one-tap mark on a warm-up question: got it / needed a prompt / not yet. */
export type WarmupMark = 'tick' | 'prompted' | 'cross';

export interface WarmupResult {
  itemId: string;
  mark: WarmupMark;
  conceptId?: string;
}

/** How today's lesson is pitched, from the adaptivity triggers. */
export type DayDirective = 'normal' | 'depth' | 'reteach';

export type SessionKind = 'lesson' | 'revision' | 'flex';

/** Mastery-based position on the spine (may drift behind the calendar, capped). */
export interface SpineState {
  /** Index into spine.weeks; null until the first lesson session adopts the calendar week. */
  activeIndex: number | null;
  /** Extension days used by the active concept (cap = one week). */
  extraDaysUsed: number;
  /** Completed lesson days per concept. */
  lessonDaysDone: Record<string, number>;
}

export type Mode = 'together' | 'solo';

export interface SessionRecord {
  date: string; // ISO date
  mode: Mode;
  weekId: string;
  conceptId: string;
  total: number;
  ftr: number;
  secondLooks: number;
  parked: number;
  results: ItemResult[];
  warmup?: WarmupResult[];
  kind?: SessionKind;
  directive?: DayDirective;
}

export interface Settings {
  voiceName: string | null;
  rate: number;
  dateOverride: string | null; // ISO date, "pretend today is"
}

// ---------- diagnostic ----------

export interface DiagItem {
  id: string;
  level: number; // 1-based rung on the ladder
  conceptId: string;
  text: string;
  say: string;
  answer: number | string; // shown to umma only
}

export interface Ladder {
  id: string;
  title: string;
  emoji: string;
  items: DiagItem[];
}

export interface DiagnosticMark {
  itemId: string;
  ladderId: string;
  level: number;
  conceptId: string;
  mark: WarmupMark;
}

export interface DiagnosticResult {
  date: string;
  marks: DiagnosticMark[];
  /** Highest cleanly-reached rung per ladder. */
  levels: Record<string, number>;
}

export interface ProgressState {
  sessions: SessionRecord[];
  streak: number;
  lastSessionDate: string | null;
  settings: Settings;
  spine: SpineState;
  diagnostic?: DiagnosticResult | null;
}
