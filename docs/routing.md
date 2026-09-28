# Routing

Current routing supports direct model IDs such as `openai/gpt-4o-mini`.

Next routing phases:

- Provider-native model IDs are exposed publicly; Compass-owned aliases are not used.
- Candidate model priority.
- Fallback attempts for timeout, 429, 500, 502, 503, and 504.
- Provider health-aware avoidance.
