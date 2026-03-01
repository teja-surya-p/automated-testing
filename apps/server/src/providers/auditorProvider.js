import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { clamp, extractJsonObject } from "../lib/utils.js";
import { config, hasBedrockRuntime } from "../lib/config.js";

const auditorClient = hasBedrockRuntime()
  ? new BedrockRuntimeClient({
      region: config.awsRegion
    })
  : null;

function repeatedActionCount(recentActions) {
  const normalized = recentActions
    .filter((entry) => (entry.action ?? entry).type !== "wait")
    .map((action) => JSON.stringify(action.action ?? action))
    .slice(-4);
  if (normalized.length < 3) {
    return 0;
  }

  const [last] = normalized.slice(-1);
  return normalized.filter((entry) => entry === last).length;
}

function serializeAudit(audit) {
  return JSON.stringify(
    {
      status: audit.status,
      action: audit.action,
      reasoning: audit.reasoning,
      confidenceScore: audit.confidenceScore,
      nextInstruction: audit.nextInstruction,
      obstruction: audit.obstruction,
      bug: audit.bug
    },
    null,
    2
  );
}

function enrichAudit(audit) {
  const enriched = {
    action: audit.action ?? audit.nextInstruction ?? "Inspecting current UI state",
    reasoning: audit.reasoning ?? audit.thought ?? "Evaluating the latest browser state.",
    confidenceScore: clamp(Number(audit.confidenceScore ?? 72), 0, 100),
    ...audit
  };

  return {
    ...enriched,
    raw: audit.raw ?? serializeAudit(enriched)
  };
}

function heuristicAudit(context) {
  const thought = [];
  const signupSuccess =
    !/\bno account created\b/i.test(context.snapshot.bodyText) &&
    /(welcome,\s|profile is ready|registration complete|account created\b)/i.test(context.snapshot.bodyText);
  const checkoutSuccess =
    /order placed without a credit card|thanks for your order|purchase complete|invoice approved/i.test(
      context.snapshot.bodyText
    );

  if (context.snapshot.overlays.length) {
    thought.push("Visible modal or overlay detected.");
  }

  if (context.snapshot.spinnerVisible) {
    thought.push("A loader is visible.");
  }

  if (context.snapshot.spinnerVisible && context.unchangedSteps >= config.stagnationLimit) {
    thought.push("The page has stalled with the same visible state.");
    return enrichAudit({
      status: "bug",
      thought: thought.join(" "),
      action: "Declaring performance hang",
      reasoning: "The loader remains visible and the screen hash has not changed for multiple audit cycles.",
      confidenceScore: 96,
      nextInstruction: "Stop the session and report a hang bug.",
      obstruction: {
        present: false,
        summary: ""
      },
      bug: {
        type: "performance-hang",
        severity: "P1",
        summary: "The screen did not change while a loader remained visible.",
        evidencePrompt: "Create a short video showing the loader never resolves."
      }
    });
  }

  if (repeatedActionCount(context.recentActions) >= 3) {
    thought.push("The session is repeating the same action.");
    return enrichAudit({
      status: "bug",
      thought: thought.join(" "),
      action: "Declaring state amnesia",
      reasoning: "The agent is repeating the same non-progressing action pattern without changing the screen.",
      confidenceScore: 94,
      nextInstruction: "Stop retrying the same interaction.",
      obstruction: {
        present: false,
        summary: ""
      },
      bug: {
        type: "state-amnesia",
        severity: "P1",
        summary: "The explorer repeated the same action without progress.",
        evidencePrompt: "Show repeated attempts that do not change the page."
      }
    });
  }

  if (context.snapshot.overlays.length) {
    return enrichAudit({
      status: "recoverable",
      thought: thought.join(" "),
      action: "Dismissing blocking overlay",
      reasoning: "The current UI contains a visible modal that obstructs interactive controls.",
      confidenceScore: 89,
      nextInstruction: "Dismiss the popup before the next action.",
      obstruction: {
        present: true,
        summary: context.snapshot.overlays[0].text
      },
      bug: null
    });
  }

  if (signupSuccess) {
    return enrichAudit({
      status: "success",
      thought: "The registration flow is complete.",
      action: "Declaring success",
      reasoning: "The screen contains a clear account-created success state.",
      confidenceScore: 98,
      nextInstruction: "Goal reached.",
      obstruction: {
        present: false,
        summary: ""
      },
      bug: null
    });
  }

  if (checkoutSuccess) {
    return enrichAudit({
      status: "success",
      thought: "Checkout completed successfully.",
      action: "Declaring success",
      reasoning: "The checkout state shows invoice approval or order completion without a card.",
      confidenceScore: 97,
      nextInstruction: "Goal reached.",
      obstruction: {
        present: false,
        summary: ""
      },
      bug: null
    });
  }

  return enrichAudit({
    status: "proceed",
    thought: thought.join(" ") || "The page looks usable.",
    action: "Proceeding with the next move",
    reasoning:
      context.snapshot.overlays.length > 0
        ? "A visible overlay exists and should be handled first."
        : "No blocking conditions are visible on the current screen.",
    confidenceScore: context.snapshot.spinnerVisible ? 61 : 78,
    nextInstruction: context.snapshot.overlays.length
      ? "Close the popup."
      : "Proceed with the next best interaction.",
    obstruction: {
      present: false,
      summary: ""
    },
    bug: null
  });
}

