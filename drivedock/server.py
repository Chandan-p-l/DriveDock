#!/usr/bin/env python3
"""DriveDock — selective Google Drive backup & file manager for Linux.

Serves a local UI on http://127.0.0.1:8765 and drives rclone (rcd) as the
transfer engine. Python standard library only — nothing to pip install.

    python3 server.py           run the background service
    python3 server.py --open    open the UI (starts the service if needed)
"""
import base64
import ctypes
import glob
import json
import logging
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

VERSION = "1.0.0"
HOME = os.path.expanduser("~")
CONF_DIR = os.path.join(os.environ.get("XDG_CONFIG_HOME") or os.path.join(HOME, ".config"), "drivedock")
DATA_DIR = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.join(HOME, ".local", "share"), "drivedock")
CONFIG_FILE = os.path.join(CONF_DIR, "config.json")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
RCLONE_CONF = os.path.join(CONF_DIR, "rclone.conf")
LOG_FILE = os.path.join(DATA_DIR, "drivedock.log")
RCLONE_LOG = os.path.join(DATA_DIR, "rclone.log")
UPLOAD_TMP = os.path.join(DATA_DIR, "uploads")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
ICON = os.path.join(STATIC_DIR, "icon.svg")
PORT = int(os.environ.get("DRIVEDOCK_PORT", "8765"))
URL = f"http://127.0.0.1:{PORT}/"
REMOTE = "gdrive"
HOSTNAME = socket.gethostname()
DOWNLOAD_DIR = os.path.join(HOME, "Downloads", "DriveDock")
RESTORE_DIR = os.path.join(HOME, "DriveDock Restore")

DEFAULT_CONFIG = {
    "folders": [],
    "backup_root": f"DriveDock Backups/{HOSTNAME}",
    "auto_enabled": True,
    "backup_on_connect": True,
    "interval_hours": 6,
    "wifi_only": True,
    "skip_metered": True,
    "trusted_ssids": [],
    "min_battery": 20,
    "bwlimit": "",
    "transfers": 4,
    "notifications": True,
    "paused": False,
    "keep_versions": True,
    "global_excludes": ["*.tmp", "*.swp", "*.part", "*.crdownload", ".cache/**",
                        "node_modules/**", "__pycache__/**", ".Trash-*/**"],
}

log = logging.getLogger("drivedock")


class ApiError(Exception):
    pass


class RcError(Exception):
    pass


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _die_with_parent():
    """Make child processes exit if DriveDock dies (Linux prctl PR_SET_PDEATHSIG)."""
    try:
        ctypes.CDLL("libc.so.6").prctl(1, signal.SIGTERM)
    except Exception:
        pass


def notify(title, body, urgent=False):
    if not shutil.which("notify-send"):
        return
    try:
        subprocess.Popen(["notify-send", "-a", "DriveDock", "-i", ICON,
                          "-u", "critical" if urgent else "normal", title, body],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


# ---------------------------------------------------------------- rclone engine
class Rclone:
    def __init__(self):
        self.bin = shutil.which("rclone")
        self.proc = None
        self.port = None
        self.auth = None
        self.version = ""
        self._start_lock = threading.Lock()

    def start(self):
        """Start (or restart) the engine on a dedicated thread that lives as long as rclone does.

        PR_SET_PDEATHSIG fires when the *thread* that spawned the child exits, not the process.
        Spawning from a short-lived thread (e.g. the sign-in watcher) would get rclone killed
        the moment that thread finished, so the spawning thread must outlive the engine.
        """
        with self._start_lock:
            result, ready = {}, threading.Event()

            def engine_thread():
                try:
                    self._start()
                except Exception as e:
                    result["error"] = e
                ready.set()
                proc = self.proc
                if proc is not None and "error" not in result:
                    proc.wait()

            threading.Thread(target=engine_thread, name="rclone-engine", daemon=True).start()
            ready.wait()
            if "error" in result:
                raise result["error"]

    def _start(self):
        if not self.bin:
            raise RuntimeError("rclone is not installed (sudo apt install rclone)")
        self.stop()
        try:
            if os.path.getsize(RCLONE_LOG) > 20 * 1024 * 1024:
                os.remove(RCLONE_LOG)
        except OSError:
            pass
        self.port = free_port()
        user, pw = "drivedock", secrets.token_urlsafe(24)
        self.auth = "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()
        env = dict(os.environ, RCLONE_RC_USER=user, RCLONE_RC_PASS=pw, RCLONE_CONFIG=RCLONE_CONF)
        cmd = [self.bin, "rcd", f"--rc-addr=127.0.0.1:{self.port}",
               "--log-file", RCLONE_LOG, "--log-level", "INFO"]
        self.proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                     preexec_fn=_die_with_parent)
        for _ in range(150):
            try:
                self.call("rc/noop", timeout=2)
                break
            except RcError:
                if self.proc.poll() is not None:
                    raise RuntimeError("rclone engine exited on start; see " + RCLONE_LOG)
                time.sleep(0.1)
        else:
            raise RuntimeError("rclone engine did not start")
        self.version = self.call("core/version").get("version", "")
        log.info("rclone %s engine on port %s", self.version, self.port)

    def alive(self):
        return self.proc is not None and self.proc.poll() is None

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.proc = None

    def call(self, cmd, params=None, timeout=60):
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/{cmd}", data=json.dumps(params or {}).encode(),
            method="POST", headers={"Content-Type": "application/json", "Authorization": self.auth})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("error") or str(e)
            except Exception:
                msg = str(e)
            raise RcError(msg)
        except (urllib.error.URLError, OSError) as e:
            raise RcError(f"rclone engine unreachable: {getattr(e, 'reason', e)}")
        return json.loads(body) if body else {}


