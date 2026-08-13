"use client";

import { FormEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { normalisePrintMathText, normalisePrintVisual, printPageRule } from "@/lib/classroom-print.mjs";
import { numberLineLabelPlan } from "@/lib/visual-presentation.mjs";
import "./teacher.css";

export type TeacherDestination = "start" | "build" | "review" | "settings";
export type TeacherMode = "mix" | "focus" | "quick" | "think" | "my-mix";
export type TeacherFocus =
  | "Mixed"
  | "Addition"
  | "Subtraction"
  | "Multiplication"
  | "Division"
  | "Tables"
  | "Place Value"
  | "Fractions"
  | "Decimals"
  | "Fractions and Decimals"
  | "Equivalence and Missing Numbers";
export type TeacherSupport = "independent" | "available" | "adaptive" | "guided" | "modelled";
export type EvidenceState =
  | "Not yet seen"
  | "Beginning"
  | "Building"
  | "Secure recently"
  | "Ready for retrieval"
  | "Support still useful";
export type EvidenceStrength = "Limited evidence" | "Growing evidence" | "Strong evidence";

export type TeacherChallenge =
  | { kind: "fixed"; value: number }
  | { kind: "range"; min: number; max: number };

export type TeacherLength =
  | { kind: "questions"; value: 5 | 10 | 15 | 20 | 30 }
  | { kind: "minutes"; value: 5 | 10 | 15 }
  | { kind: "open" };

export type TeacherSessionConfig = {
  mode: TeacherMode;
  focus: TeacherFocus;
  subskill?: string;
  challenge: TeacherChallenge;
  support: TeacherSupport;
  length: TeacherLength;
  representationFrequency: "low" | "balanced" | "high";
  retrievalWeight: "light" | "balanced" | "strong";
  strategyQuestions: boolean;
  connectedSequences: boolean;
  nearTransfer: boolean;
  adaptiveDifficulty: boolean;
  fadeSupport: boolean;
  wordedQuestions: boolean;
  seedMode: "fresh" | "same";
  seed?: string;
  pupilControls: {
    challenge: "unlocked" | "limited" | "locked";
    support: "unlocked" | "limited" | "locked";
    mode: "unlocked" | "locked";
    focus: "unlocked" | "locked";
  };
};

export type TeacherPreset = {
  id: string;
  name: string;
  note?: string;
  config: TeacherSessionConfig;
  builtIn?: boolean;
};

export type TeacherRecentSession = {
  id: string;
  label: string;
  usedAt: number;
  config: TeacherSessionConfig;
};

export type TeacherProfile = {
  id: string;
  displayName: string;
  symbol?: string;
  classLabel?: string;
  archived?: boolean;
};

export type TeacherGroup = {
  id: string;
  name: string;
  profileIds: string[];
};

export type TeacherParticipantSelection = {
  participantKind: "guest" | "profile" | "group";
  profileIds: string[];
  groupId?: string;
};

export type SkillEvidence = {
  id: string;
  strand: string;
  subskill: string;
  state: EvidenceState;
  strength: EvidenceStrength;
  sampleCount: number;
  independentSuccesses: number;
  supportedSuccesses: number;
  variations: number;
  lastPractised?: number;
  misconception?: string;
};

export type TeacherRecommendation = {
  id: string;
  skill: string;
  reason: string;
  challenge: TeacherChallenge;
  support: TeacherSupport;
  config: TeacherSessionConfig;
};

export type TeacherProfileReview = {
  profileId: string;
  lastPractised?: number;
  sessions: number;
  questions: number;
  recentlyPractised: string[];
  skills: SkillEvidence[];
  recommendations: TeacherRecommendation[];
};

export type TeacherEvidenceEvent = {
  id: string;
  profileId: string;
  sessionId: string;
  timestamp: number;
  strand: string;
  subskill: string;
  family: string;
  difficulty: number;
  firstResponseCorrect: boolean;
  finalCorrect: boolean;
  supportUsed: number;
  attempts: number;
  misconception?: string;
};

export type TeacherNote = {
  id: string;
  targetType: "profile" | "group" | "session";
  targetId: string;
  text: string;
  createdAt: number;
};

export type AccessibilitySettings = {
  largerText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  simplifiedDensity: boolean;
  largerTargets: boolean;
  screenReaderOptimised: boolean;
  sound: boolean;
  timedPressure: boolean;
};

export type PrintOptions = {
  format: "a4" | "strip";
  questions: 5 | 10 | 15 | 20 | 30;
  orientation: "portrait" | "landscape";
  answerSheet: boolean;
  nameLine: boolean;
  title: string;
  blackAndWhite: boolean;
};

export type PrintPreview = {
  title: string;
  questions: Array<{ number: number; type?: string; display: string; choices?: string[]; support?: string; answer?: string; visual?: unknown }>;
};

export type TeacherToolsProps = {
  profiles: TeacherProfile[];
  groups: TeacherGroup[];
  savedPresets: TeacherPreset[];
  recentSessions: TeacherRecentSession[];
  reviews: TeacherProfileReview[];
  events?: TeacherEvidenceEvent[];
  notes?: TeacherNote[];
  accessibility: AccessibilitySettings;
  profilePrivacy?: "full" | "first-and-initial" | "initials" | "alias";
  initialDestination?: TeacherDestination;
  teacherCodeEnabled?: boolean;
  storageSummary?: string;
  appVersion?: string;
  onClose: () => void;
  onLock: () => void;
  onLaunch: (config: TeacherSessionConfig, participants: TeacherParticipantSelection) => void;
  onDestinationChange?: (destination: TeacherDestination) => void;
  onSavePreset: (preset: Omit<TeacherPreset, "id" | "builtIn">) => void;
  onUpdatePreset?: (presetId: string, preset: Omit<TeacherPreset, "id" | "builtIn">) => void;
  onRenamePreset?: (presetId: string, name: string) => void;
  onDuplicatePreset?: (presetId: string) => void;
  onDeletePreset?: (presetId: string) => void;
  onCreateProfiles: (profiles: Array<{ displayName: string; symbol: string }>, groupName?: string) => void;
  onCreateGroup?: (name: string, profileIds: string[]) => void;
  onArchiveProfile?: (profileId: string) => void;
  onDeleteProfile?: (profileId: string) => void;
  onSetAccessibility: (settings: AccessibilitySettings) => void;
  onSetProfilePrivacy?: (privacy: "full" | "first-and-initial" | "initials" | "alias") => void;
  onSaveNote?: (targetType: TeacherNote["targetType"], targetId: string, text: string) => void;
  onSetTeacherCode?: (code: string | null) => void;
  onExportEvidence?: (format: "csv" | "json") => void;
  onExportBackup?: () => void;
  onImportEvidence?: (file: File) => void | Promise<void>;
  onRestoreBackup?: (file: File) => void | Promise<void>;
  onClearSessionHistory?: () => void;
  onDeleteAllEvidence?: () => void;
  onResetApplication?: () => void;
  onCreatePracticeLink?: (config: TeacherSessionConfig) => string | Promise<string>;
  onRequestPrintPreview?: (config: TeacherSessionConfig, options: PrintOptions) => PrintPreview | Promise<PrintPreview>;
};

const FOCUS_OPTIONS: TeacherFocus[] = [
  "Mixed",
  "Addition",
  "Subtraction",
  "Multiplication",
  "Division",
  "Tables",
  "Place Value",
  "Fractions",
  "Decimals",
  "Equivalence and Missing Numbers",
];

const SUBSKILLS: Partial<Record<TeacherFocus, string[]>> = {
  Multiplication: ["All multiplication", "Recall facts", "Derived facts", "Fact families", "Multiplying by 10 and 100", "Distributive reasoning"],
  Division: ["All division", "Related facts", "Grouping and sharing", "Scaling", "Missing divisors"],
  Tables: ["All tables", "2, 5 and 10", "3, 4 and 8", "6, 7, 9, 11 and 12", "Related division"],
  "Place Value": ["All place value", "Compose and partition", "Compare and order", "Rounding", "Number lines", "Powers of ten"],
  Fractions: ["All fractions", "Fractions of quantities", "Equivalence", "Compare and order", "Fraction number lines"],
  Decimals: ["All decimals", "Tenths and hundredths", "Compare", "Complements", "Fraction connections"],
  "Equivalence and Missing Numbers": ["All relationships", "Balanced equations", "Missing numbers", "Missing digits", "Calculation comparison"],
};

const CURRICULUM_MAP = [
  {
    title: "Prerequisite foundations",
    note: "Essential relationships supporting current Year 4 learning.",
    items: [
      ["Number bonds and complements", "Challenge 0–30", "7 + □ = 10", "Connects to bridging and inverse calculation"],
      ["Equal groups and related facts", "Challenge 8–38", "5 × 4 = 20", "Connects to all tables and division"],
      ["Place value within 1,000", "Challenge 20–40", "700 = □ + 260", "Connects to four-digit calculation"],
    ],
  },
  {
    title: "Year 4 core",
    note: "Main Year 4 arithmetic.",
    items: [
      ["Four-digit number structure", "Challenge 40–70", "4,582 = 3,000 + □", "Connects to rounding and calculation"],
      ["Multiplication and division relationships", "Challenge 42–72", "56 ÷ □ = 8", "Connects to derived and scaled facts"],
      ["Fractions, tenths and hundredths", "Challenge 45–72", "3/4 of 28", "Connects to equivalence and number lines"],
    ],
  },
  {
    title: "Year 4 deepening",
    note: "Structural thinking that remains within Year 4 mathematics.",
    items: [
      ["Efficient strategy", "Challenge 72–100", "399 + 487 + 601", "Builds flexible calculation"],
      ["Equivalence and missing information", "Challenge 68–100", "48 × 6 = 24 × □", "Builds inverse and relational thinking"],
      ["Generalisation and comparison", "Challenge 78–100", "Which is greater: 39 × 21 or 40 × 20?", "Builds reasoning without lengthy work"],
    ],
  },
] as const;

const DEFAULT_CONTROLS: TeacherSessionConfig["pupilControls"] = {
  challenge: "limited",
  support: "unlocked",
  mode: "locked",
  focus: "locked",
};

const PRESET_CONTROLS: TeacherSessionConfig["pupilControls"] = {
  challenge: "unlocked",
  support: "unlocked",
  mode: "unlocked",
  focus: "unlocked",
};

export const DEFAULT_TEACHER_CONFIG: TeacherSessionConfig = {
  mode: "mix",
  focus: "Mixed",
  challenge: { kind: "range", min: 45, max: 60 },
  support: "adaptive",
  length: { kind: "questions", value: 10 },
  representationFrequency: "balanced",
  retrievalWeight: "balanced",
  strategyQuestions: true,
  connectedSequences: true,
  nearTransfer: true,
  adaptiveDifficulty: true,
  fadeSupport: true,
  wordedQuestions: false,
  seedMode: "fresh",
  pupilControls: DEFAULT_CONTROLS,
};

function presetConfig(overrides: Partial<TeacherSessionConfig>): TeacherSessionConfig {
  return {
    ...DEFAULT_TEACHER_CONFIG,
    ...overrides,
    challenge: overrides.challenge ?? DEFAULT_TEACHER_CONFIG.challenge,
    length: overrides.length ?? DEFAULT_TEACHER_CONFIG.length,
    pupilControls: { ...DEFAULT_CONTROLS, ...(overrides.pupilControls ?? {}) },
  };
}

export const CORE_TEACHER_PRESETS: TeacherPreset[] = [
  { id: "morning-warm-up", name: "Morning Warm-Up", note: "Retrieval, relationships and an accessible Year 4 start.", builtIn: true, config: presetConfig({ challenge: { kind: "range", min: 34, max: 56 }, support: "adaptive", length: { kind: "questions", value: 10 }, representationFrequency: "balanced", pupilControls: PRESET_CONTROLS }) },
  { id: "year-4-core", name: "Year 4 Core", note: "Year 4 arithmetic and place value.", builtIn: true, config: presetConfig({ challenge: { kind: "range", min: 46, max: 68 }, support: "adaptive", length: { kind: "questions", value: 15 }, representationFrequency: "balanced", pupilControls: PRESET_CONTROLS }) },
  { id: "foundations", name: "Foundations", note: "Essential prerequisite knowledge, presented with dignity.", builtIn: true, config: presetConfig({ challenge: { kind: "range", min: 8, max: 34 }, support: "adaptive", length: { kind: "questions", value: 10 }, representationFrequency: "balanced", pupilControls: PRESET_CONTROLS }) },
  { id: "tables-and-division", name: "Tables and Division", note: "Facts, inverses, derivation and fact families.", builtIn: true, config: presetConfig({ focus: "Tables", mode: "focus", challenge: { kind: "range", min: 32, max: 66 }, support: "available", length: { kind: "questions", value: 15 }, representationFrequency: "balanced", retrievalWeight: "balanced", pupilControls: PRESET_CONTROLS }) },
  { id: "fractions-and-decimals", name: "Fractions and Decimals", note: "Year 4 fraction and decimal relationships.", builtIn: true, config: presetConfig({ focus: "Fractions and Decimals", mode: "focus", challenge: { kind: "range", min: 45, max: 72 }, support: "adaptive", length: { kind: "questions", value: 10 }, representationFrequency: "high", pupilControls: PRESET_CONTROLS }) },
  { id: "deep-challenge", name: "Deep Challenge", note: "Harder structure, equivalence and efficient calculation.", builtIn: true, config: presetConfig({ mode: "think", challenge: { kind: "range", min: 78, max: 96 }, support: "available", length: { kind: "questions", value: 10 }, representationFrequency: "balanced", strategyQuestions: true, pupilControls: PRESET_CONTROLS }) },
];

const SYMBOLS = ["●", "◆", "▲", "■", "✦", "◐", "◇", "⬟", "✚", "◒"];

function formatDate(timestamp?: number) {
  if (!timestamp) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(timestamp));
}

