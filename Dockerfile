FROM python:3.12-slim

WORKDIR /app
COPY . .
RUN python - <<'PY'
import datetime
import json
import os
import urllib.request

repo = os.environ.get("PROME_LAW_GITHUB_REPO", "vacangyu/prome_law")
branch = os.environ.get("PROME_LAW_GITHUB_BRANCH", "main")
built_at = datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
payload = {
    "commit": "",
    "shortCommit": "",
    "commitUrl": "",
    "committedAt": "",
    "pushedAt": "",
    "builtAt": built_at,
    "source": "build-fallback",
}

try:
    request_headers = {"User-Agent": "PromeLaw-build-version"}
    commit_request = urllib.request.Request(f"https://api.github.com/repos/{repo}/commits/{branch}", headers=request_headers)
    repo_request = urllib.request.Request(f"https://api.github.com/repos/{repo}", headers=request_headers)
    with urllib.request.urlopen(commit_request, timeout=10) as response:
        commit_payload = json.loads(response.read().decode("utf-8"))
    with urllib.request.urlopen(repo_request, timeout=10) as response:
        repo_payload = json.loads(response.read().decode("utf-8"))
    commit = commit_payload.get("sha", "")
    payload.update({
        "commit": commit,
        "shortCommit": commit[:7],
        "commitUrl": commit_payload.get("html_url", ""),
        "committedAt": commit_payload.get("commit", {}).get("committer", {}).get("date", ""),
        "pushedAt": repo_payload.get("pushed_at", ""),
        "source": "github-api",
    })
except Exception as error:
    payload["error"] = str(error)

with open("version.json", "w", encoding="utf-8") as file:
    json.dump(payload, file, ensure_ascii=False, indent=2)
PY

ENV HOST=0.0.0.0
ENV PORT=8000
ENV PROME_LAW_DATA_DIR=/data

EXPOSE 8000
CMD ["python", "server.py"]
