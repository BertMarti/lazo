#!/usr/bin/env bash
# APK de Lazo en local (WSL o Linux), sin CI. Requisitos en espacio de usuario: Node 24 en ~/.local/node,
# JDK 21 en ~/.local/jdk/jdk-21*, SDK de Android en ~/android-sdk (licencias aceptadas).
# Uso (desde Git Bash): bash scripts/wsl.sh bash scripts/build-apk.sh
# Resultado: android/app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail
cd "$(dirname "$0")/.."
JAVA_HOME="$(ls -d "$HOME"/.local/jdk/jdk-21* 2>/dev/null | head -1)"
[ -n "$JAVA_HOME" ] || { echo "Falta el JDK 21 en ~/.local/jdk" >&2; exit 1; }
export JAVA_HOME ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME" PATH="$HOME/.local/node/bin:$JAVA_HOME/bin:$PATH"
# V-33: la app solo acepta servidor por enlace si es el dominio con el que se compila (ninguno sin LAZO_HOST).
VITE_LAZO_HOST="${LAZO_HOST:-}" npm run build
[ -d android ] || npx cap add android
# Android: sin copias de seguridad automáticas (la sesión no debe viajar a la nube del móvil).
sed -i 's/android:allowBackup="true"/android:allowBackup="false"/' android/app/src/main/AndroidManifest.xml
npx cap sync android
chmod +x android/gradlew
(cd android && ./gradlew assembleDebug --no-daemon --console=plain -q)
APK=android/app/build/outputs/apk/debug/app-debug.apk
grep -q '"webContentsDebuggingEnabled": *false' android/app/src/main/assets/capacitor.config.json || { echo "¡WebView depurable!" >&2; exit 1; }
grep -q 'allowBackup="false"' android/app/src/main/AndroidManifest.xml || { echo "¡allowBackup activo!" >&2; exit 1; }
ls -l "$APK" && echo "APK listo: $APK"
