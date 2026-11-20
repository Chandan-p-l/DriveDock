#!/usr/bin/env bash
# Removes the DriveDock service, launcher and command.
# Your settings (~/.config/drivedock) and files on Google Drive are kept.
set -u
systemctl --user disable --now drivedock.service 2>/dev/null
rm -f "$HOME/.config/systemd/user/drivedock.service" \
      "$HOME/.local/share/applications/drivedock.desktop" \
      "$HOME/.local/bin/drivedock"
systemctl --user daemon-reload
echo "DriveDock removed. To also delete settings and the Google sign-in:"
echo "  rm -rf ~/.config/drivedock ~/.local/share/drivedock"
