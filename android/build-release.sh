#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v bubblewrap >/dev/null; then
  echo "ثبّت Bubblewrap أولاً: npm install -g @bubblewrap/cli" >&2
  exit 1
fi
if [[ ! -f "malaabna-release.jks" ]]; then
  echo "أنشئ مفتاح الإصدار أولاً بتشغيل ./create-signing-key.sh" >&2
  exit 1
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "اضبط JAVA_HOME على JDK 17 قبل البناء." >&2
  exit 1
fi
JAVA_VERSION=$("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1)
if [[ "$JAVA_VERSION" != *'"17.'* ]]; then
  echo "يتطلب Bubblewrap JDK 17؛ الإصدار الحالي: $JAVA_VERSION" >&2
  exit 1
fi
if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo "اضبط ANDROID_HOME أو ANDROID_SDK_ROOT على Android SDK." >&2
  exit 1
fi

bubblewrap build "$@"
echo
echo "أنشئ Bubblewrap ملف APK موقّعًا وملف AAB داخل: $PWD"