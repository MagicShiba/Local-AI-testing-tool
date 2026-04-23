@echo off
setlocal
cd /d "%~dp0"
start "" http://127.0.0.1:15397
node server.js
