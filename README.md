# DriveDock

**Selective, automatic Google Drive backup for Linux, with its own app window.**

Google doesn't make a Drive desktop app for Linux. DriveDock fills that gap. You choose which folders on your laptop to protect, and DriveDock backs them up to your Google Drive automatically whenever you connect to Wi-Fi. From the same window you can browse, download, upload and clean up your Drive.

It runs entirely on your own computer. [rclone](https://rclone.org), the well-known open-source tool, does the transfers. DriveDock adds the scheduling, Wi-Fi and battery rules, backup history and the user interface around it.

---

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [First-time setup](#first-time-setup)
- [Using DriveDock](#using-drivedock)
- [How automatic backup decides when to run](#how-automatic-backup-decides-when-to-run)
- [Backup modes: Backup vs Mirror](#backup-modes-backup-vs-mirror)
- [Where your files go on Google Drive](#where-your-files-go-on-google-drive)
- [Restoring files](#restoring-files)
- [Settings reference](#settings-reference)
- [Skip patterns](#skip-patterns)
- [Keep backing up with the laptop lid closed](#keep-backing-up-with-the-laptop-lid-closed)
- [Commands](#commands)
- [Where DriveDock keeps its data](#where-drivedock-keeps-its-data)
- [Using your own Google API client ID](#using-your-own-google-api-client-id-optional)
- [Troubleshooting](#troubleshooting)
- [Uninstall](#uninstall)
- [How it works (for developers)](#how-it-works-for-developers)
- [Security and privacy](#security-and-privacy)

---

## Features

**Backups**
- Back up **only the folders you choose**, never the whole computer.
- **Automatic backup when you connect to Wi-Fi**, then again on a schedule (every 1 to 24 hours).
- Two modes per folder: **Backup**, which never deletes anything from Drive, and **Mirror**, which keeps old versions.
- Per-folder and global **skip patterns**, for example `node_modules/**` or `*.iso`.
- Works with **USB drives and external disks** under `/media` and `/mnt`.
- **Back up now** for one folder or for all of them, plus **Stop** and **Pause**.
- **Restore** any backed-up folder to a safe location without overwriting your originals.

**Smart conditions**
- Skips **metered connections** such as phone hotspots and mobile data, so it doesn't use up your data plan.
- Can be limited to **trusted Wi-Fi networks** only, for example home and office.
- Waits when the **battery is low** and you're unplugged.
- **Stops an automatic backup** if you switch to a network that isn't allowed.
- Retries automatically and backs off after failures.

**Drive manager**
- Browse My Drive with breadcrumbs, sorting and filtering.
- **Upload** with a button or by drag and drop, **download** files or whole folders, **rename**, and **create folders**.
- **Move to trash** single items or many at once. Anything trashed can be restored from Google Drive's trash for 30 days.
- **Largest files** finder: lists every file of 50 MB or more in the current folder and all its subfolders, so you can free up space.
- See storage used, free space and trash size, and **empty the trash**.
- **Open in Google Drive** for any file or folder.
- Calculate the total size of any folder.

**App**
- Dashboard with live progress: percentage, speed, time remaining and the files being uploaded.
- Activity history with per-folder results and errors, plus a log viewer.
- Desktop notifications when backups finish or fail.
- Light, dark and system themes. The layout also works in narrow windows.
- Starts automatically when you log in and runs quietly in the background, at low CPU and disk priority.

**Safety**
- Backup mode never deletes from Drive.
- Mirror mode refuses to run on an **empty folder**. If a USB drive is unplugged, this stops it from wiping the backup.
- Deletes in the Drive manager go to **trash**, not permanent deletion.
- Restore writes to a separate folder and never overwrites your originals.
- Your Google sign-in is stored only on your computer.

---

## Requirements

| Requirement | Notes |
|---|---|
| Linux with **systemd** and a desktop | Tested on Ubuntu 26.04 (GNOME) |
| **Python 3.8+** | Standard library only, nothing to `pip install` |
| **rclone** | `sudo apt install rclone`. A recent version is recommended (see below) |
| **NetworkManager** (`nmcli`) | For Wi-Fi and metered detection. Already on Ubuntu, Fedora and Mint |
| A browser | Chrome, Chromium, Brave or Edge opens DriveDock as its own app window. Any other browser opens it as a normal tab |
| `notify-send` (optional) | For desktop notifications. Included with most desktops |

**Recommended: update rclone.** Ubuntu's packaged version can be old. The official installer gets the latest:

```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

---

## Installation

```bash
git clone git@github.com:Chandan-p-l/DriveDock.git
cd DriveDock
./install.sh
```

The installer doesn't need `sudo`. It sets up three things for your user account only:

1. **Background service:** `~/.config/systemd/user/drivedock.service`, which starts at login.
2. **App launcher entry:** search for "DriveDock" in your applications.
3. **Terminal command:** `drivedock` in `~/.local/bin`.

Then open DriveDock from your app launcher, run `drivedock`, or visit **http://127.0.0.1:8765/**.

> Keep the cloned folder where it is. The service runs the code from that location. If you move it, run `./install.sh` again.

---

## First-time setup

1. **Connect Google Drive.** Open DriveDock and click **Connect Google Drive**. A Google sign-in page opens in your browser. Choose your account and click **Allow**. If the page doesn't open, use the link DriveDock shows.
2. **Add folders.** Go to **Backup folders**, click **Add folder**, then:
   - Browse to a folder. The quick buttons cover Home, Documents, Pictures and so on, plus any USB drives.
   - Choose the name it will have on Drive.
   - Pick a mode: **Backup** (recommended) or **Mirror**.
   - Optionally add skip patterns.
3. **Back up.** Click **Back up now**, or just wait. DriveDock backs up automatically the next time the conditions are right.

The first backup uploads everything, so it can take a while. After that, only new and changed files are uploaded.

---

## Using DriveDock

### Dashboard
- **Status card:** shows whether you're backed up, when the last backup ran and when the next one is due. If automatic backup is waiting, it says exactly why, for example "metered connection" or "battery low".
- **During a backup:** a progress bar with bytes uploaded, file count, speed, time remaining, the files being uploaded and the folder queue. A **Stop** button cancels the backup.
- **Cards:**
  - **Google Drive:** storage used and free, and trash size with an **Empty** link.
  - **Protected:** how many folders are selected and their total size.
  - **Network:** current network and whether it's metered.
  - **Schedule:** your automatic backup settings and battery level.
- **Recent activity:** the last 5 backups.

### Backup folders
Each folder card shows its status (*Backed up*, *Not backed up yet*, *Problem*, *Folder missing* or *Paused*), mode, local size and file count, last backup time and its location on Drive.

| Control | What it does |
|---|---|
| Toggle | Include or exclude the folder from **automatic** backups |
| Cloud-up icon | Back up this folder now |
| Cloud icon | Open this folder's backup in the My Drive browser |
| Download icon | Restore a copy to `~/DriveDock Restore/` |
| Pencil | Edit the name, mode or skip patterns |
| Bin | Stop backing up this folder. Files already on Drive are **not** deleted |

### My Drive
- Click folders to open them. Use the path at the top to go back.
- Click the column headers to sort by **Name**, **Modified** or **Size**.
- **Filter this folder…** narrows the current list as you type.
- **Upload** files, or drag and drop them onto the window.
- **New folder** creates a folder in the current location.
- Hover a row for **Download**, **Rename**, **Open in Google Drive** and **Move to trash**.
- Tick checkboxes to download or trash many items at once. The selection bar shows the total size.
- **Largest files** scans the current folder and everything inside it for files of 50 MB or more, sorted biggest first. It's the quickest way to free up space.
- **size?** next to a folder calculates its total size.
- Downloads are saved to `~/Downloads/DriveDock/`. The **Downloads** button opens that folder.
- Transfers in progress appear in a small panel in the bottom-right corner.

### Activity
- Every backup run is listed with its trigger (*Manual*, *Scheduled* or *Connected to <Wi-Fi>*), time, number of files, size and duration.
- Click a row to see per-folder results, including error messages and how many files were removed in Mirror mode.
- Uploads, downloads and restores are listed separately.
- **View log** shows DriveDock's recent log.

---

## How automatic backup decides when to run

DriveDock checks its conditions every 15 seconds. **All** of these must be true:

1. Google Drive is connected.
2. At least one folder is enabled.
3. Backups aren't paused.
4. You're online.
5. The network is Wi-Fi or Ethernet, if **Only on Wi-Fi or Ethernet** is on.
6. The network isn't metered, if **Skip metered connections** is on.
7. The Wi-Fi network is in your trusted list, if you set one.
8. If you're on battery, the charge is above the **Minimum battery** level.

When all conditions are met, a backup starts in either of these cases:
- **You just connected**, and the last backup attempt was more than 10 minutes ago. This avoids repeat runs when Wi-Fi drops and reconnects.
- **The scheduled time has passed** since the last successful backup, for example 6 hours. After a failed attempt, DriveDock waits at least 15 minutes before trying again.

If the conditions stop being true during an automatic backup, for example because you switch to a hotspot, the backup is stopped. It will catch up later. A backup you started manually keeps running.

**Metered networks:** NetworkManager marks phone hotspots and USB tethering as metered automatically. To change this for one network, open GNOME Settings, go to Wi-Fi, click the gear icon next to the network, open **Details** and set **Metered connection**.

---

## Backup modes: Backup vs Mirror

| | **Backup** (default) | **Mirror** |
|---|---|---|
| New files | Uploaded | Uploaded |
| Changed files | Updated on Drive | Updated on Drive. The old version is kept in `.versions` if **Keep old versions** is on |
| Files deleted on the laptop | **Kept on Drive** | Removed from the backup. A copy is kept in `.versions` if **Keep old versions** is on |
| Best for | Photos, documents, anything you can't lose | Keeping Drive an exact copy of a working folder |
| rclone command used | `copy` | `sync` with `--backup-dir` |

Mirror mode has one extra safety check. If the source folder is **completely empty**, which usually means a USB drive isn't plugged in, the backup is skipped instead of wiping the copy on Drive.

---

## Where your files go on Google Drive

```
My Drive/
└── DriveDock Backups/
    └── <computer name>/                 e.g. chandan-LOQ-15IAX9
        ├── Documents/                   one folder per backed-up folder
        ├── Pictures/
        └── .versions/                   Mirror mode only
            └── Documents/
                └── 2026-11-20_135352/   files changed or deleted in that run
```

- You can change the top folder (`DriveDock Backups/<computer name>`) in Settings, under **Backup folder in My Drive**.
- Because the computer name is part of the path, several laptops can back up to the same Drive account without mixing their files.
- Renaming a backup folder in DriveDock starts a new backup folder on Drive. The old one isn't deleted.

---

## Restoring files

- **A whole folder:** go to **Backup folders**, click the download icon, then **Restore**. A full copy is downloaded to `~/DriveDock Restore/<folder name>/`. Your original folder is never touched, so you can compare and copy back what you need.
- **Individual files:** go to **My Drive**, open `DriveDock Backups/<computer>/…` and click **Download**. Files land in `~/Downloads/DriveDock/`.
- **Older versions (Mirror mode):** browse `DriveDock Backups/<computer>/.versions/<folder>/<date>/`.
- **Deleted from Drive by mistake:** restore it from Google Drive's trash at drive.google.com, within 30 days.

---

## Settings reference

| Setting | Default | What it does |
|---|---|---|
| Automatic backups | On | Master switch for all automatic backups |
| Back up when I connect to Wi-Fi | On | Start a backup when the laptop joins an allowed network |
| Also back up every | 6 hours | Repeat while connected. Set to *Never* to back up only when you connect |
| Pause all backups | Off | Temporarily stop automatic backups. Manual backups still work |
| Only on Wi-Fi or Ethernet | On | Never use mobile broadband |
| Skip metered connections | On | Never use hotspots or networks marked as metered |
| Trusted Wi-Fi networks only | *(empty)* | If set, only these Wi-Fi names are used. **Add current** fills in the network you're on |
| Minimum battery | 20% | When unplugged, wait until the battery is above this level |
| Upload speed limit | Unlimited | For example `500K`, `1M` (1 MB/s) or `2.5M`. Takes effect immediately, even during a backup |
| Parallel uploads | 4 | More is faster on good connections. Google may slow things down above about 8 |
| Backup folder in My Drive | `DriveDock Backups/<computer name>` | Where all backups are stored |
| Keep old versions (Mirror mode) | On | Keep replaced or deleted files in `.versions` |
| Always skip | see below | Skip patterns applied to every folder |
| Desktop notifications | On | Notify when a backup finishes, fails, or a download or restore completes |
| Theme | System | System, Light or Dark |
| Google Drive account | — | **Disconnect** removes the sign-in. Nothing on Drive is deleted, and your folder list is kept |

---

## Skip patterns

These patterns are skipped in every folder by default:

```
*.tmp   *.swp   *.part   *.crdownload   .cache/**   node_modules/**   __pycache__/**   .Trash-*/**
```

You can add your own in **Settings → Always skip** (for every folder) or in a folder's **Edit** dialog (for that folder only). Enter one pattern per line. They use rclone's filter syntax:

| Pattern | Skips |
|---|---|
| `*.iso` | Every `.iso` file, in any subfolder |
| `/Temp/**` | The `Temp` folder at the top of this backup folder |
| `Temp/**` | Any folder named `Temp`, at any depth |
| `*.{log,bak}` | `.log` and `.bak` files |
| `.git/**` | Git internals |

Full syntax: https://rclone.org/filtering/

---

## Keep backing up with the laptop lid closed

By default, Linux suspends the laptop when you close the lid, and that stops backups. To keep it running with the lid closed:

```bash
sudo mkdir -p /etc/systemd/logind.conf.d
printf '[Login]\nHandleLidSwitch=ignore\nHandleLidSwitchExternalPower=ignore\nHandleLidSwitchDocked=ignore\n' \
  | sudo tee /etc/systemd/logind.conf.d/no-lid-sleep.conf
sudo systemctl kill -s HUP systemd-logind     # reloads the setting without logging you out

# stop GNOME from suspending the laptop when it's idle
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
```

To undo it: `sudo rm /etc/systemd/logind.conf.d/no-lid-sleep.conf`, then run the `HUP` command again.

To keep the laptop awake only until you press Ctrl+C:

```bash
systemd-inhibit --what=handle-lid-switch:sleep --why="DriveDock backup" sleep infinity
```

Keep the laptop on a hard surface and plugged in for long backups.

---

## Commands

| Command | What it does |
|---|---|
| `drivedock` | Open the DriveDock window. Starts the service if it isn't running |
| `drivedock status` | Show whether the background service is running |
| `drivedock logs` | Follow the live log |
| `drivedock restart` | Restart the background service |
| `drivedock stop` | Stop the background service until next login, or until `systemctl --user start drivedock` |

You can also run it directly without installing: `python3 drivedock/server.py`, optionally with `--open`.

Environment variables:
- `DRIVEDOCK_PORT`: change the UI port. The default is `8765`.
- `XDG_CONFIG_HOME`, `XDG_DATA_HOME`: change where settings and data are stored.

---

## Where DriveDock keeps its data

| What | Location |
|---|---|
| App code | `drivedock/server.py`, `drivedock/static/` (this repo) |
| Settings and folder list | `~/.config/drivedock/config.json` |
| Google sign-in token (**private**, mode 600) | `~/.config/drivedock/rclone.conf` |
| Backup history and per-folder status | `~/.local/share/drivedock/state.json` |
| DriveDock log | `~/.local/share/drivedock/drivedock.log` |
| rclone transfer log (resets at 20 MB) | `~/.local/share/drivedock/rclone.log` |
| Temporary upload files (cleared automatically) | `~/.local/share/drivedock/uploads/` |
| Files downloaded from Drive | `~/Downloads/DriveDock/` |
| Restored backups | `~/DriveDock Restore/` |
| Background service | `~/.config/systemd/user/drivedock.service` |
| App launcher entry | `~/.local/share/applications/drivedock.desktop` |

DriveDock uses its **own** rclone config, so any rclone remotes you already have in `~/.config/rclone/rclone.conf` aren't touched.

---

## Using your own Google API client ID (optional)

By default, DriveDock signs in through rclone's shared Google app. Many people use it, so Google sometimes slows it down, and that's noticeable on large first backups. Your own free client ID avoids this:

1. Open https://console.cloud.google.com/, create a project, and enable the **Google Drive API**.
2. Under **APIs & Services → OAuth consent screen**, choose **External**, fill in the app name and your email, and add yourself as a **Test user**.
3. Under **Credentials → Create credentials → OAuth client ID**, choose the application type **Desktop app**.
4. Copy the **Client ID** and **Client secret**.
5. In DriveDock, go to **Settings → Disconnect**. On the welcome screen, open **Advanced**, paste both values and click **Connect Google Drive**.

More detail: https://rclone.org/drive/#making-your-own-client-id

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Window says "Service offline" | Run `drivedock restart`, then `drivedock status`. Check the log with `drivedock logs` |
| Automatic backup never starts | Look at the Dashboard: it says why it's waiting. Common causes are a metered hotspot, a network missing from the trusted list, low battery, or paused backups |
| Google sign-in page didn't open | Click the **open it here** link on the waiting screen. If you're stuck, click **Cancel** and try again |
| "Folder missing" on a folder card | The folder was moved or deleted, or it's on a USB drive that isn't plugged in. Plug the drive in or edit the folder |
| Backups are slow | Use your own client ID (see above), raise **Parallel uploads**, check **Upload speed limit**, or update rclone |
| "Reload the DriveDock window" error | The service restarted. Reload the page |
| Port 8765 already in use | Set `Environment=DRIVEDOCK_PORT=8790` in the service file, then run `systemctl --user daemon-reload && drivedock restart` |
| Want to start over | `drivedock stop && rm -rf ~/.config/drivedock ~/.local/share/drivedock && drivedock` |

---

## Uninstall

```bash
./uninstall.sh
```

This removes the service, the launcher entry and the `drivedock` command. Your settings and **everything on Google Drive** are kept. To also remove settings and the Google sign-in:

```bash
rm -rf ~/.config/drivedock ~/.local/share/drivedock
```

---

## How it works (for developers)

```
┌──────────────── Browser / app window ────────────────┐
│  static/index.html · app.js · style.css (vanilla JS) │
└──────────────┬───────────────────────────────────────┘
               │ HTTP + token, 127.0.0.1:8765
┌──────────────▼───────────────────────────────────────┐
│  server.py (Python stdlib)                           │
│   • HTTP API + static files                          │
│   • Scheduler thread: nmcli (network/metered),       │
│     /sys/class/power_supply (battery), rules         │
│   • Backup worker: one folder at a time, progress    │
│   • Task watcher: uploads / downloads / restores     │
│   • JSON config + state, notify-send                 │
└──────────────┬───────────────────────────────────────┘
               │ rclone remote-control API (random port + password)
┌──────────────▼───────────────────────────────────────┐
│  rclone rcd  → Google Drive API                      │
└──────────────────────────────────────────────────────┘
```

- `server.py` starts `rclone rcd` on a random local port with a random password. The rclone process exits automatically if DriveDock exits.
- Backups use `sync/copy` (Backup mode) or `sync/sync` with `BackupDir` (Mirror mode). Each runs as an async rclone job with its own stats group, which drives the live progress.
- Connecting to Google runs `rclone config create gdrive drive scope drive`. That opens rclone's standard OAuth flow on `127.0.0.1:53682`.
- The frontend polls `/api/state` every 1 to 3 seconds.

### API

All endpoints are under `/api/` and need the `X-DriveDock-Token` header, which is embedded in the page.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `state` | Everything the UI needs: config, folders, network, power, current run, history, tasks |
| GET | `about` | Drive storage (total, used, free, trashed) |
| GET | `ls?path=` | List a Drive folder |
| GET | `large?path=&min_mb=` | Recursive list of large files |
| GET | `size?path=` | Total size of a Drive folder |
| GET | `stat?path=` | Info on one Drive item |
| GET | `local/ls?path=&hidden=` | Local folder picker |
| GET | `log` | Last 300 log lines |
| POST | `config` | Update settings (partial) |
| POST | `folders/add`, `folders/update`, `folders/remove` | Manage backup folders |
| POST | `backup/start` `{folders?}`, `backup/stop` | Run or stop a backup |
| POST | `restore` `{id}` | Restore a folder to `~/DriveDock Restore` |
| POST | `upload?path=&name=` | Raw file body, streamed to Drive |
| POST | `download`, `delete`, `rename`, `mkdir`, `emptytrash` | Drive file operations |
| POST | `connect`, `connect/cancel`, `disconnect` | Google account |
| POST | `open` | Open a local folder in the file manager |

### Testing without a real Google account

Point DriveDock at a fake "Drive" folder on disk using an rclone alias remote:

```bash
mkdir -p /tmp/dd/cfg/drivedock /tmp/dd/data /tmp/dd/fakedrive
printf '[gdrive]\ntype = alias\nremote = /tmp/dd/fakedrive\n' > /tmp/dd/cfg/drivedock/rclone.conf
XDG_CONFIG_HOME=/tmp/dd/cfg XDG_DATA_HOME=/tmp/dd/data DRIVEDOCK_PORT=8799 \
  python3 drivedock/server.py --open
```

### Project layout

```
.
├── drivedock/
│   ├── server.py          backend: API, scheduler, backup engine
│   └── static/
│       ├── index.html     app shell
│       ├── app.js         UI logic (dashboard, folders, drive, activity, settings)
│       ├── style.css      styles, light/dark themes
│       └── icon.svg       app icon
├── install.sh             installs service, launcher and command
├── uninstall.sh
└── README.md
```

---

## Security and privacy

- **Local only:** the UI listens on `127.0.0.1`, so other devices on your network can't reach it.
- **Website protection:**
  - Every API call needs a secret token that changes each time DriveDock starts. This stops other websites from controlling DriveDock through your browser.
  - Requests whose `Host` isn't `localhost` or `127.0.0.1` are rejected, which blocks DNS-rebinding attacks.
- **Engine protection:** the rclone engine listens only on localhost, on a random port, with a random password.
- **Your Google token:** stays on your computer in `~/.config/drivedock/rclone.conf` (file mode `600`). It's never sent anywhere except to Google.
- **No middleman:** files go directly from your computer to Google Drive. There are no third-party servers and no telemetry.
- **Not in the repo:** `.gitignore` excludes `*.conf` files, so a token can't be committed by accident.
