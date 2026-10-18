import sys
import os

# Add the backend directory to Python sys.path so app imports resolve properly
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

# Vercel Serverless Function entry point
# Exports the FastAPI ASGI application
