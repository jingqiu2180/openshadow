# Clean OpenShadow residue so a fresh install can succeed.
# Run in an Administrator PowerShell (right-click -> Run as Administrator).
$ErrorActionPreference = 'SilentlyContinue'

# 1. Kill any running OpenShadow processes that lock files
@("OpenShadow", "OpenShadow Server") | ForEach-Object {
  Get-Process -Name $_ -ErrorAction SilentlyContinue | Stop-Process -Force
}

# 2. Remove install directories (per-user + possible per-machine)
@(
  "$env:LOCALAPPDATA\Programs\OpenShadow",
  "$env:APPDATA\OpenShadow",
  "C:\Program Files\OpenShadow",
  "C:\Program Files (x86)\OpenShadow"
) | ForEach-Object {
  if (Test-Path $_) { Remove-Item -Recurse -Force $_; Write-Host "removed: $_" }
}

# 3. Remove NSIS uninstall registry keys (match by DisplayName)
@(
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
) | ForEach-Object {
  if (Test-Path $_) {
    Get-ChildItem $_ | Where-Object { $_.GetValue("DisplayName") -like "*OpenShadow*" } | ForEach-Object {
      Remove-Item -Recurse -Force $_.PSPath; Write-Host "removed reg: $($_.PSPath)"
    }
  }
}

# 4. Remove electron HKCU config key
if (Test-Path "HKCU:\Software\OpenShadow") { Remove-Item -Recurse -Force "HKCU:\Software\OpenShadow" }

# 5. Remove user data (includes config.json wizard.completed flag -> avoids wizard loop)
if (Test-Path "$env:APPDATA\.openshadow") { Remove-Item -Recurse -Force "$env:APPDATA\.openshadow"; Write-Host "removed userdata" }

Write-Host "`nCleanup done. Now run OpenShadow-0.3.40-Windows-x64.exe to reinstall."
