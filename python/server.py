import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
