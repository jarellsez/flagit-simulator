"""
FlagIT FastAPI Server — Phase 9 Master Edition
==============================================
Merged logic: High-Alert Overrides + Zero-Trust Decryption + User Reporting.
"""

import re
import sys
import os
import base64
import json
from contextlib import asynccontextmanager
from typing import Literal, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from motor.motor_asyncio import AsyncIOMotorClient

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = os.path.join(os.path.expanduser("~"), "flagit-simulator")
if ROOT not in sys.path:
    sys.path.append(ROOT)

from .training.ensemble_fusion import FlagItEnsemble

# ─────────────────────────────────────────────────────────────────────────────
#  MODEL LIFESPAN
# ─────────────────────────────────────────────────────────────────────────────
ml_engine: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("  🛡️  FlagIT API — Loading Phase 8 Ensemble...")
    ml_engine["ensemble"] = FlagItEnsemble()
    print("✅ All models loaded and ready.\n")
    yield
    ml_engine.clear()
    print("🔴 Server shut down.")

# ─────────────────────────────────────────────────────────────────────────────
#  APP INIT
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="FlagIT AI Threat Detection API", version="9.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
#  DATABASE SETUP (MONGODB CLOUD)
# ─────────────────────────────────────────────────────────────────────────────
MONGO_URI = "mongodb+srv://flagitAdmin:admin123@flagit-cluster.0va0rbm.mongodb.net/?appName=flagit-cluster"

try:
    db_client = AsyncIOMotorClient(MONGO_URI)
    db = db_client["flagit_db"]
    intel_collection = db["emailLogs"]
    reports_collection = db["userReports"] # Collection for missed/false detections
    print("✅ Successfully connected to MongoDB Cloud.")
except Exception as e:
    print(f"⚠️ Warning: Failed to connect to MongoDB: {e}")

# ─────────────────────────────────────────────────────────────────────────────
#  CRYPTOGRAPHY SETUP
# ─────────────────────────────────────────────────────────────────────────────
try:
    with open("server_private.pem", "rb") as key_file:
        SERVER_PRIVATE_KEY = serialization.load_pem_private_key(
            key_file.read(),
            password=None,
        )
    print("✅ Server Private Key loaded for Zero-Trust Decryption.")
except FileNotFoundError:
    print("⚠️ Warning: server_private.pem not found. Decryption endpoint will fail.")
    SERVER_PRIVATE_KEY = None

# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_ensemble() -> FlagItEnsemble:
    ensemble = ml_engine.get("ensemble")
    if not ensemble:
        raise HTTPException(status_code=503, detail="Models initialising.")
    return ensemble

def apply_hard_overrides(result, raw_text):
    reasons_list = result.get("reasons", [])
    body_lower = raw_text.lower()
    
    # 1. Lookalike Domain Override
    target_phrase = "Suspicious hyphenated or lookalike domain"
    if any(target_phrase in str(r) for r in reasons_list):
        result["score"] = max(result["score"], 0.85)
        result["is_phishing"] = True
        result["confidence"] = "High (Hard Override)"

    # 2. MFA Social Engineering Alert
    mfa_triggers = [
        ('verification code', 'reply'),
        ('6-digit', 'text me'),
        ('mfa', 'send')
    ]
    
    for term1, term2 in mfa_triggers:
        if term1 in body_lower and term2 in body_lower:
            result["score"] = 0.95
            result["is_phishing"] = True
            result["confidence"] = "Critical"
            if "reasons" not in result: result["reasons"] = []
            result["reasons"].append("Critical Alert: Unauthorized request for MFA tokens detected.")
            break
            
    return result

# ─────────────────────────────────────────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "online", "models_loaded": "ensemble" in ml_engine}

@app.post("/predict/email")
async def predict_email(request: Request):
    ensemble = _get_ensemble()
    try:
        data = await request.json()
        content = data.get("raw_content") or data.get("text") or ""
        result = ensemble.predict_flagit(
            url=data.get("url", "TEXT_ONLY"), 
            body=content, 
            sender=data.get("sender", ""),
            platform="email",
            subject=data.get("subject", "[Email Scan]")
        )
        result = apply_hard_overrides(result, content)
        result["platform"] = "email"
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.post("/predict/chat")
async def predict_chat(request: Request):
    ensemble = _get_ensemble()
    try:
        data = await request.json()
        platform = data.get("platform", "telegram")
        text = data.get("text", "")
        result = ensemble.predict_flagit(
            url=data.get("url", "TEXT_ONLY"),
            body=text,
            sender=data.get("sender", ""),
            platform=platform,
            subject=f"[{platform.upper()} MESSAGE]"
        )
        result = apply_hard_overrides(result, text)
        result["platform"] = platform
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.post("/ingest/simulator")
async def ingest_simulator_data(request: Request):
    if not SERVER_PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="Server cryptography not initialized.")
        
    try:
        payload = await request.json()
        encrypted_data = base64.b64decode(payload['encryptedData'])
        iv = base64.b64decode(payload['initializationVector'])
        wrapped_key = base64.b64decode(payload['wrappedSessionKey'])
        
        # Unwrap AES Key
        aes_key = SERVER_PRIVATE_KEY.decrypt(
            wrapped_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Decrypt Payload
        aesgcm = AESGCM(aes_key)
        decrypted_bytes = aesgcm.decrypt(iv, encrypted_data, None)
        sanitized_text = decrypted_bytes.decode('utf-8')
        
        try:
            document = json.loads(sanitized_text)
        except json.JSONDecodeError:
            document = {"sanitized_content": sanitized_text}
            
        document["ingested_at"] = datetime.now(timezone.utc).isoformat()
        await intel_collection.insert_one(document)
        
        print("🔓 Payload decrypted and saved to MongoDB.")
        return {"status": "success"}
    except Exception as exc:
        print(f"❌ Ingest Failed: {str(exc)}")
        raise HTTPException(status_code=400, detail="Decryption failed.")

@app.post("/report/phishing")
async def report_phishing(request: Request):
    try:
        data = await request.json()
        report_document = {
            "platform": data.get("platform"),
            "report_type": data.get("report_type"), 
            "content": data.get("text"),
            "sender": data.get("sender", "Unknown"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "pending_review"
        }
        
        result = await reports_collection.insert_one(report_document)
        print(f"📥 [REPORT] {data.get('report_type')} recorded.")
        
        return {"status": "success", "id": str(result.inserted_id)}
    except Exception as exc:
        print(f"❌ Reporting Failed: {str(exc)}")
        raise HTTPException(status_code=400, detail="Failed to save report.")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)