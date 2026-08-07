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
  supportBand,
} from "@/lib/fluency-engine.mjs";

type Screen = "setup" | "practice" | "summary";
type Feedback = "idle" | "retry" | "supported" | "correct";
type PracticeMode = "mix" | "focus" | "quick" | "think" | "my-mix";

type Preferences = {
  reducedMotion: boolean;
  largerText: boolean;
  strongerContrast: boolean;
};

type StrandStat = {
  attempted: number;
  firstTry: number;
};

type SessionStats = {
  attempted: number;
  firstTry: number;
  afterSupport: number;
  modelled: number;
  startedAt: number;
  elapsed: number;
  strands: Record<string, StrandStat>;
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
  };
};

type EngineApi = {
  next: () => QuestionItem;
  setChallenge: (value: number) => void;
  setFocus: (value: string | null) => void;
  setMode: (value: PracticeMode) => void;
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
};

type MasteryState = {
  attempts: number;
  score: number;
  strength?: string;
  lastSeen?: number;
  lastSeenAt?: number | null;
};

const STORAGE_KEY = "year4-fluency-preferences-v2";
const SESSION_KEY = "year4-fluency-last-session-v2";
const HISTORY_KEY = "year4-fluency-generator-history-v2";
const LEARNING_KEY = "year4-fluency-learning-v2";

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
  firstTry: 0,
  afterSupport: 0,
  modelled: 0,
  startedAt: 0,
  elapsed: 0,
  strands: {},
};

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

function MathText({ value }: { value: string }) {
  const segments = String(value).split(/(\[\[-?\d+\/-?\d+\]\])/g);
  return (
    <>
      {segments.map((segment, index) => {
        const match = segment.match(/^\[\[(-?\d+)\/(-?\d+)\]\]$/);
        if (!match) return <span key={`${segment}-${index}`}>{segment}</span>;
        return (
          <span className="fraction" aria-label={`${match[1]} over ${match[2]}`} key={`${segment}-${index}`}>
            <span>{match[1]}</span>
            <span>{match[2]}</span>
          </span>
        );
      })}
    </>
  );
}

