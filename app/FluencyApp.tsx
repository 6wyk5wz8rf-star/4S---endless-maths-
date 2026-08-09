"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHALLENGE_ANCHORS,
  PRESETS,
  SUPPORT_ANCHORS,
  adaptiveSupport,
  challengeLabel,
  createEngine,
  evaluateAnswer,
  normalisePracticeSelection,
  supportBand,
} from "@/lib/fluency-engine.mjs";
import {
  appendEvents,
  applyEvidenceImport,
  buildRecommendations,
  calculateEvidence,
  createClassroomBackup,
  createClassroomState,
  createCsvSummary,
  createEvidenceExport,
  decodePracticeConfig,
  encodePracticeConfig,
  migrateClassroomState,
  normalisePracticeConfig,
  previewBackupRestore,
  previewEvidenceImport,
  restoreClassroomBackup,
  upsertGroup,
  upsertNote,
  upsertPreset,
  upsertProfile,
  upsertSession,
} from "@/lib/classroom-mastery.mjs";
import { createPrintPractice } from "@/lib/classroom-print.mjs";
import TeacherTools, { DEFAULT_TEACHER_CONFIG } from "./TeacherTools";
import type {
  AccessibilitySettings,
  PrintOptions,
  PrintPreview,
  TeacherGroup,
  TeacherPreset,
  TeacherProfile,
  TeacherProfileReview,
  TeacherRecentSession,
  TeacherSessionConfig,
} from "./TeacherTools";

type Screen = "setup" | "practice" | "summary" | "teacher" | "share";
type Feedback = "idle" | "retry" | "supported" | "correct";
type PracticeMode = "mix" | "focus" | "quick" | "think" | "my-mix";

type Preferences = {
  reducedMotion: boolean;
  largerText: boolean;
  strongerContrast: boolean;
  simplifiedDensity: boolean;
  largerTargets: boolean;
  screenReaderOptimised: boolean;
  sound: boolean;
  timedPressure: boolean;
};

type StrandStat = {
  attempted: number;
  firstTry: number;
};

type SessionStats = {
  attempted: number;
  classQuestions: number;
  firstTry: number;
  afterAnotherTry: number;
  afterSupport: number;
  modelled: number;
  startedAt: number;
  elapsed: number;
  strands: Record<string, StrandStat>;
};

type ActiveSession = {
  id: string;
  seed: string;
  title: string;
  config: TeacherSessionConfig | null;
  profileIds: string[];
  startedAt: number;
  length: TeacherSessionConfig["length"] | { kind: "open" };
};

type SharedSession = {
  config: TeacherSessionConfig;
  summary: string;
};

type VisualData = {
  kind: "place-value" | "base-ten" | "array" | "partition" | "groups" | "counters" | "ten-frame" | "bead-string" | "part-whole" | "multiplication-rectangle" | "fraction-strip" | "bar-model" | "hundred-grid" | "number-line" | "relationship" | "worked-example";
  title: string;
  rows?: number[][] | number;
  columns?: number;
  operator?: string;
  parts?: number[];
  multiplier?: number;
  total?: number | null;
  groupSize?: number;
  groups?: number;
  perGroup?: number;
  filled?: number;
  denominator?: number;
  numerator?: number;
  min?: number;
  max?: number;
  points?: number[];
  markers?: number[];
  ticks?: number;
  unknown?: number | null;
  whole?: number;
  segments?: number;
  factor?: number;
  value?: number;
  left?: string;
  right?: string;
  connector?: string;
  lines?: string[];
  errorLine?: number;
};

type QuestionItem = {
  id: string;
  family: string;
  strand: string;
  subskill: string;
  difficulty: number;
  type: "numeric" | "choice";
  display: string;
  instruction: string | null;
  answer: string;
  answerType: "whole" | "decimal" | "fraction";
  acceptableAnswers: string[];
  choices: string[] | null;
  promptVisual: VisualData | null;
  connections?: QuestionItem[];
  relatedFollowUp?: string;
  values?: Record<string, number>;
  scaffold: {
    hint: string;
    visual: VisualData;
    steps: string[];
    model: { title: string; display: string; lines: string[]; answer: string };
    alternatives: string[];
  };
  metadata: {
    structure: string;
    strategy: string | null;
    thinking: number;
    speed: string;
    retrievalKey: string;
    designedConnection: boolean;
    connectionKind?: string;
    sessionIndex?: number;
    selectedChallenge?: number;
    selectedChallengeRange?: { min: number; max: number } | null;
    representationFrequency?: number;
    representationSuggested?: boolean;
  };
};

type EngineApi = {
  next: () => QuestionItem;
  setChallenge: (value: number, preserveRange?: boolean) => { mode: PracticeMode; focus: string | null; challenge: number };
  setChallengeRange: (range: { min: number; max: number }) => { mode: PracticeMode; focus: string | null; challenge: number };
  setFocus: (value: string | null) => { mode: PracticeMode; focus: string | null; challenge: number };
  setMode: (value: PracticeMode) => { mode: PracticeMode; focus: string | null; challenge: number };
  recordResponse: (response: {
    item: QuestionItem;
    correct: boolean;
    firstTry: boolean;
    supportUsed: number;
    modelUsed: boolean;
    responseMs: number;
    misconception?: string | null;
  }) => void;
  getHistory: () => string[];
  getLearningState: () => Record<string, MasteryState>;
  getAdaptation: () => { mode: PracticeMode; focus: string | null };
  getState: () => Record<string, unknown>;
  generateNearTransfer: (item: QuestionItem) => QuestionItem | null;
};

type MasteryState = {
  attempts: number;
  score: number;
  strength?: string;
  lastSeen?: number;
  lastSeenAt?: number | null;
};

const STORAGE_KEY = "year4-fluency-preferences-v3";
const SESSION_KEY = "year4-fluency-last-session-v3";
const HISTORY_KEY = "year4-fluency-generator-history-v2";
const LEARNING_KEY = "year4-fluency-learning-v2";
const CLASSROOM_KEY = "year4-fluency-classroom-v3";
const ACTIVE_SESSION_KEY = "year4-fluency-active-session-v3";
const APP_VERSION = "Build 3";

const MODES: Array<{ id: PracticeMode; label: string; note: string }> = [
  { id: "mix", label: "Mix", note: "Connected mixed fluency" },
  { id: "focus", label: "Focus", note: "One broad strand" },
  { id: "quick", label: "Quick Fire", note: "Short retrieval" },
  { id: "think", label: "Think", note: "Fewer, deeper prompts" },
  { id: "my-mix", label: "My Mix", note: "Personal retrieval mix" },
];

const FOCUS_OPTIONS = ["Addition", "Subtraction", "Multiplication", "Division", "Tables", "Place Value", "Fractions", "Decimals"];

const EMPTY_STATS: SessionStats = {
  attempted: 0,
  classQuestions: 0,
  firstTry: 0,
  afterAnotherTry: 0,
  afterSupport: 0,
  modelled: 0,
  startedAt: 0,
  elapsed: 0,
  strands: {},
};

const DEFAULT_PREFERENCES: Preferences = {
  reducedMotion: false,
  largerText: false,
  strongerContrast: false,
  simplifiedDensity: false,
  largerTargets: false,
  screenReaderOptimised: false,
  sound: false,
  timedPressure: false,
};

