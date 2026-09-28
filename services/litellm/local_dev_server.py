import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


# Legacy deterministic test server. The preferred local integration is now the
# controlled Compass LiteLLM proxy image, documented in docs/litellm.md.
class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        if self.path in {"/health", "/health/liveliness", "/health/readiness"}:
            self._json(200, {"status": "ok", "service": "local-litellm-dev"})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/v1/chat/completions":
            self._json(404, {"error": "not_found"})
            return
        expected = os.environ.get("LITELLM_MASTER_KEY", "")
        auth = self.headers.get("authorization", "")
        if expected and auth != f"Bearer {expected}":
            self._json(401, {"error": {"message": "Unauthorized", "type": "auth_error"}})
            return
        length = int(self.headers.get("content-length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        messages = payload.get("messages", [])
        joined_content = "\n".join(str(message.get("content", "")) for message in messages)
        if "__FAIL_500__" in joined_content:
            self._json(500, {"error": {"message": "Local deterministic provider failure", "type": "provider_error"}})
            return
        if "__TIMEOUT__" in joined_content:
            time.sleep(15)
            self._json(504, {"error": {"message": "Local deterministic timeout", "type": "provider_timeout"}})
            return
        if "__MALFORMED__" in joined_content:
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(b"{bad json")
            return
        prompt_tokens = sum(len(str(message.get("content", "")).split()) for message in messages)
        completion_tokens = min(int(payload.get("max_tokens") or 32), 32)
        self._json(
            200,
            {
                "id": "chatcmpl_local_litellm_dev",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": payload.get("model", "unknown"),
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "Local LiteLLM development response."},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                },
            },
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
