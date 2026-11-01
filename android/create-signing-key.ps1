$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$KeyStore = Join-Path $PSScriptRoot "malaabna-release.jks"
if (Test-Path $KeyStore) {
    throw "رفض إنشاء المفتاح: الملف موجود بالفعل: $KeyStore"
}
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw "لم يُعثر على keytool. ثبّت JDK 17 وأضفه إلى PATH أولاً."
}

Write-Host "أنشئ كلمة مرور قوية. لن تُحفظ في ملفات المشروع."
& keytool -genkeypair -v `
    -keystore $KeyStore `
    -alias malaabna `
    -keyalg RSA -keysize 2048 -validity 10000
if ($LASTEXITCODE -ne 0) { throw "فشل إنشاء مفتاح التوقيع." }

Write-Host "`nبصمة SHA-256 (أضفها إلى ANDROID_TWA_SHA256_CERT_FINGERPRINTS في server/.env):"
& keytool -list -v -keystore $KeyStore -alias malaabna | Select-String "SHA256:"
if ($LASTEXITCODE -ne 0) { throw "تعذر قراءة بصمة مفتاح التوقيع." }

Write-Host "`nاحتفظ بنسخة احتياطية من $KeyStore وكلمة المرور في مكان آمن."