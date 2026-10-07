@echo off
setlocal enabledelayedexpansion
title Git Update Tool - Moments Gallery

echo ========================================================
echo          MOMENTS GALLERY - GIT AUTO UPDATER
echo ========================================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git and try again.
    goto end
)

:: Check git status
echo [1/4] Checking changes...
git status --short
echo.

:: Ask for commit message
set /p commit_msg="Enter commit message (Leave blank for auto message): "

if "%commit_msg%"=="" (
    set commit_msg=Update Moments Gallery - %date% %time%
)

echo.
echo [2/4] Adding all changes...
git add .

echo.
echo [3/4] Committing changes with message: "!commit_msg!"
git commit -m "!commit_msg!"

echo.
echo [4/4] Pushing to GitHub (origin main)...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo      SUCCESS: Repository updated successfully!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo      [WARNING / ERROR] Push failed or encountered an issue.
    echo      Please verify your GitHub credentials or connection.
    echo ========================================================
)

:end
echo.
pause