function challengeText(challenge: TeacherChallenge) {
  return challenge.kind === "fixed" ? `Challenge ${challenge.value}` : `Challenge ${challenge.min}–${challenge.max}`;
}

function lengthText(length: TeacherLength) {
  if (length.kind === "open") return "Open practice";
  return `${length.value} ${length.kind === "minutes" ? "minutes" : "questions"}`;
}

function supportText(support: TeacherSupport) {
  return ({ independent: "Independent", available: "Available on request", adaptive: "Adaptive support", guided: "Guided", modelled: "Modelled" })[support];
}

function configSummary(config: TeacherSessionConfig) {
  return `${lengthText(config.length)} · ${config.focus} · ${challengeText(config.challenge)} · ${supportText(config.support)} · ${config.mode === "mix" ? "Mix" : config.mode === "quick" ? "Quick Fire" : config.mode === "my-mix" ? "My Mix" : config.mode[0].toUpperCase() + config.mode.slice(1)}`;
}

function PrintMathText({ value }: { value: string }) {
  const segments = normalisePrintMathText(value).split(/(\[\[(?:-?\d+|□)\/(?:-?\d+|□)\]\](?:\u2060?[.,;:!?])?)/g);
  return <>{segments.map((segment, index) => {
    const fraction = segment.match(/^\[\[((?:-?\d+)|□)\/((?:-?\d+)|□)\]\](?:\u2060?([.,;:!?]))?$/);
    if (!fraction) return <span key={`${segment}-${index}`}>{segment}</span>;
    const label = `${fraction[1] === "□" ? "blank" : fraction[1]} over ${fraction[2] === "□" ? "blank" : fraction[2]}`;
    const valueNode = <span className="teacher-print-fraction" role="img" aria-label={label}><span>{fraction[1]}</span><span>{fraction[2]}</span></span>;
    return fraction[3]
      ? <span className="teacher-print-math-unit" key={`${segment}-${index}`}>{valueNode}{fraction[3]}</span>
      : <span key={`${segment}-${index}`}>{valueNode}</span>;
  })}</>;
}

