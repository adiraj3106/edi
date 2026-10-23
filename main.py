# ═══════════════════════════════════════════════════════════════════════════════
# AgriGuard Root Proxy Entrypoint
# Allows running: uvicorn main:app --reload --port 8000 directly from root.
# ═══════════════════════════════════════════════════════════════════════════════

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
