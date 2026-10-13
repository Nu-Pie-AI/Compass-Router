# Jev API Contract

`POST /member/v1/decisions`

Headers:

- `Authorization: Bearer <Clerk session token>`
- `X-Compass-Key-Id: <assigned Compass key id>`
- `X-Compass-Project-Id: <authorized project id>`

Request:

```json
{
  "model": "typesafe_ai/jev-latest",
  "project_id": "optional-project-id",
  "state": {"text": "..."},
  "questions": {
    "relevance": {
      "type": "choice",
      "instructions": "Is this relevant?",
      "criteria": {"yes": "Relevant", "no": "Not relevant"}
    }
  }
}
```

Question types are `choice`, `score`, and `noul`. The response preserves TypeSafe's typed `answers`, `model`, and `usage` fields and adds a `compass` request and billing envelope. No natural-language answer is synthesized. BYOK requests have zero Compass Credits charge; managed requests require verified pricing and provider usage before settlement.
