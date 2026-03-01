import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";
const socket = io(API_BASE, {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: true
});

const sampleGoals = [
  "Create a new user",
  "Find a way to check out without a credit card",
  "Detect whether the checkout flow is blocked by a popup"
];

function toAbsoluteUrl(value) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  return `${API_BASE}${value}`;
}

function summarizeSocketState(connected) {
  return connected
    ? {
        label: "Live",
        tone: "bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.55)]",
        text: "Socket linked to Nova Sentinel"
      }
    : {
        label: "Offline",
        tone: "bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.55)]",
        text: "Socket link degraded"
      };
}

function mergeIncident(existing, incoming) {
  const next = [incoming, ...existing.filter((item) => item.sessionId !== incoming.sessionId)];
  return next.sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
}

function incidentFromSession(session) {
  if (!session?.bug) {
    return null;
  }

  return {
    sessionId: session.id,
    type: session.bug.type,
    severity: session.bug.severity,
    summary: session.bug.summary,
    evidenceStatus: session.evidence?.status ?? "ready",
    evidenceProvider: session.evidence?.provider ?? "unknown",
    evidenceSummary: session.evidence?.summary ?? "",
    videoUrl: session.evidence?.videoUrl ?? null,
    updatedAt: session.updatedAt
  };
}

function thoughtFromPayload(payload) {
  return {
    id: crypto.randomUUID(),
    sessionId: payload.sessionId,
    step: payload.step,
    status: payload.status,
    action: payload.action ?? "Reviewing current state",
    reasoning: payload.reasoning ?? "No reasoning provided.",
    confidenceScore: Number(payload.confidenceScore ?? 0),
    raw: payload.raw ?? "{}",
    at: new Date().toLocaleTimeString()
  };
}

function selectPreferredSession(sessions) {
  return (
    sessions.find((session) => session.status === "running")?.id ??
    sessions.find((session) => session.status === "queued")?.id ??
    sessions[0]?.id ??
    null
  );
}

function StatusPill({ status }) {
  const tone =
    status === "passed"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : status === "failed"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
        : status === "running"
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
          : "border-white/10 bg-white/5 text-slate-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${tone}`}>
      {status ?? "idle"}
    </span>
  );
}

