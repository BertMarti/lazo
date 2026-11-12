#!/usr/bin/env bash
# APK de release firmado (WSL). La clave vive FUERA del repo, en ~/.lazo-keys (como Gestorín):
#   ~/.lazo-keys/lazo-release.jks  · alias «lazo» · contraseña en ~/.lazo-keys/password (chmod 600)
# Si no existe, se crea la primera vez. Guárdala a buen recaudo: sin ella no se puede publicar una
# actualización que Android acepte encima de la instalada.
# Uso (desde Git Bash): bash scripts/wsl.sh 'bash scripts/firmar-apk.sh 1.0.0'
set -euo pipefail
cd "$(dirname "$0")/.."
VER="${1:?Uso: firmar-apk.sh <versión>}"
JAVA_HOME="$(ls -d "$HOME"/.local/jdk/jdk-21* | head -1)"
export JAVA_HOME ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}" ANDROID_SDK_ROOT="${ANDROID_HOME:-$HOME/android-sdk}"
export PATH="$HOME/.local/node/bin:$JAVA_HOME/bin:$PATH"
KEYS="$HOME/.lazo-keys"; KS="$KEYS/lazo-release.jks"; PASS="$KEYS/password"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

if [ ! -f "$KS" ]; then
  mkdir -p "$KEYS" && chmod 700 "$KEYS"
  ( umask 077; head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32 > "$PASS" )
  keytool -genkeypair -keystore "$KS" -alias lazo -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass:file "$PASS" -keypass:file "$PASS" -dname "CN=Lazo, O=BertMarti, C=ES" >/dev/null
  chmod 600 "$KS"
  echo "Clave nueva creada en $KS (cópiala a un sitio seguro)."
fi

npm run build
npx cap sync android
chmod +x android/gradlew
(cd android && ./gradlew assembleRelease --no-daemon --console=plain -q)
IN=android/app/build/outputs/apk/release/app-release-unsigned.apk
OUT="dist-apk/lazo-$VER.apk"
mkdir -p dist-apk
"$BT/zipalign" -f -p 4 "$IN" dist-apk/alineado.apk
"$BT/apksigner" sign --ks "$KS" --ks-key-alias lazo --ks-pass "file:$PASS" --key-pass "file:$PASS" --out "$OUT" dist-apk/alineado.apk
rm -f dist-apk/alineado.apk "$OUT.idsig"
"$BT/apksigner" verify --print-certs "$OUT" | grep -E "Signer #1 certificate (DN|SHA-256)"
grep -q '"webContentsDebuggingEnabled": *false' android/app/src/main/assets/capacitor.config.json || { echo "¡WebView depurable!" >&2; exit 1; }
sha256sum "$OUT"
echo "APK firmado: $OUT"
