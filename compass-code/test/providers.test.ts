import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleProvider } from "../src/providers.js";

describe("OpenAI-compatible provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses streamed SSE deltas and sends the configured model", async () => {
    const payload = [
      `data: ${JSON.stringify({ id: "stream-1", model: "demo", choices: [{ index: 0, delta: { role: "assistant", content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ id: "stream-1", model: "demo", choices: [{ index: 0, delta: { content: " world" }, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n"
    ].join("");
    const response = new Response(new TextEncoder().encode(payload), { headers: { "content-type": "text/event-stream" } });
    const request = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", request);

    const provider = new OpenAICompatibleProvider({ baseUrl: "https://provider.example", apiKey: "secret" });
    const chunks = [];
    for await (const chunk of provider.stream("demo", [{ role: "user", content: "Hi" }])) chunks.push(chunk);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices?.[0].delta?.content).toBe("Hello");
    expect(request).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(request.mock.calls[0][1].body as string) as { model: string; messages: unknown[] };
    expect(body.model).toBe("demo");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("maps provider authentication failures to an actionable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid key" } }), { status: 401 })));
    const provider = new OpenAICompatibleProvider({ baseUrl: "https://provider.example", apiKey: "secret" });

    await expect(provider.models()).rejects.toThrow("Provider authentication failed");
  });

  it("normalizes a non-stream completion returned by providers that ignore stream mode", async () => {
    const response = new Response(JSON.stringify({
      id: "completion-1",
      model: "demo",
      choices: [{ index: 0, message: { role: "assistant", content: [{ type: "text", text: "Planned " }, { type: "text", text: "response" }] }, finish_reason: "stop" }]
    }), { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const provider = new OpenAICompatibleProvider({ baseUrl: "http://127.0.0.1:11434" });

    const chunks = [];
    for await (const chunk of provider.stream("demo", [{ role: "user", content: "Hi" }])) chunks.push(chunk);

    expect(chunks[0].choices?.[0].delta?.content).toBe("Planned response");
  });
});
