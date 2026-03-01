import express from "express";
import { config } from "../lib/config.js";

export function createSessionRouter(orchestrator, sessionStore, documentarianProvider) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      targetAppUrl: config.targetAppUrl
    });
  });

  router.get("/sessions", (_req, res) => {
    res.json(sessionStore.listSessions());
  });

  router.get("/sessions/:sessionId", (req, res) => {
    const session = sessionStore.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(session);
  });

  router.post("/sessions/start", async (req, res) => {
    const goal = req.body.goal?.trim();
    const startUrl = req.body.startUrl?.trim() || config.targetAppUrl;
    if (!goal) {
      res.status(400).json({ error: "goal is required" });
      return;
    }

    const session = await orchestrator.start({
      goal,
      startUrl,
      providerMode: req.body.providerMode ?? "auto"
    });

    res.status(202).json(session);
  });

  router.get("/incidents/:sessionId/video", async (req, res) => {
    const session = sessionStore.getSession(req.params.sessionId);
    if (!session?.evidence) {
      res.status(404).json({ error: "Incident video not found" });
      return;
    }

    try {
      await documentarianProvider.streamEvidence(session.evidence, res);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
}