function PanelShell({ title, accent, children, headerSlot = null }) {
  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-panel backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${accent}`}>{title}</p>
        </div>
        {headerSlot}
      </div>
      <div className="min-h-0 flex-1 p-5">{children}</div>
    </section>
  );
}

function LiveFeedPanel({ screenshot, session, latestThought }) {
  return (
    <PanelShell
      title="Live Observer (Nova Act)"
      accent="text-cyan-300"
      headerSlot={<StatusPill status={session?.status} />}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid gap-3 rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h2 className="text-xl font-semibold text-white">{session?.goal ?? "Awaiting mission objective"}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {session?.currentUrl ?? "Launch a run to stream the agent browser here in real time."}
            </p>
          </div>
          <div className="grid gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="block text-[10px] text-slate-500">Session</span>
              <strong className="mt-2 block font-mono text-sm text-slate-100">{session?.id ?? "unbound"}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="block text-[10px] text-slate-500">Auditor Action</span>
              <strong className="mt-2 block text-sm normal-case tracking-normal text-slate-100">
                {latestThought?.action ?? "Monitoring"}
              </strong>
            </div>
          </div>
        </div>

        <div className="relative min-h-[26rem] flex-1 overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950">
          <div className="absolute inset-0 animate-pulse-grid bg-[linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-[size:34px_34px]" />
          {screenshot ? (
            <img
              src={screenshot}
              alt="Live browser observer"
              className="relative z-10 h-full w-full object-contain"
            />
          ) : (
            <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
              Nova Sentinel is standing by for a target URL.
            </div>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Reasoning</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              {latestThought?.reasoning ?? session?.lastAudit ?? "The Auditor stream will appear here."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">Confidence</p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {latestThought ? `${Math.round(latestThought.confidenceScore)}%` : "--"}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              The confidence score is taken directly from the Nova Auditor response when available.
            </p>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function ThoughtStreamPanel({ logs, selectedSessionId }) {
  const filteredLogs = selectedSessionId ? logs.filter((log) => log.sessionId === selectedSessionId) : logs;

  return (
    <PanelShell
      title="Thought Stream"
      accent="text-emerald-300"
      headerSlot={<span className="font-mono text-xs text-slate-500">buffer {filteredLogs.length}/50</span>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
          Raw JSON from the Nova Pro Auditor. New entries slide in as the model reassesses the UI state.
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filteredLogs.length ? (
              filteredLogs.map((log) => (
                <motion.article
                  key={log.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-2xl border border-emerald-400/20 bg-slate-950/80 p-4 font-mono text-xs shadow-[0_12px_40px_rgba(3,7,18,0.35)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-emerald-300">{log.status}</span>
                    <span className="text-slate-500">{log.at}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-slate-200">
                    <p>
                      <span className="text-slate-500">Action:</span> {log.action}
                    </p>
                    <p className="leading-6">
                      <span className="text-slate-500">Reasoning:</span> {log.reasoning}
                    </p>
                    <p>
                      <span className="text-slate-500">Confidence:</span> {Math.round(log.confidenceScore)}%
                    </p>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-6 text-cyan-100">
                    {log.raw}
                  </pre>
                </motion.article>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center text-sm text-slate-500"
              >
                The Auditor has not emitted any reasoning yet.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PanelShell>
  );
}

function IncidentCard({ incident, selected, onSelect }) {
  const isReady = incident.evidenceStatus === "ready";
  const videoUrl = toAbsoluteUrl(incident.videoUrl);

  return (
    <motion.button
      layout
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-rose-400/50 bg-rose-400/10"
          : "border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-rose-400/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-300">{incident.type}</p>
          <h3 className="mt-2 text-sm font-semibold text-white">{incident.summary}</h3>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300">
          {incident.severity}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-400">Session {incident.sessionId}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
        {isReady && videoUrl ? (
          <video src={videoUrl} controls className="aspect-video w-full bg-black" preload="metadata" />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.18),transparent_60%),linear-gradient(160deg,#0f172a,#020617)]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-rose-300/20 border-t-rose-300" />
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-rose-200">Generating Video...</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-6 text-slate-400">{incident.evidenceSummary || "Awaiting incident media."}</p>
    </motion.button>
  );
}

function IncidentArchivePanel({ incidents, selectedSessionId, onSelectSession }) {
  return (
    <PanelShell
      title="Incident Archive (Nova Reel)"
      accent="text-rose-300"
      headerSlot={<span className="font-mono text-xs text-slate-500">{incidents.length} incidents</span>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
          Each incident card is hydrated in place. If the video is still rendering, the card stays in a guarded
          loading state instead of looking broken.
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {incidents.length ? (
              incidents.map((incident) => (
                <IncidentCard
                  key={incident.sessionId}
                  incident={incident}
                  selected={incident.sessionId === selectedSessionId}
                  onSelect={() => onSelectSession(incident.sessionId)}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center text-sm text-slate-500"
              >
                No incidents archived yet. Trigger a chaos case to populate this panel.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PanelShell>
  );
}

export default function App() {
  const [goal, setGoal] = useState(sampleGoals[1]);
  const [startUrl, setStartUrl] = useState("http://localhost:4174/store");
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [launching, setLaunching] = useState(false);

  async function refreshSessions() {
    const response = await fetch(`${API_BASE}/api/sessions`);
    const data = await response.json();
    setSessions(data);

    const knownIncidents = data.map(incidentFromSession).filter(Boolean);
    setIncidents((current) => {
      let next = [...current];
      for (const incident of knownIncidents) {
        next = mergeIncident(next, incident);
      }
      return next;
    });

    setSelectedSessionId((current) => current ?? selectPreferredSession(data));
  }

  useEffect(() => {
    refreshSessions().catch(console.error);
  }, []);

  useEffect(() => {
    function handleConnect() {
      setSocketConnected(true);
    }

    function handleDisconnect() {
      setSocketConnected(false);
    }

    function handleSessionCreated(payload) {
      setSelectedSessionId(payload.sessionId);
      setSessions((current) => [payload.session, ...current.filter((item) => item.id !== payload.session.id)]);
    }

    function handleUiUpdate(payload) {
      setScreenshot((current) =>
        !selectedSessionId || payload.sessionId === selectedSessionId ? payload.image : current
      );
      setSessions((current) =>
        current.map((session) =>
          session.id === payload.sessionId
            ? {
                ...session,
                frame: payload.image,
                currentUrl: payload.url,
                currentStep: payload.step
              }
            : session
        )
      );
      setSelectedSessionId((current) => current ?? payload.sessionId);
    }

    function handleThought(payload) {
      setLogs((current) => [thoughtFromPayload(payload), ...current].slice(0, 50));
    }

    function handleBugFound(payload) {
      setIncidents((current) =>
        mergeIncident(current, {
          ...payload,
          updatedAt: new Date().toISOString()
        })
      );
      refreshSessions().catch(console.error);
    }

    function handleIncidentUpdated(payload) {
      setIncidents((current) =>
        mergeIncident(current, {
          ...payload,
          updatedAt: new Date().toISOString()
        })
      );
      refreshSessions().catch(console.error);
    }

    function handleSessionTerminal() {
      refreshSessions().catch(console.error);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("session.created", handleSessionCreated);
    socket.on("ui-update", handleUiUpdate);
    socket.on("ai-thought", handleThought);
    socket.on("bug-found", handleBugFound);
    socket.on("incident-updated", handleIncidentUpdated);
    socket.on("session.passed", handleSessionTerminal);
    socket.on("session.failed", handleSessionTerminal);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("session.created", handleSessionCreated);
      socket.off("ui-update", handleUiUpdate);
      socket.off("ai-thought", handleThought);
      socket.off("bug-found", handleBugFound);
      socket.off("incident-updated", handleIncidentUpdated);
      socket.off("session.passed", handleSessionTerminal);
      socket.off("session.failed", handleSessionTerminal);
    };
  }, [selectedSessionId]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;
  const latestThought =
    logs.find((entry) => entry.sessionId === (selectedSession?.id ?? selectedSessionId)) ??
    logs[0] ??
    null;
  const statusMeta = summarizeSocketState(socketConnected);

  useEffect(() => {
    if (selectedSession?.frame) {
      setScreenshot(selectedSession.frame);
    }
  }, [selectedSession?.frame]);

  async function startRun(event) {
    event.preventDefault();
    setLaunching(true);

    try {
      const response = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          goal,
          startUrl
        })
      });

      const data = await response.json();
      setSelectedSessionId(data.id);
      await refreshSessions();
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_22rem),radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_20rem),linear-gradient(165deg,#020617,#0f172a_55%,#030712)] text-slate-100">
      <AnimatePresence>
        {!socketConnected ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur"
          >
            <div className="rounded-3xl border border-rose-400/20 bg-slate-900/90 px-8 py-6 text-center shadow-panel">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-rose-300/20 border-t-rose-300" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.32em] text-rose-200">
                Reconnecting to Nova Sentinel...
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto flex h-screen max-w-[1880px] flex-col gap-4 p-4">
        <header className="rounded-3xl border border-white/10 bg-slate-900/75 px-5 py-5 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${statusMeta.tone}`} />
                <span className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-300">
                  {statusMeta.label}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Sentinel Dashboard</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Observe Nova-driven intent testing in real time. The left panel streams the browser, the center panel
                  exposes Auditor reasoning, and the archive tracks failures with replay evidence.
                </p>
              </div>
            </div>

            <form className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 xl:w-[42rem]" onSubmit={startRun}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                <label className="grid gap-2 text-sm text-slate-400">
                  Goal
                  <input
                    className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-cyan-400/40"
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    list="goal-presets"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-400">
                  Target URL
                  <input
                    className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-cyan-400/40"
                    value={startUrl}
                    onChange={(event) => setStartUrl(event.target.value)}
                  />
                </label>
              </div>
              <datalist id="goal-presets">
                {sampleGoals.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {sessions.slice(0, 3).map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-mono transition ${
                        session.id === selectedSession?.id
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                      }`}
                    >
                      {session.id}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={launching}
                  className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {launching ? "Launching..." : "Launch Sentinel Run"}
                </button>
              </div>
            </form>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(330px,0.82fr)_minmax(330px,0.9fr)]">
          <LiveFeedPanel screenshot={screenshot} session={selectedSession} latestThought={latestThought} />
          <ThoughtStreamPanel logs={logs} selectedSessionId={selectedSession?.id ?? selectedSessionId} />
          <IncidentArchivePanel
            incidents={incidents}
            selectedSessionId={selectedSession?.id ?? selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
        </main>
      </div>
    </div>
  );
}
