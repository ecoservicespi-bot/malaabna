#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

KEYSTORE="malaabna-release.jks"
if [[ -e "$KEYSTORE" ]]; then
  echo "رفض إنشاء المفتاح: الملف موجود بالفعل: $KEYSTORE" >&2
  exit 1
fi
command -v keytool >/dev/null || {
  echo "لم يُعثر على keytool. ثبّت JDK 17 أولاً." >&2
  exit 1
}

echo "أنشئ كلمة مرور قوية. لن تُحفظ في ملفات المشروع."
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -alias malaabna \
  -keyalg RSA -keysize 2048 -validity 10000

echo
echo "بصمة SHA-256 (أضفها إلى ANDROID_TWA_SHA256_CERT_FINGERPRINTS في server/.env):"
keytool -list -v -keystore "$KEYSTORE" -alias malaabna | grep -E 'SHA256:'
echo
echo "احتفظ بنسخة احتياطية من $KEYSTORE وكلمة المرور في مكان آمن."