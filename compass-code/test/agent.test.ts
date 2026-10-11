import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    isTrusted: true,
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
  },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
}));

import { CompassAgent } from "../src/agent.js";

function host() {
  const transcript: any[] = [];
  return {
    transcript,
    append: (item: any) => transcript.push(item),
    has: (id: string) => transcript.some((item) => item.id === id),
    update: (id: string, patch: any) => {
      const item = transcript.find((value) => value.id === id);
      if (item) Object.assign(item, patch);
    },
    setBusy: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue("once"),
    refreshAccount: vi.fn().mockResolvedValue(undefined),
    setGoalStatus: vi.fn(),
    setPlanStep: vi.fn(),
    addGoalActivity: vi.fn().mockReturnValue("activity-1"),
    updateGoalActivity: vi.fn(),
    recordGoalFileChange: vi.fn(),
  };
}

const context = { build: vi.fn(async (prompt: string) => prompt) } as any;
const permissions = { isAllowed: () => true, isDenied: () => false, remember: vi.fn() } as any;

describe("CompassAgent request lifecycle", () => {
  it("uses no tools, one assistant item, and cumulative usage once for a greeting", async () => {
    const calls: any[] = [];
    const client = {
      stream: async function* (_model: string, _messages: unknown[], options: unknown) {
        calls.push(options);
        yield { id: "greeting", model: "demo", choices: [{ index: 0, delta: { content: "Hello" } }] };
        yield { id: "greeting", model: "demo", choices: [{ index: 0, delta: { content: "Hello" } }] };
        yield { id: "greeting", model: "demo", choices: [{ index: 0, delta: { content: " there" } }], usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 } };
      },
    } as any;
    const view = host();
    const agent = new CompassAgent(client, {} as any, view as any, context, permissions);

    await agent.send("Hi", "demo", "ask", false);

    expect(calls).toHaveLength(1);
    expect((calls[0] as any).tools).toEqual([]);
    expect(view.transcript.filter((item) => item.role === "user")).toHaveLength(1);
    expect(view.transcript.filter((item) => item.role === "assistant")).toHaveLength(1);
    expect(view.transcript.find((item) => item.role === "assistant")).toMatchObject({
      content: "Hello there",
      streaming: false,
      meta: { tokens: 12, promptTokens: 8, completionTokens: 4 },
    });
  });

  it("reuses one assistant item across a read-tool round", async () => {
    const calls: any[] = [];
    const client = {
      stream: async function* (_model: string, _messages: unknown[], options: unknown) {
        calls.push(options);
        if (calls.length === 1) {
          yield { id: "tool-round", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "read_file", arguments: '{"path":"README.md"}' } }] } }] };
          return;
        }
        yield { id: "answer-round", choices: [{ index: 0, delta: { content: "The README explains the project." } }], usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } };
      },
    } as any;
    const view = host();
    const tools = { execute: vi.fn().mockResolvedValue("Compass Router project"), discardPreview: vi.fn().mockResolvedValue(undefined) } as any;
    const agent = new CompassAgent(client, tools, view as any, context, permissions);

    await agent.send("Explain this repository", "demo", "ask", false);

    expect(calls).toHaveLength(2);
    expect((calls[0] as any).tools.length).toBeGreaterThan(0);
    expect(view.transcript.filter((item) => item.role === "assistant")).toHaveLength(1);
    expect(view.transcript.find((item) => item.role === "assistant")).toMatchObject({ content: "The README explains the project.", streaming: false });
  });
});
