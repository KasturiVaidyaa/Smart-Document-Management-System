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


from fastapi.responses import StreamingResponse
import json

@app.post("/rag/chat/stream")
async def rag_chat_stream(payload: dict, x_internal_token: str | None = Header(default=None)):
    require_internal_token(x_internal_token)
    async def _stream():
        yield json.dumps({"type": "text", "content": "You are currently running the dummy AI server (ai/main.py). Please run the real AI server in ragDMS-main/ instead!"}) + "\n"
        yield json.dumps({"type": "complete", "session": {"_id": payload.get("sessionId")}}) + "\n"
    return StreamingResponse(_stream(), media_type="application/x-ndjson")
