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

type VisualData =
  | { kind: "place-value"; title: string; rows: number[][]; operator: string }
  | { kind: "array"; title: string; rows: number; columns: number }
  | { kind: "partition"; title: string; parts: number[]; multiplier: number }
  | { kind: "groups"; title: string; total: number; groupSize: number }
  | { kind: "fraction-strip"; title: string; numerator: number; denominator: number }
  | { kind: "number-line"; title: string; min: number; max: number; points: number[] }
  | { kind: "relationship"; title: string };

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
  scaffold: {
    hint: string;
    visual: VisualData;
    steps: string[];
    model: { title: string; display: string; lines: string[]; answer: string };
  };
};

type EngineApi = {
  next: () => QuestionItem;
  setChallenge: (value: number) => void;
  getHistory: () => string[];
};

const STORAGE_KEY = "year4-fluency-preferences-v1";
const SESSION_KEY = "year4-fluency-last-session-v1";
const HISTORY_KEY = "year4-fluency-generator-history-v1";

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

  if (visual.kind === "place-value") {
    return (
      <div className="visual-model place-grid" aria-label={visual.title}>
        <div className="place-grid__head"><span>Th</span><span>H</span><span>T</span><span>O</span></div>
        {visual.rows.map((row: number[], rowIndex: number) => (
          <div className="place-grid__row" key={rowIndex}>
            {rowIndex > 0 && <b>{visual.operator}</b>}
            {row.map((digit, index) => <span key={index}>{digit}</span>)}
          </div>
        ))}
      </div>
    );
  }

  if (visual.kind === "array") {
    const dots = Math.min(visual.rows * visual.columns, 72);
    return (
      <div className="visual-model array-model" aria-label={visual.title} style={{ "--array-columns": Math.min(visual.columns, 12) } as React.CSSProperties}>
        {Array.from({ length: dots }, (_, index) => <i key={index} />)}
      </div>
    );
  }

  if (visual.kind === "partition") {
    return (
      <div className="visual-model partition-model" aria-label={visual.title}>
        <div className="partition-model__root">× {visual.multiplier}</div>
        <div className="partition-model__branches">
          {visual.parts.map((part: number) => <span key={part}>{part} × {visual.multiplier}</span>)}
        </div>
      </div>
    );
  }

  if (visual.kind === "groups") {
    const groups = Math.min(Math.ceil(visual.total / visual.groupSize), 12);
    return (
      <div className="visual-model groups-model" aria-label={visual.title}>
        {Array.from({ length: groups }, (_, index) => <span key={index}>{visual.groupSize}</span>)}
      </div>
    );
  }

  if (visual.kind === "fraction-strip") {
    return (
      <div className="visual-model fraction-strip" aria-label={visual.title}>
        {Array.from({ length: visual.denominator }, (_, index) => (
          <span className={index < visual.numerator ? "is-filled" : ""} key={index} />
        ))}
      </div>
    );
  }

  if (visual.kind === "number-line") {
    return (
      <div className="visual-model number-line" aria-label={visual.title}>
        <span>{visual.min.toLocaleString("en-GB")}</span><i /><span>{visual.max.toLocaleString("en-GB")}</span>
      </div>
    );
  }

  return (
    <div className="visual-model relationship-model" aria-label={visual.title}>
      <span>known fact</span><i /><span>new fact</span>
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
          <small>Your turn is just below.</small>
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
        <button type="button" className="text-button text-button--danger" onClick={onReset}>Reset saved preferences</button>
      </section>
    </div>
  );
}

