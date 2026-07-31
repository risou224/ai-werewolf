@echo off
cd /d "%~dp0"
chcp 65001 >nul
title AI Werewolf
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
