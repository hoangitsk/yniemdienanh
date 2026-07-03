from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

app.mount("/Logo", StaticFiles(directory=BASE_DIR / "Logo"), name="logo")
app.mount("/Kế hoạch", StaticFiles(directory=BASE_DIR / "Kế hoạch"), name="plans")


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{path:path}")
def spa_fallback(path: str):
    return FileResponse(BASE_DIR / "index.html")
