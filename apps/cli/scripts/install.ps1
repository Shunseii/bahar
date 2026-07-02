$ErrorActionPreference = "Stop"

$Repo = "Shunseii/bahar"
$BinName = "bahar.exe"
$InstallDir = Join-Path $env:LOCALAPPDATA "Bahar\bin"

Write-Host "Fetching latest Bahar CLI release..."

$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases"
$release = $releases | Where-Object { $_.tag_name -like "cli-v*" -and -not $_.draft } | Select-Object -First 1

if (-not $release) {
    Write-Error "Could not find a CLI release. Please try again later."
    exit 1
}

$asset = "bahar-windows-x64.exe"
$url = "https://github.com/$Repo/releases/download/$($release.tag_name)/$asset"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Downloading $asset ($($release.tag_name))..."
Invoke-WebRequest -Uri $url -OutFile (Join-Path $InstallDir $BinName)

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "User")
    Write-Host "Added $InstallDir to your PATH. Restart your terminal for this to take effect."
}

Write-Host "Installed to $InstallDir\$BinName"
Write-Host "Run 'bahar login' to get started."