# ------------------------------------------------------------- system sensors
def _nmcli(*args):
    try:
        return subprocess.run(["nmcli", *args], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return ""


def _split_terse(line):
    return [p.replace("\\:", ":").replace("\\\\", "\\") for p in re.split(r"(?<!\\):", line)]


def network_status():
    info = {"online": False, "type": None, "name": None, "ssid": None, "metered": False, "device": None}
    if not shutil.which("nmcli"):
        try:
            socket.create_connection(("8.8.8.8", 53), 3).close()
            info.update(online=True, type="unknown", name="Network")
        except OSError:
            pass
        return info
    rank = {"ethernet": 0, "wifi": 1}
    best = None
    for line in _nmcli("-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device").splitlines():
        p = _split_terse(line)
        if len(p) < 4:
            continue
        dev, typ, st, con = p[:4]
        if not st.startswith("connected") or "externally" in st or typ in ("loopback", "bridge", "tun", "wireguard"):
            continue
        if best is None or rank.get(typ, 9) < rank.get(best[1], 9):
            best = (dev, typ, con)
    if not best:
        return info
    dev, typ, con = best
    info.update(online=True, type=typ, name=con, device=dev)
    if typ == "wifi":
        for line in _nmcli("-t", "-f", "ACTIVE,SSID", "device", "wifi", "list", "ifname", dev, "--rescan", "no").splitlines():
            p = _split_terse(line)
            if p[0] == "yes" and len(p) > 1:
                info["ssid"] = p[1]
                break
        info["ssid"] = info["ssid"] or con
    info["metered"] = _nmcli("-g", "GENERAL.METERED", "device", "show", dev).strip().startswith("yes")
    return info


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


def power_status():
    out = {"has_battery": False, "percent": None, "plugged": True}
    ac = None
    for d in glob.glob("/sys/class/power_supply/*"):
        t = _read(d + "/type")
        if t == "Battery" and _read(d + "/capacity"):
            out["has_battery"] = True
            out["percent"] = int(_read(d + "/capacity"))
            out["charging"] = _read(d + "/status") in ("Charging", "Full")
        elif t == "Mains":
            ac = (ac or False) or _read(d + "/online") == "1"
    if out["has_battery"]:
        out["plugged"] = bool(ac) if ac is not None else out.get("charging", False)
    return out


def safe_name(name):
    name = re.sub(r"[\\/:*?\"<>|]+", "-", (name or "").strip()).strip(". ")
    return name[:80]


def human(n):
    for u in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024 or u == "TB":
            return f"{n:.1f} {u}" if u != "B" else f"{n} B"
        n /= 1024


def slim_stats(s):
    return {
        "bytes": s.get("bytes", 0), "totalBytes": s.get("totalBytes", 0),
        "transfers": s.get("transfers", 0), "totalTransfers": s.get("totalTransfers", 0),
        "checks": s.get("checks", 0), "totalChecks": s.get("totalChecks", 0),
        "deletes": s.get("deletes", 0), "errors": s.get("errors", 0),
        "lastError": s.get("lastError", ""), "speed": s.get("speed", 0), "eta": s.get("eta"),
        "elapsed": s.get("elapsedTime", 0),
        "transferring": [{"name": t.get("name"), "size": t.get("size", 0), "bytes": t.get("bytes", 0),
                          "percentage": t.get("percentage", 0), "speed": t.get("speed", 0)}
                         for t in (s.get("transferring") or [])[:6]],
    }


# ------------------------------------------------------------------ the app
class App:
    def __init__(self):
        self.lock = threading.RLock()
        cfg = load_json(CONFIG_FILE, {})
        self.config = {**DEFAULT_CONFIG, **cfg}
        self.state = {"history": [], "last_success": 0, "last_run": 0, "folder_status": {},
                      **load_json(STATE_FILE, {})}
        self.rc = Rclone()
        self.token = secrets.token_urlsafe(24)
        self.net, self.power = {}, {}
        self.connected = False
        self.connecting = {"status": "idle"}
        self.connect_proc = None
        self.auto = {"ok": False, "reason": "Starting…"}
        self.run = None
        self.cancel_reason = None
        self.current_job = None
        self.tasks = {}
        self.about_cache = (0, None)

    # ---- persistence
    def save_config(self):
        with self.lock:
            save_json(CONFIG_FILE, self.config)

    def save_state(self):
        with self.lock:
            self.state["history"] = self.state["history"][:150]
            save_json(STATE_FILE, self.state)

    def folder(self, fid):
        for f in self.config["folders"]:
            if f["id"] == fid:
                return f
        raise ApiError("Folder not found")

    def root(self):
        return self.config["backup_root"].strip().strip("/") or "DriveDock Backups"

    def dest_path(self, f):
        return f"{self.root()}/{f['name']}"

    def excludes_for(self, f):
        return list(dict.fromkeys([e for e in self.config["global_excludes"] + f.get("excludes", []) if e.strip()]))

    # ---- connection
    def check_connected(self):
        try:
            self.connected = REMOTE in (self.rc.call("config/listremotes").get("remotes") or [])
        except RcError:
            pass
        return self.connected

    def connect(self, client_id="", client_secret=""):
        if self.connect_proc and self.connect_proc.poll() is None:
            return {"ok": True}
        cmd = [self.rc.bin, "config", "create", REMOTE, "drive", "scope", "drive"]
        if client_id.strip():
            cmd += ["client_id", client_id.strip(), "client_secret", client_secret.strip()]
        self.connecting = {"status": "waiting", "url": None, "error": None}
        os.makedirs(CONF_DIR, exist_ok=True)
        started = threading.Event()
        threading.Thread(target=self._watch_connect, args=(cmd, started), daemon=True).start()
        started.wait(10)
        return {"ok": True}

    def _watch_connect(self, cmd, started):
        # Spawned here (not in the HTTP thread) so the sign-in process lives as long as this watcher.
        env = dict(os.environ, RCLONE_CONFIG=RCLONE_CONF)
        try:
            self.connect_proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                                 stdin=subprocess.DEVNULL, text=True, preexec_fn=_die_with_parent)
        except Exception as e:
            self.connecting = {"status": "error", "error": str(e)}
            started.set()
            return
        started.set()
        proc, out = self.connect_proc, []
        for line in proc.stdout:
            out.append(line)
            m = re.search(r"(http://127\.0\.0\.1:53682/auth\?state=\S+)", line)
            if m:
                self.connecting["url"] = m.group(1)
        proc.wait()
        os.chmod(RCLONE_CONF, 0o600) if os.path.exists(RCLONE_CONF) else None
        # restart the engine so it picks up the fresh token
        try:
            self.rc.start()
        except Exception as e:
            log.error("engine restart failed: %s", e)
        if self.check_connected() and proc.returncode == 0:
            self.connecting = {"status": "done"}
            self.about_cache = (0, None)
            notify("Google Drive connected", "DriveDock is ready to back up your folders.")
        else:
            tail = "".join(out[-6:]).strip()
            self.connecting = {"status": "error", "error": tail or "Sign-in was cancelled"}
            log.warning("connect failed: %s", tail)

    def cancel_connect(self):
        if self.connect_proc and self.connect_proc.poll() is None:
            self.connect_proc.terminate()
        self.connecting = {"status": "idle"}

    def disconnect(self):
        if self.run:
            raise ApiError("Stop the running backup first")
        self.rc.call("config/delete", {"name": REMOTE})
        self.connected = False
        self.about_cache = (0, None)
        self.connecting = {"status": "idle"}

    # ---- policy
    def backup_allowed(self):
        c, net, pw = self.config, self.net, self.power
        if not self.connected:
            return False, "Google Drive is not connected"
        if not any(f.get("enabled", True) for f in c["folders"]):
            return False, "No backup folders selected"
        if c["paused"]:
            return False, "Backups are paused"
        if not net.get("online"):
            return False, "Offline — will back up when you connect"
        if c["wifi_only"] and net.get("type") not in ("wifi", "ethernet", "unknown"):
            return False, f"Not on Wi-Fi ({net.get('type')})"
        if c["skip_metered"] and net.get("metered"):
            return False, f"'{net.get('name')}' is a metered connection (hotspot/mobile data)"
        trusted = [s for s in c["trusted_ssids"] if s.strip()]
        if trusted and net.get("type") == "wifi" and net.get("ssid") not in trusted:
            return False, f"Wi-Fi '{net.get('ssid')}' is not in your trusted networks"
        if pw.get("has_battery") and not pw.get("plugged") and (pw.get("percent") or 100) < int(c["min_battery"]):
            return False, f"Battery low ({pw.get('percent')}%) — waiting for charger"
        return True, "Ready"

    def next_backup(self):
        h = float(self.config["interval_hours"] or 0)
        if h <= 0:
            return None
        return max(self.state.get("last_success", 0) + h * 3600, time.time())

    def scheduler(self):
        prev_ok = None
        tick = 0
        while True:
            try:
                if not self.rc.alive():
                    log.warning("rclone engine died — restarting")
                    self.rc.start()
                self.net, self.power = network_status(), power_status()
                if tick % 8 == 0:
                    self.check_connected()
                ok, why = self.backup_allowed()
                self.auto = {"ok": ok, "reason": why}
                if self.run and not ok and self.run["reason"] != "Manual" and self.connected:
                    self.stop_backup(f"Stopped: {why}")
                elif ok and not self.run and self.config["auto_enabled"]:
                    now = time.time()
                    since_run = now - self.state.get("last_run", 0)
                    if not prev_ok and self.config["backup_on_connect"] and since_run > 600:
                        label = self.net.get("ssid") or self.net.get("name") or "network"
                        self.start_backup(f"Connected to {label}")
                    elif self.next_backup() is not None and now >= self.next_backup() and since_run > 900:
                        self.start_backup("Scheduled")
                prev_ok = ok
            except Exception as e:
                log.exception("scheduler: %s", e)
            tick += 1
            time.sleep(15)

    # ---- backups
    def start_backup(self, reason, folder_ids=None):
        with self.lock:
            if self.run:
                raise ApiError("A backup is already running")
            if not self.connected:
                raise ApiError("Connect Google Drive first")
            folders = [f for f in self.config["folders"]
                       if (f["id"] in folder_ids if folder_ids else f.get("enabled", True))]
            if not folders:
                raise ApiError("No folders selected for backup")
            self.cancel_reason = None
            self.run = {"id": uuid.uuid4().hex[:10], "reason": reason, "started": time.time(),
                        "current": None, "progress": {},
                        "folders": [{"id": f["id"], "name": f["name"], "status": "queued"} for f in folders]}
            self.state["last_run"] = time.time()
        log.info("backup started (%s): %s", reason, ", ".join(f["name"] for f in folders))
        threading.Thread(target=self._backup_worker, args=(self.run, folders), daemon=True).start()
        return {"ok": True}

    def stop_backup(self, reason="Stopped by you"):
        self.cancel_reason = reason
        if self.current_job:
            try:
                self.rc.call("job/stop", {"jobid": self.current_job})
            except RcError:
                pass

    def _apply_bwlimit(self):
        try:
            self.rc.call("core/bwlimit", {"rate": self.config["bwlimit"].strip() or "off"})
        except RcError as e:
            log.warning("bwlimit: %s", e)

    def _backup_worker(self, run, folders):
        self._apply_bwlimit()
        for f in folders:
            entry = next(e for e in run["folders"] if e["id"] == f["id"])
            if self.cancel_reason:
                entry["status"] = "cancelled"
                continue
            run["current"] = f["id"]
            entry["status"] = "running"
            fs = self.state["folder_status"].setdefault(f["id"], {})
            try:
                stats = self._backup_folder(run, f)
                entry.update(status="cancelled" if self.cancel_reason else "success", stats=stats)
                if stats.get("errors"):
                    entry.update(status="partial", error=stats.get("lastError"))
            except Exception as e:
                entry.update(status="cancelled" if self.cancel_reason else "error", error=str(e))
                log.error("backup %s failed: %s", f["name"], e)
            fs.update(last_run=time.time(), last_status=entry["status"], last_error=entry.get("error"))
            if entry["status"] == "success":
                fs["last_success"] = time.time()
            threading.Thread(target=self.measure, args=(f,), daemon=True).start()

        statuses = [e["status"] for e in run["folders"]]
        if self.cancel_reason:
            status = "cancelled"
        elif all(s == "success" for s in statuses):
            status = "success"
        elif any(s in ("success", "partial") for s in statuses):
            status = "partial"
        else:
            status = "error"
        files = sum(e.get("stats", {}).get("transfers", 0) for e in run["folders"])
        size = sum(e.get("stats", {}).get("bytes", 0) for e in run["folders"])
        record = {"id": run["id"], "reason": run["reason"], "started": run["started"], "ended": time.time(),
                  "status": status, "files": files, "bytes": size, "note": self.cancel_reason,
                  "folders": [{"name": e["name"], "status": e["status"], "error": e.get("error"),
                               "files": e.get("stats", {}).get("transfers", 0),
                               "bytes": e.get("stats", {}).get("bytes", 0),
                               "deletes": e.get("stats", {}).get("deletes", 0)} for e in run["folders"]]}
        with self.lock:
            self.state["history"].insert(0, record)
            if status == "success":
                self.state["last_success"] = time.time()
            self.save_state()
            self.run = None
            self.current_job = None
        log.info("backup finished: %s (%d files, %s)", status, files, human(size))
        if self.config["notifications"]:
            if status == "success":
                notify("Backup complete", f"{files} file(s) uploaded · {human(size)}" if files else "Everything was already up to date.")
            elif status == "cancelled":
                notify("Backup stopped", self.cancel_reason or "")
            else:
                bad = [e["name"] for e in run["folders"] if e["status"] in ("error", "partial")]
                notify("Backup had problems", "Check: " + ", ".join(bad), urgent=True)

    def _backup_folder(self, run, f):
        src = f["path"]
        if not os.path.isdir(src):
            raise RuntimeError("Folder not found on this computer (moved, deleted or drive unplugged)")
        cfg = {"Transfers": int(self.config["transfers"] or 4)}
        cmd = "sync/copy"
        if f.get("mode") == "mirror":
            if not any(os.scandir(src)):
                raise RuntimeError("Folder is empty — skipped so your Drive backup isn't wiped")
            cmd = "sync/sync"
            if self.config["keep_versions"]:
                cfg["BackupDir"] = f"{REMOTE}:{self.root()}/.versions/{f['name']}/{time.strftime('%Y-%m-%d_%H%M%S')}"
        group = f"backup-{run['id']}-{f['id']}"
        params = {"srcFs": src, "dstFs": f"{REMOTE}:{self.dest_path(f)}", "createEmptySrcDirs": True,
                  "_async": True, "_group": group, "_config": cfg,
                  "_filter": {"ExcludeRule": self.excludes_for(f)}}
        jobid = self.rc.call(cmd, params)["jobid"]
        self.current_job = jobid
        if self.cancel_reason:
            self.stop_backup(self.cancel_reason)
        stats = {}
        while True:
            time.sleep(1)
            st = self.rc.call("job/status", {"jobid": jobid})
            stats = slim_stats(self.rc.call("core/stats", {"group": group}))
            run["progress"] = stats
            if st.get("finished"):
                break
        self.current_job = None
        try:
            self.rc.call("core/stats-delete", {"group": group})
        except RcError:
            pass
        if not st.get("success") and not self.cancel_reason:
            raise RuntimeError(st.get("error") or stats.get("lastError") or "Backup failed")
        return stats

    def measure(self, f):
        """Local size/count of a backup folder (respecting excludes)."""
        if not os.path.isdir(f["path"]):
            return
        try:
            r = self.rc.call("operations/size", {"fs": f["path"], "_filter": {"ExcludeRule": self.excludes_for(f)}},
                             timeout=900)
            with self.lock:
                fs = self.state["folder_status"].setdefault(f["id"], {})
                fs.update(local_bytes=r.get("bytes", 0), local_count=r.get("count", 0), measured=time.time())
                self.save_state()
        except RcError as e:
            log.warning("measure %s: %s", f["name"], e)

    # ---- background tasks (download / upload / restore)
    def start_task(self, kind, label, cmd, params, cleanup=None):
        tid = uuid.uuid4().hex[:10]
        group = f"task-{tid}"
        jobid = self.rc.call(cmd, {**params, "_async": True, "_group": group})["jobid"]
        task = {"id": tid, "kind": kind, "label": label, "jobid": jobid, "status": "running",
                "started": time.time(), "progress": {}, "error": None}
        self.tasks[tid] = task
        threading.Thread(target=self._watch_task, args=(task, group, cleanup), daemon=True).start()
        return task

    def _watch_task(self, task, group, cleanup):
        try:
            while True:
                time.sleep(1)
                st = self.rc.call("job/status", {"jobid": task["jobid"]})
                task["progress"] = slim_stats(self.rc.call("core/stats", {"group": group}))
                if st.get("finished"):
                    break
            task["status"] = "success" if st.get("success") else "error"
            task["error"] = st.get("error") or None
        except Exception as e:
            task.update(status="error", error=str(e))
        task["ended"] = time.time()
        if cleanup:
            cleanup()
        if self.config["notifications"] and task["kind"] in ("download", "restore"):
            notify(f"{task['kind'].title()} {'finished' if task['status'] == 'success' else 'failed'}",
                   task["label"] + (f"\n{task['error']}" if task["error"] else ""))
        old = sorted(self.tasks.values(), key=lambda t: t["started"])[:-30]
        for t in old:
            if t["status"] != "running":
                self.tasks.pop(t["id"], None)

    # ======================================================== API handlers
    def api_state(self, q, b):
        ok, why = self.auto["ok"], self.auto["reason"]
        folders = []
        for f in self.config["folders"]:
            folders.append({**f, "dest": self.dest_path(f), "exists": os.path.isdir(f["path"]),
                            "status": self.state["folder_status"].get(f["id"], {})})
        return json.loads(json.dumps({
            "version": VERSION, "hostname": HOSTNAME, "rclone": self.rc.version,
            "connected": self.connected, "connecting": self.connecting,
            "config": {k: v for k, v in self.config.items() if k != "folders"},
            "folders": folders, "net": self.net, "power": self.power,
            "auto": {"ok": ok, "reason": why, "next": self.next_backup()},
            "run": self.run, "last_success": self.state.get("last_success", 0),
            "history": self.state["history"][:int(q.get("history", 40))],
            "tasks": sorted(self.tasks.values(), key=lambda t: -t["started"]),
            "paths": {"downloads": DOWNLOAD_DIR, "restore": RESTORE_DIR, "home": HOME},
        }, default=str))

    def api_config(self, q, b):
        allowed = set(DEFAULT_CONFIG) - {"folders"}
        with self.lock:
            for k, v in b.items():
                if k not in allowed:
                    continue
                if k == "backup_root":
                    v = "/".join(safe_name(p) for p in str(v).split("/") if safe_name(p))
                    if not v:
                        raise ApiError("Backup folder name can't be empty")
                if k in ("interval_hours", "min_battery", "transfers"):
                    v = max(0, min(float(v), 64 if k == "transfers" else 1000))
                    v = int(v) if k != "interval_hours" else v
                if k == "bwlimit" and v and not re.fullmatch(r"\s*\d+(\.\d+)?[KMG]?\s*", str(v), re.I):
                    raise ApiError("Bandwidth limit looks like 500K, 2M or 1.5M")
                self.config[k] = v
            self.save_config()
        if "bwlimit" in b and self.run:
            self._apply_bwlimit()
        return {"ok": True}

    def api_folder_add(self, q, b):
        path = os.path.realpath(os.path.expanduser(b.get("path", "")))
        if not os.path.isdir(path):
            raise ApiError("That folder doesn't exist")
        with self.lock:
            for f in self.config["folders"]:
                if f["path"] == path:
                    raise ApiError("This folder is already being backed up")
                if path.startswith(f["path"] + "/"):
                    raise ApiError(f"Already included inside '{f['name']}'")
            name = safe_name(b.get("name") or os.path.basename(path) or "Home")
            names = {f["name"] for f in self.config["folders"]}
            base, n = name, 2
            while name in names:
                name, n = f"{base} ({n})", n + 1
            f = {"id": uuid.uuid4().hex[:8], "path": path, "name": name,
                 "mode": "mirror" if b.get("mode") == "mirror" else "copy",
                 "excludes": [e.strip() for e in b.get("excludes", []) if e.strip()],
                 "enabled": True, "added": time.time()}
            self.config["folders"].append(f)
            self.save_config()
        threading.Thread(target=self.measure, args=(f,), daemon=True).start()
        return f

    def api_folder_update(self, q, b):
        with self.lock:
            f = self.folder(b.get("id"))
            if "name" in b:
                name = safe_name(b["name"])
                if not name:
                    raise ApiError("Name can't be empty")
                if any(o["name"] == name and o["id"] != f["id"] for o in self.config["folders"]):
                    raise ApiError("Another folder already uses that name")
                f["name"] = name
            if "mode" in b:
                f["mode"] = "mirror" if b["mode"] == "mirror" else "copy"
            if "excludes" in b:
                f["excludes"] = [e.strip() for e in b["excludes"] if e.strip()]
            if "enabled" in b:
                f["enabled"] = bool(b["enabled"])
            self.save_config()
        if "excludes" in b:
            threading.Thread(target=self.measure, args=(f,), daemon=True).start()
        return f

    def api_folder_remove(self, q, b):
        with self.lock:
            f = self.folder(b.get("id"))
            if self.run and any(e["id"] == f["id"] for e in self.run["folders"]):
                raise ApiError("This folder is being backed up right now")
            self.config["folders"].remove(f)
            self.state["folder_status"].pop(f["id"], None)
            self.save_config()
            self.save_state()
        return {"ok": True}

    def api_backup_start(self, q, b):
        return self.start_backup("Manual", b.get("folders") or None)

    def api_backup_stop(self, q, b):
        self.stop_backup()
        return {"ok": True}

    def api_restore(self, q, b):
        f = self.folder(b.get("id"))
        dst = os.path.join(RESTORE_DIR, f["name"])
        os.makedirs(dst, exist_ok=True)
        return self.start_task("restore", f"{f['name']} → {dst}", "sync/copy",
                               {"srcFs": f"{REMOTE}:{self.dest_path(f)}", "dstFs": dst})

    def api_connect(self, q, b):
        return self.connect(b.get("client_id", ""), b.get("client_secret", ""))

    def api_connect_cancel(self, q, b):
        self.cancel_connect()
        return {"ok": True}

    def api_disconnect(self, q, b):
        self.disconnect()
        return {"ok": True}

    # ---- drive browser
    def _need_drive(self):
        if not self.connected:
            raise ApiError("Google Drive is not connected")

    def api_about(self, q, b):
        self._need_drive()
        t, data = self.about_cache
        if data and time.time() - t < 60 and not q.get("fresh"):
            return data
        data = self.rc.call("operations/about", {"fs": f"{REMOTE}:"}, timeout=60)
        self.about_cache = (time.time(), data)
        return data

    def api_ls(self, q, b):
        self._need_drive()
        path = q.get("path", "").strip("/")
        r = self.rc.call("operations/list", {"fs": f"{REMOTE}:", "remote": path}, timeout=180)
        return {"path": path, "items": [
            {"name": i["Name"], "path": i["Path"], "size": i.get("Size", -1), "mime": i.get("MimeType", ""),
             "mod": i.get("ModTime"), "dir": i.get("IsDir", False), "id": i.get("ID")} for i in r.get("list", [])]}

    def api_stat(self, q, b):
        self._need_drive()
        r = self.rc.call("operations/stat", {"fs": f"{REMOTE}:", "remote": q.get("path", "").strip("/")})
        return r.get("item") or {}

    def api_large(self, q, b):
        self._need_drive()
        path = q.get("path", "").strip("/")
        min_mb = float(q.get("min_mb", 50))
        r = self.rc.call("operations/list", {"fs": f"{REMOTE}:", "remote": path,
                                             "opt": {"recurse": True, "filesOnly": True}}, timeout=900)
        items = [i for i in r.get("list", []) if i.get("Size", 0) >= min_mb * 1024 * 1024]
        items.sort(key=lambda i: -i.get("Size", 0))
        return {"items": [{"name": i["Name"], "path": i["Path"], "size": i["Size"], "mime": i.get("MimeType", ""),
                           "mod": i.get("ModTime"), "dir": False, "id": i.get("ID")} for i in items[:300]],
                "scanned": len(r.get("list", []))}

    def api_size(self, q, b):
        self._need_drive()
        return self.rc.call("operations/size", {"fs": f"{REMOTE}:{q.get('path', '').strip('/')}"}, timeout=600)

    def api_delete(self, q, b):
        self._need_drive()
        done, errors = 0, []
        for it in b.get("items", []):
            p = it["path"].strip("/")
            if not p:
                continue
            try:
                if it.get("dir"):
                    self.rc.call("operations/purge", {"fs": f"{REMOTE}:", "remote": p}, timeout=600)
                else:
                    self.rc.call("operations/deletefile", {"fs": f"{REMOTE}:", "remote": p})
                done += 1
            except RcError as e:
                errors.append(f"{p}: {e}")
        self.about_cache = (0, None)
        return {"deleted": done, "errors": errors}

    def api_mkdir(self, q, b):
        self._need_drive()
        p = b.get("path", "").strip("/")
        if not p:
            raise ApiError("Folder name required")
        self.rc.call("operations/mkdir", {"fs": f"{REMOTE}:", "remote": p})
        return {"ok": True}

    def api_rename(self, q, b):
        self._need_drive()
        src, dst = b["from"].strip("/"), b["to"].strip("/")
        if not dst or src == dst:
            raise ApiError("Pick a different name")
        if b.get("dir"):
            self.rc.call("sync/move", {"srcFs": f"{REMOTE}:{src}", "dstFs": f"{REMOTE}:{dst}",
                                       "deleteEmptySrcDirs": True}, timeout=900)
            try:
                self.rc.call("operations/rmdir", {"fs": f"{REMOTE}:", "remote": src})
            except RcError:
                pass
        else:
            self.rc.call("operations/movefile", {"srcFs": f"{REMOTE}:", "srcRemote": src,
                                                 "dstFs": f"{REMOTE}:", "dstRemote": dst}, timeout=900)
        return {"ok": True}

    def api_download(self, q, b):
        self._need_drive()
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        tasks = []
        for it in b.get("items", []):
            p = it["path"].strip("/")
            name = os.path.basename(p) or "My Drive"
            if it.get("dir"):
                tasks.append(self.start_task("download", f"{name} → Downloads/DriveDock", "sync/copy",
                                             {"srcFs": f"{REMOTE}:{p}", "dstFs": os.path.join(DOWNLOAD_DIR, name)}))
            else:
                tasks.append(self.start_task("download", f"{name} → Downloads/DriveDock", "operations/copyfile",
                                             {"srcFs": f"{REMOTE}:", "srcRemote": p,
                                              "dstFs": DOWNLOAD_DIR, "dstRemote": name}))
        return {"tasks": tasks}

    def api_emptytrash(self, q, b):
        self._need_drive()
        self.rc.call("operations/cleanup", {"fs": f"{REMOTE}:"}, timeout=600)
        self.about_cache = (0, None)
        return {"ok": True}

    def api_open_path(self, q, b):
        """Open a local folder in the file manager."""
        p = b.get("path") or ""
        if p in ("downloads", "restore"):
            p = DOWNLOAD_DIR if p == "downloads" else RESTORE_DIR
            os.makedirs(p, exist_ok=True)
        if not os.path.isdir(p):
            raise ApiError("Folder not found")
        subprocess.Popen(["xdg-open", p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {"ok": True}

    def api_log(self, q, b):
        try:
            with open(LOG_FILE, errors="replace") as fh:
                lines = fh.readlines()[-300:]
        except OSError:
            lines = []
        return {"lines": [l.rstrip() for l in lines]}

    # ---- local folder picker
    def api_local_ls(self, q, b):
        path = os.path.realpath(os.path.expanduser(q.get("path") or HOME))
        if not os.path.isdir(path):
            raise ApiError("Folder not found")
        hidden = q.get("hidden") == "1"
        dirs = []
        try:
            with os.scandir(path) as it:
                for e in it:
                    if e.is_dir(follow_symlinks=False) and (hidden or not e.name.startswith(".")):
                        dirs.append({"name": e.name, "path": e.path})
        except PermissionError:
            raise ApiError("No permission to open this folder")
        dirs.sort(key=lambda d: d["name"].lower())
        places = [{"name": "Home", "path": HOME}]
        for n in ("Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"):
            if os.path.isdir(os.path.join(HOME, n)):
                places.append({"name": n, "path": os.path.join(HOME, n)})
        for m in glob.glob(f"/media/{os.environ.get('USER', '')}/*") + glob.glob("/mnt/*"):
            if os.path.isdir(m):
                places.append({"name": os.path.basename(m), "path": m, "drive": True})
        return {"path": path, "parent": os.path.dirname(path) if path != "/" else None,
                "dirs": dirs, "places": places}

    # ---- upload (streamed body)
    def upload(self, handler, q):
        self._need_drive()
        name = safe_name(os.path.basename(q.get("name", "")))
        if not name:
            raise ApiError("Missing file name")
        length = int(handler.headers.get("Content-Length") or 0)
        tmpdir = os.path.join(UPLOAD_TMP, uuid.uuid4().hex)
        os.makedirs(tmpdir)
        with open(os.path.join(tmpdir, name), "wb") as fh:
            left = length
            while left > 0:
                chunk = handler.rfile.read(min(left, 1 << 20))
                if not chunk:
                    break
                fh.write(chunk)
                left -= len(chunk)
        dst = "/".join(p for p in (q.get("path", "").strip("/"), name) if p)
        return self.start_task("upload", f"{name} → My Drive/{q.get('path', '').strip('/')}", "operations/movefile",
                               {"srcFs": tmpdir, "srcRemote": name, "dstFs": f"{REMOTE}:", "dstRemote": dst},
                               cleanup=lambda: shutil.rmtree(tmpdir, ignore_errors=True))


APP = None
GET_ROUTES = {"state": "api_state", "about": "api_about", "ls": "api_ls", "stat": "api_stat",
              "large": "api_large", "size": "api_size", "local/ls": "api_local_ls", "log": "api_log"}
POST_ROUTES = {"config": "api_config", "folders/add": "api_folder_add", "folders/update": "api_folder_update",
               "folders/remove": "api_folder_remove", "backup/start": "api_backup_start",
               "backup/stop": "api_backup_stop", "restore": "api_restore", "connect": "api_connect",
               "connect/cancel": "api_connect_cancel", "disconnect": "api_disconnect",
               "delete": "api_delete", "mkdir": "api_mkdir", "rename": "api_rename",
               "download": "api_download", "emptytrash": "api_emptytrash", "open": "api_open_path"}
STATIC_FILES = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js",
                "/style.css": "style.css", "/icon.svg": "icon.svg"}
MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml"}


class Handler(BaseHTTPRequestHandler):
    server_version = "DriveDock"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="application/json"):
        try:
            self._send_raw(code, body, ctype)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the window was closed or reloaded mid-request; nothing to do

    def _send_raw(self, code, body, ctype):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _host_ok(self):
        # Blocks DNS-rebinding: only answer requests addressed to localhost.
        return (self.headers.get("Host") or "").rsplit(":", 1)[0] in ("127.0.0.1", "localhost")

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, {"error": "forbidden"})
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self._api(GET_ROUTES, u)
        name = STATIC_FILES.get(u.path)
        if not name:
            return self._send(404, {"error": "not found"})
        with open(os.path.join(STATIC_DIR, name), "rb") as fh:
            data = fh.read()
        if name == "index.html":
            data = data.replace(b"%%TOKEN%%", APP.token.encode())
        self._send(200, data, MIME[os.path.splitext(name)[1]])

    def do_POST(self):
        if not self._host_ok():
            return self._send(403, {"error": "forbidden"})
        self._api(POST_ROUTES, urlparse(self.path))

    def _api(self, routes, u):
        # Token stops other websites from driving the API through your browser.
        if not secrets.compare_digest(self.headers.get("X-DriveDock-Token", ""), APP.token):
            return self._send(401, {"error": "Reload the DriveDock window"})
        route = u.path[len("/api/"):]
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if self.command == "POST" and route == "upload":
                return self._send(200, APP.upload(self, q))
            fn = routes.get(route)
            if not fn:
                return self._send(404, {"error": "unknown endpoint"})
            body = {}
            if self.command == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            self._send(200, getattr(APP, fn)(q, body) or {"ok": True})
        except ApiError as e:
            self._send(400, {"error": str(e)})
        except RcError as e:
            self._send(502, {"error": str(e)})
        except Exception as e:
            log.exception("api %s", route)
            self._send(500, {"error": f"{type(e).__name__}: {e}"})


