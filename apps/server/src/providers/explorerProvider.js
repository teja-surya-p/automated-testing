import { config } from "../lib/config.js";
import { createExplorerAgent, runExplorerAgent } from "../agents/createAgents.js";

function matchElement(interactive, patterns, options = {}) {
  const normalizedPatterns = patterns.map((pattern) => pattern.toLowerCase());
  return interactive.find((element) => {
    const haystack = [
      element.text,
      element.placeholder,
      element.name,
      element.type
    ]
      .join(" ")
      .toLowerCase();

    if (options.inputOnly && !["input", "textarea", "select"].includes(element.tag)) {
      return false;
    }

    return normalizedPatterns.some((pattern) => haystack.includes(pattern));
  });
}

function inferGoalFamily(goal) {
  const normalized = goal.toLowerCase();
  if (/(sign up|signup|register|create.*user|new user|account)/.test(normalized)) {
    return "signup";
  }
  if (/(checkout|purchase|buy|credit card|cart)/.test(normalized)) {
    return "checkout";
  }
  return "generic";
}

function heuristicPlanSignup(snapshot) {
  const hasSignupSuccess =
    !/\bno account created\b/i.test(snapshot.bodyText) &&
    /(welcome,\s|profile is ready|registration complete|account created\b)/i.test(snapshot.bodyText);

  if (hasSignupSuccess) {
    return {
      thinking: "The page shows account creation success.",
      action: { type: "done" },
      isDone: true,
      bug: null
    };
  }

  const closeModal = matchElement(snapshot.interactive, ["close", "dismiss", "not now", "skip"]);
  if (snapshot.overlays.length && closeModal) {
    return {
      thinking: "A popup is blocking the flow, closing it first.",
      action: { type: "click", elementId: closeModal.elementId },
      isDone: false,
      bug: null
    };
  }

  const navToSignup = matchElement(snapshot.interactive, ["sign up", "signup", "create account", "register"]);
  if (navToSignup && !/signup|register/.test(snapshot.url)) {
    return {
      thinking: "The registration entrypoint is visible.",
      action: { type: "click", elementId: navToSignup.elementId },
      isDone: false,
      bug: null
    };
  }

  const nameInput = matchElement(snapshot.interactive, ["name", "full name"], { inputOnly: true });
  if (nameInput && !nameInput.value) {
    return {
      thinking: "The name field is empty.",
      action: { type: "type", elementId: nameInput.elementId, text: "Hackathon Tester" },
      isDone: false,
      bug: null
    };
  }

  const emailInput = matchElement(snapshot.interactive, ["email"], { inputOnly: true });
  if (emailInput && !emailInput.value) {
    return {
      thinking: "The email field is empty.",
      action: { type: "type", elementId: emailInput.elementId, text: "qa.agent@example.com" },
      isDone: false,
      bug: null
    };
  }

  const passwordInput = matchElement(snapshot.interactive, ["password"], { inputOnly: true });
  if (passwordInput && !passwordInput.value) {
    return {
      thinking: "The password field is empty.",
      action: { type: "type", elementId: passwordInput.elementId, text: "TestPass123!" },
      isDone: false,
      bug: null
    };
  }

  const submit =
    snapshot.interactive.find(
      (element) =>
        !element.disabled &&
        (element.tag === "button" || element.type === "submit") &&
        /create account|sign up|register|submit/i.test(element.text)
    ) ?? null;
  if (submit) {
    return {
      thinking: "The form looks ready to submit.",
      action: { type: "click", elementId: submit.elementId },
      isDone: false,
      bug: null
    };
  }

  return {
    thinking: "No registration action is obvious yet, pausing briefly.",
    action: { type: "wait", durationMs: 1200 },
    isDone: false,
    bug: null
  };
}

