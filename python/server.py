import os
import io
import base64
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import qrcode

BASE_DIR = Path(__file__).resolve().parents[1]
HTML_DIR = BASE_DIR / "html"
ASSETS_DIR = BASE_DIR / "assets"

app = Flask(__name__, static_folder=str(HTML_DIR), static_url_path="")

USERS = [
    {
        "id": 1,
        "firstName": "Super",
        "lastName": "Admin",
        "email": "admin@olutajr.com",
        "password": "admin",
        "role": "Super Admin",
        "status": "Active",
        "permissions": [
            "dashboard",
            "pos",
            "sales",
            "customers",
            "products",
            "stock",
            "finance",
            "reporting",
            "expenses",
            "users",
            "settings"
        ]
    }
]

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/qr-generator")
def qr_generator():
    return app.send_static_file("qr-generator.html")

@app.route("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(str(ASSETS_DIR), filename)

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = next((u for u in USERS if u["email"].lower() == email and u["password"] == password), None)
    if not user:
        return jsonify({"success": False, "message": "Invalid credentials."}), 401
    return jsonify({"success": True, "user": {"id": user["id"], "firstName": user["firstName"], "lastName": user["lastName"], "email": user["email"], "role": user["role"], "permissions": user["permissions"]}})

@app.route("/api/users", methods=["GET"])
def api_users():
    return jsonify({"users": USERS})

@app.route("/api/generate-qr", methods=["POST"])
def generate_qr():
    """Generate QR code from provided data"""
    data = request.get_json() or {}
    qr_data = data.get("data") or "OLUTAJR-ERP"
    
    try:
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        img_base64 = base64.b64encode(img_io.getvalue()).decode()
        
        return jsonify({
            "success": True,
            "qr_code": f"data:image/png;base64,{img_base64}",
            "data": qr_data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/api/generate-qr-batch", methods=["POST"])
def generate_qr_batch():
    """Generate multiple QR codes"""
    data = request.get_json() or {}
    items = data.get("items") or []
    
    try:
        qr_codes = []
        for item in items:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(item.get("data", f"Item-{len(qr_codes)}"))
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            img_io = io.BytesIO()
            img.save(img_io, 'PNG')
            img_io.seek(0)
            img_base64 = base64.b64encode(img_io.getvalue()).decode()
            
            qr_codes.append({
                "id": item.get("id"),
                "qr_code": f"data:image/png;base64,{img_base64}",
                "data": item.get("data")
            })
        
        return jsonify({"success": True, "qr_codes": qr_codes})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