export default function FluencyApp() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [challenge, setChallenge] = useState(54);
  const [support, setSupport] = useState(26);
  const [focus, setFocus] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [feedbackText, setFeedbackText] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [scaffoldStage, setScaffoldStage] = useState(0);
  const [controlOpen, setControlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [elapsed, setElapsed] = useState(0);
  const [independentStreak, setIndependentStreak] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>({ reducedMotion: false, largerText: false, strongerContrast: false });
  const [hydrated, setHydrated] = useState(false);
  const engineRef = useRef<EngineApi | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let saved: { challenge?: number; support?: number; preferences?: Preferences } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      // A damaged preference should never block practice.
    }
    const timer = window.setTimeout(() => {
      if (saved) {
        if (Number.isFinite(saved.challenge)) setChallenge(saved.challenge as number);
        if (Number.isFinite(saved.support)) setSupport(saved.support as number);
        if (saved.preferences) setPreferences(saved.preferences);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ challenge, support, preferences }));
  }, [challenge, support, preferences, hydrated]);

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
    setScaffoldStage(initialStage(support));
  }, [initialStage, support]);

  const begin = (presetKey?: keyof typeof PRESETS) => {
    let nextChallenge = challenge;
    let nextSupport = support;
    let nextFocus = focus;
    if (presetKey) {
      const preset = PRESETS[presetKey];
      nextChallenge = preset.challenge;
      nextSupport = preset.support;
      nextFocus = preset.focus;
      setChallenge(nextChallenge);
      setSupport(nextSupport);
      setFocus(nextFocus);
    }
    const startedAt = Date.now();
    let recentSignatures: string[] = [];
    try {
      recentSignatures = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      recentSignatures = [];
    }
    engineRef.current = createEngine({ seed: `practice-${startedAt}`, challenge: nextChallenge, focus: nextFocus, recentSignatures });
    setStats({ ...EMPTY_STATS, startedAt });
    setElapsed(0);
    setIndependentStreak(0);
    setScreen("practice");
    const item = engineRef.current.next();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(engineRef.current.getHistory()));
    setQuestion(item);
    setAnswer("");
    setSelectedChoice("");
    setAttempts(0);
    setFeedback("idle");
    setScaffoldStage(initialStage(nextSupport));
  };

  const recordCompletedQuestion = useCallback((wasFirstTry: boolean, usedModel: boolean) => {
    if (!question) return;
    setStats((current) => {
      const strand = question.strand;
      const strandStat = current.strands[strand] ?? { attempted: 0, firstTry: 0 };
      return {
        ...current,
        attempted: current.attempted + 1,
        firstTry: current.firstTry + (wasFirstTry ? 1 : 0),
        afterSupport: current.afterSupport + (wasFirstTry ? 0 : 1),
        modelled: current.modelled + (usedModel ? 1 : 0),
        strands: {
          ...current.strands,
          [strand]: {
            attempted: strandStat.attempted + 1,
            firstTry: strandStat.firstTry + (wasFirstTry ? 1 : 0),
          },
        },
      };
    });
  }, [question]);

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
      recordCompletedQuestion(wasFirstTry, usedModel);
      setFeedback("correct");
      setFeedbackText(wasFirstTry ? "Correct" : "You found it");

      if (wasFirstTry && scaffoldStage === 0) {
        const nextStreak = independentStreak + 1;
        setIndependentStreak(nextStreak);
        if (nextStreak >= 3) {
          const nextSupport = adaptiveSupport(support, "three-independent-correct");
          setSupport(nextSupport);
          setIndependentStreak(0);
        }
      } else {
        setIndependentStreak(0);
      }

      advanceTimer.current = setTimeout(nextQuestion, preferences.reducedMotion ? 250 : 720);
      return;
    }

    const nextAttempts = attempts + 1;
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
    if (nextAttempts === 2) setSupport((current) => adaptiveSupport(current, "repeated-struggle"));
  }, [answer, attempts, feedback, independentStreak, nextQuestion, preferences.reducedMotion, question, recordCompletedQuestion, scaffoldStage, selectedChoice, support]);

  useEffect(() => {
    if (screen !== "practice") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || feedback === "correct" || question?.type === "choice") return;
      if (/^[0-9]$/.test(event.key)) setAnswer((current) => current.length < 12 ? current + event.key : current);
      if (event.key === "Backspace" || event.key === "Delete") setAnswer((current) => current.slice(0, -1));
      if (event.key === "." && question?.answerType === "decimal") setAnswer((current) => current.includes(".") ? current : current + ".");
      if (event.key === "/" && question?.answerType === "fraction") setAnswer((current) => current.includes("/") ? current : current + "/");
      if (event.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [feedback, question, screen, settingsOpen, submit]);

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
    setScaffoldStage(initialStage(value));
  };

  const revealHint = () => setScaffoldStage((stage) => Math.min(4, stage + 1));

  const endSession = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const finalStats = { ...stats, elapsed: Math.max(1, elapsed) };
    setStats(finalStats);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...finalStats, challenge, support, endedAt: Date.now() }));
    setScreen("summary");
    setControlOpen(false);
  };

  const resetPreferences = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(HISTORY_KEY);
    setChallenge(54);
    setSupport(26);
    setPreferences({ reducedMotion: false, largerText: false, strongerContrast: false });
    setSettingsOpen(false);
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Some embedded browsers reserve full screen for their own controls.
    }
  };

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
  ].filter(Boolean).join(" ");

  return (
    <main className={rootClass} data-screen={screen}>
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
            <AxisControl id="challenge" label="Challenge" value={challenge} setValue={(value) => { setChallenge(value); setFocus(null); }} anchors={CHALLENGE_ANCHORS} />
            <AxisControl id="support" label="Support" value={support} setValue={setSupport} anchors={SUPPORT_ANCHORS} />
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
              <button type="button" className="icon-button" onClick={toggleFullScreen} aria-label="Toggle full screen">⛶</button>
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
              </div>
              {question.instruction && <p id="question-instruction" className="question-instruction"><MathText value={question.instruction} /></p>}
              {!(question.type === "choice" && question.display.startsWith("Choose")) && (
                <div className="question-math" aria-label={`${question.instruction ?? "Calculate"}: ${question.display}`}>
                  <MathText value={question.display} />
                </div>
              )}

              {question.type === "choice" ? (
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
              )}

              <div className={`feedback-line feedback-line--${feedback}`} role="status" aria-live="polite">
                {feedback === "correct" && <b aria-hidden="true">✓</b>}
                <span>{feedbackText}</span>
              </div>

              {question.type !== "choice" && (
                <NumberPad
                  value={answer}
                  setValue={(value) => { setAnswer(value); setFeedback("idle"); setFeedbackText(""); }}
                  allowDecimal={question.answerType === "decimal"}
                  allowFraction={question.answerType === "fraction"}
                  disabled={feedback === "correct"}
                />
              )}

              <div className="question-actions">
                <button type="button" className="hint-button" onClick={revealHint} disabled={scaffoldStage >= 4 || feedback === "correct"}>
                  {scaffoldStage === 0 ? "Hint" : scaffoldStage >= 4 ? "Model shown" : "More help"}
                </button>
                <button type="button" className="check-button" onClick={submit} disabled={feedback === "correct"}>Check</button>
              </div>
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
            <button type="button" className="text-button" onClick={() => { setFocus(null); setScreen("setup"); }}>Change the settings</button>
          </div>
        </section>
      )}

      {settingsOpen && <SettingsPanel preferences={preferences} setPreferences={setPreferences} onClose={() => setSettingsOpen(false)} onReset={resetPreferences} />}
    </main>
  );
}
