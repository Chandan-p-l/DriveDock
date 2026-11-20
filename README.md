# DriveDock

Back up chosen folders from this Linux laptop to Google Drive, automatically, with its own app window.

## Use it
- Open **DriveDock** from the app launcher, or run `drivedock` in a terminal.
- First time: click **Connect Google Drive** and sign in with Google in the browser.
- **Backup folders** → **Add folder** → pick a folder, choose *Backup* or *Mirror*, and add skip patterns if you want.

## How backups run
- Automatically when you join Wi-Fi, and then every N hours (Settings).
- Skips metered networks (phone hotspots), low battery, and untrusted Wi-Fi if you set a list.
- **Backup** mode never deletes anything from Drive. **Mirror** mode makes Drive match the folder; removed or changed files are kept in `.versions`.
- Files go to `My Drive / DriveDock Backups / <computer name> / <folder name>`.

## Files
| What | Where |
|---|---|
| App code | `drivedock/server.py`, `drivedock/static/` |
| Settings | `~/.config/drivedock/config.json` |
| Google sign-in (private) | `~/.config/drivedock/rclone.conf` |
| History & logs | `~/.local/share/drivedock/` |
| Downloads from Drive | `~/Downloads/DriveDock/` |
| Restored backups | `~/DriveDock Restore/` |

## Commands
`drivedock` (open) · `drivedock status` · `drivedock logs` · `drivedock restart` · `drivedock stop`

Uninstall: `./uninstall.sh`. This keeps your settings and everything on Drive.
