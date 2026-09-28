# Development

Install backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r apps/api/requirements.txt
```

Run tests:

```powershell
.\.venv\Scripts\python -m pytest
```

Run API:

```powershell
.\.venv\Scripts\uvicorn app.main:app --app-dir apps/api --reload --port 8000
```

Run the full local end-to-end stack:

```powershell
docker compose up --build -d
```

The local stack runs in Local Test Mode. Use `local/test-chat` to verify the Compass request, billing, ledger, and LiteLLM boundary without real provider credentials.

Run web:

```powershell
Set-Location apps/web
npm install
npm run dev
```