function localId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function localPinHash(code: string) {
  let hash = 2166136261;
  for (const character of `year4-fluency:${code}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function supportModeValue(mode: TeacherSessionConfig["support"]) {
  return ({ independent: 0, available: 24, adaptive: 38, guided: 68, modelled: 94 })[mode];
}

function titleFocus(value: string | null | undefined): TeacherSessionConfig["focus"] {
  const source = String(value ?? "mixed").trim().toLowerCase();
  const labels: Record<string, TeacherSessionConfig["focus"]> = {
    mixed: "Mixed",
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
    division: "Division",
    tables: "Tables",
    "place value": "Place Value",
    fractions: "Fractions",
    decimals: "Decimals",
    "fractions and decimals": "Fractions and Decimals",
    "equivalence and missing numbers": "Equivalence and Missing Numbers",
  };
  return labels[source] ?? "Mixed";
}

function toTeacherConfig(source: any): TeacherSessionConfig {
  if (!source) return DEFAULT_TEACHER_CONFIG;
  const challengeSource = source.challenge ?? { kind: "fixed", value: 52, min: 52, max: 52 };
  const challenge = challengeSource.kind === "range" && Number(challengeSource.min) !== Number(challengeSource.max)
    ? { kind: "range" as const, min: Number(challengeSource.min), max: Number(challengeSource.max) }
    : { kind: "fixed" as const, value: Number(challengeSource.value ?? challengeSource.min ?? 52) };
  const support = typeof source.support === "string" ? source.support : source.support?.mode;
  const lengthSource = source.length ?? { kind: "open" };
  let length: TeacherSessionConfig["length"] = { kind: "open" };
  if (lengthSource.kind === "minutes") length = { kind: "minutes", value: [5, 10, 15].includes(Number(lengthSource.value)) ? Number(lengthSource.value) as 5 | 10 | 15 : 10 };
  if (lengthSource.kind === "questions") length = { kind: "questions", value: [5, 10, 15, 20, 30].includes(Number(lengthSource.value)) ? Number(lengthSource.value) as 5 | 10 | 15 | 20 | 30 : Number(lengthSource.value) <= 15 ? 10 : 20 };
  const pupilControl = (key: string, fallback: "unlocked" | "limited" | "locked") => {
    const item = source.pupilControls?.[key];
    return (typeof item === "string" ? item : item?.state) ?? fallback;
  };
  const representation = typeof source.representationFrequency === "string"
    ? source.representationFrequency
    : Number(source.representationFrequency ?? 0.35) >= 0.58 ? "high" : Number(source.representationFrequency ?? 0.35) <= 0.2 ? "low" : "balanced";
  const retrieval = typeof source.retrievalWeight === "string"
    ? source.retrievalWeight
    : Number(source.adaptation?.retrievalWeight ?? 0.25) >= 0.45 ? "strong" : Number(source.adaptation?.retrievalWeight ?? 0.25) <= 0.14 ? "light" : "balanced";
  return {
    mode: ["mix", "focus", "quick", "think", "my-mix"].includes(source.mode) ? source.mode : "mix",
    focus: titleFocus(source.focus),
    subskill: source.subskill ?? source.subskills?.[0],
    challenge,
    support: ["independent", "available", "adaptive", "guided", "modelled"].includes(support) ? support : "adaptive",
    length,
    representationFrequency: ["low", "balanced", "high"].includes(representation) ? representation : "balanced",
    retrievalWeight: ["light", "balanced", "strong"].includes(retrieval) ? retrieval : "balanced",
    strategyQuestions: source.strategyQuestions ?? source.includeStrategyQuestions ?? true,
    connectedSequences: source.connectedSequences ?? source.adaptation?.connectedSequences ?? true,
    nearTransfer: source.nearTransfer ?? source.adaptation?.nearTransfer ?? true,
    adaptiveDifficulty: source.adaptiveDifficulty ?? source.adaptation?.withinBand ?? true,
    fadeSupport: source.fadeSupport ?? source.adaptation?.supportFading ?? true,
    wordedQuestions: source.wordedQuestions ?? source.includeWordedQuestions ?? false,
    seedMode: source.seedMode === "same" ? "same" : "fresh",
    seed: source.seed ?? undefined,
    pupilControls: {
      challenge: pupilControl("challenge", "limited"),
      support: pupilControl("support", "unlocked"),
      mode: pupilControl("mode", "locked") === "limited" ? "locked" : pupilControl("mode", "locked"),
      focus: pupilControl("focus", "locked") === "limited" ? "locked" : pupilControl("focus", "locked"),
    },
  };
}

function toStoredConfig(config: TeacherSessionConfig) {
  const challenge = config.challenge.kind === "range"
    ? config.challenge
    : { kind: "fixed", value: config.challenge.value };
  return normalisePracticeConfig({
    mode: config.mode,
    focus: config.focus.toLowerCase(),
    subskills: config.subskill ? [config.subskill] : [],
    challenge,
    support: { mode: config.support, value: supportModeValue(config.support) },
    length: config.length,
    representationFrequency: ({ low: 0.15, balanced: 0.35, high: 0.65 })[config.representationFrequency],
    adaptation: {
      withinBand: config.adaptiveDifficulty,
      supportFading: config.fadeSupport,
      retrievalWeight: ({ light: 0.12, balanced: 0.28, strong: 0.55 })[config.retrievalWeight],
      connectedSequences: config.connectedSequences,
      nearTransfer: config.nearTransfer,
    },
    includeStrategyQuestions: config.strategyQuestions,
    includeWordedQuestions: config.wordedQuestions,
    seedMode: config.seedMode,
    seed: config.seed,
    pupilControls: {
      challenge: { state: config.pupilControls.challenge },
      support: { state: config.pupilControls.support },
      mode: { state: config.pupilControls.mode },
      focus: { state: config.pupilControls.focus },
    },
  });
}

function teacherEngineOptions(config: TeacherSessionConfig | null) {
  if (!config) return {};
  return {
    subskills: config.subskill ? [config.subskill] : [],
    retrievalWeight: ({ light: 0.12, balanced: 0.28, strong: 0.55 })[config.retrievalWeight],
    includeStrategyQuestions: config.strategyQuestions,
    connectedSequences: config.connectedSequences,
    nearTransfer: config.nearTransfer,
    adaptiveDifficulty: config.adaptiveDifficulty,
    representationFrequency: ({ low: 0.15, balanced: 0.35, high: 0.65 })[config.representationFrequency],
    fixedSequence: config.seedMode === "same",
  };
}

function teacherSessionSummary(config: TeacherSessionConfig) {
  const length = config.length.kind === "open" ? "Open practice" : `${config.length.value} ${config.length.kind}`;
  const challenge = config.challenge.kind === "fixed" ? `Challenge ${config.challenge.value}` : `Challenge ${config.challenge.min}–${config.challenge.max}`;
  const support = ({ independent: "Independent", available: "Support on request", adaptive: "Adaptive support", guided: "Guided", modelled: "Modelled" })[config.support];
  return `${length} · ${config.focus} · ${challenge} · ${support}`;
}

function downloadLocalFile(name: string, type: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function nearestLabel(value: number, anchors: Array<{ value: number; label: string }>) {
  return anchors.reduce((best, anchor) =>
    Math.abs(anchor.value - value) < Math.abs(best.value - value) ? anchor : best,
  ).label;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.max(1, seconds)} sec`;
  return `${minutes} min`;
}

function sessionProgressText(attempted: number, session: ActiveSession | null) {
  if (session?.length.kind === "questions") return `${attempted} of ${session.length.value}`;
  return `${attempted} ${attempted === 1 ? "question" : "questions"}`;
}

function timedProgressText(elapsed: number, totalSeconds: number) {
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  if (progress < 0.2) return "just begun";
  if (progress < 0.45) return "under halfway";
  if (progress < 0.7) return "over halfway";
  if (progress < 0.9) return "nearly finished";
  return "finishing soon";
}

const VULGAR_FRACTIONS: Record<string, string> = {
  "½": "one half",
  "⅓": "one third",
  "⅔": "two thirds",
  "¼": "one quarter",
  "¾": "three quarters",
  "⅕": "one fifth",
  "⅖": "two fifths",
  "⅗": "three fifths",
  "⅘": "four fifths",
  "⅛": "one eighth",
  "⅜": "three eighths",
  "⅝": "five eighths",
  "⅞": "seven eighths",
};

function spokenFraction(numerator: string, denominator: string) {
  if (numerator === "□" || denominator === "□") {
    return `${numerator === "□" ? "blank" : numerator} over ${denominator === "□" ? "blank" : denominator}`;
  }
  const common = VULGAR_FRACTIONS[`${numerator}/${denominator}`];
  if (common) return common;
  if (numerator === "1") {
    const names: Record<string, string> = { "2": "one half", "3": "one third", "4": "one quarter", "5": "one fifth", "8": "one eighth", "10": "one tenth", "100": "one hundredth" };
    return names[denominator] ?? `${numerator} over ${denominator}`;
  }
  const names: Record<string, string> = { "2": "halves", "3": "thirds", "4": "quarters", "5": "fifths", "8": "eighths", "10": "tenths", "100": "hundredths" };
  return names[denominator] ? `${numerator} ${names[denominator]}` : `${numerator} over ${denominator}`;
}

function normaliseFractionTokens(value: string) {
  return String(value ?? "").replace(/(?<!\[)(-?\d+|□)\/(-?\d+|□)(?!\])/g, "[[$1/$2]]");
}

function accessibleMath(value: string) {
  let spoken = normaliseFractionTokens(value);
  for (const [symbol, words] of Object.entries(VULGAR_FRACTIONS)) spoken = spoken.replaceAll(symbol, words);
  spoken = spoken.replace(/\[\[((?:-?\d+)|□)\/((?:-?\d+)|□)\]\]/g, (_, numerator, denominator) => spokenFraction(numerator, denominator));
  return spoken
    .replaceAll("□", " blank ")
    .replaceAll("×", " multiplied by ")
    .replaceAll("÷", " divided by ")
    .replaceAll("−", " minus ")
    .replaceAll("≈", " approximately ")
    .replaceAll("=", " equals ")
    .replaceAll("<", " is less than ")
    .replaceAll(">", " is greater than ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionMathScale(value: string) {
  const display = String(value ?? "").trim();
  if (/[A-Za-z]{3}/.test(display)) return "question-math--prose";
  if (display.length > 26) return "question-math--long";
  if (display.length > 16) return "question-math--medium";
  return "question-math--short";
}

function MathText({ value }: { value: string }) {
  const segments = normaliseFractionTokens(value).split(/(\[\[(?:-?\d+|□)\/(?:-?\d+|□)\]\])/g);
  return (
    <>
      {segments.map((segment, index) => {
        const match = segment.match(/^\[\[((?:-?\d+)|□)\/((?:-?\d+)|□)\]\]$/);
        if (!match) return <span key={`${segment}-${index}`}>{segment}</span>;
        return (
          <span className="fraction" aria-label={spokenFraction(match[1], match[2])} key={`${segment}-${index}`}>
            <span>{match[1]}</span>
            <span>{match[2]}</span>
          </span>
        );
      })}
    </>
  );
}

function useDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
    const focusFirst = () => {
      const preferred = dialog.querySelector<HTMLElement>("[autofocus], [data-initial-focus]");
      (preferred ?? dialog.querySelector<HTMLElement>(focusableSelector) ?? dialog).focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return dialogRef;
}

function FractionEntry({ value }: { value: string }) {
  const [numerator = "", denominator = ""] = value.split("/");
  if (!value.includes("/")) return <MathText value={value} />;

  const description = denominator
    ? spokenFraction(numerator, denominator)
    : `${numerator || "blank"} over blank`;

  return (
    <span className="fraction fraction--entry" aria-label={description}>
      <span>{numerator || "\u00a0"}</span>
      <span>{denominator || "\u00a0"}</span>
    </span>
  );
}

function AxisControl({
  id,
  label,
  description,
  value,
  setValue,
  anchors,
  compact = false,
  min = 0,
  max = 100,
}: {
  id: string;
  label: string;
  description?: string;
  value: number;
  setValue: (value: number) => void;
  anchors: Array<{ value: number; label: string }>;
  compact?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className={`axis ${compact ? "axis--compact" : ""}`}>
      <div className="axis__heading">
        {description ? (
          <div className="axis__title">
            <label htmlFor={id}>{label}</label>
            <small>{description}</small>
          </div>
        ) : <label htmlFor={id}>{label}</label>}
        <output htmlFor={id}>{nearestLabel(value, anchors)}</output>
      </div>
      <input
        id={id}
        aria-valuetext={nearestLabel(value, anchors)}
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        style={{ "--range-progress": `${max === min ? 100 : ((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      {!compact && (
        <div className="axis__labels" aria-hidden="true">
          {anchors.map((anchor) => (
            <span key={anchor.value}>{anchor.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function VisualScaffold({ visual }: { visual: VisualData }) {
  if (!visual) return null;
  const format = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

  if (visual.kind === "place-value") {
    const rows = Array.isArray(visual.rows) ? visual.rows as number[][] : [];
    return (
      <div className="visual-model place-grid" role="img" aria-label={`${accessibleMath(visual.title)}. A place-value grid with thousands, hundreds, tens and ones.`}>
        <div className="place-grid__head"><span>Th</span><span>H</span><span>T</span><span>O</span></div>
        {rows.map((row: number[], rowIndex: number) => (
          <div className="place-grid__row" key={rowIndex}>
            {rowIndex > 0 && <b>{visual.operator ?? ""}</b>}
            {row.map((digit, index) => <span key={index}>{digit}</span>)}
          </div>
        ))}
      </div>
    );
  }

  if (visual.kind === "base-ten") {
    const value = Math.max(0, Math.round(visual.value ?? 0));
    const places = [
      { label: "Th", value: Math.floor(value / 1000) },
      { label: "H", value: Math.floor(value / 100) % 10 },
      { label: "T", value: Math.floor(value / 10) % 10 },
      { label: "O", value: value % 10 },
    ];
    return (
      <div className="visual-model base-ten" role="img" aria-label={`${visual.title}: ${format(value)}`}>
        {places.map((place) => <span key={place.label}><small>{place.label}</small><b>{place.value}</b></span>)}
      </div>
    );
  }

  if (visual.kind === "array") {
    const rowCount = typeof visual.rows === "number" ? visual.rows : 1;
    const columnCount = visual.columns ?? 1;
    const total = rowCount * columnCount;
    const dots = Math.min(total, 96);
    return (
      <div className="visual-model array-model" role="img" aria-label={`${accessibleMath(visual.title)}. ${total} counters arranged in ${Math.ceil(total / columnCount)} rows of up to ${columnCount}.`} style={{ "--array-columns": Math.min(columnCount, 12) } as React.CSSProperties}>
        {Array.from({ length: dots }, (_, index) => <i key={index} />)}
      </div>
    );
  }

  if (visual.kind === "partition") {
    return (
      <div className="visual-model partition-model" role="img" aria-label={`${accessibleMath(visual.title)}. Parts: ${(visual.parts ?? []).map(format).join(", ")}.`}>
        <div className="partition-model__root">× {visual.multiplier ?? 1}</div>
        <div className="partition-model__branches">
          {(visual.parts ?? []).map((part: number) => <span key={part}>{part} × {visual.multiplier ?? 1}</span>)}
        </div>
      </div>
    );
  }

  if (visual.kind === "groups") {
    const total = Number(visual.total ?? 0);
    const groupSize = Math.max(1, visual.groupSize ?? 1);
    const groups = Math.min(Math.ceil(total / groupSize), 12);
    return (
      <div className="visual-model groups-model" role="img" aria-label={`${accessibleMath(visual.title)}. ${groups} equal groups of ${visual.groupSize ?? visual.perGroup ?? 1}.`}>
        {Array.from({ length: groups }, (_, index) => <span key={index}>{groupSize}</span>)}
      </div>
    );
  }

  if (visual.kind === "counters") {
    const groups = Math.min(visual.groups ?? 1, 12);
    const perGroup = Math.min(visual.perGroup ?? 1, 12);
    return (
      <div className="visual-model counter-groups" role="img" aria-label={visual.title}>
        {Array.from({ length: groups }, (_, group) => (
          <span key={group}>{Array.from({ length: perGroup }, (_, counter) => <i key={counter} />)}</span>
        ))}
      </div>
    );
  }

  if (visual.kind === "ten-frame") {
    const total = Math.min(visual.total ?? 10, 20);
    return (
      <div className="visual-model ten-frame" role="img" aria-label={`${visual.title}: ${visual.filled ?? 0} of ${total}`}>
        {Array.from({ length: total }, (_, index) => <i className={index < (visual.filled ?? 0) ? "is-filled" : ""} key={index} />)}
      </div>
    );
  }

  if (visual.kind === "part-whole") {
    return (
      <div className="visual-model part-whole" role="img" aria-label={`${visual.title}: ${visual.whole} split into ${(visual.parts ?? []).join(" and ")}`}>
        <strong>{format(visual.whole ?? 0)}</strong>
        <i aria-hidden="true" />
        <div>{(visual.parts ?? []).map((part) => <span key={part}>{format(part)}</span>)}</div>
      </div>
    );
  }

  if (visual.kind === "multiplication-rectangle") {
    return (
      <div className="visual-model multiplication-rectangle" role="img" aria-label={`${accessibleMath(visual.title)}. A multiplication rectangle split into ${(visual.parts ?? []).map(format).join(" and ")}.`}>
        <b>× {visual.factor ?? 1}</b>
        <div>{(visual.parts ?? []).map((part) => <span key={part}>{format(part)} × {visual.factor ?? 1}</span>)}</div>
      </div>
    );
  }

  if (visual.kind === "fraction-strip") {
    const denominator = Math.max(1, visual.denominator ?? 1);
    return (
      <div className="visual-model fraction-strip" role="img" aria-label={`${visual.title}: ${visual.numerator ?? 0} of ${denominator} equal parts`}>
        {Array.from({ length: denominator }, (_, index) => (
          <span className={index < (visual.numerator ?? 0) ? "is-filled" : ""} key={index} />
        ))}
      </div>
    );
  }

  if (visual.kind === "bar-model") {
    const segments = Math.max(1, visual.segments ?? 1);
    return (
      <div className="visual-model bar-model" role="img" aria-label={`${visual.title}: ${visual.filled ?? 0} of ${segments} equal parts`}>
        <div>{Array.from({ length: segments }, (_, index) => <span className={index < (visual.filled ?? 0) ? "is-filled" : ""} key={index} />)}</div>
        {visual.total !== null && visual.total !== undefined && <small>whole = {format(Number(visual.total))}</small>}
      </div>
    );
  }

  if (visual.kind === "hundred-grid") {
    const filled = Math.max(0, Math.min(100, visual.filled ?? 0));
    return (
      <div className="visual-model hundred-grid" role="img" aria-label={`${visual.title}: ${filled} hundredths shaded`}>
        {Array.from({ length: 100 }, (_, index) => <i className={index < filled ? "is-filled" : ""} key={index} />)}
      </div>
    );
  }

  if (visual.kind === "number-line" || visual.kind === "bead-string") {
    const min = visual.min ?? 0;
    const max = visual.max ?? min + 1;
    const markers = visual.markers ?? visual.points ?? [];
    const span = Math.max(0.0001, max - min);
    const divisions = visual.ticks ? ` with ${visual.ticks} marked divisions` : "";
    const markerDescription = markers.length
      ? markers.map((marker, index) => visual.unknown === index ? `marker ${index + 1} is the missing value` : `marker ${index + 1} is at ${format(marker)}`).join("; ")
      : "no extra markers";
    return (
      <div className={`visual-model number-line ${visual.kind === "bead-string" ? "bead-string" : ""}`} role="img" aria-label={`${accessibleMath(visual.title)}. From ${format(min)} to ${format(max)}${divisions}; ${markerDescription}.`}>
        <div className="number-line__track">
          <i aria-hidden="true" />
          {markers.map((marker, index) => (
            <span className="number-line__marker" style={{ left: `${Math.max(0, Math.min(100, ((marker - min) / span) * 100))}%` }} key={`${marker}-${index}`}>
              <b aria-hidden="true" />
              <small><MathText value={visual.unknown === index ? "□" : format(marker)} /></small>
            </span>
          ))}
        </div>
        <div className="number-line__ends"><span>{format(min)}</span><span>{format(max)}</span></div>
      </div>
    );
  }

  if (visual.kind === "worked-example") {
    return (
      <div className="visual-model worked-example" role="img" aria-label={`${accessibleMath(visual.title)}. ${(visual.lines ?? []).map(accessibleMath).join(". ")}`}>
        {(visual.lines ?? []).map((line, index) => <span key={index}><MathText value={line} /></span>)}
      </div>
    );
  }

  return (
    <div className="visual-model relationship-model" role="img" aria-label={`${accessibleMath(visual.title)}. ${accessibleMath(visual.left ?? "known fact")} ${visual.connector ?? "helps with"} ${accessibleMath(visual.right ?? "new fact")}.`}>
      <span><MathText value={visual.left ?? "known fact"} /></span>
      <i><small>{visual.connector ?? "helps"}</small></i>
      <span><MathText value={visual.right ?? "new fact"} /></span>
    </div>
  );
}

function visualsEquivalent(first?: VisualData | null, second?: VisualData | null) {
  if (!first || !second || first.kind !== second.kind) return false;
  const { title: _firstTitle, ...firstValues } = first;
  const { title: _secondTitle, ...secondValues } = second;
  return JSON.stringify(firstValues) === JSON.stringify(secondValues);
}

function visibleScaffoldStage(item: QuestionItem | null, stage: number) {
  if (!item) return Math.max(0, Math.min(4, stage));
  return stage === 2 && visualsEquivalent(item.promptVisual, item.scaffold.visual) ? 3 : Math.max(0, Math.min(4, stage));
}

function nextScaffoldStage(item: QuestionItem | null, stage: number) {
  const visible = visibleScaffoldStage(item, stage);
  if (visible >= 4) return 4;
  if (visible === 1 && item && visualsEquivalent(item.promptVisual, item.scaffold.visual)) return 3;
  return visible + 1;
}

function scaffoldActionLabel(item: QuestionItem | null, stage: number) {
  const visible = visibleScaffoldStage(item, stage);
  if (visible >= 4) return "Model shown";
  return ({ 1: "Hint", 2: "Show it", 3: "Steps", 4: "Model" } as const)[nextScaffoldStage(item, stage) as 1 | 2 | 3 | 4];
}

function shouldShowQuestionDisplay(item: QuestionItem) {
  if (item.type !== "choice") return true;
  const display = item.display.trim();
  if (/^choose\b/i.test(display)) return false;
  if (/^(three share one value or rule|compare without long addition|choose without long multiplication|complete the whole)$/i.test(display)) return false;
  if (item.promptVisual && /^(read\b|correct or find\b)/i.test(display)) return false;
  return true;
}

function ScaffoldPanel({ item, stage, onHide }: { item: QuestionItem; stage: number; onHide?: () => void }) {
  const visibleStage = visibleScaffoldStage(item, stage);
  if (visibleStage <= 0 || !item) return null;
  const scaffold = item.scaffold;
  const heading = ({ 1: "Hint", 2: "See it", 3: "Steps", 4: "Model" } as const)[visibleStage as 1 | 2 | 3 | 4];
  return (
    <aside className={`scaffold scaffold--stage-${visibleStage}`} aria-live="polite">
      {visibleStage === 1 && (
        <div className="scaffold__hint">
          <header className="scaffold__heading"><span>{heading}</span>{onHide && <button type="button" onClick={onHide}>Hide help</button>}</header>
          <p><MathText value={scaffold.hint} /></p>
        </div>
      )}
      {visibleStage === 2 && (
        <div className="scaffold__visual">
          <header className="scaffold__heading"><span>{heading}</span>{onHide && <button type="button" onClick={onHide}>Hide help</button>}</header>
          <p className="scaffold__caption">{scaffold.visual.title}</p>
          <VisualScaffold visual={scaffold.visual} />
        </div>
      )}
      {visibleStage === 3 && (
        <div className="scaffold__steps">
          <header className="scaffold__heading"><span>{heading}</span>{onHide && <button type="button" onClick={onHide}>Hide help</button>}</header>
          <ol>
            {scaffold.steps.map((step: string, index: number) => <li key={index}><MathText value={step} /></li>)}
          </ol>
        </div>
      )}
      {visibleStage === 4 && (
        <div className="scaffold__model">
          <header className="scaffold__heading"><span>{heading}</span>{onHide && <button type="button" onClick={onHide}>Hide help</button>}</header>
          <strong><MathText value={scaffold.model.display} /></strong>
          {scaffold.model.lines.map((line: string, index: number) => <p key={index}><MathText value={line} /></p>)}
          <b>= <MathText value={scaffold.model.answer} /></b>
          <small>Now try the question.</small>
        </div>
      )}
    </aside>
  );
}

function NumberPad({
  value,
  setValue,
  allowDecimal,
  allowFraction,
  disabled,
}: {
  value: string;
  setValue: (value: string) => void;
  allowDecimal: boolean;
  allowFraction: boolean;
  disabled: boolean;
}) {
  const add = (character: string) => {
    if (disabled || value.length >= 12) return;
    if ((character === "." && value.includes(".")) || (character === "/" && value.includes("/"))) return;
    if (character === "/" && !value) return;
    setValue(value + character);
  };
  return (
    <div className="number-pad" aria-label="Number pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
        <button type="button" onClick={() => add(String(number))} disabled={disabled} key={number}>{number}</button>
      ))}
      <button type="button" className="number-pad__utility" onClick={() => setValue(value.slice(0, -1))} disabled={disabled || !value} aria-label="Delete last digit">⌫</button>
      <button type="button" className={!allowDecimal && !allowFraction ? "number-pad__zero number-pad__zero--wide" : "number-pad__zero"} onClick={() => add("0")} disabled={disabled}>0</button>
      {(allowDecimal || allowFraction) && (
        <button
          type="button"
          className="number-pad__utility"
          onClick={() => add(allowFraction ? "/" : ".")}
          disabled={disabled || (allowFraction ? !value || value.includes("/") : value.includes("."))}
          aria-label={allowFraction ? "Fraction line" : "Decimal point"}
        >{allowFraction ? "⁄" : "."}</button>
      )}
    </div>
  );
}

function FullscreenButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="fullscreen-button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Exit full screen" : "Enter full screen"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {active ? (
          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
        ) : (
          <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
        )}
      </svg>
      <span>{active ? "Exit full screen" : "Full screen"}</span>
    </button>
  );
}

function ModeSelector({
  mode,
  setMode,
  focus,
  setFocus,
  challenge,
  myMixAvailable,
  expanded,
  setExpanded,
}: {
  mode: PracticeMode;
  setMode: (mode: PracticeMode) => void;
  focus: string | null;
  setFocus: (focus: string | null) => void;
  challenge: number;
  myMixAvailable: boolean;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}) {
  const visibleModes = MODES.filter((item) => item.id !== "my-mix" || myMixAvailable);
  const availableFocus = FOCUS_OPTIONS.filter((item) => item !== "Fractions" || challenge >= 20).filter((item) => item !== "Decimals" || challenge >= 38);
  const selected = MODES.find((item) => item.id === mode) ?? MODES[0];
  return (
    <div className={`mode-selector ${expanded ? "is-open" : ""}`}>
      <button type="button" className="mode-selector__trigger" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>Practice options</span><b>{selected.label}</b><i aria-hidden="true">{expanded ? "−" : "+"}</i>
      </button>
      {expanded && (
        <div className="mode-selector__panel">
          <div className="mode-options" aria-label="Practice mode">
            {visibleModes.map((item) => (
              <button
                type="button"
                aria-pressed={mode === item.id}
                className={mode === item.id ? "is-selected" : ""}
                onClick={() => {
                  setMode(item.id);
                  if (item.id === "focus" && !focus) setFocus(availableFocus[0]?.toLowerCase() ?? "addition");
                }}
                key={item.id}
              >
                <b>{item.label}</b><small>{item.note}</small>
              </button>
            ))}
          </div>
          {mode === "focus" && (
            <label className="focus-select">
              <span>Area</span>
              <select value={focus ?? availableFocus[0]?.toLowerCase()} onChange={(event) => setFocus(event.target.value)}>
                {availableFocus.map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function JotPad({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (history.current.length >= 4 && !window.confirm("Clear the current jotting?")) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [];
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = history.current.pop();
    if (!canvas || !context || !previous) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(previous, 0, 0);
    context.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const nextWidth = Math.round(bounds.width * ratio);
      const nextHeight = Math.round(bounds.height * ratio);
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      const snapshot = canvas.width > 0 && canvas.height > 0 ? document.createElement("canvas") : null;
      if (snapshot) {
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      }
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const context = canvas.getContext("2d");
      if (context) {
        if (snapshot) context.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, nextWidth, nextHeight);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 2.4;
        context.strokeStyle = "#24375d";
      }
      history.current = [];
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  return (
    <div className="jot-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="jot-sheet" role="dialog" aria-modal="true" aria-label="Temporary jotting space" tabIndex={-1}>
        <header><span>Jot</span><div><button type="button" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>Pen</button><button type="button" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>Eraser</button><button type="button" onClick={undo}>Undo</button><button type="button" onClick={clear}>Clear</button><button type="button" onClick={onClose} aria-label="Close jotting space">Done</button></div></header>
        <canvas
          ref={canvasRef}
          aria-label="Draw temporary working here"
          onPointerDown={(event) => {
            drawing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            const context = event.currentTarget.getContext("2d");
            if (context) {
              history.current.push(context.getImageData(0, 0, event.currentTarget.width, event.currentTarget.height));
              history.current = history.current.slice(-12);
              context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
              context.lineWidth = tool === "eraser" ? 22 : 2.4;
            }
            const start = point(event);
            context?.beginPath();
            context?.moveTo(start.x, start.y);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const context = event.currentTarget.getContext("2d");
            const next = point(event);
            context?.lineTo(next.x, next.y);
            context?.stroke();
          }}
          onPointerUp={() => { drawing.current = false; }}
          onPointerCancel={() => { drawing.current = false; }}
        />
      </section>
    </div>
  );
}

function SettingsPanel({
  preferences,
  setPreferences,
  onClose,
  onReset,
}: {
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()} tabIndex={-1}>
        <div className="sheet-heading">
          <div><span>Preferences</span><h2 id="settings-title">Make Fluency comfortable</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings" autoFocus>×</button>
        </div>
        <label className="setting-row">
          <span><b>Larger mathematics</b><small>Increase question text and numerals</small></span>
          <input type="checkbox" checked={preferences.largerText} onChange={(event) => setPreferences({ ...preferences, largerText: event.target.checked })} />
        </label>
        <label className="setting-row">
          <span><b>Stronger contrast</b><small>Darken text and control edges</small></span>
          <input type="checkbox" checked={preferences.strongerContrast} onChange={(event) => setPreferences({ ...preferences, strongerContrast: event.target.checked })} />
        </label>
        <label className="setting-row">
          <span><b>Reduce motion</b><small>Remove transitions and movement</small></span>
          <input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => setPreferences({ ...preferences, reducedMotion: event.target.checked })} />
        </label>
        <label className="setting-row">
          <span><b>Larger touch controls</b><small>Give buttons and number keys more space</small></span>
          <input type="checkbox" checked={preferences.largerTargets} onChange={(event) => setPreferences({ ...preferences, largerTargets: event.target.checked })} />
        </label>
        <label className="setting-row">
          <span><b>Simpler screen</b><small>Hide non-essential session detail</small></span>
          <input type="checkbox" checked={preferences.simplifiedDensity} onChange={(event) => setPreferences({ ...preferences, simplifiedDensity: event.target.checked })} />
        </label>
        <button type="button" className="text-button text-button--danger" onClick={onReset}>Reset pupil preferences and practice memory</button>
      </section>
    </div>
  );
}

function ProfilePicker({ profiles, activeId, onSelect, onClose }: { profiles: TeacherProfile[]; activeId?: string; onSelect: (profileId: string | null) => void; onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  const [query, setQuery] = useState("");
  const visible = profiles.filter((profile) => !profile.archived && profile.displayName.toLowerCase().includes(query.toLowerCase())).sort((left, right) => left.displayName.localeCompare(right.displayName));
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="profile-picker" role="dialog" aria-modal="true" aria-labelledby="profile-picker-title" onMouseDown={(event) => event.stopPropagation()} tabIndex={-1}>
        <header className="sheet-heading"><div><span>On this device</span><h2 id="profile-picker-title">Who is practising?</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close profile selection">×</button></header>
        {profiles.length > 12 && <label className="profile-search"><span>Find a profile</span><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
        <div className="profile-grid">
          <button type="button" data-initial-focus className={!activeId ? "is-selected" : ""} onClick={() => { onSelect(null); onClose(); }}><i aria-hidden="true">○</i><span><b>Guest</b><small>No evidence saved</small></span></button>
          {visible.map((profile) => <button type="button" className={activeId === profile.id ? "is-selected" : ""} onClick={() => { onSelect(profile.id); onClose(); }} key={profile.id}><i aria-hidden="true">{profile.symbol ?? "●"}</i><span><b>{profile.displayName}</b><small>{profile.classLabel ?? "This device"}</small></span></button>)}
        </div>
      </section>
    </div>
  );
}

function TeacherGate({ mode, pin, error, setPin, onNoCode, onSubmit, onClose }: { mode: "choose" | "unlock"; pin: string; error: string; setPin: (value: string) => void; onNoCode: () => void; onSubmit: () => void; onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="teacher-gate" role="dialog" aria-modal="true" aria-labelledby="teacher-gate-title" onMouseDown={(event) => event.stopPropagation()} tabIndex={-1}>
        <header className="sheet-heading"><div><span>Teacher tools</span><h2 id="teacher-gate-title">{mode === "choose" ? "Choose local access" : "Enter the local code"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close teacher access">×</button></header>
        {mode === "choose" && <p>A four-digit code can prevent accidental pupil access on this device. It is not an account or strong security.</p>}
        <label className="teacher-pin-field"><span>Four-digit code{mode === "choose" ? " · optional" : ""}</span><input autoFocus type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); }} onKeyDown={(event) => { if (event.key === "Enter") onSubmit(); }} /></label>
        {error && <p className="teacher-gate-error" role="alert">{error}</p>}
        <div className="teacher-gate-actions"><button type="button" className="primary-button" onClick={onSubmit}>{mode === "choose" ? "Use this code" : "Open teacher tools"}</button>{mode === "choose" && <button type="button" className="text-button" onClick={onNoCode}>Continue without a code</button>}</div>
      </section>
    </div>
  );
}

function BoardHelpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="board-help" role="dialog" aria-modal="true" aria-labelledby="board-help-title" onMouseDown={(event) => event.stopPropagation()} tabIndex={-1}>
        <header className="sheet-heading">
          <div><span>Class view</span><h2 id="board-help-title">Keyboard controls</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close keyboard controls" autoFocus>×</button>
        </header>
        <dl>
          <div><dt>Space</dt><dd>Reveal next stage</dd></div>
          <div><dt>N</dt><dd>Next question</dd></div>
          <div><dt>H</dt><dd>Hint</dd></div>
          <div><dt>M</dt><dd>Model</dd></div>
          <div><dt>A</dt><dd>Another way</dd></div>
          <div><dt>J</dt><dd>Jot</dd></div>
          <div><dt>F</dt><dd>Full screen</dd></div>
          <div><dt>Escape</dt><dd>Close or leave class view</dd></div>
        </dl>
      </section>
    </div>
  );
}

export default function FluencyApp() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [challenge, setChallenge] = useState(54);
  const [support, setSupport] = useState(26);
  const [effectiveSupport, setEffectiveSupport] = useState(26);
  const [mode, setMode] = useState<PracticeMode>("mix");
  const [focus, setFocus] = useState<string | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const [question, setQuestion] = useState<QuestionItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [feedbackText, setFeedbackText] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [scaffoldStage, setScaffoldStage] = useState(0);
  const [scaffoldScrollRequest, setScaffoldScrollRequest] = useState(0);
  const [controlOpen, setControlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jotOpen, setJotOpen] = useState(false);
  const [anotherWayOpen, setAnotherWayOpen] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const [boardAnswerVisible, setBoardAnswerVisible] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [elapsed, setElapsed] = useState(0);
  const [independentStreak, setIndependentStreak] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [learningState, setLearningState] = useState<Record<string, MasteryState>>({});
  const [classroomState, setClassroomState] = useState<any>(() => createClassroomState({ applicationVersion: APP_VERSION }));
  const [activeProfileIds, setActiveProfileIds] = useState<string[]>([]);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [teacherGateOpen, setTeacherGateOpen] = useState(false);
  const [teacherGateMode, setTeacherGateMode] = useState<"choose" | "unlock">("choose");
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherGateError, setTeacherGateError] = useState("");
  const [teacherLocked, setTeacherLocked] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sharedSession, setSharedSession] = useState<SharedSession | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<any>(null);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);
  const [boardInvitation, setBoardInvitation] = useState("");
  const [boardHelpOpen, setBoardHelpOpen] = useState(false);
  const [boardMoreOpen, setBoardMoreOpen] = useState(false);
  const [lastMisconception, setLastMisconception] = useState<string | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const engineRef = useRef<EngineApi | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveSupportRef = useRef(26);
  const questionStartedAt = useRef(0);
  const statsRef = useRef<SessionStats>(EMPTY_STATS);
  const questionAttemptedRef = useRef(false);
  const boardQuestionIdsRef = useRef(new Set<string>());
  const boardMoreSummaryRef = useRef<HTMLElement | null>(null);
  const sessionEndPendingRef = useRef(false);
  const updateRequestedRef = useRef(false);
  const fullscreenActive = nativeFullscreen || fallbackFullscreen;

  useEffect(() => {
    const syncFullscreenState = () => {
      const legacyDocument = document as Document & { webkitFullscreenElement?: Element | null };
      setNativeFullscreen(Boolean(document.fullscreenElement || legacyDocument.webkitFullscreenElement));
    };
    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fallbackFullscreen]);

  useEffect(() => {
    if (!fallbackFullscreen || boardMode) return;
    const leaveFallbackFullscreen = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallbackFullscreen(false);
    };
    window.addEventListener("keydown", leaveFallbackFullscreen);
    return () => window.removeEventListener("keydown", leaveFallbackFullscreen);
  }, [boardMode, fallbackFullscreen]);

  useEffect(() => {
    if (scaffoldScrollRequest === 0) return;
    if (screen !== "practice" || boardMode || scaffoldStage <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".question-panel > .scaffold")?.scrollIntoView({
        behavior: preferences.reducedMotion ? "auto" : "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [boardMode, preferences.reducedMotion, scaffoldScrollRequest, scaffoldStage, screen]);

  useEffect(() => {
    let saved: { challenge?: number; support?: number; mode?: PracticeMode; focus?: string | null; preferences?: Preferences } | null = null;
    let savedLearning: Record<string, MasteryState> = {};
    let savedClassroom: any = null;
    let savedActiveSession: any = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("year4-fluency-preferences-v2") ?? localStorage.getItem("year4-fluency-preferences-v1") ?? "null");
      savedLearning = JSON.parse(localStorage.getItem(LEARNING_KEY) ?? "{}");
      savedClassroom = JSON.parse(localStorage.getItem(CLASSROOM_KEY) ?? "null");
      savedActiveSession = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) ?? "null");
    } catch {
      // A damaged local record should never block practice.
    }
    const timer = window.setTimeout(() => {
      if (saved) {
        if (Number.isFinite(saved.challenge)) setChallenge(saved.challenge as number);
        if (Number.isFinite(saved.support)) {
          setSupport(saved.support as number);
          setEffectiveSupport(saved.support as number);
          effectiveSupportRef.current = saved.support as number;
        }
        const savedAttempts = Object.values(savedLearning).reduce((total, skill) => total + (skill.attempts ?? 0), 0);
        if (saved.mode && MODES.some((item) => item.id === saved?.mode) && (saved.mode !== "my-mix" || savedAttempts >= 20)) setMode(saved.mode);
        if (typeof saved.focus === "string" || saved.focus === null) setFocus(saved.focus);
        if (saved.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...saved.preferences });
      }
      const migrated = migrateClassroomState(savedClassroom ?? {
        settings: {
          lastChallenge: saved?.challenge,
          lastSupport: saved?.support,
          largerText: saved?.preferences?.largerText,
          highContrast: saved?.preferences?.strongerContrast,
          reducedMotion: saved?.preferences?.reducedMotion,
        },
      }, { applicationVersion: APP_VERSION });
      setClassroomState(migrated);
      setLearningState(savedLearning && typeof savedLearning === "object" ? savedLearning : {});
      if (savedActiveSession?.startedAt && Date.now() - Number(savedActiveSession.startedAt) < 48 * 60 * 60 * 1000) {
        const resumeProfileId = Array.isArray(savedActiveSession.profileIds) ? savedActiveSession.profileIds[0] : null;
        const profileStillAvailable = resumeProfileId && migrated.profiles?.some((profile: any) => profile.id === resumeProfileId && !profile.archived);
        if (profileStillAvailable) {
          setResumeSnapshot(savedActiveSession);
          setActiveProfileIds([resumeProfileId]);
        } else {
          localStorage.removeItem(ACTIVE_SESSION_KEY);
        }
      }
      const shared = decodePracticeConfig(`${window.location.search}${window.location.hash}`);
      if (shared.valid) {
        const config = toTeacherConfig(shared.config);
        setSharedSession({ config, summary: teacherSessionSummary(config) });
        setScreen("share");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ challenge, support, mode, focus, preferences }));
  }, [challenge, support, mode, focus, preferences, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CLASSROOM_KEY, JSON.stringify(classroomState));
  }, [classroomState, hydrated]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateReady(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(worker);
          });
        });
      }).catch(() => {
        // Offline support is progressive; practice must still work if registration is unavailable.
      });
      const onControllerChange = () => {
        if (updateRequestedRef.current) window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (screen !== "practice" || !stats.startedAt) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - stats.startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, stats.startedAt]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    if (screen !== "practice" || !boardMode || !question || !activeSession) return;
    const presentationId = `${activeSession.id}:${question.id}`;
    if (boardQuestionIdsRef.current.has(presentationId)) return;
    boardQuestionIdsRef.current.add(presentationId);
    setStats((current) => {
      const next = { ...current, classQuestions: current.classQuestions + 1 };
      statsRef.current = next;
      return next;
    });
  }, [activeSession, boardMode, question, screen]);

  useEffect(() => {
    if (!hydrated || screen !== "practice" || !activeSession || activeSession.profileIds.length !== 1 || !question) return;
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
      ...activeSession,
      question,
      engineState: engineRef.current?.getState() ?? null,
      stats: { ...stats, elapsed },
      challenge,
      support,
      effectiveSupport,
      mode,
      focus,
      attempts,
      scaffoldStage,
      independentStreak,
      feedback,
      savedAt: Date.now(),
    }));
  }, [activeSession, attempts, challenge, effectiveSupport, elapsed, feedback, focus, hydrated, independentStreak, mode, question, scaffoldStage, screen, stats, support]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const initialStage = useCallback((supportValue: number, item?: QuestionItem | null, config?: TeacherSessionConfig | null) => {
    const band = supportBand(supportValue);
    const stage = { independent: 0, prompted: 0, guided: 2, stepped: 3, modelled: 4 }[band] ?? 0;
    // A teacher's representation frequency controls how often guided support is
    // already visible. The modelled end still shows the complete scaffold, and
    // a quieter guided question can always reveal its model with More help.
    if (config && stage === 2 && item?.metadata.representationSuggested === false) return 1;
    return stage;
  }, []);

  const syncEngineSelection = useCallback((engine: EngineApi) => {
    const selection = engine.getAdaptation();
    setMode(selection.mode);
    setFocus(selection.focus);
  }, []);

  const nextQuestion = useCallback(() => {
    if (!engineRef.current) return;
    const item = engineRef.current.next();
    syncEngineSelection(engineRef.current);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(engineRef.current.getHistory()));
    setQuestion(item);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    questionAttemptedRef.current = false;
    setFeedback("idle");
    setFeedbackText("");
    setLastMisconception(null);
    setAnotherWayOpen(false);
    setBoardMoreOpen(false);
    setBoardInvitation("");
    setBoardAnswerVisible(false);
    const selectedStage = initialStage(effectiveSupportRef.current, item, activeSession?.config);
    setScaffoldStage(item.metadata.connectionKind === "near-transfer" ? Math.min(2, selectedStage) : selectedStage);
    questionStartedAt.current = Date.now();
  }, [activeSession?.config, initialStage, syncEngineSelection]);

  const begin = (presetKey?: keyof typeof PRESETS, configured?: TeacherSessionConfig, selectedProfiles = activeProfileIds) => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    let nextChallenge = challenge;
    let nextSupport = support;
    let nextMode = mode;
    let nextFocus = mode === "focus" ? focus : null;
    let challengeRange: { min: number; max: number } | null = null;
    if (configured) {
      if (configured.challenge.kind === "range") {
        challengeRange = { min: configured.challenge.min, max: configured.challenge.max };
        nextChallenge = Math.round((configured.challenge.min + configured.challenge.max) / 2);
      } else {
        nextChallenge = configured.challenge.value;
      }
      nextSupport = supportModeValue(configured.support);
      nextMode = configured.mode;
      nextFocus = configured.focus === "Mixed" ? null : configured.focus.toLowerCase();
      setChallenge(nextChallenge);
      setSupport(nextSupport);
      setMode(nextMode);
      setFocus(nextFocus);
    } else if (presetKey) {
      const preset = PRESETS[presetKey];
      nextChallenge = preset.challenge;
      nextSupport = preset.support;
      nextFocus = preset.focus;
      nextMode = presetKey === "tables" ? "focus" : "mix";
      setChallenge(nextChallenge);
      setSupport(nextSupport);
      setMode(nextMode);
      setFocus(nextFocus);
    }
    const selection = normalisePracticeSelection({ mode: nextMode, focus: nextFocus, challenge: nextChallenge });
    nextChallenge = selection.challenge;
    nextMode = selection.mode as PracticeMode;
    nextFocus = selection.focus;
    setChallenge(selection.challenge);
    setSupport(nextSupport);
    setMode(nextMode);
    setFocus(nextFocus);
    const startedAt = Date.now();
    const sessionSeed = configured?.seedMode === "same" ? (configured.seed?.trim() || "year-4-fluency") : `practice-${startedAt}`;
    let recentSignatures: string[] = [];
    try {
      recentSignatures = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? localStorage.getItem("year4-fluency-generator-history-v1") ?? "[]");
    } catch {
      recentSignatures = [];
    }
    const reproducible = configured?.seedMode === "same";
    const engine = createEngine({
      seed: sessionSeed,
      challenge: nextChallenge,
      challengeRange,
      support: nextSupport,
      mode: nextMode,
      focus: nextFocus,
      recentSignatures: reproducible ? [] : recentSignatures,
      learningState: reproducible ? {} : learningState,
      ...teacherEngineOptions(configured ?? null),
    }) as unknown as EngineApi;
    engineRef.current = engine;
    effectiveSupportRef.current = nextSupport;
    setEffectiveSupport(nextSupport);
    const freshStats = { ...EMPTY_STATS, startedAt };
    boardQuestionIdsRef.current = new Set();
    statsRef.current = freshStats;
    setStats(freshStats);
    setElapsed(0);
    setIndependentStreak(0);
    setModeOpen(false);
    setBoardMode(false);
    setBoardAnswerVisible(false);
    setAnotherWayOpen(false);
    setBoardMoreOpen(false);
    setBoardInvitation("");
    setLastMisconception(null);
    const session: ActiveSession = {
      id: localId("session"),
      seed: sessionSeed,
      title: configured ? configured.focus : presetKey ? PRESETS[presetKey].label : "Mixed Fluency",
      config: configured ?? null,
      profileIds: selectedProfiles,
      startedAt,
      length: configured?.length ?? { kind: "open" },
    };
    setActiveProfileIds(selectedProfiles);
    setActiveSession(session);
    setResumeSnapshot(null);
    setScreen("practice");
    const item = engine.next();
    syncEngineSelection(engine);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(engine.getHistory()));
    setQuestion(item);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    questionAttemptedRef.current = false;
    setFeedback("idle");
    setScaffoldStage(initialStage(nextSupport, item, configured ?? null));
    questionStartedAt.current = Date.now();
  };

  const resumePractice = () => {
    if (!resumeSnapshot?.question || !resumeSnapshot?.seed) return;
    const savedConfig = resumeSnapshot.config ? toTeacherConfig(resumeSnapshot.config) : null;
    const range = savedConfig?.challenge.kind === "range" ? { min: savedConfig.challenge.min, max: savedConfig.challenge.max } : null;
    const savedChallenge = Number(resumeSnapshot.challenge ?? challenge);
    const savedSupport = Number(resumeSnapshot.support ?? support);
    let recentSignatures: string[] = [];
    try { recentSignatures = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { recentSignatures = []; }
    const engine = createEngine(resumeSnapshot.engineState ? { state: resumeSnapshot.engineState } : {
      seed: resumeSnapshot.seed,
      challenge: savedChallenge,
      challengeRange: range,
      mode: resumeSnapshot.mode ?? "mix",
      focus: resumeSnapshot.focus ?? null,
      recentSignatures,
      learningState,
      ...teacherEngineOptions(savedConfig),
    }) as unknown as EngineApi;
    engineRef.current = engine;
    const savedElapsed = Math.max(0, Number(resumeSnapshot.stats?.elapsed ?? 0));
    const resumedStats = { ...EMPTY_STATS, ...resumeSnapshot.stats, elapsed: savedElapsed, startedAt: Date.now() - savedElapsed * 1000 };
    const savedLength = savedConfig?.length ?? resumeSnapshot.length ?? { kind: "open" };
    const resumedSession: ActiveSession = {
      id: resumeSnapshot.id,
      seed: resumeSnapshot.seed,
      title: resumeSnapshot.title ?? "Practice",
      config: savedConfig,
      profileIds: Array.isArray(resumeSnapshot.profileIds) ? resumeSnapshot.profileIds : [],
      startedAt: resumedStats.startedAt,
      length: savedLength,
    };
    boardQuestionIdsRef.current = new Set();
    statsRef.current = resumedStats;
    setStats(resumedStats);
    setElapsed(savedElapsed);
    setChallenge(savedChallenge);
    setSupport(savedSupport);
    setEffectiveSupport(Number(resumeSnapshot.effectiveSupport ?? savedSupport));
    effectiveSupportRef.current = Number(resumeSnapshot.effectiveSupport ?? savedSupport);
    const resumeAfterCompletedAnswer = resumeSnapshot.feedback === "correct";
    const sessionAlreadyComplete = (savedLength.kind === "questions" && resumedStats.attempted >= savedLength.value && resumeAfterCompletedAnswer)
      || (savedLength.kind === "minutes" && savedElapsed >= savedLength.value * 60);
    setActiveProfileIds(resumedSession.profileIds);
    setActiveSession(resumedSession);
    if (sessionAlreadyComplete) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      setResumeSnapshot(null);
      if (resumedStats.attempted === 0 && resumedStats.classQuestions === 0) {
        setActiveSession(null);
        setScreen("setup");
        return;
      }
      const endedAt = Date.now();
      setClassroomState((current: any) => {
        const next = upsertSession(current, {
          id: resumedSession.id,
          profileIds: resumedSession.profileIds,
          title: resumedSession.title,
          status: "complete",
          config: savedConfig ? toStoredConfig(savedConfig) : normalisePracticeConfig({ mode: resumeSnapshot.mode ?? "mix", focus: resumeSnapshot.focus ?? "mixed", challenge: savedChallenge, support: savedSupport, length: savedLength, seedMode: "same", seed: resumedSession.seed }),
          position: Math.max(resumedStats.attempted, resumedStats.classQuestions),
          startedAt: resumedSession.startedAt,
          updatedAt: endedAt,
          completedAt: endedAt,
          adaptationState: { effectiveSupport: Number(resumeSnapshot.effectiveSupport ?? savedSupport) },
        });
        return { ...next, recentSessionIds: [resumedSession.id, ...next.recentSessionIds.filter((id: string) => id !== resumedSession.id)].slice(0, 12) };
      });
      setScreen("summary");
      return;
    }
    const resumedQuestion = resumeAfterCompletedAnswer ? engine.next() : resumeSnapshot.question;
    syncEngineSelection(engine);
    setQuestion(resumedQuestion);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(resumeAfterCompletedAnswer ? 0 : Number(resumeSnapshot.attempts ?? 0));
    questionAttemptedRef.current = !resumeAfterCompletedAnswer && Number(resumeSnapshot.attempts ?? 0) > 0;
    setFeedback("idle");
    setFeedbackText("");
    setScaffoldStage(resumeAfterCompletedAnswer ? initialStage(Number(resumeSnapshot.effectiveSupport ?? savedSupport), resumedQuestion, savedConfig) : Number(resumeSnapshot.scaffoldStage ?? initialStage(Number(resumeSnapshot.effectiveSupport ?? savedSupport), resumedQuestion, savedConfig)));
    setIndependentStreak(Number(resumeSnapshot.independentStreak ?? 0));
    setScreen("practice");
    questionStartedAt.current = Date.now();
  };

  const recordQuestionAttempt = useCallback(() => {
    if (!question) return;
    if (questionAttemptedRef.current) return;
    questionAttemptedRef.current = true;
    setStats((current) => {
      const strand = question.strand;
      const strandStat = current.strands[strand] ?? { attempted: 0, firstTry: 0 };
      const next = {
        ...current,
        attempted: current.attempted + 1,
        strands: {
          ...current.strands,
          [strand]: {
            attempted: strandStat.attempted + 1,
            firstTry: strandStat.firstTry,
          },
        },
      };
      statsRef.current = next;
      return next;
    });
  }, [question]);

  const recordSuccessfulQuestion = useCallback((wasFirstTry: boolean, usedSupport: boolean, usedModel: boolean) => {
    if (!question) return;
    const independentFirstTry = wasFirstTry && !usedSupport;
    setStats((current) => {
      const strand = question.strand;
      const strandStat = current.strands[strand] ?? { attempted: 0, firstTry: 0 };
      const next = {
        ...current,
        firstTry: current.firstTry + (independentFirstTry ? 1 : 0),
        afterAnotherTry: current.afterAnotherTry + (!wasFirstTry && !usedSupport ? 1 : 0),
        afterSupport: current.afterSupport + (usedSupport && !usedModel ? 1 : 0),
        modelled: current.modelled + (usedModel ? 1 : 0),
        strands: {
          ...current.strands,
          [strand]: {
            ...strandStat,
            firstTry: strandStat.firstTry + (independentFirstTry ? 1 : 0),
          },
        },
      };
      statsRef.current = next;
      return next;
    });
  }, [question]);

  const persistLearning = useCallback(() => {
    if (!engineRef.current) return;
    const nextLearning = engineRef.current.getLearningState();
    setLearningState(nextLearning);
    localStorage.setItem(LEARNING_KEY, JSON.stringify(nextLearning));
  }, []);

  const recordEvidenceEvent = useCallback(({
    finalCorrect,
    firstResponseCorrect,
    usedSupport,
    usedModel,
    responseMs,
    attemptCount,
    misconception,
  }: {
    finalCorrect: boolean;
    firstResponseCorrect: boolean;
    usedSupport: boolean;
    usedModel: boolean;
    responseMs: number;
    attemptCount: number;
    misconception?: string | null;
  }) => {
    if (!question || !activeSession || activeSession.profileIds.length !== 1 || boardMode) return;
    const profileId = activeSession.profileIds[0];
    const challengeBand = activeSession.config?.challenge.kind === "range"
      ? { min: activeSession.config.challenge.min, max: activeSession.config.challenge.max }
      : { min: activeSession.config?.challenge.kind === "fixed" ? activeSession.config.challenge.value : challenge, max: activeSession.config?.challenge.kind === "fixed" ? activeSession.config.challenge.value : challenge };
    const event = {
      id: `event-${activeSession.id}-${question.id}`.replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 100),
      profileId,
      sessionId: activeSession.id,
      timestamp: new Date(questionStartedAt.current || Date.now()).toISOString(),
      family: question.family,
      strand: question.strand,
      subskill: question.subskill,
      questionDifficulty: question.difficulty,
      selectedChallengeBand: challengeBand,
      supportAvailable: effectiveSupportRef.current,
      supportUsed: usedModel ? 100 : usedSupport ? Math.max(25, scaffoldStage * 25) : 0,
      representationShown: scaffoldStage >= 2 ? question.scaffold.visual.kind : question.promptVisual?.kind ?? "",
      attempts: attemptCount,
      firstResponseCorrect,
      finalCorrect,
      misconceptionCode: misconception ?? lastMisconception ?? "",
      relatedSequencePosition: question.metadata.connectionKind ? 1 : 0,
      connectionKind: question.metadata.connectionKind ?? "",
      transfer: question.metadata.connectionKind === "near-transfer",
      questionSignature: `${question.family}:${question.display}:${question.answer}`,
      sessionSeed: activeSession.seed,
      responseMs,
    };
    // One question produces one evidence event. Repeated responses replace that
    // event so an eventual success can update, rather than duplicate, the earlier
    // incorrect evidence.
    setClassroomState((current: any) => appendEvents({
      ...current,
      events: (current.events ?? []).filter((candidate: any) => candidate.id !== event.id),
    }, [event]));
  }, [activeSession, boardMode, challenge, lastMisconception, question, scaffoldStage]);

  const submit = useCallback(() => {
    if (!question || feedback === "correct") return;
    const response = question.type === "choice" ? selectedChoice : answer;
    const result = evaluateAnswer(question, response);
    if (result.empty) {
      setFeedbackText("Enter an answer first.");
      return;
    }
    recordQuestionAttempt();
    if (result.correct) {
      const wasFirstTry = attempts === 0;
      const usedModel = scaffoldStage >= 4;
      const usedSupport = scaffoldStage > 0;
      const responseMs = Date.now() - questionStartedAt.current;
      engineRef.current?.recordResponse({
        item: question,
        correct: true,
        firstTry: wasFirstTry,
        supportUsed: scaffoldStage,
        modelUsed: usedModel,
        responseMs,
      });
      persistLearning();
      recordSuccessfulQuestion(wasFirstTry, usedSupport, usedModel);
      recordEvidenceEvent({
        finalCorrect: true,
        firstResponseCorrect: wasFirstTry,
        usedSupport,
        usedModel,
        responseMs,
        attemptCount: attempts + 1,
      });
      setFeedback("correct");
      setFeedbackText(wasFirstTry ? "Correct" : "You found it");

      const adaptiveTeacherSupport = !activeSession?.config || activeSession.config.support === "adaptive";
      if (wasFirstTry && scaffoldStage === 0 && adaptiveTeacherSupport && (activeSession?.config?.fadeSupport ?? true)) {
        const nextStreak = independentStreak + 1;
        setIndependentStreak(nextStreak);
        if (nextStreak >= 3) {
          const nextEffectiveSupport = adaptiveSupport(effectiveSupportRef.current, "three-independent-correct");
          effectiveSupportRef.current = nextEffectiveSupport;
          setEffectiveSupport(nextEffectiveSupport);
          setIndependentStreak(0);
        }
      } else {
        setIndependentStreak(0);
      }

      advanceTimer.current = setTimeout(nextQuestion, 1_200);
      return;
    }

    const nextAttempts = attempts + 1;
    engineRef.current?.recordResponse({
      item: question,
      correct: false,
      firstTry: false,
      supportUsed: scaffoldStage,
      modelUsed: scaffoldStage >= 4,
      responseMs: Date.now() - questionStartedAt.current,
      misconception: result.misconception,
    });
    persistLearning();
    recordEvidenceEvent({
      finalCorrect: false,
      firstResponseCorrect: false,
      usedSupport: scaffoldStage > 0,
      usedModel: scaffoldStage >= 4,
      responseMs: Date.now() - questionStartedAt.current,
      attemptCount: nextAttempts,
      misconception: result.misconception,
    });
    setLastMisconception(result.misconception ?? null);
    setAttempts(nextAttempts);
    setIndependentStreak(0);
    if (nextAttempts === 1) {
      setFeedback("retry");
      setFeedbackText(result.misconception ?? "Try once more");
      setAnswer("");
      setSelectedChoice("");
      return;
    }

    setFeedback("supported");
    setFeedbackText("Let’s make the structure visible");
    setScaffoldScrollRequest((current) => current + 1);
    setScaffoldStage((current) => Math.min(4, Math.max(nextScaffoldStage(question, current), 2)));
    setAnswer("");
    setSelectedChoice("");
    if (nextAttempts === 2 && (!activeSession?.config || activeSession.config.support === "adaptive")) {
      const nextEffectiveSupport = adaptiveSupport(effectiveSupportRef.current, "repeated-struggle");
      effectiveSupportRef.current = nextEffectiveSupport;
      setEffectiveSupport(nextEffectiveSupport);
    }
  }, [activeSession, answer, attempts, feedback, independentStreak, nextQuestion, persistLearning, question, recordEvidenceEvent, recordQuestionAttempt, recordSuccessfulQuestion, scaffoldStage, selectedChoice]);

  useEffect(() => {
    if (screen !== "practice") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || jotOpen || boardMode || feedback === "correct" || question?.type === "choice") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, select, textarea, [contenteditable='true']")) return;
      const beginEditing = () => {
        setFeedback("idle");
        setFeedbackText("");
      };
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        beginEditing();
        setAnswer((current) => current.length < 12 ? current + event.key : current);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        beginEditing();
        setAnswer((current) => current.slice(0, -1));
        return;
      }
      if (event.key === "." && question?.answerType === "decimal") {
        event.preventDefault();
        beginEditing();
        setAnswer((current) => current.includes(".") ? current : current + ".");
        return;
      }
      if (event.key === "/" && question?.answerType === "fraction" && answer.length > 0) {
        event.preventDefault();
        beginEditing();
        setAnswer((current) => current.includes("/") ? current : current + "/");
        return;
      }
      const answerReady = question?.answerType === "fraction" ? /^-?\d+\/-?\d+$/.test(answer) : Boolean(answer.trim());
      if (event.key === "Enter" && answerReady) {
        if (target?.closest("button, a, summary")) return;
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, boardMode, feedback, jotOpen, question, screen, settingsOpen, submit]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  const changeChallenge = (value: number) => {
    const selection = engineRef.current?.setChallenge(value, challengePermission === "limited")
      ?? normalisePracticeSelection({ mode, focus, challenge: value });
    setChallenge(selection.challenge);
    setMode(selection.mode as PracticeMode);
    setFocus(selection.focus);
  };

  const changeSetupChallenge = (value: number) => {
    const selection = normalisePracticeSelection({ mode, focus, challenge: value });
    setChallenge(selection.challenge);
    setMode(selection.mode as PracticeMode);
    setFocus(selection.focus);
  };

  const changeSupport = (value: number) => {
    setSupport(value);
    setEffectiveSupport(value);
    effectiveSupportRef.current = value;
    setScaffoldScrollRequest((current) => current + 1);
    setScaffoldStage(initialStage(value, question, activeSession?.config));
  };

  const changePracticeMode = (nextMode: PracticeMode) => {
    const selection = engineRef.current?.setMode(nextMode)
      ?? normalisePracticeSelection({ mode: nextMode, focus, challenge });
    setMode(selection.mode as PracticeMode);
    setFocus(selection.focus);
  };

  const changePracticeFocus = (nextFocus: string) => {
    const selectedFocus = nextFocus === "mixed" ? null : nextFocus;
    const selection = engineRef.current?.setFocus(selectedFocus)
      ?? normalisePracticeSelection({ mode, focus: selectedFocus, challenge });
    setMode(selection.mode as PracticeMode);
    setFocus(selection.focus);
  };

  const enterFullscreen = async () => {
    if (fullscreenActive) return;
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
    if (!request) {
      setFallbackFullscreen(true);
      return;
    }
    try {
      await request();
      setFallbackFullscreen(false);
      setNativeFullscreen(true);
    } catch {
      // iPad browsers can reserve native full screen. The in-app fallback still
      // removes every nonessential page edge and fills the available viewport.
      setFallbackFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    const legacyDocument = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (legacyDocument.webkitFullscreenElement && legacyDocument.webkitExitFullscreen) await legacyDocument.webkitExitFullscreen();
    } catch {
      // The visual fallback is always safe to close even if the browser refuses.
    }
    setFallbackFullscreen(false);
    setNativeFullscreen(false);
  };

  const toggleFullscreen = () => {
    if (fullscreenActive) void exitFullscreen();
    else void enterFullscreen();
  };

  const revealHint = () => {
    setScaffoldScrollRequest((current) => current + 1);
    setScaffoldStage((stage) => nextScaffoldStage(question, stage));
  };

  const endSession = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    sessionEndPendingRef.current = false;
    if (statsRef.current.attempted === 0 && statsRef.current.classQuestions === 0) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      setResumeSnapshot(null);
      setActiveSession(null);
      setScreen("setup");
      setControlOpen(false);
      setBoardMode(false);
      if (fullscreenActive) void exitFullscreen();
      return;
    }
    const finalStats = { ...statsRef.current, elapsed: Math.max(1, elapsed) };
    statsRef.current = finalStats;
    setStats(finalStats);
    const endedAt = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...finalStats, challenge, support, mode, focus, endedAt }));
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    setResumeSnapshot(null);
    if (activeSession) {
      setClassroomState((current: any) => {
        const next = upsertSession(current, {
          id: activeSession.id,
          profileIds: activeSession.profileIds,
          title: activeSession.title,
          status: "complete",
          config: activeSession.config ? toStoredConfig(activeSession.config) : normalisePracticeConfig({ mode, focus: focus ?? "mixed", challenge, support, length: { kind: "open" }, seedMode: "same", seed: activeSession.seed }),
          position: Math.max(finalStats.attempted, finalStats.classQuestions),
          startedAt: activeSession.startedAt,
          updatedAt: endedAt,
          completedAt: endedAt,
          adaptationState: engineRef.current ? { effectiveSupport } : {},
        });
        return { ...next, recentSessionIds: [activeSession.id, ...next.recentSessionIds.filter((id: string) => id !== activeSession.id)].slice(0, 12) };
      });
    }
    setScreen("summary");
    setControlOpen(false);
    setBoardMode(false);
    if (fullscreenActive) void exitFullscreen();
  };

  useEffect(() => {
    if (screen !== "practice" || !activeSession) return;
    if (activeSession.length.kind === "questions" && stats.attempted >= activeSession.length.value && feedback === "correct") {
      if (sessionEndPendingRef.current) return;
      sessionEndPendingRef.current = true;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(endSession, 1_200);
      return;
    }
    if (activeSession.length.kind === "minutes" && elapsed >= activeSession.length.value * 60) endSession();
    // endSession intentionally follows the live render state; the two primitive counters are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, elapsed, feedback, screen, stats.attempted]);

  const resetPreferences = () => {
    if (!window.confirm("Reset saved settings and personal practice memory on this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("year4-fluency-preferences-v2");
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LEARNING_KEY);
    localStorage.removeItem("year4-fluency-preferences-v1");
    localStorage.removeItem("year4-fluency-last-session-v1");
    localStorage.removeItem("year4-fluency-generator-history-v1");
    setChallenge(54);
    setSupport(26);
    setEffectiveSupport(26);
    effectiveSupportRef.current = 26;
    setMode("mix");
    setFocus(null);
    setLearningState({});
    setPreferences(DEFAULT_PREFERENCES);
    setSettingsOpen(false);
  };

  const toggleBoardMode = async () => {
    const nextBoardMode = !boardMode;
    setBoardMode(nextBoardMode);
    setBoardAnswerVisible(false);
    setBoardMoreOpen(false);
    if (nextBoardMode) await enterFullscreen();
    else if (fullscreenActive) await exitFullscreen();
  };

  const revealBoardStage = () => {
    if (boardAnswerVisible) return;
    if (visibleScaffoldStage(question, scaffoldStage) < 4) {
      setScaffoldStage((stage) => nextScaffoldStage(question, stage));
    } else setBoardAnswerVisible(true);
  };

  const closeBoardMore = useCallback(() => {
    boardMoreSummaryRef.current?.focus();
    setBoardMoreOpen(false);
  }, []);

  const showRelatedQuestion = () => {
    if (!question) return;
    closeBoardMore();
    const related = question.connections?.[0] ?? engineRef.current?.generateNearTransfer(question);
    if (!related) return nextQuestion();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setQuestion({ ...related, id: related.id || localId("board-related") });
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    questionAttemptedRef.current = false;
    setFeedback("idle");
    setFeedbackText("");
    setLastMisconception(null);
    setScaffoldStage(0);
    setBoardAnswerVisible(false);
    setAnotherWayOpen(false);
    setBoardInvitation("");
    questionStartedAt.current = Date.now();
  };

  const nextBoardQuestion = () => {
    setBoardMoreOpen(false);
    if (activeSession?.length.kind === "questions" && statsRef.current.classQuestions >= activeSession.length.value) {
      endSession();
      return;
    }
    nextQuestion();
  };

  useEffect(() => {
    if (screen !== "practice" || !boardMode) return;
    const onBoardKey = (event: KeyboardEvent) => {
      if (boardHelpOpen || jotOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (boardMoreOpen) closeBoardMore();
        else void toggleBoardMode();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, input, select, textarea, a, summary, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (event.key === " " || key === "spacebar") { event.preventDefault(); revealBoardStage(); return; }
      if (key === "n") { event.preventDefault(); nextBoardQuestion(); return; }
      if (key === "h") { event.preventDefault(); setScaffoldStage((stage) => Math.max(1, stage)); return; }
      if (key === "m") { event.preventDefault(); setScaffoldStage(4); return; }
      if (key === "a" && (question?.scaffold.alternatives.length ?? 0) > 0) { event.preventDefault(); setAnotherWayOpen((open) => !open); return; }
      if (key === "j") { event.preventDefault(); setJotOpen(true); return; }
      if (key === "f") { event.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", onBoardKey);
    return () => window.removeEventListener("keydown", onBoardKey);
  }, [boardAnswerVisible, boardHelpOpen, boardMode, boardMoreOpen, closeBoardMore, fullscreenActive, jotOpen, nextQuestion, question, scaffoldStage, screen]);

  const myMixAvailable = useMemo(() => Object.values(learningState).reduce((total, skill) => total + (skill.attempts ?? 0), 0) >= 20, [learningState]);

  const strandSummary = useMemo(() => {
    const rows = Object.entries(stats.strands).map(([strand, value]) => ({
      strand,
      attempted: value.attempted,
      rate: value.attempted ? value.firstTry / value.attempted : 0,
    }));
    const meaningful = rows.filter((row) => row.attempted >= 2);
    if (meaningful.length < 2) return null;
    const ranked = meaningful.sort((a, b) => b.rate - a.rate || b.attempted - a.attempted);
    if (ranked[0].rate < 0.5 || ranked[0].rate === ranked.at(-1)!.rate) return null;
    return { strongest: ranked[0].strand, practise: ranked.at(-1)!.strand };
  }, [stats.strands]);

  const teacherProfiles = useMemo<TeacherProfile[]>(() => (classroomState.profiles ?? []).map((profile: any) => ({
    id: profile.id,
    displayName: profile.label,
    symbol: profile.symbol,
    classLabel: (classroomState.groups ?? []).filter((group: any) => group.profileIds.includes(profile.id)).map((group: any) => group.name).join(" · ") || undefined,
    archived: profile.archived,
  })), [classroomState.groups, classroomState.profiles]);

  const teacherGroups = useMemo<TeacherGroup[]>(() => (classroomState.groups ?? []).map((group: any) => ({
    id: group.id,
    name: group.name,
    profileIds: group.profileIds,
  })), [classroomState.groups]);

  const teacherPresets = useMemo<TeacherPreset[]>(() => (classroomState.presets ?? [])
    .filter((preset: any) => !preset.builtIn)
    .map((preset: any) => ({ id: preset.id, name: preset.name, note: preset.note, config: toTeacherConfig(preset.config) })), [classroomState.presets]);

  const teacherRecentSessions = useMemo<TeacherRecentSession[]>(() => [...(classroomState.sessions ?? [])]
    .filter((session: any) => session.status === "complete")
    .sort((left: any, right: any) => Date.parse(right.completedAt ?? 0) - Date.parse(left.completedAt ?? 0))
    .slice(0, 8)
    .map((session: any) => ({ id: session.id, label: session.title, usedAt: Date.parse(session.completedAt ?? session.updatedAt ?? 0) || Date.now(), config: toTeacherConfig(session.config) })), [classroomState.sessions]);

  const teacherReviews = useMemo<TeacherProfileReview[]>(() => {
    const evidence = calculateEvidence(classroomState.events ?? []);
    return teacherProfiles.map((profile) => {
      const profileEvents = (classroomState.events ?? []).filter((event: any) => event.profileId === profile.id);
      const skillEvidence = Object.values(evidence[profile.id] ?? {}) as any[];
      const skills = skillEvidence.map((skill) => {
        const matching = profileEvents.filter((event: any) => event.strand === skill.strand && event.subskill === skill.subskill);
        return {
          id: skill.key,
          strand: skill.strand,
          subskill: skill.subskill,
          state: skill.state,
          strength: skill.strength,
          sampleCount: skill.sampleCount,
          independentSuccesses: matching.filter((event: any) => event.finalCorrect && event.firstResponseCorrect && event.supportUsed === 0).length,
          supportedSuccesses: matching.filter((event: any) => event.finalCorrect && (event.supportUsed > 0 || !event.firstResponseCorrect)).length,
          variations: skill.variationCount,
          lastPractised: Date.parse(skill.lastPractised ?? 0) || undefined,
          misconception: skill.misconception ? `May be ${String(skill.misconception.code).replaceAll("-", " ")} (${skill.misconception.count} related responses).` : undefined,
        };
      });
      const challengeBySkill = Object.fromEntries(skillEvidence.map((skill) => {
        const matching = profileEvents.filter((event: any) => event.strand === skill.strand && event.subskill === skill.subskill);
        const mean = matching.length ? matching.reduce((sum: number, event: any) => sum + Number(event.questionDifficulty ?? 52), 0) / matching.length : 52;
        return [skill.key, mean];
      }));
      const recommendations = buildRecommendations(skillEvidence, { challengeBySkill }).map((item: any) => ({
        id: item.id,
        skill: item.skill,
        reason: item.reason,
        challenge: { kind: "range" as const, min: item.suggestedChallengeBand.min, max: item.suggestedChallengeBand.max },
        support: item.suggestedSupport.mode,
        config: toTeacherConfig(item.config),
      }));
      const orderedEvents = [...profileEvents].sort((left: any, right: any) => Date.parse(right.timestamp ?? 0) - Date.parse(left.timestamp ?? 0));
      return {
        profileId: profile.id,
        lastPractised: Date.parse(orderedEvents[0]?.timestamp ?? 0) || undefined,
        sessions: new Set(profileEvents.map((event: any) => event.sessionId)).size,
        questions: profileEvents.length,
        recentlyPractised: [...new Set(orderedEvents.map((event: any) => event.strand))].slice(0, 6) as string[],
        skills,
        recommendations,
      };
    });
  }, [classroomState.events, teacherProfiles]);

  const accessibility: AccessibilitySettings = {
    largerText: preferences.largerText,
    highContrast: preferences.strongerContrast,
    reducedMotion: preferences.reducedMotion,
    simplifiedDensity: preferences.simplifiedDensity,
    largerTargets: preferences.largerTargets,
    screenReaderOptimised: preferences.screenReaderOptimised,
    sound: preferences.sound,
    timedPressure: preferences.timedPressure,
  };

  const updateClassroomSettings = (patch: Record<string, unknown>) => {
    setClassroomState((current: any) => ({ ...current, settings: { ...current.settings, ...patch }, meta: { ...current.meta, updatedAt: new Date().toISOString() } }));
  };

  const openTeacherTools = () => {
    setTeacherGateError("");
    setTeacherPin("");
    if (!classroomState.settings?.teacherAccessConfigured) {
      setTeacherGateMode("choose");
      setTeacherGateOpen(true);
      return;
    }
    if (classroomState.settings.teacherPinHash) {
      setTeacherGateMode("unlock");
      setTeacherGateOpen(true);
      return;
    }
    setTeacherLocked(false);
    setScreen("teacher");
  };

  const enterTeacherToolsWithoutCode = () => {
    updateClassroomSettings({ teacherAccessConfigured: true, teacherPinHash: "" });
    setTeacherGateOpen(false);
    setTeacherLocked(false);
    setScreen("teacher");
  };

  const submitTeacherPin = () => {
    if (!/^\d{4}$/.test(teacherPin)) {
      setTeacherGateError("Enter four digits.");
      return;
    }
    const hash = localPinHash(teacherPin);
    if (teacherGateMode === "unlock" && hash !== classroomState.settings.teacherPinHash) {
      setTeacherGateError("That code does not match.");
      return;
    }
    if (teacherGateMode === "choose") updateClassroomSettings({ teacherAccessConfigured: true, teacherPinHash: hash });
    setTeacherGateOpen(false);
    setTeacherLocked(false);
    setTeacherPin("");
    setScreen("teacher");
  };

  const setAccessibility = (settings: AccessibilitySettings) => {
    setPreferences({
      largerText: settings.largerText,
      strongerContrast: settings.highContrast,
      reducedMotion: settings.reducedMotion,
      simplifiedDensity: settings.simplifiedDensity,
      largerTargets: settings.largerTargets,
      screenReaderOptimised: settings.screenReaderOptimised,
      sound: settings.sound,
      timedPressure: settings.timedPressure,
    });
    updateClassroomSettings({
      largerText: settings.largerText,
      highContrast: settings.highContrast,
      reducedMotion: settings.reducedMotion,
      simplifiedDensity: settings.simplifiedDensity,
      largerTouchControls: settings.largerTargets,
      screenReaderOptimised: settings.screenReaderOptimised,
      sound: settings.sound,
      noTimedPressure: !settings.timedPressure,
    });
  };

  const createProfiles = (drafts: Array<{ displayName: string; symbol: string }>, groupName?: string) => {
    setClassroomState((current: any) => {
      let next = current;
      const ids: string[] = [];
      drafts.forEach((draft) => {
        const id = localId("profile");
        ids.push(id);
        next = upsertProfile(next, { id, label: draft.displayName, symbol: draft.symbol, createdAt: Date.now(), updatedAt: Date.now() });
      });
      if (groupName) next = upsertGroup(next, { id: localId("group"), name: groupName, type: "class", profileIds: ids, createdAt: Date.now(), updatedAt: Date.now() });
      return next;
    });
  };

  const saveTeacherPreset = (preset: Omit<TeacherPreset, "id" | "builtIn">) => {
    setClassroomState((current: any) => upsertPreset(current, { id: localId("preset"), name: preset.name, note: preset.note, config: toStoredConfig(preset.config), createdAt: Date.now(), updatedAt: Date.now() }));
  };

  const updateTeacherPreset = (id: string, preset: Omit<TeacherPreset, "id" | "builtIn">) => {
    setClassroomState((current: any) => upsertPreset(current, { id, name: preset.name, note: preset.note, config: toStoredConfig(preset.config), updatedAt: Date.now() }));
  };

  const duplicateTeacherPreset = (id: string) => {
    const source = teacherPresets.find((preset) => preset.id === id);
    if (source) saveTeacherPreset({ name: `${source.name} copy`, note: source.note, config: source.config });
  };

  const exportEvidence = (format: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") downloadLocalFile(`year-4-fluency-evidence-${stamp}.csv`, "text/csv;charset=utf-8", createCsvSummary(classroomState));
    else downloadLocalFile(`year-4-fluency-evidence-${stamp}.json`, "application/json", JSON.stringify(createEvidenceExport(classroomState, { applicationVersion: APP_VERSION }), null, 2));
  };

  const exportBackup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadLocalFile(`year-4-fluency-backup-${stamp}.json`, "application/json", JSON.stringify(createClassroomBackup(classroomState, { applicationVersion: APP_VERSION }), null, 2));
  };

  const importEvidence = async (file: File) => {
    try {
      const packageValue = JSON.parse(await file.text());
      const firstPreview = previewEvidenceImport(classroomState, packageValue);
      if (!firstPreview.valid) return window.alert(firstPreview.errors.join("\n") || "This evidence file is not valid.");
      const profileMappings: Record<string, any> = {};
      for (const profile of firstPreview.unresolvedProfiles) {
        const availableProfiles = teacherProfiles.filter((candidate) => !candidate.archived);
        if (!availableProfiles.length) {
          profileMappings[profile.id] = window.confirm(`Create a new local profile for “${profile.label}”? Choose Cancel to skip that profile and its evidence.`)
            ? { action: "create" }
            : { action: "skip" };
          continue;
        }
        const options = availableProfiles.map((candidate, index) => `${index + 1} · ${candidate.displayName}`).join("\n");
        const selection = window.prompt(`Import evidence for “${profile.label}”.\n\nType NEW to create a local profile, SKIP to leave it out, or the number of an existing profile:\n\n${options}`, "NEW")?.trim();
        if (!selection || selection.toUpperCase() === "SKIP") profileMappings[profile.id] = { action: "skip" };
        else if (selection.toUpperCase() === "NEW") profileMappings[profile.id] = { action: "create" };
        else {
          const target = availableProfiles[Number(selection) - 1];
          if (!target) {
            window.alert(`“${selection}” is not a listed profile number. This imported profile will be skipped.`);
            profileMappings[profile.id] = { action: "skip" };
          } else profileMappings[profile.id] = { action: "map", profileId: target.id };
        }
      }
      const preview = previewEvidenceImport(classroomState, packageValue, { profileMappings });
      if (!preview.canApply) return window.alert("Profile choices are still required before this evidence can be imported.");
      if (!window.confirm(`Add ${preview.addEvents} evidence events, ignore ${preview.duplicateEvents} duplicates and reject ${preview.rejectedEvents} invalid or skipped records? Existing data will be preserved.`)) return;
      const result = applyEvidenceImport(classroomState, packageValue, { profileMappings });
      if (result.applied) {
        setClassroomState(result.state);
        window.alert(`Import complete. ${Number((result.report as any).appliedEvents ?? preview.addEvents)} events added.`);
      }
    } catch {
      window.alert("This evidence file could not be read.");
    }
  };

  const restoreBackup = async (file: File) => {
    try {
      const packageValue = JSON.parse(await file.text());
      const choice = window.prompt("Type MERGE to preserve current data and add compatible records, or REPLACE to replace current classroom data.", "MERGE")?.trim().toUpperCase();
      if (choice !== "MERGE" && choice !== "REPLACE") return;
      const mode = choice === "REPLACE" ? "replace" : "merge";
      const preview = previewBackupRestore(classroomState, packageValue, { mode });
      if (!preview.valid) return window.alert(preview.errors.join("\n") || "This backup is not valid.");
      if (!window.confirm(`${preview.warning}\n\n${preview.profiles} profiles · ${preview.events} evidence events · ${preview.duplicateEvents} duplicates`)) return;
      if (mode === "replace") exportBackup();
      const result = restoreClassroomBackup(classroomState, packageValue, { mode });
      if (result.restored) {
        setClassroomState(result.state);
        window.alert("Backup restored.");
      }
    } catch {
      window.alert("This backup file could not be read.");
    }
  };

  const createPracticeLink = (config: TeacherSessionConfig) => {
    const url = new URL(window.location.href);
    url.search = `?${encodePracticeConfig(toStoredConfig(config))}`;
    url.hash = "";
    return url.toString();
  };

  const createTeacherPrintPreview = (config: TeacherSessionConfig, options: PrintOptions): PrintPreview => {
    const challenge = config.challenge.kind === "range" ? config.challenge : { min: config.challenge.value, max: config.challenge.value };
    const pack = createPrintPractice({
      title: options.title,
      focus: config.focus === "Mixed" ? null : config.focus.toLowerCase(),
      mode: config.mode,
      challengeMin: challenge.min,
      challengeMax: challenge.max,
      support: config.support,
      count: options.questions,
      seed: config.seedMode === "same" ? (config.seed?.trim() || "year-4-fluency") : `print-${Date.now()}`,
      format: options.format,
      orientation: options.orientation,
      includeAnswers: options.answerSheet,
      includeNameLine: options.nameLine,
      blackAndWhite: options.blackAndWhite,
      subskills: config.subskill ? [config.subskill] : [],
      retrievalWeight: ({ light: 0.12, balanced: 0.28, strong: 0.55 })[config.retrievalWeight],
      includeStrategyQuestions: config.strategyQuestions,
      connectedSequences: config.connectedSequences,
      nearTransfer: config.nearTransfer,
      adaptiveDifficulty: config.adaptiveDifficulty,
      representationFrequency: ({ low: 0.15, balanced: 0.35, high: 0.65 })[config.representationFrequency],
      fixedSequence: config.seedMode === "same",
    }, learningState);
    return {
      title: pack.config.title,
      questions: pack.questions.map((item: any) => ({
        number: item.number,
        display: item.instruction ? `${item.instruction} · ${item.display}` : item.display,
        support: item.support?.kind === "prompt" ? item.support.hint : item.support?.kind === "guided" ? `${item.support.hint} ${item.support.steps.join(" ")}` : item.support?.kind === "model" ? `${item.support.title}: ${item.support.display} ${item.support.lines.join(" ")} = ${item.support.answer}` : undefined,
        visual: item.support?.visual ?? item.promptVisual ?? undefined,
        answer: item.answer,
      })),
    };
  };

  const launchTeacherSession = (config: TeacherSessionConfig, profileIds?: string[]) => {
    setTeacherLocked(true);
    begin(undefined, config, profileIds ?? []);
  };

  const closeTeacherTools = () => {
    setTeacherLocked(true);
    setScreen("setup");
  };

  const setTeacherCode = (code: string | null) => updateClassroomSettings({ teacherAccessConfigured: true, teacherPinHash: code ? localPinHash(code) : "" });

  const deleteProfile = (profileId: string) => {
    setClassroomState((current: any) => ({
      ...current,
      profiles: current.profiles.filter((profile: any) => profile.id !== profileId),
      groups: current.groups.map((group: any) => ({ ...group, profileIds: group.profileIds.filter((id: string) => id !== profileId) })),
      events: current.events.filter((event: any) => event.profileId !== profileId),
      notes: current.notes.filter((note: any) => !(note.subjectType === "profile" && note.subjectId === profileId)),
    }));
    setActiveProfileIds((current) => current.filter((id) => id !== profileId));
  };

  const resetCompleteApplication = () => {
    for (const key of [STORAGE_KEY, SESSION_KEY, HISTORY_KEY, LEARNING_KEY, CLASSROOM_KEY, ACTIVE_SESSION_KEY, "year4-fluency-preferences-v2", "year4-fluency-preferences-v1", "year4-fluency-last-session-v2", "year4-fluency-last-session-v1", "year4-fluency-generator-history-v1"]) localStorage.removeItem(key);
    setClassroomState(createClassroomState({ applicationVersion: APP_VERSION }));
    setLearningState({});
    setPreferences(DEFAULT_PREFERENCES);
    setChallenge(54);
    setSupport(26);
    setMode("mix");
    setFocus(null);
    setActiveProfileIds([]);
    setResumeSnapshot(null);
    setTeacherLocked(true);
    setScreen("setup");
  };

  const pupilProfiles = useMemo<TeacherProfile[]>(() => teacherProfiles.map((profile) => {
    const source = classroomState.profiles.find((item: any) => item.id === profile.id);
    const privacy = classroomState.settings?.profilePrivacy ?? "full";
    let displayName = profile.displayName;
    if (privacy === "first-initial") {
      const parts = profile.displayName.split(/\s+/).filter(Boolean);
      displayName = parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
    }
    if (privacy === "initials") displayName = source?.initials || profile.displayName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 3).toUpperCase();
    if (privacy === "alias") displayName = source?.alias || source?.initials || "Pupil";
    return { ...profile, displayName };
  }), [classroomState.profiles, classroomState.settings?.profilePrivacy, teacherProfiles]);

  const activeProfile = pupilProfiles.find((profile) => profile.id === activeProfileIds[0]);
  const resumeProfileId = Array.isArray(resumeSnapshot?.profileIds) ? resumeSnapshot.profileIds[0] : null;
  const resumeProfile = pupilProfiles.find((profile) => profile.id === resumeProfileId && !profile.archived);
  const visibleResumeSnapshot = resumeSnapshot && resumeProfile && activeProfileIds[0] === resumeProfile.id ? resumeSnapshot : null;
  const selectPupilProfile = (profileId: string | null) => {
    if (resumeSnapshot && profileId !== resumeProfileId) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      setResumeSnapshot(null);
    }
    setActiveProfileIds(profileId ? [profileId] : []);
  };
  const challengePermission = activeSession?.config?.pupilControls.challenge ?? "unlocked";
  const supportPermission = activeSession?.config?.pupilControls.support ?? "unlocked";
  const modePermission = activeSession?.config?.pupilControls.mode ?? "unlocked";
  const focusPermission = activeSession?.config?.pupilControls.focus ?? "unlocked";
  const configuredChallengeRange = activeSession?.config?.challenge.kind === "range" ? activeSession.config.challenge : null;
  const practiceChallengeMin = challengePermission === "limited" && configuredChallengeRange ? configuredChallengeRange.min : 0;
  const practiceChallengeMax = challengePermission === "limited" && configuredChallengeRange ? configuredChallengeRange.max : 100;
  const configuredSupportValue = activeSession?.config ? supportModeValue(activeSession.config.support) : support;
  const practiceSupportMin = supportPermission === "limited" ? Math.max(0, configuredSupportValue - 18) : 0;
  const practiceSupportMax = supportPermission === "limited" ? Math.min(100, configuredSupportValue + 18) : 100;
  const controlsLocked = challengePermission === "locked" && supportPermission === "locked" && modePermission === "locked" && focusPermission === "locked";
  const currentScaffoldStage = visibleScaffoldStage(question, scaffoldStage);
  const boardRevealLabel = boardAnswerVisible
    ? "Answer shown"
    : currentScaffoldStage >= 4
      ? "Reveal answer"
      : `Reveal ${scaffoldActionLabel(question, scaffoldStage).toLowerCase()}`;
  const practiceQuestionCount = boardMode ? stats.classQuestions : stats.attempted;
  const timedLengthMinutes = activeSession?.length.kind === "minutes" ? activeSession.length.value : null;
  const sessionPrimaryText = timedLengthMinutes ? `${timedLengthMinutes}-minute practice` : sessionProgressText(practiceQuestionCount, activeSession);
  const sessionSecondaryText = timedLengthMinutes
    ? preferences.timedPressure
      ? formatDuration(elapsed)
      : timedProgressText(elapsed, timedLengthMinutes * 60)
    : preferences.timedPressure
      ? formatDuration(elapsed)
      : "";
  const classOnlySummary = stats.classQuestions > 0 && stats.attempted === 0;
  const mixedClassAndPupilSummary = stats.classQuestions > 0 && stats.attempted > 0;
  const numericAnswerReady = question?.answerType === "fraction"
    ? /^-?\d+\/-?\d+$/.test(answer)
    : Boolean(answer.trim());
  const questionAnnouncement = question
    ? [question.instruction, shouldShowQuestionDisplay(question) ? question.display : null, question.promptVisual?.title]
      .filter(Boolean)
      .map((part) => accessibleMath(String(part)))
      .join(". ")
    : "";

  const rootClass = [
    "fluency-app",
    preferences.reducedMotion ? "reduce-motion" : "",
    preferences.largerText ? "larger-text" : "",
    preferences.strongerContrast ? "stronger-contrast" : "",
    preferences.simplifiedDensity ? "simplified-density" : "",
    preferences.largerTargets ? "larger-targets" : "",
    preferences.screenReaderOptimised ? "screen-reader-optimised" : "",
    fullscreenActive ? "is-fullscreen" : "",
    fallbackFullscreen ? "app-fullscreen" : "",
    boardMode ? "board-mode" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClass} data-screen={screen} data-adaptive-support={Math.round(effectiveSupport)}>
      {screen !== "teacher" && <a className="skip-link" href="#main-content">Skip to main content</a>}

      {updateReady && screen !== "practice" && <aside className="update-banner" role="status"><span>A newer version is ready.</span><button type="button" onClick={() => { updateRequestedRef.current = true; updateReady.postMessage({ type: "SKIP_WAITING" }); }}>Update now</button><button type="button" onClick={() => setUpdateReady(null)}>Later</button></aside>}

      {screen === "teacher" && !teacherLocked && (
        <TeacherTools
          profiles={teacherProfiles}
          groups={teacherGroups}
          savedPresets={teacherPresets}
          recentSessions={teacherRecentSessions}
          reviews={teacherReviews}
          events={(classroomState.events ?? []).map((event: any) => ({ id: event.id, profileId: event.profileId, sessionId: event.sessionId, timestamp: Date.parse(event.timestamp ?? 0) || 0, strand: event.strand, subskill: event.subskill, family: event.family, difficulty: event.questionDifficulty, firstResponseCorrect: event.firstResponseCorrect, finalCorrect: event.finalCorrect, supportUsed: event.supportUsed, attempts: event.attempts, misconception: event.misconceptionCode || undefined }))}
          notes={(classroomState.notes ?? []).map((note: any) => ({ id: note.id, targetType: note.subjectType, targetId: note.subjectId, text: note.text, createdAt: Date.parse(note.createdAt ?? 0) || Date.now() }))}
          accessibility={accessibility}
          profilePrivacy={classroomState.settings?.profilePrivacy === "first-initial" ? "first-and-initial" : classroomState.settings?.profilePrivacy ?? "full"}
          teacherCodeEnabled={Boolean(classroomState.settings?.teacherPinHash)}
          storageSummary={`${teacherProfiles.length} profiles · ${(classroomState.events ?? []).length} evidence events · stored on this device only`}
          appVersion={APP_VERSION}
          onClose={closeTeacherTools}
          onLock={closeTeacherTools}
          onLaunch={launchTeacherSession}
          onSavePreset={saveTeacherPreset}
          onUpdatePreset={updateTeacherPreset}
          onRenamePreset={(id, name) => { const preset = teacherPresets.find((item) => item.id === id); if (preset) updateTeacherPreset(id, { name, note: preset.note, config: preset.config }); }}
          onDuplicatePreset={duplicateTeacherPreset}
          onDeletePreset={(id) => setClassroomState((current: any) => ({ ...current, presets: current.presets.filter((preset: any) => preset.id !== id || preset.builtIn) }))}
          onCreateProfiles={createProfiles}
          onCreateGroup={(name, profileIds) => setClassroomState((current: any) => upsertGroup(current, { id: localId("group"), name, type: "focus", profileIds, createdAt: Date.now(), updatedAt: Date.now() }))}
          onArchiveProfile={(id) => { const source = classroomState.profiles.find((profile: any) => profile.id === id); if (source) setClassroomState((current: any) => upsertProfile(current, { ...source, archived: true, updatedAt: Date.now() })); }}
          onDeleteProfile={deleteProfile}
          onSetAccessibility={setAccessibility}
          onSetProfilePrivacy={(privacy) => updateClassroomSettings({ profilePrivacy: privacy === "first-and-initial" ? "first-initial" : privacy })}
          onSaveNote={(targetType, targetId, text) => setClassroomState((current: any) => upsertNote(current, { id: localId("note"), subjectType: targetType, subjectId: targetId, text, createdAt: Date.now(), updatedAt: Date.now() }))}
          onSetTeacherCode={setTeacherCode}
          onExportEvidence={exportEvidence}
          onExportBackup={exportBackup}
          onImportEvidence={importEvidence}
          onRestoreBackup={restoreBackup}
          onClearSessionHistory={() => {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            setResumeSnapshot(null);
            setClassroomState((current: any) => ({ ...current, sessions: [], recentSessionIds: [] }));
          }}
          onDeleteAllEvidence={() => setClassroomState((current: any) => ({ ...current, events: [] }))}
          onResetApplication={resetCompleteApplication}
          onCreatePracticeLink={createPracticeLink}
          onRequestPrintPreview={createTeacherPrintPreview}
        />
      )}

      {screen === "share" && sharedSession && (
        <main className="share-screen" id="main-content" tabIndex={-1}>
          <header className="setup-header"><div className="wordmark"><i aria-hidden="true" />Fluency</div></header>
          <section className="share-summary"><p>Shared practice</p><h1>Ready when you are.</h1><strong>{sharedSession.summary}</strong><button type="button" className="primary-button" onClick={() => begin(undefined, sharedSession.config, [])}>Begin</button><button type="button" className="text-button" onClick={() => { window.history.replaceState(null, "", window.location.pathname); setSharedSession(null); setScreen("setup"); }}>Change the settings</button></section>
        </main>
      )}

      {screen === "setup" && (
        <section className="setup-screen" id="main-content" tabIndex={-1}>
          <header className="setup-header">
            <div className="wordmark" aria-label="Year 4 Fluency"><i aria-hidden="true" />Year 4</div>
            <div className="setup-header-actions">
              {pupilProfiles.some((profile) => !profile.archived) && <button type="button" className="profile-button" onClick={() => setProfilePickerOpen(true)}><i aria-hidden="true">{activeProfile?.symbol ?? "○"}</i><span>{activeProfile?.displayName ?? "Guest"}</span></button>}
              <FullscreenButton active={fullscreenActive} onToggle={toggleFullscreen} />
              <button type="button" className="header-text-button" onClick={() => setSettingsOpen(true)}>Settings</button>
            </div>
          </header>

          <div className="setup-intro">
            <p>Mathematics practice</p>
            <h1>Fluency</h1>
            <span className="setup-intro-copy">Choose the challenge and the support. Then begin.</span>
          </div>

          {visibleResumeSnapshot && resumeProfile && (
            <div className="setup-resume-choice">
              <button type="button" className="primary-button resume-primary" onClick={resumePractice}>
                <span>Continue {resumeProfile.displayName}</span>
                <small>{visibleResumeSnapshot.stats?.attempted ?? 0} questions explored</small>
              </button>
              <span>Or set up a new practice below.</span>
            </div>
          )}

          <div className="setup-controls" aria-label="Practice settings">
            <AxisControl id="challenge" label="Challenge" description="How tricky should the maths be?" value={challenge} setValue={changeSetupChallenge} anchors={CHALLENGE_ANCHORS} />
            <AxisControl id="support" label="Support" description="How much help should be available?" value={support} setValue={setSupport} anchors={SUPPORT_ANCHORS} />
          </div>

          <div className="setup-actions">
            <button type="button" className="primary-button" onClick={() => begin()}>{visibleResumeSnapshot ? "Begin new practice" : "Begin"}</button>
            <div className={`setup-options ${modeOpen ? "is-open" : ""}`}>
              <ModeSelector
                mode={mode}
                setMode={(nextMode) => { setMode(nextMode); if (nextMode !== "focus") setFocus(null); }}
                focus={focus}
                setFocus={setFocus}
                challenge={challenge}
                myMixAvailable={myMixAvailable}
                expanded={modeOpen}
                setExpanded={setModeOpen}
              />
              {modeOpen && (
                <div className="quick-starts">
                  <span>Or begin with a ready-made practice</span>
                  <div className="presets" aria-label="Ready-made practice">
                    {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                      <button type="button" onClick={() => begin(key)} key={key}>
                        <span>{PRESETS[key].label}</span>
                        <small>{key === "warmup" ? "Gentle mixed start" : key === "year4" ? "Core Year 4" : key === "stretch" ? "Deep thinking" : "Facts and inverses"}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="setup-footer">
            <span>Quiet practice. No scores or timer pressure.</span>
            <button type="button" className="teacher-entry" onClick={openTeacherTools}>Teacher tools</button>
          </footer>
        </section>
      )}

      {screen === "practice" && question && (
        <section className="practice-screen" id="main-content" tabIndex={-1}>
          <header className="practice-header">
            <button type="button" className="header-text-button header-text-button--finish" onClick={endSession}>Finish</button>
            <div className="session-pulse" aria-label={`${sessionPrimaryText}${sessionSecondaryText ? `. ${sessionSecondaryText}` : ""}`}>
              <span>{sessionPrimaryText}</span>
              {sessionSecondaryText && <><i /><span>{sessionSecondaryText}</span></>}
            </div>
            <div className="practice-tools">
              {boardMode && <button type="button" className="board-button" onClick={toggleBoardMode} aria-pressed="true">Exit teacher view</button>}
              <FullscreenButton active={fullscreenActive} onToggle={toggleFullscreen} />
              <button type="button" className="header-text-button" onClick={() => setSettingsOpen(true)}>Settings</button>
            </div>
          </header>

          <div className={`control-drawer ${controlOpen ? "is-open" : ""} ${controlsLocked ? "is-locked" : ""}`}>
            <button type="button" className="control-drawer__tab" onClick={() => setControlOpen((open) => !open)} aria-expanded={controlOpen}>
              <span>Practice settings</span><i aria-hidden="true">{controlOpen ? "−" : "+"}</i>
            </button>
            {controlOpen && (
              <div className="control-drawer__body">
                {controlsLocked && <p className="control-drawer__notice">Challenge and support are set by the teacher for this session.</p>}
                {challengePermission !== "locked" && <AxisControl compact id="practice-challenge" label="Challenge" value={challenge} setValue={changeChallenge} anchors={CHALLENGE_ANCHORS} min={practiceChallengeMin} max={practiceChallengeMax} />}
                {supportPermission !== "locked" && <AxisControl compact id="practice-support" label="Support" value={support} setValue={changeSupport} anchors={SUPPORT_ANCHORS} min={practiceSupportMin} max={practiceSupportMax} />}
                {(modePermission !== "locked" || focusPermission !== "locked") && (
                  <div className="control-drawer__selects">
                    {modePermission !== "locked" && <label><span>Mode</span><select value={mode} onChange={(event) => changePracticeMode(event.target.value as PracticeMode)}>{MODES.filter((item) => item.id !== "my-mix" || myMixAvailable).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}
                    {focusPermission !== "locked" && <label><span>Focus</span><select value={focus ?? "mixed"} onChange={(event) => changePracticeFocus(event.target.value)}><option value="mixed">Mixed</option>{[...FOCUS_OPTIONS, "Equivalence and Missing Numbers"].map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}</select></label>}
                  </div>
                )}
                {!boardMode && <div className="practice-teacher-option"><div><strong>Teacher-led view</strong><span>Show one question to the whole class.</span></div><button type="button" onClick={toggleBoardMode}>Open teacher view</button></div>}
              </div>
            )}
          </div>

          <div className={`practice-workspace scaffold-stage-${scaffoldStage}`}>
            <article
              className="question-panel"
              aria-labelledby={question.instruction ? "question-instruction" : undefined}
              aria-label={question.instruction ? undefined : `Question: ${accessibleMath(question.display)}`}
            >
              <div className="pupil-sr-only" aria-live="polite" aria-atomic="true">{questionAnnouncement}</div>
              {boardMode && (
                <div className="question-context" aria-label={`${question.strand}, ${challengeLabel(question.difficulty)}, ${MODES.find((item) => item.id === mode)?.label ?? "Mix"}`}>
                  <span>{question.strand}</span>
                  <span aria-hidden="true">·</span>
                  <span>{challengeLabel(question.difficulty)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{MODES.find((item) => item.id === mode)?.label ?? "Mix"}</span>
                </div>
              )}
              {boardMode && boardInvitation && <div className="board-invitation" role="status">{boardInvitation}</div>}
              {question.instruction && <p id="question-instruction" className="question-instruction"><MathText value={question.instruction} /></p>}
              {shouldShowQuestionDisplay(question) && (
                <div className={`question-math ${questionMathScale(question.display)}`} aria-label={`${accessibleMath(question.instruction ?? "Calculate")}: ${accessibleMath(question.display)}`}>
                  <MathText value={question.display} />
                </div>
              )}

              {question.promptVisual && <div className="prompt-visual"><VisualScaffold visual={question.promptVisual} /></div>}

              <ScaffoldPanel item={question} stage={scaffoldStage} onHide={!boardMode ? () => setScaffoldStage(0) : undefined} />

              {anotherWayOpen && question.scaffold.alternatives.length > 0 && (
                <div className="another-way" aria-live="polite">
                  <span>Another way</span>
                  {question.scaffold.alternatives.slice(0, 2).map((alternative) => <p key={alternative}><MathText value={alternative} /></p>)}
                </div>
              )}

              {boardMode && boardAnswerVisible && (
                <div className="board-answer" role="status"><span>Answer</span><strong><MathText value={question.answer} /></strong></div>
              )}

              {!boardMode && question.type !== "choice" && (
                <div className="response-dock">
                  <div className="answer-display" data-empty={!answer} aria-live="polite">
                    {answer
                      ? question.answerType === "fraction"
                        ? <FractionEntry value={answer} />
                        : <MathText value={answer} />
                      : <span>?</span>}
                  </div>
                  <div className={`feedback-line feedback-line--${feedback}`} role="status" aria-live="polite">
                    {feedback === "correct" && <b aria-hidden="true">✓</b>}
                    <span>{feedbackText}</span>
                  </div>
                  <NumberPad
                    value={answer}
                    setValue={(value) => { setAnswer(value); setFeedback("idle"); setFeedbackText(""); }}
                    allowDecimal={question.answerType === "decimal"}
                    allowFraction={question.answerType === "fraction"}
                    disabled={feedback === "correct"}
                  />
                  <div className="question-actions">
                    <button type="button" className="hint-button" onClick={revealHint} disabled={currentScaffoldStage >= 4 || feedback === "correct"}>
                      {scaffoldActionLabel(question, scaffoldStage)}
                    </button>
                    <button type="button" className="check-button" onClick={submit} disabled={feedback === "correct" || !numericAnswerReady}>Check</button>
                  </div>
                  <div className="question-secondary-actions">
                    <button type="button" onClick={() => setJotOpen(true)}>Jot</button>
                    {question.scaffold.alternatives.length > 0 && (currentScaffoldStage > 0 || feedback === "supported") && (
                      <button type="button" onClick={() => setAnotherWayOpen((open) => !open)}>{anotherWayOpen ? "Hide other way" : "Another way"}</button>
                    )}
                  </div>
                </div>
              )}

              {!boardMode && question.type === "choice" && (
                <>
                  <div className="choice-grid" aria-label="Choose an answer">
                    {(question.choices ?? []).map((choice: string) => (
                      <button
                        type="button"
                        aria-pressed={selectedChoice === choice}
                        className={selectedChoice === choice ? "is-selected" : ""}
                        onClick={() => { setSelectedChoice(choice); setFeedback("idle"); setFeedbackText(""); }}
                        disabled={feedback === "correct"}
                        key={choice}
                      ><MathText value={choice} /></button>
                    ))}
                  </div>
                  <div className={`feedback-line feedback-line--${feedback}`} role="status" aria-live="polite">
                    {feedback === "correct" && <b aria-hidden="true">✓</b>}
                    <span>{feedbackText}</span>
                  </div>
                  <div className="question-actions question-actions--choice">
                    <button type="button" className="hint-button" onClick={revealHint} disabled={currentScaffoldStage >= 4 || feedback === "correct"}>
                      {scaffoldActionLabel(question, scaffoldStage)}
                    </button>
                    <button type="button" className="check-button" onClick={submit} disabled={feedback === "correct" || !selectedChoice}>Check</button>
                  </div>
                  <div className="question-secondary-actions">
                    <button type="button" onClick={() => setJotOpen(true)}>Jot</button>
                    {question.scaffold.alternatives.length > 0 && (currentScaffoldStage > 0 || feedback === "supported") && (
                      <button type="button" onClick={() => setAnotherWayOpen((open) => !open)}>{anotherWayOpen ? "Hide other way" : "Another way"}</button>
                    )}
                  </div>
                </>
              )}

              {boardMode ? (
                <div className="board-controls">
                  <button type="button" onClick={revealBoardStage} disabled={boardAnswerVisible}>{boardRevealLabel}</button>
                  <button type="button" onClick={() => setScaffoldStage(4)} disabled={currentScaffoldStage >= 4}>{currentScaffoldStage >= 4 ? "Model shown" : "Model"}</button>
                  <details className="board-more" open={boardMoreOpen} onToggle={(event) => setBoardMoreOpen(event.currentTarget.open)}>
                    <summary ref={boardMoreSummaryRef}>More</summary>
                    <div className="board-more__panel">
                      {question.scaffold.alternatives.length > 0 && <button type="button" onClick={() => { setAnotherWayOpen((open) => !open); closeBoardMore(); }}>Another way</button>}
                      <button type="button" onClick={showRelatedQuestion}>Related question</button>
                      <button type="button" onClick={() => { closeBoardMore(); setJotOpen(true); }}>Jot</button>
                      <button type="button" onClick={() => { closeBoardMore(); setBoardHelpOpen(true); }}>Keyboard help</button>
                      <span>Show a class prompt</span>
                      <div className="board-more__prompts">{["Think", "Show me", "Explain", "Turn and talk", "Estimate first", "Agree or disagree"].map((invitation) => <button type="button" key={invitation} onClick={() => { setBoardInvitation(invitation); closeBoardMore(); }}>{invitation}</button>)}</div>
                    </div>
                  </details>
                  <button type="button" className="is-primary" onClick={nextBoardQuestion}>{activeSession?.length.kind === "questions" && stats.classQuestions >= activeSession.length.value ? "Finish" : "Next"}</button>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      )}

      {screen === "summary" && (
        <section className="summary-screen" id="main-content" tabIndex={-1}>
          <header className="setup-header">
            <div className="wordmark"><i aria-hidden="true" />Fluency</div>
          </header>
          <div className="summary-copy">
            <p>{classOnlySummary ? "Class practice" : "Practice"}</p>
            <h1>{classOnlySummary ? "Class practice complete." : "Session complete."}</h1>
          </div>
          <div className={`summary-numbers ${mixedClassAndPupilSummary ? "summary-numbers--mixed" : ""}`} aria-label="Session summary">
            {classOnlySummary ? (
              <div className="summary-numbers__class"><strong>{stats.classQuestions}</strong><span>questions shown</span></div>
            ) : (
              <>
                <div><strong>{stats.attempted}</strong><span>questions explored</span></div>
                <div><strong>{stats.firstTry}</strong><span>first try independently</span></div>
                <div><strong>{stats.afterAnotherTry}</strong><span>after another try</span></div>
                <div><strong>{stats.afterSupport}</strong><span>with a hint or steps</span></div>
                <div><strong>{stats.modelled}</strong><span>after a worked model</span></div>
                {mixedClassAndPupilSummary && <div><strong>{stats.classQuestions}</strong><span>shown in class view</span></div>}
              </>
            )}
          </div>
          {!classOnlySummary && strandSummary && <div className="summary-notes">
            <div><span>Strong today</span><b>{strandSummary.strongest}</b></div>
            <div><span>Bring back soon</span><b>{strandSummary.practise}</b></div>
          </div>}
          <div className="summary-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                begin(undefined, activeSession?.config ?? undefined, activeSession?.profileIds ?? activeProfileIds);
                if (classOnlySummary) {
                  setBoardMode(true);
                  void enterFullscreen();
                }
              }}
            >{classOnlySummary ? "Teach again" : "Practise again"}</button>
            <button type="button" className="text-button" onClick={() => { setActiveSession(null); setScreen("setup"); }}>Finish</button>
          </div>
        </section>
      )}

      {settingsOpen && <SettingsPanel preferences={preferences} setPreferences={setPreferences} onClose={() => setSettingsOpen(false)} onReset={resetPreferences} />}
      {jotOpen && <JotPad onClose={() => setJotOpen(false)} />}
      {profilePickerOpen && <ProfilePicker profiles={pupilProfiles} activeId={activeProfileIds[0]} onSelect={selectPupilProfile} onClose={() => setProfilePickerOpen(false)} />}
      {teacherGateOpen && <TeacherGate mode={teacherGateMode} pin={teacherPin} error={teacherGateError} setPin={(value) => { setTeacherPin(value); setTeacherGateError(""); }} onNoCode={enterTeacherToolsWithoutCode} onSubmit={submitTeacherPin} onClose={() => setTeacherGateOpen(false)} />}
      {boardHelpOpen && <BoardHelpDialog onClose={() => setBoardHelpOpen(false)} />}
    </div>
  );
}
