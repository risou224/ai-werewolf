@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Backend Server
npm run dev:server