function heuristicPlanCheckout(snapshot) {
  const cartHasItems =
    /checkout \(([1-9]\d*)\)/i.test(snapshot.bodyText) ||
    /[1-9]\d* items in cart/i.test(snapshot.bodyText) ||
    snapshot.interactive.some((element) => /checkout \(([1-9]\d*)\)/i.test(element.text));

  if (/order placed without a credit card|thanks for your order|purchase complete|invoice approved/i.test(snapshot.bodyText)) {
    return {
      thinking: "Checkout success is visible on screen.",
      action: { type: "done" },
      isDone: true,
      bug: null
    };
  }

  const closeModal = matchElement(snapshot.interactive, ["close", "dismiss", "not now", "skip"]);
  if (snapshot.overlays.length && closeModal) {
    return {
      thinking: "A popup is obstructing the checkout controls.",
      action: { type: "click", elementId: closeModal.elementId },
      isDone: false,
      bug: null
    };
  }

  const checkout = matchElement(snapshot.interactive, ["checkout", "cart"]);
  if (checkout && cartHasItems && !/checkout/.test(snapshot.url)) {
    return {
      thinking: "Moving into the checkout flow.",
      action: { type: "click", elementId: checkout.elementId },
      isDone: false,
      bug: null
    };
  }

  const addToCart = matchElement(snapshot.interactive, ["add to cart"]);
  if (addToCart && !cartHasItems) {
    return {
      thinking: "A product can be added to the cart.",
      action: { type: "click", elementId: addToCart.elementId },
      isDone: false,
      bug: null
    };
  }

  const address = matchElement(snapshot.interactive, ["address"], { inputOnly: true });
  if (address && !address.value) {
    return {
      thinking: "Checkout requires an address before payment.",
      action: { type: "type", elementId: address.elementId, text: "221B Baker Street" },
      isDone: false,
      bug: null
    };
  }

  const reviewOrder =
    snapshot.interactive.find(
      (element) => !element.disabled && element.tag === "button" && /review order/i.test(element.text)
    ) ?? null;
  const invoice =
    snapshot.interactive.find(
      (element) =>
        !element.disabled &&
        element.tag === "button" &&
        /invoice|pay later|cash on delivery|without card/i.test(element.text)
    ) ?? null;
  if (invoice && !invoice.pressed) {
    return {
      thinking: "An alternative payment path is visible.",
      action: { type: "click", elementId: invoice.elementId },
      isDone: false,
      bug: null
    };
  }

  const placeOrder =
    snapshot.interactive.find(
      (element) =>
        !element.disabled &&
        element.tag === "button" &&
        /place order|buy now|complete order/i.test(element.text)
    ) ?? null;
  if (placeOrder && !placeOrder.disabled) {
    return {
      thinking: "The order button is enabled.",
      action: { type: "click", elementId: placeOrder.elementId },
      isDone: false,
      bug: null
    };
  }

  if (snapshot.spinnerVisible) {
    return {
      thinking: "The page is still processing the checkout review.",
      action: { type: "wait", durationMs: 1200 },
      isDone: false,
      bug: null
    };
  }

  if (reviewOrder && !snapshot.spinnerVisible) {
    return {
      thinking: "The order needs to be reviewed before final submission.",
      action: { type: "click", elementId: reviewOrder.elementId },
      isDone: false,
      bug: null
    };
  }

  return {
    thinking: "The page may need another render cycle before a checkout action is possible.",
    action: { type: "wait", durationMs: 1200 },
    isDone: false,
    bug: null
  };
}

function heuristicPlanGeneric(snapshot) {
  const closeModal = matchElement(snapshot.interactive, ["close", "dismiss", "not now", "skip"]);
  if (snapshot.overlays.length && closeModal) {
    return {
      thinking: "Closing a blocking popup before continuing.",
      action: { type: "click", elementId: closeModal.elementId },
      isDone: false,
      bug: null
    };
  }

  const primaryButton = snapshot.interactive.find((element) => !element.disabled && ["button", "a"].includes(element.tag));
  if (primaryButton) {
    return {
      thinking: "Trying the first available primary interaction.",
      action: { type: "click", elementId: primaryButton.elementId },
      isDone: false,
      bug: null
    };
  }

  return {
    thinking: "Nothing actionable is available, waiting.",
    action: { type: "wait", durationMs: 1000 },
    isDone: false,
    bug: null
  };
}

export function createExplorerProvider() {
  const agent = config.explorerProvider === "bedrock" ? createExplorerAgent() : null;

  return {
    async plan(context) {
      if (agent) {
        const response = await runExplorerAgent(agent, context);
        if (response?.action?.type) {
          return response;
        }
      }

      const family = inferGoalFamily(context.goal);
      if (family === "signup") {
        return heuristicPlanSignup(context.snapshot);
      }
      if (family === "checkout") {
        return heuristicPlanCheckout(context.snapshot);
      }
      return heuristicPlanGeneric(context.snapshot);
    }
  };
}
