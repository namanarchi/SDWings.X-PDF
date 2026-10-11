@echo off
chcp 65001 > nul
echo ==========================================================
echo    SDWings.X-PDF · ĐÓNG GÓI BẢN CÀI ĐẶT & PORTABLE
echo ==========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-installer.ps1"
pause
