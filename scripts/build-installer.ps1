# PowerShell Build & Package Script for SDWings.X-PDF
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SDWings.X-PDF · BUILD & PACKAGE RELEASE INSTALLER" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Build Web Assets
Write-Host "`n[1/4] Building Web Application Assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Lỗi khi build web assets!" -ForegroundColor Red
    exit 1
}

# 2. Build Desktop Host
Write-Host "`n[2/4] Compiling Lightweight Windows Desktop Host..." -ForegroundColor Yellow
dotnet publish src-desktop/SDWings.Desktop.csproj -c Release --no-self-contained -o release/lightweight-win
if ($LASTEXITCODE -ne 0) {
    Write-Host "Lỗi khi compile desktop host!" -ForegroundColor Red
    exit 1
}

# Copy app icon to release folder
Copy-Item "src-desktop/app.ico" "release/lightweight-win/app.ico" -Force

# 3. Create Portable Zip Package
Write-Host "`n[3/4] Creating Portable ZIP Archive..." -ForegroundColor Yellow
Compress-Archive -Path "release/lightweight-win/*" -DestinationPath "release/SDWings.X-PDF-v1.0.0-Portable.zip" -Force
$zipSize = [math]::Round((Get-Item "release/SDWings.X-PDF-v1.0.0-Portable.zip").Length / 1MB, 2)
Write-Host "  -> Created: release/SDWings.X-PDF-v1.0.0-Portable.zip ($zipSize MB)" -ForegroundColor Green

# 4. Compile Setup Installer (.exe)
Write-Host "`n[4/4] Generating Windows Setup Wizard (.exe) with Inno Setup..." -ForegroundColor Yellow
$isccPath = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $isccPath)) {
    $isccPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $isccPath)) {
    $isccPath = "C:\Program Files\Inno Setup 6\ISCC.exe"
}

if (Test-Path $isccPath) {
    & $isccPath "installer/setup.iss"
    if ($LASTEXITCODE -eq 0) {
        $setupSize = [math]::Round((Get-Item "release/SDWings.X-PDF-Setup-v1.0.0.exe").Length / 1MB, 2)
        Write-Host "  -> Created: release/SDWings.X-PDF-Setup-v1.0.0.exe ($setupSize MB)" -ForegroundColor Green
    } else {
        Write-Host "Lỗi khi biên dịch file Setup bằng Inno Setup!" -ForegroundColor Red
    }
} else {
    Write-Host "Không tìm thấy ISCC.exe. Vui lòng cài đặt Inno Setup 6." -ForegroundColor Yellow
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  HOÀN THÀNH ĐÓNG GÓI! BẢN PHÁT HÀNH NẰM TRONG THƯ MỤC release/" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
