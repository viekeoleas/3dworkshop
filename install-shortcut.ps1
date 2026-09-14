$ErrorActionPreference = 'Stop'
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) '3D Workshop.lnk'))
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'launch.ps1') + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Local 3D Workshop'
$shortcut.Save()
