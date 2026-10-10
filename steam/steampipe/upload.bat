@echo off
rem Empire XY auf Steam hochladen (SteamPipe).
rem Voraussetzung: steamcmd.exe liegt in C:\steamcmd (https://developer.valvesoftware.com/wiki/SteamCMD)
rem Aufruf aus diesem Ordner: upload.bat DEIN_STEAM_LOGIN
setlocal
if "%~1"=="" (echo Aufruf: upload.bat STEAM_LOGIN & exit /b 1)
set STEAMCMD=C:\steamcmd\steamcmd.exe
if not exist "%STEAMCMD%" (echo steamcmd nicht gefunden: %STEAMCMD% & exit /b 1)

echo [1/2] Steam-Fassung bauen ...
pushd ..\..\desktop
call npm install || (popd & exit /b 1)
call npm run dist:steam || (popd & exit /b 1)
popd

echo [2/2] Hochladen ...
"%STEAMCMD%" +login %1 +run_app_build "%~dp0app_build.vdf" +quit
echo Fertig. Build in Steamworks unter "SteamPipe > Builds" freischalten.