function PrintVisualModel({ visual }: { visual: unknown }) {
  const model = normalisePrintVisual(visual) as any;
  if (!model) return null;
  const format = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

  if (model.kind === "number-line" || model.kind === "bead-string") {
    const labelPlan = numberLineLabelPlan({ min: model.min, max: model.max, markers: model.markers, unknown: model.unknown });
    const markerDescription = model.markers.map((marker: number, index: number) => model.unknown === index ? `marker ${index + 1} is the missing value` : `marker ${index + 1} is at ${format(marker)}`).join("; ");
    return <div className="print-visual print-number-line" role="img" aria-label={`${model.title}. Number line from ${labelPlan.unknownAtMin ? "a missing start value" : format(model.min)} to ${labelPlan.unknownAtMax ? "a missing end value" : format(model.max)}${markerDescription ? `; ${markerDescription}` : ""}.`}><div className="print-number-line__track">{Array.from({ length: model.ticks }, (_, index) => <i key={index} style={{ left: `${index / Math.max(1, model.ticks - 1) * 100}%` }} />)}{labelPlan.markers.map((marker, index) => <b className={`${marker.isEndpoint ? "is-endpoint" : ""} ${marker.isUnknown ? "is-unknown" : ""}`.trim()} key={index} style={{ left: `${marker.position}%` }}>{marker.showLabel && <span>{marker.isUnknown ? "□" : format(marker.value)}</span>}</b>)}</div><footer><span>{labelPlan.unknownAtMin ? "□" : format(model.min)}</span><span>{labelPlan.unknownAtMax ? "□" : format(model.max)}</span></footer></div>;
  }

  if (model.kind === "fraction-strip" || model.kind === "bar-model") {
    return <div className="print-visual" role="img" aria-label={`${model.title}. A bar divided into ${model.segments} equal parts; ${model.filled} ${model.filled === 1 ? "part is" : "parts are"} marked${model.total === null ? "" : `; the whole is ${format(model.total)}`}.`}><div className="print-fraction-bar">{Array.from({ length: model.segments }, (_, index) => <i className={index < model.filled ? "is-filled" : ""} key={index} />)}</div>{model.total !== null && <small>whole = {format(model.total)}</small>}</div>;
  }

  if (model.kind === "hundred-grid") {
    return <div className="print-visual print-hundred-grid" role="img" aria-label={`${model.title}. ${model.filled} hundredths shaded.`}>{Array.from({ length: 100 }, (_, index) => <i className={index < model.filled ? "is-filled" : ""} key={index} />)}</div>;
  }

  if (model.kind === "array") {
    const count = Math.min(model.rows * model.columns, 144);
    return <div className="print-visual print-array" role="img" aria-label={`${model.title}. ${model.rows} rows of ${model.columns}.`} style={{ "--print-array-columns": Math.min(model.columns, 24) } as React.CSSProperties}>{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>;
  }

  if (model.kind === "partition" || model.kind === "multiplication-rectangle") {
    const multiplier = model.kind === "partition" ? model.multiplier : model.factor;
    return <div className="print-visual print-partition" role="img" aria-label={`${model.title}. ${model.parts.map((part: number) => `${format(part)} multiplied by ${format(multiplier)}`).join(" and ")}.`}><b>× {format(multiplier)}</b><span>{model.parts.map((part: number) => `${format(part)} × ${format(multiplier)}`).join(" · ")}</span></div>;
  }

  if (model.kind === "groups" || model.kind === "counters") {
    const shownGroups = Math.min(model.groups, 12);
    const shownPerGroup = Math.min(model.perGroup, 12);
    return <div className="print-visual print-groups" role="img" aria-label={`${model.title}. ${model.groups} equal groups of ${model.perGroup}, total ${model.total}.`}>{Array.from({ length: shownGroups }, (_, group) => <span key={group}><small>{model.perGroup}</small>{Array.from({ length: shownPerGroup }, (_, index) => <i key={index} />)}</span>)}</div>;
  }

  if (model.kind === "ten-frame") {
    return <div className="print-visual print-ten-frame" role="img" aria-label={`${model.title}. ${model.filled} of ${model.total} spaces filled.`}>{Array.from({ length: model.total }, (_, index) => <i className={index < model.filled ? "is-filled" : ""} key={index} />)}</div>;
  }

  if (model.kind === "place-value") {
    const rowDescription = model.rows.map((row: number[], index: number) => `${index > 0 && model.operator ? `${model.operator} ` : ""}${row.join("")}`).join("; ");
    return <div className="print-visual print-place-value-grid" role="img" aria-label={`${model.title}. Place-value rows: ${rowDescription}.`}><header>{["1,000s", "100s", "10s", "1s"].map((label) => <small key={label}>{label}</small>)}</header>{model.rows.map((row: number[], rowIndex: number) => <div key={rowIndex}>{rowIndex > 0 && <b>{model.operator}</b>}{row.slice(-4).map((digit: number, index: number) => <span key={index}>{digit}</span>)}</div>)}</div>;
  }

  if (model.kind === "base-ten") {
    const value = Math.max(0, Math.round(model.value));
    const digits = [Math.floor(value / 1000) % 10, Math.floor(value / 100) % 10, Math.floor(value / 10) % 10, value % 10];
    return <div className="print-visual print-place-value" role="img" aria-label={`${model.title}. Thousands ${digits[0]}, hundreds ${digits[1]}, tens ${digits[2]}, ones ${digits[3]}.`}>{["1,000s", "100s", "10s", "1s"].map((label, index) => <span key={label}><small>{label}</small><b>{digits[index]}</b></span>)}</div>;
  }

  if (model.kind === "part-whole") {
    return <div className="print-visual print-part-whole" role="img" aria-label={`${model.title}. ${format(model.whole)} split into ${model.parts.map(format).join(" and ")}.`}><strong>{format(model.whole)}</strong><span>{model.parts.map(format).join(" + ")}</span></div>;
  }

  if (model.kind === "relationship") {
    return <div className="print-visual print-relationship" role="img" aria-label={`${model.title}. ${model.left} ${model.connector} ${model.right}.`}><PrintMathText value={model.left} /><small>{model.connector}</small><PrintMathText value={model.right} /></div>;
  }

  if (model.kind === "worked-example") {
    return <div className="print-visual print-worked" role="img" aria-label={`${model.title}. ${model.lines.join(". ")}.`}>{model.lines.map((line: string, index: number) => <span key={index}><PrintMathText value={line} /></span>)}</div>;
  }

  return null;
}

function Dialog({ open, title, onClose, children, className = "" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !open) return undefined;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!node.open) node.showModal();
    return () => {
      if (node.open) node.close();
      const opener = previousFocus.current;
      if (opener?.isConnected) window.requestAnimationFrame(() => opener.focus());
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog className={`teacher-dialog ${className}`} ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header><h2 id={titleId}>{title}</h2><button className="teacher-icon-button" type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
      {children}
    </dialog>
  );
}

