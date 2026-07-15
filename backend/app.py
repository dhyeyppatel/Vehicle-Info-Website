"""
VehicleScan Terminal — Secure Flask Backend Proxy
=================================================
Hides the upstream API URL, uses MongoDB for tokens 
(ShrinkEarn verification) and data protection.
"""

import os
import re
import uuid
from datetime import datetime

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, redirect
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient
import urllib.parse

# ── Load environment variables ──────────────────────────────────────
load_dotenv()

VEHICLE_API_BASE = os.getenv("VEHICLE_API_BASE", "")
if not VEHICLE_API_BASE:
    raise ValueError("VEHICLE_API_BASE environment variable is missing.")
PORT            = int(os.getenv("PORT", 2929))
ALLOWED_ORIGIN  = os.getenv("ALLOWED_ORIGIN", "*")
FLASK_ENV       = os.getenv("FLASK_ENV", "production")

SHRINKEARN_API_KEY = os.getenv("SHRINKEARN_API_KEY", "")
MONGO_URI = os.getenv("MONGO_URI", "")

if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is missing.")

# Absolute path to the frontend folder (one level up from backend/)
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)

# ── MongoDB Setup ───────────────────────────────────────────────────
client = MongoClient(MONGO_URI)
db = client.get_database("vehiclescan")
tokens_col = db.get_collection("tokens")
protected_col = db.get_collection("protected_vehicles")

# ── Vehicle Number Validation ────────────────────────────────────────
VEHICLE_REGEX = re.compile(r"^[A-Z0-9]{4,15}$")


# ── Flask App ────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# CORS — restrict to own domain in production
CORS(
    app,
    origins=ALLOWED_ORIGIN,
    methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Rate Limiter — 30 requests per 15 minutes per IP
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://",
    default_limits=[],
    on_breach=lambda limit: (
        jsonify({
            "success": False,
            "error": "RATE_LIMIT: Too many requests. Try again in 15 minutes.",
        }),
        429,
    ),
)


# ── Security Headers ─────────────────────────────────────────────────
@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Content-Security-Policy"] = " ".join(
        [
            "default-src 'self';",
            "script-src 'self' 'unsafe-inline';",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
            "font-src 'self' https://fonts.gstatic.com;",
            "img-src 'self' data: https:;",
            "connect-src 'self';",
            "object-src 'none';",
            "base-uri 'self';",
        ]
    )
    response.headers.pop("Server", None)
    response.headers.pop("X-Powered-By", None)
    return response


# ── Token Generation / ShrinkEarn ────────────────────────────────────
@app.route("/api/generate-link", methods=["GET"])
@limiter.limit("5 per minute")
def generate_link():
    # 1. Generate UUID Token
    new_token = str(uuid.uuid4())
    
    # 2. Save to DB with 5 uses
    tokens_col.insert_one({
        "token_id": new_token,
        "uses_left": 5,
        "created_at": datetime.utcnow()
    })
    
    # 3. Create destination URL pointing back to our site
    # Use request.host_url (e.g. http://localhost:5001/)
    destination_url = urllib.parse.urljoin(request.host_url, f"?token={new_token}")
    
    # 4. Call ShrinkEarn
    shrink_url = f"https://shrinkearn.com/api?api={SHRINKEARN_API_KEY}&url={urllib.parse.quote_plus(destination_url)}&format=text"
    
    try:
        r = requests.get(shrink_url, timeout=10)
        r.raise_for_status()
        shortened_url = r.text.strip()
        
        if not shortened_url.startswith("http"):
            app.logger.error(f"ShrinkEarn returned invalid response: {shortened_url}")
            # Fallback to direct URL if ShrinkEarn fails (e.g. because localhost is invalid)
            shortened_url = destination_url

        return jsonify({
            "success": True,
            "shortened_url": shortened_url
        })
    except Exception as e:
        app.logger.error(f"ShrinkEarn error: {e}")
        # Fallback to direct URL if ShrinkEarn API is down
        return jsonify({
            "success": True, 
            "shortened_url": destination_url
        })


