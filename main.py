import sys
import os
from pathlib import Path

# Add backend directory to sys.path so 'app' module imports cleanly from repo root
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = str(ROOT_DIR / "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Set PYTHONPATH environment variable as well
os.environ["PYTHONPATH"] = BACKEND_DIR + (os.pathsep + os.environ.get("PYTHONPATH", "") if os.environ.get("PYTHONPATH") else "")

# Import the FastAPI application from backend/app/main.py
from app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port)
