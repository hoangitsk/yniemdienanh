import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from payos import PayOS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

PAYOS_CLIENT_ID = os.getenv("PAYOS_CLIENT_ID", "a214cd31-2135-4ca7-9a75-2ce78c120162")
PAYOS_API_KEY = os.getenv("PAYOS_API_KEY", "cf09b581-376e-4402-9c50-cba641eb5f19")
PAYOS_CHECKSUM_KEY = os.getenv("PAYOS_CHECKSUM_KEY", "cc3948ed2f90e993e7a45fb51281ed8037be48317eac30794ead6d8b0f7c492c")

payos = PayOS(client_id=PAYOS_CLIENT_ID, api_key=PAYOS_API_KEY, checksum_key=PAYOS_CHECKSUM_KEY)

BASE_URL = os.getenv("BASE_URL", "http://localhost:7860")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/Logo", StaticFiles(directory=BASE_DIR / "Logo"), name="logo")
app.mount("/Kế hoạch", StaticFiles(directory=BASE_DIR / "Kế hoạch"), name="plans")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/create-payment")
async def create_payment(req: Request):
    try:
        body = await req.json()
        amount = int(body.get("amount", 5000))
        description = str(body.get("description", "Thanh toan"))[:25]
        order_code = int(body.get("orderCode", abs(hash(str(body))) % 10**12))

        payment_data = {
            "orderCode": order_code,
            "amount": amount,
            "description": description,
            "returnUrl": f"{BASE_URL}/payment-success?orderCode={order_code}",
            "cancelUrl": f"{BASE_URL}/payment-cancel?orderCode={order_code}",
        }

        payment_link = payos.create_payment_link(payment_data)
        return {
            "checkoutUrl": payment_link.get("checkoutUrl"),
            "qrCode": payment_link.get("qrCode"),
            "orderCode": order_code,
        }
    except Exception as e:
        logger.error("PayOS create payment error: %s", e)
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/api/payos-webhook")
async def payos_webhook(req: Request):
    try:
        body = await req.json()
        order_code = body.get("data", {}).get("orderCode")
        status = body.get("data", {}).get("status")
        logger.info("PayOS webhook received: orderCode=%s, status=%s", order_code, status)
        return {"success": True}
    except Exception as e:
        logger.error("PayOS webhook error: %s", e)
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.get("/payment-success")
def payment_success(orderCode: str = ""):
    return FileResponse(BASE_DIR / "index.html")


@app.get("/payment-cancel")
def payment_cancel(orderCode: str = ""):
    return FileResponse(BASE_DIR / "index.html")


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{path:path}")
def spa_fallback(path: str):
    return FileResponse(BASE_DIR / "index.html")