function normalizeAuditorResponse(raw, fallback) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const normalized = {
    status: typeof parsed.status === "string" ? parsed.status : fallback.status,
    thought:
      typeof parsed.thought === "string"
        ? parsed.thought
        : typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : fallback.thought,
    action:
      typeof parsed.action === "string"
        ? parsed.action
        : typeof parsed.nextInstruction === "string"
          ? parsed.nextInstruction
          : fallback.action,
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : typeof parsed.thought === "string"
          ? parsed.thought
          : fallback.reasoning,
    confidenceScore:
      typeof parsed.confidenceScore === "number"
        ? parsed.confidenceScore
        : typeof parsed.confidence === "number"
          ? parsed.confidence
          : fallback.confidenceScore,
    nextInstruction:
      typeof parsed.nextInstruction === "string" ? parsed.nextInstruction : fallback.nextInstruction,
    obstruction:
      parsed.obstruction && typeof parsed.obstruction === "object"
        ? {
            present: Boolean(parsed.obstruction.present),
            summary: typeof parsed.obstruction.summary === "string" ? parsed.obstruction.summary : ""
          }
        : fallback.obstruction,
    bug:
      parsed.bug && typeof parsed.bug === "object" && typeof parsed.bug.summary === "string"
        ? {
            type: typeof parsed.bug.type === "string" ? parsed.bug.type : "ui-defect",
            severity: typeof parsed.bug.severity === "string" ? parsed.bug.severity : "P2",
            summary: parsed.bug.summary,
            evidencePrompt:
              typeof parsed.bug.evidencePrompt === "string"
                ? parsed.bug.evidencePrompt
                : "Show the visible UI failure."
          }
        : null,
    raw
  };

  return enrichAudit(normalized);
}

export async function auditUserInterface(context) {
  if (!auditorClient) {
    return null;
  }

  const fallback = heuristicAudit(context);
  const command = new ConverseCommand({
    modelId: config.auditorModelId,
    messages: [
      {
        role: "user",
        content: [
          {
            text: [
              "Analyze this UI screenshot.",
              "Identify any Chaos edge cases like overlapping elements, broken loaders, or poor accessibility.",
              "If a bug is found, explain why it is a failure.",
              `Goal: ${context.goal}`,
              `Phase: ${context.phase}`,
              `Current URL: ${context.snapshot.url}`,
              `Current step: ${context.step}`,
              `Last action: ${JSON.stringify(context.lastAction ?? null)}`,
              `Recent actions: ${JSON.stringify(context.recentActions)}`,
              `Unchanged screen count: ${context.unchangedSteps}`,
              `Visible overlays: ${JSON.stringify(context.snapshot.overlays)}`,
              `Interactive elements: ${JSON.stringify(context.snapshot.interactive.slice(0, 20))}`,
              `Spinner visible: ${context.snapshot.spinnerVisible}`,
              `Visible text summary: ${context.snapshot.bodyText}`,
              "Return strict JSON only.",
              'JSON shape: {"status":"proceed|recoverable|bug|success","action":"short next action label","reasoning":"why this matters","confidenceScore":87,"thought":"optional detailed summary","nextInstruction":"short instruction","obstruction":{"present":false,"summary":""},"bug":null}',
              "If there is a bug, set bug to { type, severity, summary, evidencePrompt }."
            ].join("\n")
          },
          {
            image: {
              format: "png",
              source: {
                bytes: Buffer.from(context.snapshot.screenshotBase64, "base64")
              }
            }
          }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 700,
      temperature: 0
    }
  });

  const response = await auditorClient.send(command);
  const rawText =
    response.output?.message?.content?.map((item) => item.text ?? "").filter(Boolean).join("\n").trim() ?? "";

  return normalizeAuditorResponse(rawText, fallback);
}

export function createAuditorProvider() {
  return {
    async audit(context) {
      const fallback = heuristicAudit(context);

      if (config.auditorProvider === "bedrock") {
        const response = await auditUserInterface(context).catch(() => null);
        if (response?.status) {
          if (fallback.status === "bug" || fallback.status === "success") {
            return enrichAudit({
              ...response,
              ...fallback,
              thought: [response.thought, fallback.thought].filter(Boolean).join(" ").trim(),
              reasoning: [response.reasoning, fallback.reasoning].filter(Boolean).join(" ").trim(),
              nextInstruction: fallback.nextInstruction,
              obstruction: fallback.obstruction.present ? fallback.obstruction : response.obstruction,
              bug: fallback.bug ?? response.bug,
              raw: response.raw
            });
          }

          return response;
        }
      }

      return fallback;
    }
  };
}
