#!/usr/bin/env python3
import argparse
import copy
import json
import os
import secrets
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
DATA_ROOT = Path(os.environ.get("PROME_LAW_DATA_DIR", ROOT)).expanduser().resolve()
DATA_ROOT.mkdir(parents=True, exist_ok=True)
INDEX_FILE = ROOT / "index.html"
ORIGINAL_FILE_NAME = "동아리 회칙 원본.md"
REVISED_FILE_NAME = "동아리 회칙 062326 개정본.md"
ORIGINAL_FILE = ROOT / ORIGINAL_FILE_NAME
REVISED_FILE = ROOT / REVISED_FILE_NAME
STATE_FILE = DATA_ROOT / ".prome-law-state.json"
EDIT_TOKEN_FILE = DATA_ROOT / ".prome-law-edit-token"
SEED_STATE_FILE = ROOT / "seed-state.json"

state_condition = threading.Condition()
server_revision = 0


def hash_text(text):
    value = 5381
    for character in text:
        value = ((value << 5) + value) + ord(character)
        value &= 0xFFFFFFFF
    return str(value)


def read_text_file(path):
    return path.read_text(encoding="utf-8")


def atomic_write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{path.name}-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as file:
            file.write(text)
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def atomic_write_json(path, payload):
    atomic_write_text(path, json.dumps(payload, ensure_ascii=False, indent=2))


def get_edit_token():
    env_token = os.environ.get("PROME_LAW_EDIT_TOKEN", "").strip()
    if env_token:
        return env_token
    if EDIT_TOKEN_FILE.exists():
        return EDIT_TOKEN_FILE.read_text(encoding="utf-8").strip()
    token = secrets.token_urlsafe(32)
    EDIT_TOKEN_FILE.write_text(token, encoding="utf-8")
    return token


EDIT_TOKEN = get_edit_token()


def normalize_annotation(note):
    normalized = dict(note)
    normalized["isPublic"] = False if normalized.get("kind") == "댓글" else normalized.get("isPublic") is not False
    highlights = normalized.get("highlights")
    normalized["highlights"] = highlights if isinstance(highlights, list) else []
    return normalized


def normalize_payload(payload):
    normalized = dict(payload)
    annotations = normalized.get("annotations")
    normalized["annotations"] = [normalize_annotation(note) for note in annotations] if isinstance(annotations, list) else []
    return normalized


def viewer_payload(payload):
    public_payload = copy.deepcopy(normalize_payload(payload))
    public_payload["annotations"] = [
        note for note in public_payload.get("annotations", [])
        if note.get("kind") != "댓글" and note.get("isPublic") is not False
    ]
    for note in public_payload["annotations"]:
        note.pop("author", None)
    public_payload["annotationDefaults"] = {}
    return public_payload


def initial_payload():
    original_text = read_text_file(ORIGINAL_FILE)
    revised_text = read_text_file(REVISED_FILE)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "version": 2,
        "savedAt": now,
        "serverSavedAt": now,
        "serverRevision": server_revision,
        "files": {
            "original": {
                "name": ORIGINAL_FILE_NAME,
                "hash": hash_text(original_text),
                "text": original_text,
            },
            "revised": {
                "name": REVISED_FILE_NAME,
                "hash": hash_text(revised_text),
                "text": revised_text,
            },
        },
        "documents": {
            "original": {"name": ORIGINAL_FILE_NAME, "text": original_text},
            "revised": {"name": REVISED_FILE_NAME, "text": revised_text},
        },
        "layout": {"alignments": {}, "deletedRows": []},
        "alignments": {},
        "deletedRows": [],
        "lineHeights": {},
        "lineOffsets": {},
        "lineBonds": [],
        "annotations": [],
        "annotationDefaults": {},
        "selectedRevisedId": None,
        "splitRatio": 50,
        "patchNotes": [],
        "plusNotes": [],
    }


def load_seed_payload():
    if not SEED_STATE_FILE.exists():
        return None
    try:
        payload = normalize_payload(json.loads(SEED_STATE_FILE.read_text(encoding="utf-8")))
    except json.JSONDecodeError:
        return None
    payload["serverRevision"] = int(payload.get("serverRevision") or 0)
    return payload


