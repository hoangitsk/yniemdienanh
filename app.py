import os
import json
import logging
import time as time_module
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from payos import PayOS
from payos.types import CreatePaymentLinkRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

PAYOS_CLIENT_ID = os.getenv("PAYOS_CLIENT_ID", "")
PAYOS_API_KEY = os.getenv("PAYOS_API_KEY", "")
PAYOS_CHECKSUM_KEY = os.getenv("PAYOS_CHECKSUM_KEY", "")

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
        order_code = int(body.get("orderCode", int(time_module.time() * 1000) % 10**12))

        payment_request = CreatePaymentLinkRequest(
            order_code=order_code,
            amount=amount,
            description=description,
            cancel_url=f"{BASE_URL}/payment-cancel?orderCode={order_code}",
            return_url=f"{BASE_URL}/payment-success?orderCode={order_code}",
        )

        payment_link = payos.payment_requests.create(payment_request)
        return {
            "checkoutUrl": payment_link.checkout_url,
            "qrCode": payment_link.qr_code,
            "orderCode": payment_link.order_code,
        }
    except Exception as e:
        logger.error("PayOS create payment error: %s", e)
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/api/payos-webhook")
async def payos_webhook(req: Request):
    try:
        body = await req.body()
        webhook_data = payos.webhooks.verify(body)
        order_code = webhook_data.order_code
        logger.info("PayOS webhook received: orderCode=%s, amount=%s", order_code, webhook_data.amount)
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
