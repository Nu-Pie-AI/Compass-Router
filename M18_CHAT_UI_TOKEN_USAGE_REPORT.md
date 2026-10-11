# M18 Chat UI and Token Usage Report

Date: 2026-10-11
Scope: `compass-code` only; the original repository and Compass Router web/API were not modified.

## Root causes found

- `CompassAgent.send()` created a new visible assistant placeholder on every model/tool iteration. A tool round therefore produced repeated assistant sections instead of one logical response.
- Streaming usage was added for every SSE chunk. Providers commonly report cumulative usage in the final chunk, so the same request could be billed and displayed multiple times.
- Ask mode always exposed read tools and always created a planning goal. A greeting could therefore trigger workspace inspection and show agent progress that did not belong in a conversational answer.
- The chat header rendered copy/export buttons both in the toolbar and in the options menu.

## Implemented

- One stable assistant transcript item is reused for all rounds of one request.
- Duplicate stream events are ignored using a stable event fingerprint.
- Prompt, completion, total token, cost, and latency metadata are accumulated per model round; cumulative provider usage is counted once per round.
- Ask mode now sends no tools for greetings and general conversational prompts. Read tools remain available for explicit repository, file, bug, code, or context requests.
- Ask mode no longer creates or renders task plans/progress. Plan and execution modes retain the existing approval-gated goal workflow.
- Duplicate visible header actions were removed; copy/export remain available from the conversation menu.
- Added lifecycle regression tests for one user/assistant response, no greeting tools, duplicate stream chunks, cumulative usage, and tool-assisted single-assistant rendering.

## Verification

- `npm.cmd run check`: passed.
- `npm.cmd test`: passed, 12 tests.
- `npm.cmd run test:ui`: passed, 11 Playwright tests.
- `npm.cmd run package`: passed and regenerated `compass-code/compass-router-0.1.0.vsix`.
- `git diff --check`: passed.
- VSIX secret-pattern scan: no embedded provider/database/Clerk secret patterns found.

The automated tests do not replace a live provider or VS Code Extension Development Host smoke test. No live inference, Credits settlement, or Marketplace publication was performed.

## Before/after benchmark evidence

The reported baseline was the owner-provided M18 observation: a simple greeting produced repeated activity/response sections and approximately 7,854 tokens. That value was not independently replayed against the live provider in this environment.

The deterministic regression fixture now proves: greeting tool calls `0`, model requests `1`, visible assistant items `1`, and billed total tokens `12` for a stream whose final cumulative usage is `12`, despite a duplicated chunk. The tool-round fixture proves two model rounds still render one visible assistant item.

## Remaining verification

- Launch the VS Code Extension Development Host with the packaged source and send `Hi` through the real Compass API. Confirm one request in server usage records, one assistant response in the transcript, and provider-reported usage matching the displayed metadata.
- Repeat with a code question, cancellation, retry, reload, and an agent-mode edit task. These require a connected VS Code host and valid external credentials.
