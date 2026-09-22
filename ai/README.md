The FastAPI AI service lives in `ragDMS-main/`.

From that folder:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

Express calls it at `AI_SERVICE_URL` with `X-Internal-Token`.
