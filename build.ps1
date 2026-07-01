<#
.SYNOPSIS
    Builds WhatsApp Controller end-to-end: creates an isolated Python virtual
    environment with only the backend's actual dependencies, packages the
    backend with PyInstaller, builds the frontend, and produces a Windows
    installer via electron-builder in frontend\release.

.DESCRIPTION
    The backend is built from a dedicated virtual environment
    (backend\.venv) rather than whatever Python happens to be on PATH.
    This matters because PyInstaller's hooks for packages like pandas/numpy
    will bundle *other* unrelated packages they merely detect sitting in the
    same site-packages (e.g. torch, numba, django) if the interpreter's
    environment has them installed for unrelated projects. An isolated venv
    with only backend\requirements.txt installed guarantees the build only
    contains what this app actually uses.

    After a successful build, intermediate artifacts that aren't part of the
    distributable (PyInstaller's work dir/spec file, electron-builder's
    unpacked app folder, blockmap, debug yaml) are removed, leaving just the
    installer .exe in frontend\release.

.PARAMETER Python
    Base Python interpreter used only to *create* the virtual environment
    (needs the stdlib venv module; any Python 3.9+ works). Defaults to
    "python" on PATH.

.PARAMETER Clean
    Remove previous build output (backend/dist, backend/build, backend/.venv,
    frontend/dist, frontend/release, and the old frontend/dist-electron
    location from earlier builds) before building.

.EXAMPLE
    .\build.ps1
    .\build.ps1 -Python "C:\Path\To\python.exe"
    .\build.ps1 -Clean
#>
param(
    [string]$Python = "python",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$backendDir = Join-Path $repoRoot "backend"
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$releaseDir = Join-Path $frontendDir "release"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

if ($Clean) {
    Write-Step "Cleaning previous build output"
    @(
        (Join-Path $backendDir "dist"),
        (Join-Path $backendDir "build"),
        (Join-Path $backendDir "backend.spec"),
        (Join-Path $frontendDir "dist"),
        $releaseDir,
        (Join-Path $frontendDir "dist-electron"), # old output location from earlier builds
        $venvDir
    ) | ForEach-Object {
        if (Test-Path $_) {
            Write-Host "  Removing $_"
            Remove-Item $_ -Recurse -Force
        }
    }
}

Write-Step "Setting up isolated backend build environment"
if (-not (Test-Path $venvPython)) {
    Write-Host "  Creating venv at $venvDir (base interpreter: $Python)"
    & $Python -m venv $venvDir
    if ($LASTEXITCODE -ne 0) { throw "Failed to create virtual environment with '$Python'. Pass -Python <path> to a valid Python 3 interpreter." }
}
& $venvPython -m pip install --quiet --upgrade pip
& $venvPython -m pip install --quiet -r (Join-Path $backendDir "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Failed to install backend\requirements.txt into the venv" }

Write-Step "Building backend (PyInstaller, isolated venv)"
Push-Location $backendDir
try {
    & $venvPython -m PyInstaller server.py `
        --onefile --noconsole --clean `
        --distpath=dist --workpath=build --specpath=. --name=backend `
        --hidden-import=uvicorn.logging `
        --hidden-import=uvicorn.loops `
        --hidden-import=uvicorn.loops.auto `
        --hidden-import=uvicorn.protocols `
        --hidden-import=uvicorn.protocols.http `
        --hidden-import=uvicorn.protocols.http.auto `
        --hidden-import=uvicorn.protocols.websockets `
        --hidden-import=uvicorn.protocols.websockets.auto `
        --hidden-import=uvicorn.lifespan `
        --hidden-import=uvicorn.lifespan.on `
        --collect-all=uiautomation `
        --collect-all=pdfplumber `
        --collect-all=pypdfium2
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
}
finally {
    Pop-Location
}

Push-Location $frontendDir
try {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Step "Installing frontend dependencies (npm install)"
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }

    Write-Step "Building frontend (Vite)"
    npm run build:frontend
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

    Write-Step "Packaging Windows installer (electron-builder)"
    npx electron-builder --win
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
}
finally {
    Pop-Location
}

Write-Step "Cleaning up intermediate build artifacts"
@(
    (Join-Path $backendDir "build"),
    (Join-Path $backendDir "backend.spec"),
    (Join-Path $releaseDir "win-unpacked"),
    (Join-Path $releaseDir ".icon-ico"),
    (Join-Path $releaseDir "builder-debug.yml")
) | ForEach-Object {
    if (Test-Path $_) {
        Write-Host "  Removing $_"
        Remove-Item $_ -Recurse -Force
    }
}
Get-ChildItem $releaseDir -Filter "*.blockmap" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Step "Build complete"
$installers = Get-ChildItem $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue
if ($installers) {
    Write-Host "Installer(s):" -ForegroundColor Green
    $installers | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 1)
        Write-Host "  $($_.FullName) ($sizeMB MB)" -ForegroundColor Green
    }
} else {
    Write-Host "No installer .exe found in $releaseDir - check the electron-builder output above." -ForegroundColor Yellow
}
