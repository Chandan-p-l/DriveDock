#!/usr/bin/env bash
# Installs DriveDock for the current user: background service (starts at login),
# app-launcher entry, and a `drivedock` command. No sudo needed.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/drivedock" && pwd)"
PY="$(command -v python3)"
UNIT_DIR="$HOME/.config/systemd/user"
APPS_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

command -v rclone >/dev/null || { echo "rclone is missing. Install it with: sudo apt install rclone"; exit 1; }

mkdir -p "$UNIT_DIR" "$APPS_DIR" "$BIN_DIR"

cat > "$UNIT_DIR/drivedock.service" <<EOF
[Unit]
Description=DriveDock - Google Drive backup
After=network-online.target graphical-session.target

[Service]
ExecStart=$PY $APP_DIR/server.py
Restart=on-failure
RestartSec=10
Nice=10
IOSchedulingClass=idle

[Install]
WantedBy=default.target
EOF

cat > "$APPS_DIR/drivedock.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=DriveDock
GenericName=Google Drive Backup
Comment=Back up chosen folders to Google Drive and manage your Drive
Exec=$PY $APP_DIR/server.py --open
Icon=$APP_DIR/static/icon.svg
Terminal=false
Categories=Utility;FileTools;Network;
Keywords=google;drive;backup;sync;cloud;
StartupWMClass=DriveDock
EOF

cat > "$BIN_DIR/drivedock" <<EOF
#!/usr/bin/env bash
# drivedock            open the DriveDock window
# drivedock status     show service status
# drivedock logs       follow the log
# drivedock restart    restart the background service
case "\${1:-open}" in
  open)    exec $PY $APP_DIR/server.py --open ;;
  status)  exec systemctl --user status drivedock ;;
  logs)    exec tail -f "\$HOME/.local/share/drivedock/drivedock.log" ;;
  restart) exec systemctl --user restart drivedock ;;
  stop)    exec systemctl --user stop drivedock ;;
  *) echo "usage: drivedock [open|status|logs|restart|stop]"; exit 1 ;;
esac
EOF
chmod +x "$BIN_DIR/drivedock" "$APP_DIR/server.py"

systemctl --user daemon-reload
systemctl --user enable --now drivedock.service
update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true

echo "DriveDock installed and running."
echo "  Open it: search 'DriveDock' in your apps, or run: drivedock"
echo "  Web UI:  http://127.0.0.1:8765/"
