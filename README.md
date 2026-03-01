# Self-Healing Multi-Agent QA Orchestrator

Node/JavaScript implementation of an intent-based QA system with:

- a Node backend that runs the test state machine and Playwright browser loop
- a React dashboard that streams screenshots and agent reasoning in real time
- a React target app with sign-up, checkout, popup, and loader chaos cases

## What is implemented

- `Explorer` agent with two modes:
  - `heuristic` mode that works immediately and proves the orchestration loop
  - `bedrock` mode that uses the Strands TypeScript SDK plus Amazon Bedrock multimodal prompts
- `Auditor` agent with popup detection, repeated-action detection, and infinite-loader hang detection
- `Documentarian` that turns the last screenshot buffer into a local MP4 and exposes it at `/artifacts/...`
- live event streaming over Server-Sent Events for the dashboard
- session history tracking so the last three actions can be fed back into planning

## Workspace layout

- `apps/server`: Express API, Playwright runner, agent orchestration, evidence generation
- `apps/dashboard`: real-time React operations console
- `apps/target`: sample React storefront and sign-up app for demo/testing

## Run it

1. Install dependencies:

```bash
npm install
```

2. Install the Playwright browser once:

```bash
npx playwright install chromium
```

3. Copy `.env.example` to `.env` if you want custom settings.

Important env keys for your hackathon account:

```bash
AWS_PROFILE=778015578217_slalom_lsbUsersPS
AWS_REGION=eu-central-1
NOVA_PRO_ID=eu.amazon.nova-pro-v1:0
NOVA_LITE_ID=eu.amazon.nova-lite-v1:0
S3_OUTPUT_BUCKET=s3://nova-sentinel-logs-778015578217/outputs/
```

4. Start everything:

```bash
npm run dev
```

Services:

- dashboard: [http://localhost:4173](http://localhost:4173)
- API/events: [http://localhost:8787](http://localhost:8787)
- target app: [http://localhost:4174](http://localhost:4174)

## Demo goals

Use these in the dashboard:

- `Create a new user`
- `Find a way to check out without a credit card`
- `Detect whether the checkout flow is blocked by a popup`

Useful start URLs:

- `http://localhost:4174/signup`
- `http://localhost:4174/store`
- `http://localhost:4174/checkout?newsletterPopup=false&stuckLoader=true&slowReview=false`

The last URL forces the infinite-loader path so the Auditor should raise a `performance-hang` bug and the Documentarian should emit `/artifacts/<sessionId>/evidence.mp4`.

## AWS-backed mode

The default build works without cloud credentials. To turn on Bedrock-backed planning/reasoning:

1. Configure AWS credentials locally.
2. Enable access in Amazon Bedrock for the models you want to use.
3. Set:

```bash
BEDROCK_ENABLED=true
EXPLORER_PROVIDER=bedrock
AUDITOR_PROVIDER=bedrock
AWS_REGION=us-east-1
NOVA_PRO_ID=eu.amazon.nova-pro-v1:0
NOVA_LITE_ID=eu.amazon.nova-lite-v1:0
```

If you want async Reel output, also set:

```bash
EVIDENCE_PROVIDER=nova-reel
NOVA_REEL_MODEL_ID=amazon.nova-reel-v1:1
S3_OUTPUT_BUCKET=s3://your-bucket/qa-artifacts
```

## Important implementation note

Your original brief assumes `Nova Act` actions come from Bedrock Converse. Current AWS APIs separate those concerns:

- Bedrock Converse is the clean Node path for multimodal planning/reasoning today
- Nova Reel is async video generation, not literal stitching of ten screenshots
- this project therefore uses local MP4 stitching for evidence now, with optional Bedrock/Nova hooks where they fit

That keeps the Node app fully runnable now while preserving the agent boundaries you asked for.

For your current hackathon account in `eu-central-1`, Bedrock reports Nova as inference-profile-only. The working profile ID for Nova Pro is `eu.amazon.nova-pro-v1:0`.

## What credentials I still need from you for cloud mode

If you want the non-mock AWS path enabled, I need:

- AWS credentials with Bedrock access in your chosen region
- model access enabled for the Nova models you want to use
- an S3 bucket URI for evidence output if you want `nova-reel`
- if you specifically want real Nova Act instead of the current Bedrock/Playwright adapter, the exact Nova Act endpoint/auth details you have access to
