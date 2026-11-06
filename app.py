import os
from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder="site", static_url_path="")

VERSION = os.environ.get("APP_VERSION", "dev")


@app.route("/")
def index():
    return send_from_directory("site", "index.html")


@app.route("/health")
def health():
    return jsonify(status="ok"), 500


@app.route("/version")
def version():
    return jsonify(version=VERSION), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
