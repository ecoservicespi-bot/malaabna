$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command bubblewrap -ErrorAction SilentlyContinue)) {
    throw "ثبّت Bubblewrap أولاً: npm install -g @bubblewrap/cli"
}
if (-not (Test-Path (Join-Path $PSScriptRoot "malaabna-release.jks"))) {
    throw "أنشئ مفتاح الإصدار أولاً بتشغيل .\create-signing-key.ps1"
}
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    throw "اضبط JAVA_HOME على JDK 17 قبل البناء."
}
$JavaVersion = & (Join-Path $env:JAVA_HOME "bin\java.exe") -version 2>&1 | Select-Object -First 1
if ($JavaVersion -notmatch 'version "17\.') {
    throw "يتطلب Bubblewrap JDK 17؛ الإصدار الحالي: $JavaVersion"
}
if (-not ($env:ANDROID_HOME -or $env:ANDROID_SDK_ROOT)) {
    throw "اضبط ANDROID_HOME أو ANDROID_SDK_ROOT على Android SDK."
}

& bubblewrap build @args
if ($LASTEXITCODE -ne 0) { throw "فشل بناء APK الإصدار." }
Write-Host "`nاكتمل البناء. ملفات APK وAAB موجودة في: $PSScriptRoot"