# Full cleanup of OpenShadow residue + NSIS temp leftovers (reclaims C: space).
# Run in an Administrator PowerShell.
$ErrorActionPreference = 'SilentlyContinue'

# 1. Kill any running OpenShadow / installer processes
@("OpenShadow", "OpenShadow Server") | ForEach-Object {
  Get-Process -Name $_ -ErrorAction SilentlyContinue | Stop-Process -Force
}

# 2. Remove partial install directories
@(
  "$env:LOCALAPPDATA\Programs\OpenShadow",
  "$env:APPDATA\OpenShadow",
  "C:\Program Files\OpenShadow",
  "C:\Program Files (x86)\OpenShadow"
) | ForEach-Object {
  if (Test-Path $_) { Remove-Item -Recurse -Force $_; Write-Host "removed dir: $_" }
}

# 3. Remove NSIS temp extraction leftovers in %TEMP% (this is what eats C: space)
#    NSIS extracts to folders like "nsXXXX.tmp" and the installer's plugin dir.
$temp = $env:TEMP
$reclaimed = 0
Get-ChildItem $temp -ErrorAction SilentlyContinue | Where-Object {
  $_.PSIsContainer -and ($_.Name -like 'ns*' -or $_.Name -like '*OpenShadow*' -or $_.Name -like '*openshadow*')
} | ForEach-Object {
  $sz = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
  $reclaimed += $sz
  Write-Host ("removed temp: {0} ({1:N0} MB)" -f $_.Name, ($sz/1MB))
}

# 4. Remove NSIS uninstall registry keys (match by DisplayName)
@(
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
) | ForEach-Object {
  if (Test-Path $_) {
    Get-ChildItem $_ | Where-Object { $_.GetValue("DisplayName") -like "*OpenShadow*" } | ForEach-Object {
      Remove-Item -Recurse -Force $_.PSPath; Write-Host ("removed reg: {0}" -f $_.PSPath)
    }
  }
}

# 5. Remove electron HKCU config + user data (resets wizard.completed flag)
if (Test-Path "HKCU:\Software\OpenShadow") { Remove-Item -Recurse -Force "HKCU:\Software\OpenShadow" }
if (Test-Path "$env:APPDATA\.openshadow") { Remove-Item -Recurse -Force "$env:APPDATA\.openshadow"; Write-Host "removed userdata" }

Write-Host ("`nReclaimed about {0:N0} MB from NSIS temp leftovers." -f ($reclaimed/1MB))
Write-Host "Cleanup done. You can now retry the install with a clean slate."