def open_ui():
    for b in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser", "microsoft-edge"):
        if shutil.which(b):
            cmd = [b, f"--app={URL}", "--class=DriveDock", "--window-size=1280,860"]
            break
    else:
        cmd = ["xdg-open", URL]
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def server_running():
    try:
        socket.create_connection(("127.0.0.1", PORT), 1).close()
        return True
    except OSError:
        return False


def main():
    global APP
    want_open = "--open" in sys.argv
    if server_running():
        if want_open:
            open_ui()
            return
        sys.exit(f"DriveDock is already running on {URL}")
    for d in (CONF_DIR, DATA_DIR, UPLOAD_TMP):
        os.makedirs(d, exist_ok=True)
    shutil.rmtree(UPLOAD_TMP, ignore_errors=True)
    os.makedirs(UPLOAD_TMP, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()])
    APP = App()
    APP.rc.start()
    APP.check_connected()
    threading.Thread(target=APP.scheduler, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True

    def shutdown(*_):
        log.info("shutting down")
        APP.stop_backup("DriveDock was closed")
        threading.Thread(target=srv.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    log.info("DriveDock %s on %s", VERSION, URL)
    if want_open:
        threading.Timer(0.8, open_ui).start()
    srv.serve_forever()
    APP.rc.stop()


if __name__ == "__main__":
    main()