function AxisControl({
  id,
  label,
  value,
  setValue,
  anchors,
  compact = false,
}: {
  id: string;
  label: string;
  value: number;
  setValue: (value: number) => void;
  anchors: Array<{ value: number; label: string }>;
  compact?: boolean;
}) {
  return (
    <div className={`axis ${compact ? "axis--compact" : ""}`}>
      <div className="axis__heading">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{nearestLabel(value, anchors)}</output>
      </div>
      <input
        id={id}
        aria-valuetext={nearestLabel(value, anchors)}
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        style={{ "--range-progress": `${value}%` } as React.CSSProperties}
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
      <div className="visual-model place-grid" role="img" aria-label={visual.title}>
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
    const dots = Math.min(rowCount * columnCount, 96);
    return (
      <div className="visual-model array-model" role="img" aria-label={visual.title} style={{ "--array-columns": Math.min(columnCount, 12) } as React.CSSProperties}>
        {Array.from({ length: dots }, (_, index) => <i key={index} />)}
      </div>
    );
  }

  if (visual.kind === "partition") {
    return (
      <div className="visual-model partition-model" role="img" aria-label={visual.title}>
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
      <div className="visual-model groups-model" role="img" aria-label={visual.title}>
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
      <div className="visual-model multiplication-rectangle" role="img" aria-label={visual.title}>
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
    return (
      <div className={`visual-model number-line ${visual.kind === "bead-string" ? "bead-string" : ""}`} role="img" aria-label={`${visual.title}, from ${format(min)} to ${format(max)}`}>
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
      <div className="visual-model worked-example" aria-label={visual.title}>
        {(visual.lines ?? []).map((line, index) => <span key={index}><MathText value={line} /></span>)}
      </div>
    );
  }

  return (
    <div className="visual-model relationship-model" role="img" aria-label={visual.title}>
      <span><MathText value={visual.left ?? "known fact"} /></span>
      <i><small>{visual.connector ?? "helps"}</small></i>
      <span><MathText value={visual.right ?? "new fact"} /></span>
    </div>
  );
}

function ScaffoldPanel({ item, stage }: { item: QuestionItem; stage: number }) {
  if (stage <= 0 || !item) return null;
  const scaffold = item.scaffold;
  return (
    <aside className="scaffold" aria-live="polite">
      {stage >= 1 && (
        <div className="scaffold__hint">
          <span>Notice</span>
          <p><MathText value={scaffold.hint} /></p>
        </div>
      )}
      {stage >= 2 && (
        <div className="scaffold__visual">
          <span>See it</span>
          <p className="scaffold__caption">{scaffold.visual.title}</p>
          <VisualScaffold visual={scaffold.visual} />
        </div>
      )}
      {stage >= 3 && (
        <div className="scaffold__steps">
          <span>Try these steps</span>
          <ol>
            {scaffold.steps.map((step: string, index: number) => <li key={index}><MathText value={step} /></li>)}
          </ol>
        </div>
      )}
      {stage >= 4 && (
        <div className="scaffold__model">
          <span>{scaffold.model.title}</span>
          <strong><MathText value={scaffold.model.display} /></strong>
          {scaffold.model.lines.map((line: string, index: number) => <p key={index}><MathText value={line} /></p>)}
          <b>= <MathText value={scaffold.model.answer} /></b>
          <small>Use the structure, then try the question.</small>
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
    setValue(value + character);
  };
  return (
    <div className="number-pad" aria-label="Number pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
        <button type="button" onClick={() => add(String(number))} disabled={disabled} key={number}>{number}</button>
      ))}
      <button type="button" className="number-pad__utility" onClick={() => setValue(value.slice(0, -1))} disabled={disabled || !value} aria-label="Delete last digit">←</button>
      <button type="button" onClick={() => add("0")} disabled={disabled}>0</button>
      <button
        type="button"
        className="number-pad__utility"
        onClick={() => add(allowFraction ? "/" : ".")}
        disabled={disabled || (!allowDecimal && !allowFraction)}
        aria-label={allowFraction ? "Fraction line" : "Decimal point"}
      >{allowFraction ? "⁄" : "."}</button>
    </div>
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
        <span>Practice</span><b>{selected.label}</b><i aria-hidden="true">{expanded ? "−" : "+"}</i>
      </button>
      {expanded && (
        <div className="mode-selector__panel">
          <div className="mode-options" role="radiogroup" aria-label="Practice mode">
            {visibleModes.map((item) => (
              <button
                type="button"
                role="radio"
                aria-checked={mode === item.id}
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      const context = canvas.getContext("2d");
      if (context) {
        context.scale(ratio, ratio);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 2.4;
        context.strokeStyle = "#24375d";
      }
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
      <section className="jot-sheet" role="dialog" aria-modal="true" aria-label="Temporary jotting space">
        <header><span>Jot</span><div><button type="button" onClick={clear}>Clear</button><button type="button" onClick={onClose} aria-label="Close jotting space">Done</button></div></header>
        <canvas
          ref={canvasRef}
          aria-label="Draw temporary working here"
          onPointerDown={(event) => {
            drawing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            const context = event.currentTarget.getContext("2d");
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
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-heading">
          <div><span>Preferences</span><h2 id="settings-title">Make Fluency comfortable</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings" autoFocus>×</button>
        </div>
        <label className="setting-row">
          <span><b>Larger mathematics</b><small>Increase questions and controls</small></span>
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
        <button type="button" className="text-button text-button--danger" onClick={onReset}>Reset saved practice data</button>
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
  const [controlOpen, setControlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jotOpen, setJotOpen] = useState(false);
  const [anotherWayOpen, setAnotherWayOpen] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const [boardAnswerVisible, setBoardAnswerVisible] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [elapsed, setElapsed] = useState(0);
  const [independentStreak, setIndependentStreak] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>({ reducedMotion: false, largerText: false, strongerContrast: false });
  const [learningState, setLearningState] = useState<Record<string, MasteryState>>({});
  const [hydrated, setHydrated] = useState(false);
  const engineRef = useRef<EngineApi | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveSupportRef = useRef(26);
  const questionStartedAt = useRef(0);

  useEffect(() => {
    let saved: { challenge?: number; support?: number; mode?: PracticeMode; focus?: string | null; preferences?: Preferences } | null = null;
    let savedLearning: Record<string, MasteryState> = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("year4-fluency-preferences-v1") ?? "null");
      savedLearning = JSON.parse(localStorage.getItem(LEARNING_KEY) ?? "{}");
    } catch {
      // A damaged preference should never block practice.
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
        if (saved.preferences) setPreferences(saved.preferences);
      }
      setLearningState(savedLearning && typeof savedLearning === "object" ? savedLearning : {});
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ challenge, support, mode, focus, preferences }));
  }, [challenge, support, mode, focus, preferences, hydrated]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline support is progressive; practice must still work if registration is unavailable.
      });
    }
  }, []);

  useEffect(() => {
    if (screen !== "practice" || !stats.startedAt) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - stats.startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, stats.startedAt]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const initialStage = useCallback((supportValue: number) => {
    const band = supportBand(supportValue);
    return { independent: 0, prompted: 0, guided: 2, stepped: 3, modelled: 4 }[band] ?? 0;
  }, []);

  const nextQuestion = useCallback(() => {
    if (!engineRef.current) return;
    const item = engineRef.current.next();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(engineRef.current.getHistory()));
    setQuestion(item);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    setFeedback("idle");
    setFeedbackText("");
    setAnotherWayOpen(false);
    setBoardAnswerVisible(false);
    const selectedStage = initialStage(effectiveSupportRef.current);
    setScaffoldStage(item.metadata.connectionKind === "near-transfer" ? Math.min(2, selectedStage) : selectedStage);
    questionStartedAt.current = Date.now();
  }, [initialStage]);

  const begin = (presetKey?: keyof typeof PRESETS) => {
    let nextChallenge = challenge;
    let nextSupport = support;
    let nextMode = mode;
    let nextFocus = mode === "focus" ? focus : null;
    if (presetKey) {
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
    if (nextMode === "focus" && (!nextFocus || (nextFocus === "fractions" && nextChallenge < 20) || (nextFocus === "decimals" && nextChallenge < 38))) {
      nextFocus = "addition";
      setFocus(nextFocus);
    }
    const startedAt = Date.now();
    let recentSignatures: string[] = [];
    try {
      recentSignatures = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? localStorage.getItem("year4-fluency-generator-history-v1") ?? "[]");
    } catch {
      recentSignatures = [];
    }
    const engine = createEngine({
      seed: `practice-${startedAt}`,
      challenge: nextChallenge,
      support: nextSupport,
      mode: nextMode,
      focus: nextFocus,
      recentSignatures,
      learningState,
    }) as unknown as EngineApi;
    engineRef.current = engine;
    effectiveSupportRef.current = nextSupport;
    setEffectiveSupport(nextSupport);
    setStats({ ...EMPTY_STATS, startedAt });
    setElapsed(0);
    setIndependentStreak(0);
    setModeOpen(false);
    setBoardMode(false);
    setBoardAnswerVisible(false);
    setAnotherWayOpen(false);
    setScreen("practice");
    const item = engine.next();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(engine.getHistory()));
    setQuestion(item);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    setFeedback("idle");
    setScaffoldStage(initialStage(nextSupport));
    questionStartedAt.current = Date.now();
  };

  const recordCompletedQuestion = useCallback((wasFirstTry: boolean, usedSupport: boolean, usedModel: boolean) => {
    if (!question) return;
    const independentFirstTry = wasFirstTry && !usedSupport;
    setStats((current) => {
      const strand = question.strand;
      const strandStat = current.strands[strand] ?? { attempted: 0, firstTry: 0 };
      return {
        ...current,
        attempted: current.attempted + 1,
        firstTry: current.firstTry + (independentFirstTry ? 1 : 0),
        afterSupport: current.afterSupport + (!independentFirstTry && !usedModel ? 1 : 0),
        modelled: current.modelled + (usedModel ? 1 : 0),
        strands: {
          ...current.strands,
          [strand]: {
            attempted: strandStat.attempted + 1,
            firstTry: strandStat.firstTry + (independentFirstTry ? 1 : 0),
          },
        },
      };
    });
  }, [question]);

  const persistLearning = useCallback(() => {
    if (!engineRef.current) return;
    const nextLearning = engineRef.current.getLearningState();
    setLearningState(nextLearning);
    localStorage.setItem(LEARNING_KEY, JSON.stringify(nextLearning));
  }, []);

  const submit = useCallback(() => {
    if (!question || feedback === "correct") return;
    const response = question.type === "choice" ? selectedChoice : answer;
    const result = evaluateAnswer(question, response);
    if (result.empty) {
      setFeedbackText("Enter an answer first.");
      return;
    }
    if (result.correct) {
      const wasFirstTry = attempts === 0;
      const usedModel = scaffoldStage >= 4;
      const usedSupport = scaffoldStage > 0 || !wasFirstTry;
      engineRef.current?.recordResponse({
        item: question,
        correct: true,
        firstTry: wasFirstTry,
        supportUsed: scaffoldStage,
        modelUsed: usedModel,
        responseMs: Date.now() - questionStartedAt.current,
      });
      persistLearning();
      recordCompletedQuestion(wasFirstTry, usedSupport, usedModel);
      setFeedback("correct");
      setFeedbackText(wasFirstTry ? "Correct" : "You found it");

      if (wasFirstTry && scaffoldStage === 0) {
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

      advanceTimer.current = setTimeout(nextQuestion, preferences.reducedMotion ? 250 : 720);
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
    setScaffoldStage((current) => Math.max(current + 1, 2));
    setAnswer("");
    setSelectedChoice("");
    if (nextAttempts === 2) {
      const nextEffectiveSupport = adaptiveSupport(effectiveSupportRef.current, "repeated-struggle");
      effectiveSupportRef.current = nextEffectiveSupport;
      setEffectiveSupport(nextEffectiveSupport);
    }
  }, [answer, attempts, feedback, independentStreak, nextQuestion, persistLearning, preferences.reducedMotion, question, recordCompletedQuestion, scaffoldStage, selectedChoice]);

  useEffect(() => {
    if (screen !== "practice") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || jotOpen || boardMode || feedback === "correct" || question?.type === "choice") return;
      if (/^[0-9]$/.test(event.key)) setAnswer((current) => current.length < 12 ? current + event.key : current);
      if (event.key === "Backspace" || event.key === "Delete") setAnswer((current) => current.slice(0, -1));
      if (event.key === "." && question?.answerType === "decimal") setAnswer((current) => current.includes(".") ? current : current + ".");
      if (event.key === "/" && question?.answerType === "fraction") setAnswer((current) => current.includes("/") ? current : current + "/");
      if (event.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [boardMode, feedback, jotOpen, question, screen, settingsOpen, submit]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  const changeChallenge = (value: number) => {
    setChallenge(value);
    engineRef.current?.setChallenge(value);
  };

  const changeSupport = (value: number) => {
    setSupport(value);
    setEffectiveSupport(value);
    effectiveSupportRef.current = value;
    setScaffoldStage(initialStage(value));
  };

  const revealHint = () => setScaffoldStage((stage) => Math.min(4, stage + 1));

  const endSession = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const finalStats = { ...stats, elapsed: Math.max(1, elapsed) };
    setStats(finalStats);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...finalStats, challenge, support, mode, focus, endedAt: Date.now() }));
    setScreen("summary");
    setControlOpen(false);
    setBoardMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  };

  const resetPreferences = () => {
    if (!window.confirm("Reset saved settings and personal practice memory on this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
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
    setPreferences({ reducedMotion: false, largerText: false, strongerContrast: false });
    setSettingsOpen(false);
  };

  const toggleBoardMode = async () => {
    const nextBoardMode = !boardMode;
    setBoardMode(nextBoardMode);
    setBoardAnswerVisible(false);
    try {
      if (nextBoardMode && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (!nextBoardMode && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Some embedded browsers reserve full screen for their own controls.
    }
  };

  const myMixAvailable = useMemo(() => Object.values(learningState).reduce((total, skill) => total + (skill.attempts ?? 0), 0) >= 20, [learningState]);

  const strandSummary = useMemo(() => {
    const rows = Object.entries(stats.strands).map(([strand, value]) => ({
      strand,
      attempted: value.attempted,
      rate: value.attempted ? value.firstTry / value.attempted : 0,
    }));
    const meaningful = rows.filter((row) => row.attempted >= 2);
    const ranked = (meaningful.length ? meaningful : rows).sort((a, b) => b.rate - a.rate || b.attempted - a.attempted);
    return { strongest: ranked[0]?.strand ?? "steady thinking", practise: ranked.at(-1)?.strand ?? "mixed fluency" };
  }, [stats.strands]);

  const rootClass = [
    "fluency-app",
    preferences.reducedMotion ? "reduce-motion" : "",
    preferences.largerText ? "larger-text" : "",
    preferences.strongerContrast ? "stronger-contrast" : "",
    boardMode ? "board-mode" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className={rootClass} data-screen={screen} data-adaptive-support={Math.round(effectiveSupport)}>
      <a className="skip-link" href="#main-content">Skip to the question</a>

      {screen === "setup" && (
        <section className="setup-screen" id="main-content">
          <header className="setup-header">
            <div className="wordmark"><i aria-hidden="true" />Fluency</div>
            <button type="button" className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">•••</button>
          </header>

          <div className="setup-intro">
            <p>Year 4 mathematics</p>
            <h1>Find your point.<br />Begin there.</h1>
          </div>

          <div className="setup-controls" aria-label="Practice settings">
            <AxisControl id="challenge" label="Challenge" value={challenge} setValue={setChallenge} anchors={CHALLENGE_ANCHORS} />
            <AxisControl id="support" label="Support" value={support} setValue={setSupport} anchors={SUPPORT_ANCHORS} />
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
          </div>

          <div className="setup-actions">
            <button type="button" className="primary-button" onClick={() => begin()}>Begin</button>
            <div className="presets" aria-label="Quick starts">
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                <button type="button" onClick={() => begin(key)} key={key}>
                  <span>{PRESETS[key].label}</span>
                  <small>{key === "warmup" ? "Gentle mixed start" : key === "year4" ? "Core Year 4" : key === "stretch" ? "Deep thinking" : "Facts and inverses"}</small>
                </button>
              ))}
            </div>
          </div>

          <footer className="setup-footer">
            <span>No scores. No timer pressure.</span>
            <span>Challenge and support stay in your hands.</span>
          </footer>
        </section>
      )}

      {screen === "practice" && question && (
        <section className="practice-screen" id="main-content">
          <header className="practice-header">
            <button type="button" className="wordmark wordmark--button" onClick={endSession} aria-label="End practice and see summary"><i aria-hidden="true" />Fluency</button>
            <div className="session-pulse" aria-label={`${stats.attempted} questions in ${formatDuration(elapsed)}`}>
              <span>{stats.attempted} {stats.attempted === 1 ? "question" : "questions"}</span><i />
              <span>{formatDuration(elapsed)}</span>
            </div>
            <div className="practice-tools">
              <button type="button" className="board-button" onClick={toggleBoardMode} aria-pressed={boardMode}>{boardMode ? "Exit board" : "Board"}</button>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">•••</button>
            </div>
          </header>

          <div className={`control-drawer ${controlOpen ? "is-open" : ""}`}>
            <button type="button" className="control-drawer__tab" onClick={() => setControlOpen((open) => !open)} aria-expanded={controlOpen}>
              <span>Adjust</span><i>{controlOpen ? "−" : "+"}</i>
            </button>
            {controlOpen && (
              <div className="control-drawer__body">
                <AxisControl compact id="practice-challenge" label="Challenge" value={challenge} setValue={changeChallenge} anchors={CHALLENGE_ANCHORS} />
                <AxisControl compact id="practice-support" label="Support" value={support} setValue={changeSupport} anchors={SUPPORT_ANCHORS} />
              </div>
            )}
          </div>

          <div className={`practice-workspace scaffold-stage-${scaffoldStage}`}>
            <ScaffoldPanel item={question} stage={scaffoldStage} />

            <article
              className="question-panel"
              aria-labelledby={question.instruction ? "question-instruction" : undefined}
              aria-label={question.instruction ? undefined : `Question: ${question.display}`}
            >
              <div className="question-context">
                <span>{question.strand}</span>
                <span aria-hidden="true">·</span>
                <span>{challengeLabel(question.difficulty)}</span>
                <span aria-hidden="true">·</span>
                <span>{MODES.find((item) => item.id === mode)?.label ?? "Mix"}</span>
              </div>
              {question.instruction && <p id="question-instruction" className="question-instruction"><MathText value={question.instruction} /></p>}
              {!(question.type === "choice" && question.display.startsWith("Choose")) && (
                <div className="question-math" aria-label={`${question.instruction ?? "Calculate"}: ${question.display}`}>
                  <MathText value={question.display} />
                </div>
              )}

              {question.promptVisual && <div className="prompt-visual"><VisualScaffold visual={question.promptVisual} /></div>}

              {anotherWayOpen && question.scaffold.alternatives.length > 0 && (
                <div className="another-way" aria-live="polite">
                  <span>Another way</span>
                  {question.scaffold.alternatives.slice(0, 2).map((alternative) => <p key={alternative}><MathText value={alternative} /></p>)}
                </div>
              )}

              {!boardMode && (question.type === "choice" ? (
                <div className="choice-grid" role="radiogroup" aria-label="Choose an answer">
                  {(question.choices ?? []).map((choice: string) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedChoice === choice}
                      className={selectedChoice === choice ? "is-selected" : ""}
                      onClick={() => { setSelectedChoice(choice); setFeedback("idle"); setFeedbackText(""); }}
                      disabled={feedback === "correct"}
                      key={choice}
                    ><MathText value={choice} /></button>
                  ))}
                </div>
              ) : (
                <div className="answer-display" data-empty={!answer} aria-live="polite">
                  {answer ? <MathText value={answer} /> : <span>?</span>}
                </div>
              ))}

              {boardMode && boardAnswerVisible && (
                <div className="board-answer" role="status"><span>Answer</span><strong><MathText value={question.answer} /></strong></div>
              )}

              {!boardMode && <div className={`feedback-line feedback-line--${feedback}`} role="status" aria-live="polite">
                {feedback === "correct" && <b aria-hidden="true">✓</b>}
                <span>{feedbackText}</span>
              </div>}

              {!boardMode && question.type !== "choice" && (
                <NumberPad
                  value={answer}
                  setValue={(value) => { setAnswer(value); setFeedback("idle"); setFeedbackText(""); }}
                  allowDecimal={question.answerType === "decimal"}
                  allowFraction={question.answerType === "fraction"}
                  disabled={feedback === "correct"}
                />
              )}

              {boardMode ? (
                <div className="board-controls">
                  <button type="button" onClick={() => setBoardAnswerVisible((visible) => !visible)}>{boardAnswerVisible ? "Hide" : "Reveal"}</button>
                  <button type="button" onClick={() => setScaffoldStage(4)}>Model</button>
                  <button type="button" className="is-primary" onClick={nextQuestion}>Another</button>
                </div>
              ) : (
                <>
                  <div className="question-actions">
                    <button type="button" className="hint-button" onClick={revealHint} disabled={scaffoldStage >= 4 || feedback === "correct"}>
                      {scaffoldStage === 0 ? "Hint" : scaffoldStage === 3 ? "Model" : scaffoldStage >= 4 ? "Model shown" : "More help"}
                    </button>
                    <button type="button" className="check-button" onClick={submit} disabled={feedback === "correct"}>Check</button>
                  </div>
                  <div className="question-secondary-actions">
                    <button type="button" onClick={() => setJotOpen(true)}>Jot</button>
                    {question.scaffold.alternatives.length > 0 && (scaffoldStage > 0 || feedback === "supported") && (
                      <button type="button" onClick={() => setAnotherWayOpen((open) => !open)}>{anotherWayOpen ? "Hide other way" : "Another way"}</button>
                    )}
                  </div>
                </>
              )}
            </article>
          </div>
        </section>
      )}

      {screen === "summary" && (
        <section className="summary-screen" id="main-content">
          <header className="setup-header">
            <div className="wordmark"><i aria-hidden="true" />Fluency</div>
          </header>
          <div className="summary-copy">
            <p>Practice complete</p>
            <h1>Good work.<br />Leave it there.</h1>
          </div>
          <div className="summary-numbers" aria-label="Session summary">
            <div><strong>{stats.attempted}</strong><span>questions explored</span></div>
            <div><strong>{stats.firstTry}</strong><span>first try</span></div>
            <div><strong>{stats.afterSupport}</strong><span>after support</span></div>
            <div><strong>{stats.modelled}</strong><span>after a model</span></div>
          </div>
          <div className="summary-notes">
            <div><span>Strongest today</span><b>{strandSummary.strongest}</b></div>
            <div><span>Keep practising</span><b>{strandSummary.practise}</b></div>
          </div>
          <div className="summary-actions">
            <button type="button" className="primary-button" onClick={() => begin()}>Practise again</button>
            <button type="button" className="text-button" onClick={() => setScreen("setup")}>Change the settings</button>
          </div>
        </section>
      )}

      {settingsOpen && <SettingsPanel preferences={preferences} setPreferences={setPreferences} onClose={() => setSettingsOpen(false)} onReset={resetPreferences} />}
      {jotOpen && <JotPad onClose={() => setJotOpen(false)} />}
    </main>
  );
}