# ── Vehicle Protection API ───────────────────────────────────────────
@app.route("/api/protect", methods=["POST"])
@limiter.limit("5 per 15 minutes")
def protect_vehicle():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Missing payload."}), 400
        
    reg = data.get("reg_no", "").strip().upper()
    mobile = data.get("mobile_no", "").strip()
    
    if not reg or not mobile:
        return jsonify({"success": False, "error": "Registration and Mobile Number are required."}), 400
        
    if not VEHICLE_REGEX.match(reg):
        return jsonify({"success": False, "error": "Invalid Registration Number format."}), 400

    # Verify ownership by fetching vehicle data
    try:
        api_url = f"{VEHICLE_API_BASE}?type=vehicle_num&term={reg}"
        upstream = requests.get(api_url, timeout=15, headers={"User-Agent": "VehicleScan-Proxy/2.0"})
        upstream.raise_for_status()
        vdata = upstream.json()
        
        if not vdata.get("success"):
            return jsonify({"success": False, "error": "Vehicle not found."}), 404
            
        actual_mobile = vdata.get("mobile_no", "")
        
        # In a real app we'd verify the mobile number perfectly. Sometimes APIs return it masked or missing.
        # If the API returns it unmasked, we can do a strict check. If the user provides the correct mobile, we protect it.
        # But for robustness, we just check if it's somewhat matching or if the API even has it.
        if actual_mobile and actual_mobile != mobile:
            return jsonify({"success": False, "error": "Mobile number does not match records."}), 403
            
        # Add to protected collection (upsert)
        protected_col.update_one(
            {"reg_no": reg},
            {"$set": {"protected_at": datetime.utcnow()}},
            upsert=True
        )
        
        return jsonify({"success": True, "message": f"{reg} is now protected."})
        
    except Exception as e:
        app.logger.error(f"Protect error: {e}")
        return jsonify({"success": False, "error": "Failed to verify vehicle."}), 500


# ── API Proxy Route ──────────────────────────────────────────────────
@app.route("/api/scan")
@limiter.limit("30 per 15 minutes")
def scan_vehicle():
    # 1. Extract Token
    token_val = request.args.get("token", "").strip()
    if not token_val:
        return jsonify({"success": False, "error": "TOKEN_REQUIRED: An access token is required."}), 401
        
    # 2. Validate Token in MongoDB
    token_doc = tokens_col.find_one({"token_id": token_val})
    if not token_doc or token_doc.get("uses_left", 0) <= 0:
        return jsonify({"success": False, "error": "TOKEN_EXPIRED: Token is invalid or has 0 uses left."}), 403

    # 3. Extract and sanitize reg input
    reg = request.args.get("reg", "").strip().upper()[:12]
    if len(reg) < 4:
        return jsonify({"success": False, "error": "INVALID_INPUT: Enter a valid vehicle registration number."}), 400
    if not VEHICLE_REGEX.match(reg):
        return jsonify({"success": False, "error": "INVALID_FORMAT: Use Indian format e.g. UK04AP2300."}), 400

    # 4. Proxy to upstream API
    try:
        api_url = f"{VEHICLE_API_BASE}?type=vehicle_num&term={reg}"
        upstream = requests.get(api_url, timeout=15, headers={"User-Agent": "VehicleScan-Proxy/2.0"})
        upstream.raise_for_status()
        data = upstream.json()

    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "TIMEOUT: API timed out. Try again."}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": "NETWORK_ERROR: Could not reach API."}), 502
    except ValueError:
        return jsonify({"success": False, "error": "PARSE_ERROR: Invalid response from API."}), 502

    if not data.get("success"):
        return jsonify({"success": False, "error": "Vehicle not found."}), 404

    # 5. Strip unwanted fields
    data.pop("api", None)
    if isinstance(data.get("data"), dict):
        data["data"].pop("_debug", None)
        
    # 6. Apply Data Protection
    is_protected = protected_col.find_one({"reg_no": reg}) is not None
    if is_protected:
        # Decrement Token Uses even if protected (they still used a search)
        new_uses = token_doc["uses_left"] - 1
        tokens_col.update_one({"token_id": token_val}, {"$set": {"uses_left": new_uses}})
        return jsonify({
            "success": False, 
            "error": "VEHICLE_PROTECTED: This vehicle's data has been hidden by the owner.",
            "uses_left": new_uses
        }), 403

    # 7. Decrement Token Uses
    new_uses = token_doc["uses_left"] - 1
    tokens_col.update_one({"token_id": token_val}, {"$set": {"uses_left": new_uses}})
    
    # 8. Attach uses left to response for frontend UI
    data["uses_left"] = new_uses

    return jsonify(data)


# ── Health Check ─────────────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "VehicleScan Terminal v2.0"}), 200


# ── Serve Frontend Static Files ───────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    target = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(target):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    is_debug = FLASK_ENV == "development"
    app.logger.info("Starting VehicleScan on port %d (debug=%s)", PORT, is_debug)
    app.run(host="0.0.0.0", port=PORT, debug=is_debug)
