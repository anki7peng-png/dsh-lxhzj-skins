#!/bin/bash
# Build the optional local helper; pass an .icns file to change its app icon.
set -euo pipefail
cd "$(dirname "$0")"
APP="Luoxiaohei Notify.app"
if [ -e "$APP" ]; then
  echo "已有 $APP；请先手动备份或移走，再重新编译。" >&2
  exit 1
fi
ICON_SRC="${1:-$(pwd)/notification-heixiu.icns}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/luoxiaohei-notify-build.XXXXXXXX")"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/$APP/Contents/MacOS" "$TMP/$APP/Contents/Resources"
swiftc -module-cache-path "$TMP/module-cache" -O -o "$TMP/$APP/Contents/MacOS/luoxiaohei-notify" LuoxiaoheiNotify.swift
ICON_KEY=""
if [ -f "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$TMP/$APP/Contents/Resources/icon.icns"
  ICON_KEY='<key>CFBundleIconFile</key><string>icon</string>'
fi
cat > "$TMP/$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.dsh.luoxiaohei-notify</string>
<key>CFBundleName</key><string>Luoxiaohei Notify</string>
<key>CFBundleDisplayName</key><string>罗小黑通知</string>
<key>CFBundleExecutable</key><string>luoxiaohei-notify</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
<key>LSMinimumSystemVersion</key><string>11.0</string>
$ICON_KEY
</dict></plist>
PLIST
codesign --force --sign - "$TMP/$APP"
mv "$TMP/$APP" "$APP"
printf '已生成 %s/%s\n' "$(pwd)" "$APP"