def load_state_payload():
    if STATE_FILE.exists():
        try:
            return normalize_payload(json.loads(STATE_FILE.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            pass
    seed_payload = load_seed_payload()
    if seed_payload:
        return seed_payload
    return initial_payload()


def save_state_payload(payload):
    global server_revision
    with state_condition:
        server_revision += 1
        next_payload = normalize_payload(payload)
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        next_payload["serverSavedAt"] = now
        next_payload["serverRevision"] = server_revision
        atomic_write_json(STATE_FILE, next_payload)
        update_markdown_files_from_payload(next_payload)
        state_condition.notify_all()
        return server_revision


def update_markdown_files_from_payload(payload):
    revised_text = payload.get("documents", {}).get("revised", {}).get("text")
    if isinstance(revised_text, str):
        atomic_write_text(REVISED_FILE, revised_text)


def update_revised_markdown(text):
    payload = load_state_payload()
    payload.setdefault("documents", {}).setdefault("revised", {})["name"] = REVISED_FILE_NAME
    payload["documents"]["revised"]["text"] = text
    payload.setdefault("files", {}).setdefault("revised", {})["name"] = REVISED_FILE_NAME
    payload["files"]["revised"]["hash"] = hash_text(text)
    payload["files"]["revised"]["text"] = text
    return save_state_payload(payload)


def initialize_revision():
    global server_revision
    payload = load_state_payload()
    revision = int(payload.get("serverRevision") or 0)
    server_revision = max(server_revision, revision)


class PromeLawHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path in {"/", "/viewer"}:
            self.send_index("viewer")
            return

        if path == "/present":
            self.send_index("present")
            return

        if path.startswith("/edit/"):
            token = path.split("/edit/", 1)[1]
            if secrets.compare_digest(token, EDIT_TOKEN):
                self.send_index("edit", token)
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
            return

        if path == "/api/state":
            payload = load_state_payload()
            self.send_json(payload if self.is_edit_request(parsed) else viewer_payload(payload))
            return

        if path == "/api/events":
            self.send_events(parsed)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.is_edit_request(parsed):
            self.send_json({"error": "편집 권한이 없습니다."}, HTTPStatus.FORBIDDEN)
            return

        if parsed.path == "/api/revised":
            self.handle_revised_post()
            return

        if parsed.path == "/api/state":
            self.handle_state_post()
            return

        self.send_json({"error": "지원하지 않는 API입니다."}, HTTPStatus.NOT_FOUND)

    def handle_revised_post(self):
        try:
            payload = self.read_json_body()
            text = payload.get("text")
            if not isinstance(text, str):
                raise ValueError("text 필드가 필요합니다.")
            revision = update_revised_markdown(text)
            self.send_json({"ok": True, "revision": revision})
        except Exception as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def handle_state_post(self):
        try:
            payload = self.read_json_body()
            if not isinstance(payload, dict):
                raise ValueError("상태 JSON이 필요합니다.")
            revision = save_state_payload(payload)
            self.send_json({"ok": True, "revision": revision})
        except Exception as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def send_index(self, mode, token=""):
        html = INDEX_FILE.read_text(encoding="utf-8")
        html = html.replace('href="./styles.css"', 'href="/styles.css"')
        config = json.dumps({
            "mode": mode,
            "editToken": token if mode == "edit" else "",
            "realtime": True,
        }, ensure_ascii=False)
        html = html.replace(
            '<script src="./app.js" defer></script>',
            f'<script>window.PROME_LAW_CONFIG = {config};</script>\n    <script src="/app.js" defer></script>',
        )
        body = html.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_events(self, parsed):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        query = parse_qs(parsed.query)
        last_seen = int(query.get("last", ["0"])[0] or 0)
        self.write_event(max(server_revision, last_seen))

        while True:
            with state_condition:
                state_condition.wait(timeout=20)
                next_revision = server_revision
            try:
                if next_revision > last_seen:
                    last_seen = next_revision
                    self.write_event(next_revision)
                else:
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return

    def write_event(self, revision):
        body = f"event: state\ndata: {json.dumps({'revision': revision})}\n\n".encode("utf-8")
        self.wfile.write(body)
        self.wfile.flush()

    def is_edit_request(self, parsed):
        header_token = self.headers.get("X-PromeLaw-Edit-Token", "")
        query_token = parse_qs(parsed.query).get("token", [""])[0]
        return secrets.compare_digest(header_token or query_token, EDIT_TOKEN)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 10 * 1024 * 1024:
            raise ValueError("요청 본문이 너무 큽니다.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5173")))
    args = parser.parse_args()
    initialize_revision()
    server = ThreadingHTTPServer((args.host, args.port), PromeLawHandler)
    print(f"Viewer: http://{args.host}:{args.port}/")
    print(f"Editor: http://{args.host}:{args.port}/edit/{EDIT_TOKEN}")
    server.serve_forever()


if __name__ == "__main__":
    main()
