from fastapi import FastAPI, Header, HTTPException

app = FastAPI(title="Smart Cloud DMS AI", version="0.1.0")


def require_internal_token(x_internal_token: str | None) -> None:
    import os

    expected = os.getenv("AI_INTERNAL_TOKEN", "")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="Invalid internal token")


@app.get("/health")
def health():
    return {"ok": True, "service": "fastapi"}


@app.post("/jobs/process")
def process_job(payload: dict, x_internal_token: str | None = Header(default=None)):
    require_internal_token(x_internal_token)
    return {"status": "queued", "detail": "Not implemented yet", "received": payload}


@app.post("/rag/chat")
def rag_chat(payload: dict, x_internal_token: str | None = Header(default=None)):
    require_internal_token(x_internal_token)
    return {"status": "not_implemented", "answer": None}