function PresetRow({ preset, onStart, actions }: { preset: TeacherPreset; onStart: () => void; actions?: ReactNode }) {
  return (
    <article className="teacher-preset-row">
      <button type="button" className="teacher-preset-row__main" onClick={onStart}>
        <span><strong>{preset.name}</strong>{preset.note && <small>{preset.note}</small>}</span><span aria-hidden="true">Start&nbsp;→</span>
      </button>
      {actions && <div className="teacher-row-actions">{actions}</div>}
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="teacher-empty">{children}</p>;
}

export function TeacherTools(props: TeacherToolsProps) {
  const [destination, setDestination] = useState<TeacherDestination>(props.initialDestination ?? "start");
  const [config, setConfig] = useState<TeacherSessionConfig>(DEFAULT_TEACHER_CONFIG);
  const [selectedParticipants, setSelectedParticipants] = useState<TeacherParticipantSelection>({ participantKind: "guest", profileIds: [] });
  const [groupProfileIds, setGroupProfileIds] = useState<string[]>([]);
  const [profileDialog, setProfileDialog] = useState(false);
  const [groupDialog, setGroupDialog] = useState(false);
  const [presetDialog, setPresetDialog] = useState(false);
  const [printDialog, setPrintDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [names, setNames] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetNote, setPresetNote] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [practiceLink, setPracticeLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printPreview, setPrintPreview] = useState<PrintPreview | null>(null);
  const printSeedRef = useRef<string | null>(null);
  const [printOptions, setPrintOptions] = useState<PrintOptions>({ format: "a4", questions: 10, orientation: "portrait", answerSheet: true, nameLine: true, title: "4S Arithmetic", blackAndWhite: true });
  const [reviewGroup, setReviewGroup] = useState("all");
  const [reviewStrand, setReviewStrand] = useState("all");
  const [reviewState, setReviewState] = useState("all");
  const [reviewPeriod, setReviewPeriod] = useState("all");
  const [reviewSupport, setReviewSupport] = useState("all");
  const [reviewProfileId, setReviewProfileId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [settingsSection, setSettingsSection] = useState<"accessibility" | "profiles" | "data">("accessibility");

  useEffect(() => setPrintPreview(null), [printOptions]);
  useEffect(() => { if (!printDialog) printSeedRef.current = null; }, [printDialog]);
  useEffect(() => {
    if (printOptions.format === "strip" && printOptions.questions > 10) {
      setPrintOptions((current) => ({ ...current, questions: 10 }));
    }
  }, [printOptions.format, printOptions.questions]);

  const activeProfiles = props.profiles.filter((profile) => !profile.archived);
  const selectedProfiles = selectedParticipants.profileIds;
  const activeProfileKey = activeProfiles.map((profile) => profile.id).sort().join("\u0000");
  const groupMembershipKey = props.groups.map((group) => `${group.id}:${group.profileIds.join(",")}`).join("\u0000");

  useEffect(() => {
    const available = new Set(activeProfiles.map((profile) => profile.id));
    setSelectedParticipants((current) => {
      if (current.participantKind === "profile") {
        return current.profileIds.length === 1 && available.has(current.profileIds[0])
          ? current
          : { participantKind: "guest", profileIds: [] };
      }
      if (current.participantKind === "group") {
        const group = props.groups.find((item) => item.id === current.groupId);
        const profileIds = (group?.profileIds ?? current.profileIds).filter((id) => available.has(id));
        if (!profileIds.length) return { participantKind: "guest", profileIds: [] };
        if (profileIds.length === current.profileIds.length && profileIds.every((id, index) => id === current.profileIds[index])) return current;
        return { ...current, profileIds };
      }
      return current.profileIds.length ? { participantKind: "guest", profileIds: [] } : current;
    });
  }, [activeProfileKey, groupMembershipKey]);
  const filteredProfiles = useMemo(() => {
    const allowed = reviewGroup === "all" ? null : new Set(props.groups.find((group) => group.id === reviewGroup)?.profileIds ?? []);
    return activeProfiles.filter((profile) => {
      if (allowed && !allowed.has(profile.id)) return false;
      const review = props.reviews.find((item) => item.profileId === profile.id);
      if (!review) return reviewStrand === "all" && reviewState === "all";
      if (reviewPeriod !== "all") {
        const cutoff = Date.now() - Number(reviewPeriod) * 86_400_000;
        if (!review.lastPractised || review.lastPractised < cutoff) return false;
      }
      if (reviewState === "Not yet seen") return reviewStrand === "all" && reviewSupport === "all" && review.skills.length === 0;
      if (reviewStrand === "all" && reviewState === "all" && reviewSupport === "all") return true;
      return review.skills.some((skill) =>
        (reviewStrand === "all" || skill.strand === reviewStrand)
        && (reviewState === "all" || skill.state === reviewState)
        && (reviewSupport === "all"
          || (reviewSupport === "supported" && skill.supportedSuccesses > skill.independentSuccesses)
          || (reviewSupport === "independent" && skill.independentSuccesses > 0)),
      );
    });
  }, [activeProfiles, props.groups, props.reviews, reviewGroup, reviewPeriod, reviewState, reviewStrand, reviewSupport]);

  const selectedReview = reviewProfileId ? props.reviews.find((review) => review.profileId === reviewProfileId) : undefined;
  const selectedReviewProfile = reviewProfileId ? props.profiles.find((profile) => profile.id === reviewProfileId) : undefined;
  const strands = Array.from(new Set(props.reviews.flatMap((review) => review.skills.map((skill) => skill.strand)))).sort();
  const navItems: Array<{ id: TeacherDestination; label: string }> = [
    { id: "start", label: "Start" }, { id: "build", label: "Build" }, { id: "review", label: "Review" }, { id: "settings", label: "Settings" },
  ];

  function changeDestination(next: TeacherDestination) {
    setDestination(next);
    props.onDestinationChange?.(next);
  }

  function updateConfig<K extends keyof TeacherSessionConfig>(key: K, value: TeacherSessionConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateChallengeRange(edge: "min" | "max", value: number) {
    setConfig((current) => {
      if (current.challenge.kind !== "range") return current;
      return {
        ...current,
        challenge: edge === "min"
          ? { kind: "range", min: value, max: current.challenge.max }
          : { kind: "range", min: current.challenge.min, max: value },
      };
    });
  }

  function chooseFocus(focus: TeacherFocus) {
    setConfig((current) => ({
      ...current,
      focus,
      subskill: undefined,
      mode: focus === "Mixed" && current.mode === "focus" ? "mix" : current.mode,
    }));
  }

  function chooseFixedChallenge() {
    setConfig((current) => {
      const value = current.challenge.kind === "fixed"
        ? current.challenge.value
        : Math.round((current.challenge.min + current.challenge.max) / 2);
      return {
        ...current,
        challenge: { kind: "fixed", value },
        pupilControls: {
          ...current.pupilControls,
          challenge: current.pupilControls.challenge === "limited" ? "locked" : current.pupilControls.challenge,
        },
      };
    });
  }

  function chooseMode(mode: TeacherMode) {
    setConfig((current) => ({
      ...current,
      mode,
      focus: mode === "focus" && current.focus === "Mixed" ? "Addition" : current.focus,
    }));
  }

  function startPreset(preset: TeacherPreset) {
    props.onLaunch(preset.config, selectedParticipants);
  }

  function onePupil(profileId: string): TeacherParticipantSelection {
    return { participantKind: "profile", profileIds: [profileId] };
  }

  function createProfiles(event: FormEvent) {
    event.preventDefault();
    const parsed = names.split(/[\n,;]/).map((name) => name.trim()).filter(Boolean).slice(0, 40);
    if (!parsed.length) return;
    props.onCreateProfiles(parsed.map((displayName, index) => ({ displayName, symbol: SYMBOLS[index % SYMBOLS.length] })), newGroupName.trim() || undefined);
    setNames(""); setNewGroupName(""); setProfileDialog(false);
  }

  async function makePracticeLink() {
    if (!props.onCreatePracticeLink) return;
    setLinkBusy(true);
    try { setPracticeLink(await props.onCreatePracticeLink(config)); setLinkDialog(true); }
    finally { setLinkBusy(false); }
  }

  async function makePrintPreview() {
    if (!props.onRequestPrintPreview) return;
    const stableSeed = config.seedMode === "same"
      ? (config.seed?.trim() || "year-4-fluency")
      : (printSeedRef.current ?? `print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    printSeedRef.current = stableSeed;
    const printConfig = { ...config, seedMode: "same" as const, seed: stableSeed };
    setPrintBusy(true);
    try { setPrintPreview(await props.onRequestPrintPreview(printConfig, printOptions)); }
    finally { setPrintBusy(false); }
  }

  function printDocument() {
    document.getElementById("year4-fluency-print-page")?.remove();
    const style = document.createElement("style");
    style.id = "year4-fluency-print-page";
    style.textContent = printPageRule(printOptions);
    document.head.append(style);
    let cleanupTimer = 0;
    const cleanup = () => {
      window.clearTimeout(cleanupTimer);
      window.removeEventListener("afterprint", cleanup);
      style.remove();
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    cleanupTimer = window.setTimeout(cleanup, 60_000);
    window.print();
  }

  return (
    <div className={["teacher-tools", props.accessibility.largerText ? "teacher-larger-text" : "", props.accessibility.highContrast ? "teacher-high-contrast" : "", props.accessibility.reducedMotion ? "teacher-reduced-motion" : "", props.accessibility.simplifiedDensity ? "teacher-simplified-density" : "", props.accessibility.largerTargets ? "teacher-larger-targets" : ""].filter(Boolean).join(" ")}>
      <a className="teacher-skip-link" href="#teacher-main">Skip to teacher tools</a>
      <header className="teacher-topbar">
        <div className="teacher-brand"><i aria-hidden="true" />4S Arithmetic <span>Teacher</span></div>
        <nav aria-label="Teacher tools">
          {navItems.map((item) => <button key={item.id} type="button" aria-current={destination === item.id ? "page" : undefined} onClick={() => changeDestination(item.id)}>{item.label}</button>)}
        </nav>
        <div className="teacher-topbar__actions"><button type="button" className="teacher-quiet-button" onClick={props.onLock}>Pupil view</button></div>
      </header>

      <main id="teacher-main" className="teacher-main" tabIndex={-1}>
        {destination === "start" && (
          <div className="teacher-page teacher-start-page">
            <header className="teacher-page-heading"><p>Teacher start</p><h1>What should the children practise now?</h1><div className="teacher-heading-actions"><button className="teacher-secondary-button" type="button" onClick={() => { setEditingPresetId(null); setConfig(DEFAULT_TEACHER_CONFIG); changeDestination("build"); }}>Build a session</button></div></header>
            {activeProfiles.length > 0 && <section className="teacher-participants" aria-labelledby="participants-heading"><div><h2 id="participants-heading">Who is practising?</h2><p>{selectedParticipants.participantKind === "profile" ? "One pupil" : selectedParticipants.participantKind === "group" ? `${selectedProfiles.length} in group` : "Whole class or guest"}</p>{selectedParticipants.participantKind === "group" && <small>Group practice does not create individual pupil evidence.</small>}</div><div className="teacher-chip-list"><button type="button" className={selectedParticipants.participantKind === "guest" ? "is-selected" : ""} aria-pressed={selectedParticipants.participantKind === "guest"} onClick={() => setSelectedParticipants({ participantKind: "guest", profileIds: [] })}>Whole class / guest</button>{props.groups.map((group) => { const profileIds = group.profileIds.filter((id) => activeProfiles.some((profile) => profile.id === id)); const selected = selectedParticipants.participantKind === "group" && selectedParticipants.groupId === group.id; return <button type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} disabled={!profileIds.length} key={group.id} onClick={() => setSelectedParticipants(selected ? { participantKind: "guest", profileIds: [] } : { participantKind: "group", profileIds, groupId: group.id })}>{group.name}</button>; })}<select aria-label="Choose one pupil profile" value={selectedParticipants.participantKind === "profile" ? selectedProfiles[0] : ""} onChange={(event) => setSelectedParticipants(event.target.value ? { participantKind: "profile", profileIds: [event.target.value] } : { participantKind: "guest", profileIds: [] })}><option value="">One pupil…</option>{activeProfiles.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></div></section>}
            <section className="teacher-section"><div className="teacher-section-heading"><div><p>Ready in one tap</p><h2>Classroom presets</h2></div></div><div className="teacher-preset-grid">{CORE_TEACHER_PRESETS.map((preset) => <PresetRow key={preset.id} preset={preset} onStart={() => startPreset(preset)} />)}</div></section>
            <div className="teacher-two-column">
              <section className="teacher-section"><div className="teacher-section-heading"><div><p>Your choices</p><h2>Saved presets</h2></div><button type="button" className="teacher-text-button" onClick={() => { setEditingPresetId(null); setConfig(DEFAULT_TEACHER_CONFIG); changeDestination("build"); }}>Create</button></div>{props.savedPresets.length ? props.savedPresets.map((preset) => <PresetRow key={preset.id} preset={preset} onStart={() => startPreset(preset)} actions={<><button type="button" onClick={() => { setConfig(preset.config); setEditingPresetId(preset.id); changeDestination("build"); }}>Edit</button><button type="button" onClick={() => props.onDuplicatePreset?.(preset.id)}>Duplicate</button><button type="button" onClick={() => { const next = window.prompt("Preset name", preset.name); if (next?.trim()) props.onRenamePreset?.(preset.id, next.trim()); }}>Rename</button><button type="button" onClick={() => { if (window.confirm(`Delete “${preset.name}”? Pupil evidence will not be removed.`)) props.onDeletePreset?.(preset.id); }}>Delete</button></>} />) : <EmptyState>Save a session you want to use again.</EmptyState>}</section>
              <section className="teacher-section"><div className="teacher-section-heading"><div><p>Recently used</p><h2>Recent sessions</h2></div></div>{props.recentSessions.slice(0, 5).length ? props.recentSessions.slice(0, 5).map((session) => <article className="teacher-recent-row" key={session.id}><button type="button" onClick={() => props.onLaunch(session.config, selectedParticipants)}><strong>{session.label}</strong><small>{formatDate(session.usedAt)} · {configSummary(session.config)}</small></button><button type="button" className="teacher-text-button" onClick={() => { setConfig(session.config); setEditingPresetId(null); changeDestination("build"); }}>Edit</button></article>) : <EmptyState>Your most recent session choices will appear here.</EmptyState>}</section>
            </div>
          </div>
        )}

        {destination === "build" && (
          <div className="teacher-page teacher-build-page">
            <header className="teacher-page-heading teacher-page-heading--compact"><p>Build</p><h1>{editingPresetId ? "Refine the preset." : "Shape the practice."}</h1>{editingPresetId && <span className="teacher-heading-note">Editing {props.savedPresets.find((preset) => preset.id === editingPresetId)?.name ?? "saved preset"}</span>}</header>
            <div className="teacher-builder">
              <form className="teacher-builder-form" onSubmit={(event) => { event.preventDefault(); props.onLaunch(config, selectedParticipants); }}>
                <fieldset><legend>Focus</legend><p className="teacher-field-note">What mathematics will be practised?</p><div className="teacher-segmented teacher-segmented--wrap">{FOCUS_OPTIONS.map((focus) => <button type="button" className={config.focus === focus ? "is-selected" : ""} aria-pressed={config.focus === focus} key={focus} onClick={() => chooseFocus(focus)}>{focus}</button>)}</div>{SUBSKILLS[config.focus] && <label className="teacher-select-field"><span>Narrow the focus <small>Optional</small></span><select value={config.subskill ?? ""} onChange={(event) => updateConfig("subskill", event.target.value || undefined)}><option value="">All {config.focus.toLowerCase()}</option>{SUBSKILLS[config.focus]?.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label>}</fieldset>
                <details className="teacher-curriculum-map"><summary>Curriculum map</summary><p>Generator purposes, approximate challenge ranges and mathematical connections.</p><div>{CURRICULUM_MAP.map((region) => <section key={region.title}><header><h3>{region.title}</h3><p>{region.note}</p></header>{region.items.map(([name, range, example, connection]) => <article key={name}><div><strong>{name}</strong><small>{range}</small></div><code>{example}</code><p>{connection}</p></article>)}</section>)}</div></details>
                <fieldset><legend>Challenge</legend><p className="teacher-field-note">How demanding should it be?</p><div className="teacher-segmented teacher-segmented--short"><button type="button" className={config.challenge.kind === "fixed" ? "is-selected" : ""} onClick={chooseFixedChallenge}>Fixed</button><button type="button" className={config.challenge.kind === "range" ? "is-selected" : ""} onClick={() => { const value = config.challenge.kind === "fixed" ? config.challenge.value : Math.round((config.challenge.min + config.challenge.max) / 2); updateConfig("challenge", { kind: "range", min: Math.max(0, value - 8), max: Math.min(100, value + 8) }); }}>Range</button></div>{config.challenge.kind === "fixed" ? <label className="teacher-range"><span><b>Challenge</b><output>{config.challenge.value}</output></span><input type="range" min="0" max="100" value={config.challenge.value} onChange={(event) => updateConfig("challenge", { kind: "fixed", value: Number(event.target.value) })} /></label> : <div className="teacher-range-pair"><label className="teacher-range"><span><b>From</b><output>{config.challenge.min}</output></span><input type="range" min="0" max={config.challenge.max} value={config.challenge.min} onChange={(event) => updateChallengeRange("min", Number(event.target.value))} /></label><label className="teacher-range"><span><b>To</b><output>{config.challenge.max}</output></span><input type="range" min={config.challenge.min} max="100" value={config.challenge.max} onChange={(event) => updateChallengeRange("max", Number(event.target.value))} /></label></div>}</fieldset>
                <fieldset><legend>Support</legend><p className="teacher-field-note">Challenge stays separate from support.</p><div className="teacher-choice-list">{([ ["independent", "Independent", "No automatic scaffold."], ["available", "Available on request", "Hints and models can be opened."], ["adaptive", "Adaptive", "Offer the least support needed."], ["guided", "Guided", "Representations and steps appear readily."], ["modelled", "Modelled", "Frequent worked examples and near transfer."] ] as Array<[TeacherSupport, string, string]>).map(([value, label, note]) => <label key={value}><input type="radio" name="support" value={value} checked={config.support === value} onChange={() => updateConfig("support", value)} /><span><b>{label}</b><small>{note}</small></span></label>)}</div></fieldset>
                <div className="teacher-field-pair"><fieldset><legend>Length</legend><label className="teacher-select-field"><span>Continue for</span><select value={config.length.kind === "open" ? "open" : `${config.length.kind}-${config.length.value}`} onChange={(event) => { const [kind, raw] = event.target.value.split("-"); if (kind === "open") updateConfig("length", { kind: "open" }); else updateConfig("length", { kind: kind as "questions" | "minutes", value: Number(raw) as never }); }}><optgroup label="Questions">{[5,10,15,20,30].map((value) => <option key={value} value={`questions-${value}`}>{value} questions</option>)}</optgroup><optgroup label="Minutes">{[5,10,15].map((value) => <option key={value} value={`minutes-${value}`}>{value} minutes</option>)}</optgroup><option value="open">Open practice</option></select></label></fieldset><fieldset><legend>Mode</legend><label className="teacher-select-field"><span>Practice feel</span><select value={config.mode} onChange={(event) => chooseMode(event.target.value as TeacherMode)}><option value="mix">Mix</option><option value="focus">Focus</option><option value="quick">Quick Fire</option><option value="think">Think</option><option value="my-mix">My Mix</option></select></label></fieldset></div>
                <details className="teacher-more-options"><summary>More options</summary><div className="teacher-more-options__body"><div className="teacher-field-pair"><label className="teacher-select-field"><span>Representations</span><select value={config.representationFrequency} onChange={(event) => updateConfig("representationFrequency", event.target.value as TeacherSessionConfig["representationFrequency"])}><option value="low">Occasional</option><option value="balanced">Balanced</option><option value="high">Frequent</option></select></label><label className="teacher-select-field"><span>Retrieval</span><select value={config.retrievalWeight} onChange={(event) => updateConfig("retrievalWeight", event.target.value as TeacherSessionConfig["retrievalWeight"])}><option value="light">Light</option><option value="balanced">Balanced</option><option value="strong">Strong</option></select></label></div><div className="teacher-switch-list">{([ ["strategyQuestions", "Include strategy questions"], ["connectedSequences", "Use connected sequences"], ["nearTransfer", "Near transfer after modelling"], ["adaptiveDifficulty", "Adapt inside the challenge band"], ["fadeSupport", "Fade support after success"] ] as Array<[keyof TeacherSessionConfig, string]>).map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={Boolean(config[key])} onChange={(event) => updateConfig(key, event.target.checked as never)} /></label>)}</div><div className="teacher-field-pair"><label className="teacher-select-field"><span>Sequence</span><select value={config.seedMode} onChange={(event) => updateConfig("seedMode", event.target.value as "fresh" | "same")}><option value="fresh">Fresh variation</option><option value="same">Same sequence</option></select></label>{config.seedMode === "same" && <label className="teacher-select-field"><span>Sequence name or seed</span><input type="text" value={config.seed ?? ""} onChange={(event) => updateConfig("seed", event.target.value)} placeholder="Tuesday-4B" /></label>}</div><fieldset className="teacher-control-permissions"><legend>Pupil control</legend><div className="teacher-field-pair"><label className="teacher-select-field"><span>Challenge</span><select value={config.pupilControls.challenge} onChange={(event) => updateConfig("pupilControls", { ...config.pupilControls, challenge: event.target.value as TeacherSessionConfig["pupilControls"]["challenge"] })}><option value="unlocked">Unlocked</option><option value="limited">Limited range</option><option value="locked">Set by teacher</option></select></label><label className="teacher-select-field"><span>Support</span><select value={config.pupilControls.support} onChange={(event) => updateConfig("pupilControls", { ...config.pupilControls, support: event.target.value as TeacherSessionConfig["pupilControls"]["support"] })}><option value="unlocked">Unlocked</option><option value="limited">Limited range</option><option value="locked">Set by teacher</option></select></label></div><div className="teacher-field-pair"><label className="teacher-select-field"><span>Mode</span><select value={config.pupilControls.mode} onChange={(event) => updateConfig("pupilControls", { ...config.pupilControls, mode: event.target.value as TeacherSessionConfig["pupilControls"]["mode"] })}><option value="unlocked">Unlocked</option><option value="locked">Set by teacher</option></select></label><label className="teacher-select-field"><span>Focus</span><select value={config.pupilControls.focus} onChange={(event) => updateConfig("pupilControls", { ...config.pupilControls, focus: event.target.value as TeacherSessionConfig["pupilControls"]["focus"] })}><option value="unlocked">Unlocked</option><option value="locked">Set by teacher</option></select></label></div></fieldset></div></details>
                <footer className="teacher-builder-actions"><button className="teacher-primary-button" type="submit">Start</button>{editingPresetId ? <button className="teacher-secondary-button" type="button" disabled={!props.onUpdatePreset} onClick={() => { const original = props.savedPresets.find((preset) => preset.id === editingPresetId); if (original) props.onUpdatePreset?.(editingPresetId, { name: original.name, note: original.note, config }); setEditingPresetId(null); }}>Save changes</button> : <button className="teacher-secondary-button" type="button" onClick={() => setPresetDialog(true)}>Save preset</button>}<button className="teacher-text-button" type="button" onClick={makePracticeLink} disabled={!props.onCreatePracticeLink || linkBusy}>{linkBusy ? "Creating…" : "Practice link"}</button><button className="teacher-text-button" type="button" onClick={() => { setPrintPreview(null); setPrintDialog(true); }} disabled={!props.onRequestPrintPreview}>Print</button></footer>
              </form>
              <aside className="teacher-live-summary" aria-live="polite"><p>Session</p><h2>{configSummary(config)}</h2>{config.subskill && <p className="teacher-summary-detail">Focus: {config.subskill}</p>}<dl><div><dt>Representations</dt><dd>{config.representationFrequency}</dd></div><div><dt>Retrieval</dt><dd>{config.retrievalWeight}</dd></div><div><dt>Pupil challenge</dt><dd>{config.pupilControls.challenge === "locked" ? "Set by teacher" : config.pupilControls.challenge}</dd></div></dl></aside>
            </div>
          </div>
        )}

        {destination === "review" && (
          <div className="teacher-page teacher-review-page">
            <header className="teacher-page-heading teacher-page-heading--compact"><p>Review</p><h1>Calm evidence for the next decision.</h1><span className="teacher-heading-note">Practice evidence, not formal assessment.</span></header>
            <section className="teacher-review-filters" aria-label="Review filters"><label><span>Group</span><select value={reviewGroup} onChange={(event) => setReviewGroup(event.target.value)}><option value="all">All profiles</option>{props.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label><span>Strand</span><select value={reviewStrand} onChange={(event) => setReviewStrand(event.target.value)}><option value="all">All strands</option>{strands.map((strand) => <option key={strand}>{strand}</option>)}</select></label><label><span>Evidence</span><select value={reviewState} onChange={(event) => setReviewState(event.target.value)}><option value="all">All states</option>{(["Not yet seen", "Beginning", "Building", "Secure recently", "Ready for retrieval", "Support still useful"] as EvidenceState[]).map((state) => <option key={state}>{state}</option>)}</select></label><label><span>Period</span><select value={reviewPeriod} onChange={(event) => setReviewPeriod(event.target.value)}><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label><span>Support</span><select value={reviewSupport} onChange={(event) => setReviewSupport(event.target.value)}><option value="all">Any support</option><option value="independent">Independent success</option><option value="supported">Support often useful</option></select></label></section>
            <div className="teacher-review-layout">
              <section className="teacher-profile-list" aria-labelledby="profile-list-heading"><div className="teacher-section-heading"><div><p>Alphabetical</p><h2 id="profile-list-heading">Pupil profiles</h2></div>{activeProfiles.length > 0 && <button type="button" className="teacher-text-button" onClick={() => setProfileDialog(true)}>Add profiles</button>}</div>{filteredProfiles.length ? filteredProfiles.sort((a,b) => a.displayName.localeCompare(b.displayName)).map((profile) => { const review = props.reviews.find((item) => item.profileId === profile.id); const ready = review?.skills.filter((skill) => skill.state === "Ready for retrieval").length ?? 0; const supported = review?.skills.filter((skill) => skill.state === "Support still useful").length ?? 0; return <button type="button" className={reviewProfileId === profile.id ? "teacher-profile-row is-selected" : "teacher-profile-row"} key={profile.id} onClick={() => setReviewProfileId(profile.id)}><span className="teacher-profile-symbol" aria-hidden="true">{profile.symbol ?? "●"}</span><span><strong>{profile.displayName}</strong><small>{review && review.questions > 0 ? `${review.questions} questions · ${formatDate(review.lastPractised)}` : "No practice yet"}</small></span><span className="teacher-profile-flags">{ready > 0 && <small>{ready} to retrieve</small>}{supported > 0 && <small>{supported} supported</small>}</span></button>; }) : <EmptyState>{activeProfiles.length ? "No profiles match these filters." : "No pupil profiles yet."}</EmptyState>}</section>
              <section className="teacher-profile-review" aria-live="polite">{selectedReview && selectedReviewProfile ? <><header><div><p>Current picture</p><h2>{selectedReviewProfile.displayName}</h2></div><button className="teacher-secondary-button" type="button" onClick={() => props.onLaunch(presetConfig({ mode: "my-mix", focus: "Mixed" }), onePupil(selectedReviewProfile.id))}>Start My Mix</button></header><div className="teacher-evidence-summary"><div><strong>{selectedReview.questions}</strong><span>questions tried</span></div><div><strong>{selectedReview.sessions}</strong><span>practice sessions</span></div><div><strong>{selectedReview.skills.filter((skill) => skill.state === "Ready for retrieval").length}</strong><span>ready for retrieval</span></div></div><section><div className="teacher-section-heading"><div><p>Recent practice</p><h3>What has been encountered</h3></div></div><p className="teacher-inline-list">{selectedReview.recentlyPractised.length ? selectedReview.recentlyPractised.join(" · ") : "No recent practice recorded."}</p></section><section><div className="teacher-section-heading"><div><p>Useful next step</p><h3>Recommendations</h3></div></div>{selectedReview.recommendations.slice(0,3).length ? selectedReview.recommendations.slice(0,3).map((recommendation) => <article className="teacher-recommendation" key={recommendation.id}><div><strong>{recommendation.skill}</strong><p>{recommendation.reason}</p><small>{challengeText(recommendation.challenge)} · {supportText(recommendation.support)}</small></div><button className="teacher-secondary-button" type="button" onClick={() => props.onLaunch(recommendation.config, onePupil(selectedReviewProfile.id))}>Practise this</button></article>) : <EmptyState>More varied practice will make the next recommendation useful.</EmptyState>}</section><section><div className="teacher-section-heading"><div><p>Skill evidence</p><h3>Detail</h3></div></div><div className="teacher-skill-list">{selectedReview.skills.map((skill) => <details key={skill.id}><summary><span><strong>{skill.subskill}</strong><small>{skill.strand}</small></span><span><b>{skill.state}</b><small>{skill.strength}</small></span></summary><dl><div><dt>Independent success</dt><dd>{skill.independentSuccesses}</dd></div><div><dt>Supported success</dt><dd>{skill.supportedSuccesses}</dd></div><div><dt>Variations seen</dt><dd>{skill.variations}</dd></div><div><dt>Evidence count</dt><dd>{skill.sampleCount}</dd></div></dl>{skill.misconception && <p className="teacher-notice"><b>Possible pattern</b>{skill.misconception}</p>}<button type="button" className="teacher-text-button" onClick={() => props.onLaunch(presetConfig({ focus: skill.strand as TeacherFocus, mode: "focus" }), onePupil(selectedReviewProfile.id))}>Practise this</button></details>)}</div></section>{props.onSaveNote && <section><div className="teacher-section-heading"><div><p>Local note</p><h3>Teacher note</h3></div></div><div className="teacher-note-history">{(props.notes ?? []).filter((note) => note.targetType === "profile" && note.targetId === selectedReviewProfile.id).slice(-3).map((note) => <p key={note.id}><span>{formatDate(note.createdAt)}</span>{note.text}</p>)}</div><form className="teacher-note-form" onSubmit={(event) => { event.preventDefault(); if (!noteText.trim()) return; props.onSaveNote?.("profile", selectedReviewProfile.id, noteText.trim()); setNoteText(""); }}><label><span className="sr-only">New note for {selectedReviewProfile.displayName}</span><textarea rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Concise local note" /></label><button type="submit" className="teacher-secondary-button">Save note</button></form></section>}</> : selectedReviewProfile ? <div className="teacher-review-prompt"><h2>No practice yet.</h2><p>Start a practice for this pupil to begin building a private evidence picture.</p><button className="teacher-primary-button" type="button" onClick={() => props.onLaunch(presetConfig({ mode: "my-mix", focus: "Mixed" }), onePupil(selectedReviewProfile.id))}>Start My Mix</button></div> : activeProfiles.length === 0 ? <div className="teacher-review-prompt"><h2>Add pupil profiles.</h2><p>Profiles are optional and stay on this device.</p><button className="teacher-primary-button" type="button" onClick={() => setProfileDialog(true)}>Add profiles</button></div> : filteredProfiles.length === 0 ? <div className="teacher-review-prompt"><h2>No matching profiles.</h2><p>Adjust the filters to see a pupil profile.</p></div> : <div className="teacher-review-prompt"><h2>Choose a profile.</h2><p>Evidence stays private until a teacher deliberately opens it.</p></div>}</section>
            </div>
          </div>
        )}

        {destination === "settings" && (
          <div className="teacher-page teacher-settings-page">
            <header className="teacher-page-heading teacher-page-heading--compact"><p>Settings</p><h1>Keep the classroom setup simple.</h1></header>
            <div className="teacher-settings-layout"><nav aria-label="Settings sections"><button type="button" aria-current={settingsSection === "accessibility" ? "page" : undefined} onClick={() => setSettingsSection("accessibility")}>Accessibility</button><button type="button" aria-current={settingsSection === "profiles" ? "page" : undefined} onClick={() => setSettingsSection("profiles")}>Profiles and groups</button><button type="button" aria-current={settingsSection === "data" ? "page" : undefined} onClick={() => setSettingsSection("data")}>Data and backup</button></nav><section className="teacher-settings-panel">
              {settingsSection === "accessibility" && <><div className="teacher-section-heading"><div><p>Adjustments</p><h2>Accessibility</h2></div></div><p className="teacher-lead">Useful controls for this device. No single preset is assumed to suit every child.</p><div className="teacher-settings-list">{([ ["largerText", "Larger text", "Increase pupil and teacher text."], ["highContrast", "High contrast", "Strengthen text and control contrast."], ["reducedMotion", "Reduced motion", "Use immediate state changes."], ["simplifiedDensity", "Simplified visual density", "Show fewer secondary details."], ["largerTargets", "Larger touch controls", "Increase interactive target size."], ["timedPressure", "Timed pressure", "Off keeps timers quiet and non-urgent."] ] as Array<[keyof AccessibilitySettings,string,string]>).map(([key,label,note]) => <label key={key}><span><b>{label}</b><small>{note}</small></span><input type="checkbox" checked={props.accessibility[key]} onChange={(event) => props.onSetAccessibility({ ...props.accessibility, [key]: event.target.checked })} /></label>)}</div><section className="teacher-subsection"><h3>Teacher access</h3><p>A four-digit code prevents accidental pupil access on this device. It is not an online account or strong security.</p><div className="teacher-inline-actions"><button className="teacher-secondary-button" type="button" onClick={() => { const code = window.prompt("Choose a four-digit code"); if (code === null) return; if (!/^\d{4}$/.test(code)) return window.alert("Use exactly four digits."); props.onSetTeacherCode?.(code); }}>{props.teacherCodeEnabled ? "Change local code" : "Add local code"}</button>{props.teacherCodeEnabled && <button className="teacher-text-button" type="button" onClick={() => { if (window.confirm("Remove the local teacher code from this device?")) props.onSetTeacherCode?.(null); }}>Remove code</button>}</div></section></>}
              {settingsSection === "profiles" && <><div className="teacher-section-heading"><div><p>Device-local</p><h2>Profiles and groups</h2></div><button className="teacher-primary-button" type="button" onClick={() => setProfileDialog(true)}>Add profiles</button></div><p className="teacher-lead">Profiles are optional. Guest practice always remains available.</p><label className="teacher-select-field teacher-privacy-field"><span>Profile-selection privacy</span><select value={props.profilePrivacy ?? "full"} onChange={(event) => props.onSetProfilePrivacy?.(event.target.value as NonNullable<TeacherToolsProps["profilePrivacy"]>)}><option value="full">Full display names</option><option value="first-and-initial">First name and initial</option><option value="initials">Initials only</option><option value="alias">Alias and symbol</option></select></label><div className="teacher-profile-admin">{activeProfiles.sort((a,b) => a.displayName.localeCompare(b.displayName)).map((profile) => <div key={profile.id}><span className="teacher-profile-symbol" aria-hidden="true">{profile.symbol ?? "●"}</span><span><strong>{profile.displayName}</strong><small>{profile.classLabel ?? "No class label"}</small></span><div><button type="button" onClick={() => props.onArchiveProfile?.(profile.id)}>Archive</button><button type="button" onClick={() => { if (window.confirm(`Delete ${profile.displayName}? Their local profile and evidence may be removed.`)) props.onDeleteProfile?.(profile.id); }}>Delete</button></div></div>)}</div><section className="teacher-subsection"><div className="teacher-section-heading"><div><h3>Groups</h3><p>For launching, filtering and printing.</p></div><button className="teacher-secondary-button" type="button" onClick={() => { setGroupProfileIds([]); setNewGroupName(""); setGroupDialog(true); }}>New group</button></div>{props.groups.length ? <ul className="teacher-group-list">{props.groups.map((group) => <li key={group.id}><strong>{group.name}</strong><span>{group.profileIds.length} profiles</span></li>)}</ul> : <EmptyState>No groups yet.</EmptyState>}</section></>}
              {settingsSection === "data" && <><div className="teacher-section-heading"><div><p>Local data</p><h2>Export, import and reset</h2></div></div><p className="teacher-lead">Nothing synchronises automatically between devices. Exported files may contain pupil data and should be handled carefully.</p>{props.storageSummary && <p className="teacher-storage-summary">{props.storageSummary}</p>}<div className="teacher-data-actions"><section><h3>Evidence</h3><p>Move or inspect practice evidence without replacing current records.</p><div><button className="teacher-secondary-button" type="button" onClick={() => props.onExportEvidence?.("csv")}>CSV summary</button><button className="teacher-secondary-button" type="button" onClick={() => props.onExportEvidence?.("json")}>Export evidence</button><label className="teacher-file-button">Import evidence<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImportEvidence?.(file); event.target.value = ""; }} /></label></div></section><section><h3>Complete backup</h3><p>Profiles, groups, presets, settings, evidence, notes, preferences, learning progress and unfinished practice.</p><div><button className="teacher-secondary-button" type="button" onClick={props.onExportBackup}>Export all data</button><label className="teacher-file-button">Restore backup<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onRestoreBackup?.(file); event.target.value = ""; }} /></label></div></section><section className="teacher-danger-zone"><h3>Data management</h3><p>Destructive actions ask for confirmation and say exactly what will be removed.</p><div><button type="button" onClick={() => { if (window.confirm("Clear completed session history? Profiles, unfinished practice and mathematical evidence will remain.")) props.onClearSessionHistory?.(); }}>Clear completed session history</button><button type="button" onClick={() => { if (window.confirm("Delete all local pupil evidence? Profiles and presets will remain.")) props.onDeleteAllEvidence?.(); }}>Delete all local pupil evidence</button><button type="button" onClick={() => { if (window.confirm("Reset the complete application on this device? Export a backup first if the data may be needed.")) props.onResetApplication?.(); }}>Reset application</button></div></section></div><footer className="teacher-version">4S Arithmetic {props.appVersion ? `· ${props.appVersion}` : ""}</footer></>}
            </section></div>
          </div>
        )}
      </main>

      <Dialog open={profileDialog} title="Add pupil profiles" onClose={() => setProfileDialog(false)}><form className="teacher-dialog-form" onSubmit={createProfiles}><p>Paste or enter one name, initial or alias per line. No other personal details are needed.</p><label><span>Names or aliases</span><textarea rows={10} required value={names} onChange={(event) => setNames(event.target.value)} placeholder={"Amina\nBen R\nCJ"} autoFocus /></label><label><span>Add to group <small>Optional</small></span><input type="text" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="4B" /></label><footer><button className="teacher-primary-button" type="submit" disabled={!names.trim()}>Create profiles</button><button className="teacher-text-button" type="button" onClick={() => setProfileDialog(false)}>Cancel</button></footer></form></Dialog>
      <Dialog open={groupDialog} title="Create a group" onClose={() => { setNewGroupName(""); setGroupProfileIds([]); setGroupDialog(false); }}><form className="teacher-dialog-form" onSubmit={(event) => { event.preventDefault(); if (newGroupName.trim() && groupProfileIds.length > 0) props.onCreateGroup?.(newGroupName.trim(), groupProfileIds); setNewGroupName(""); setGroupProfileIds([]); setGroupDialog(false); }}><label><span>Group name</span><input autoFocus required type="text" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} /></label><fieldset><legend>Profiles</legend><div className="teacher-dialog-checklist">{activeProfiles.map((profile) => <label key={profile.id}><input type="checkbox" checked={groupProfileIds.includes(profile.id)} onChange={(event) => setGroupProfileIds((current) => event.target.checked ? [...new Set([...current, profile.id])] : current.filter((id) => id !== profile.id))} />{profile.displayName}</label>)}</div></fieldset><footer><button className="teacher-primary-button" type="submit" disabled={!newGroupName.trim() || groupProfileIds.length === 0}>Create group</button><button className="teacher-text-button" type="button" onClick={() => { setNewGroupName(""); setGroupProfileIds([]); setGroupDialog(false); }}>Cancel</button></footer></form></Dialog>
      <Dialog open={presetDialog} title="Save teacher preset" onClose={() => setPresetDialog(false)}><form className="teacher-dialog-form" onSubmit={(event) => { event.preventDefault(); if (!presetName.trim()) return; props.onSavePreset({ name: presetName.trim(), note: presetNote.trim() || undefined, config }); setPresetName(""); setPresetNote(""); setPresetDialog(false); }}><p>{configSummary(config)}</p><label><span>Preset name</span><input autoFocus required type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="4B Tuesday Warm-Up" /></label><label><span>Short note <small>Optional</small></span><input type="text" value={presetNote} onChange={(event) => setPresetNote(event.target.value)} placeholder="Before the fractions lesson" /></label><footer><button className="teacher-primary-button" type="submit" disabled={!presetName.trim()}>Save preset</button><button className="teacher-text-button" type="button" onClick={() => setPresetDialog(false)}>Cancel</button></footer></form></Dialog>
      <Dialog open={linkDialog} title="Practice link" onClose={() => setLinkDialog(false)}><div className="teacher-dialog-form"><p>The link contains only the session configuration. It does not contain pupil names, evidence or notes.</p><label><span>Shareable link</span><input type="text" readOnly value={practiceLink} onFocus={(event) => event.currentTarget.select()} /></label><footer><button className="teacher-primary-button" type="button" onClick={() => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(practiceLink).catch(() => window.prompt("Copy this link", practiceLink)); else window.prompt("Copy this link", practiceLink); }}>Copy link</button><button className="teacher-text-button" type="button" onClick={() => setLinkDialog(false)}>Done</button></footer></div></Dialog>
      <Dialog open={printDialog} title="Print practice" onClose={() => setPrintDialog(false)} className="teacher-print-dialog">
        <div className="teacher-print-layout">
          <form className="teacher-print-controls" onSubmit={(event) => { event.preventDefault(); makePrintPreview(); }}>
            <label><span>Format</span><select value={printOptions.format} onChange={(event) => setPrintOptions((current) => ({ ...current, format: event.target.value as PrintOptions["format"] }))}><option value="a4">A4 practice page</option><option value="strip">Practice strip</option></select></label>
            <label><span>Questions</span><select value={printOptions.questions} onChange={(event) => setPrintOptions((current) => ({ ...current, questions: Number(event.target.value) as PrintOptions["questions"] }))}>{(printOptions.format === "strip" ? [5,10] : [5,10,15,20,30]).map((count) => <option key={count}>{count}</option>)}</select></label>
            <label><span>Orientation</span><select value={printOptions.orientation} onChange={(event) => setPrintOptions((current) => ({ ...current, orientation: event.target.value as PrintOptions["orientation"] }))}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
            <label><span>Title</span><input type="text" maxLength={80} value={printOptions.title} onChange={(event) => setPrintOptions((current) => ({ ...current, title: event.target.value }))} /></label>
            <div className="teacher-switch-list"><label><span>Answer sheet</span><input type="checkbox" checked={printOptions.answerSheet} onChange={(event) => setPrintOptions((current) => ({ ...current, answerSheet: event.target.checked }))} /></label><label><span>Name and date line</span><input type="checkbox" checked={printOptions.nameLine} onChange={(event) => setPrintOptions((current) => ({ ...current, nameLine: event.target.checked }))} /></label><label><span>Black-and-white safe</span><input type="checkbox" checked={printOptions.blackAndWhite} onChange={(event) => setPrintOptions((current) => ({ ...current, blackAndWhite: event.target.checked }))} /></label></div>
            <button className="teacher-primary-button" type="submit" disabled={printBusy}>{printBusy ? "Preparing…" : "Preview"}</button>
          </form>
          <section className={`teacher-print-preview ${printOptions.orientation} format-${printOptions.format} ${printOptions.answerSheet ? "has-answer-sheet" : "without-answer-sheet"} ${printOptions.blackAndWhite ? "is-monochrome" : "is-colour"}`} aria-label="Print preview" tabIndex={0}>
            {printPreview ? <>
              {(printOptions.format === "strip"
                ? Array.from({ length: Math.ceil(printPreview.questions.length / 5) }, (_, index) => printPreview.questions.slice(index * 5, index * 5 + 5))
                : [printPreview.questions]
              ).map((questions, chunkIndex, chunks) => <div className="print-sheet print-sheet--questions" key={`questions-${chunkIndex}`}>
                <header><h1>{printPreview.title}{chunks.length > 1 ? ` · ${chunkIndex + 1}/${chunks.length}` : ""}</h1>{printOptions.nameLine && <p>Name ____________________ &nbsp; Date __________</p>}</header>
                <ol start={questions[0]?.number}>{questions.map((question) => <li key={question.number}><strong><PrintMathText value={question.display} /></strong>{question.choices?.length ? <ul className="print-choices">{question.choices.map((choice) => <li key={choice}><PrintMathText value={choice} /></li>)}</ul> : null}{question.visual != null && <PrintVisualModel visual={question.visual} />}{question.support && <small><PrintMathText value={question.support} /></small>}</li>)}</ol>
              </div>)}
              {printOptions.answerSheet && <section className="print-sheet print-sheet--answers"><h2>Answers</h2><ol>{printPreview.questions.map((question) => <li key={question.number}><PrintMathText value={question.answer ?? "—"} /></li>)}</ol></section>}
            </> : <div className="teacher-preview-empty"><span aria-hidden="true">□</span><p>Choose Preview to typeset this session for paper.</p></div>}
          </section>
        </div>
        {printPreview && <footer className="teacher-dialog-footer"><button className="teacher-primary-button" type="button" onClick={printDocument}>Print</button><button className="teacher-text-button" type="button" onClick={() => setPrintDialog(false)}>Close</button></footer>}
      </Dialog>
    </div>
  );
}

export default TeacherTools;
