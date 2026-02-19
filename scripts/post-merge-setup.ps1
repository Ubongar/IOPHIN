param(
    [switch]$UseDockerInfra,
    [switch]$Dynamic,
    [switch]$SkipPipeline,
    [switch]$NoStartServices
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action
    )

    Write-Step $Title
    & $Action
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Repository: $repoRoot" -ForegroundColor Yellow

Invoke-Step "Checking required tools" {
    Assert-Command git
    Assert-Command python
    Assert-Command npm
    Assert-Command node

    if ($UseDockerInfra) {
        Assert-Command docker
    }
}

Invoke-Step "Syncing latest main branch" {
    git checkout main
    git pull origin main
}

$venvPython = Join-Path $repoRoot "venv\Scripts\python.exe"

Invoke-Step "Setting up Python virtual environment" {
    if (-not (Test-Path $venvPython)) {
        python -m venv venv
    }

    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r requirements.txt
}

Invoke-Step "Installing Node dependencies (server + client)" {
    Push-Location (Join-Path $repoRoot "server")
    npm install
    Pop-Location

    Push-Location (Join-Path $repoRoot "client")
    npm install
    Pop-Location
}

Invoke-Step "Preparing .env file" {
    $envFile = Join-Path $repoRoot ".env"
    $envExample = Join-Path $repoRoot ".env.example"

    if (-not (Test-Path $envFile)) {
        Copy-Item $envExample $envFile
        Write-Host "Created .env from .env.example" -ForegroundColor Green
    }
    else {
        Write-Host ".env already exists (left unchanged)" -ForegroundColor DarkYellow
    }
}

if ($UseDockerInfra) {
    Invoke-Step "Starting PostgreSQL + Redis with Docker" {
        docker compose up -d postgres redis
    }
}
else {
    Write-Step "Database/Redis"
    Write-Host "Using local PostgreSQL/Redis. Ensure they are running before API startup." -ForegroundColor DarkYellow
}

if (-not $SkipPipeline) {
    Invoke-Step "Running ML pipeline" {
        & $venvPython -m src.main
    }

    Invoke-Step "Migrating output to PostgreSQL" {
        & $venvPython -m src.migrate_to_db
    }
}
else {
    Write-Step "Skipping pipeline"
    Write-Host "SkipPipeline flag set. No model run or DB migration performed." -ForegroundColor DarkYellow
}

if (-not $NoStartServices) {
    Invoke-Step "Starting API server (new PowerShell window)" {
        Start-Process powershell -ArgumentList @(
            "-NoExit",
            "-Command",
            "Set-Location '$repoRoot\server'; node index.js"

            )
    }

    Invoke-Step "Starting frontend dev server (new PowerShell window)" {
        Start-Process powershell -ArgumentList @(
            "-NoExit",
            "-Command",
            "Set-Location '$repoRoot\client'; npm run dev"
        )
    }

    if ($Dynamic) {
        Invoke-Step "Starting dynamic scheduler (new PowerShell window)" {
            Start-Process powershell -ArgumentList @(
                "-NoExit",
                "-Command",
                "Set-Location '$repoRoot'; & '$venvPython' -m src.scheduler_service"
            )
        }
    }

    Invoke-Step "Checking API health" {
        $healthOk = $false

        for ($i = 1; $i -le 20; $i++) {
            try {
                $null = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 5
                $healthOk = $true
                break
            }
            catch {
                Start-Sleep -Seconds 1
            }
        }

        if ($healthOk) {
            Write-Host "API health check passed" -ForegroundColor Green
        }
        else {
            Write-Host "API health check not ready yet. Service may still be starting." -ForegroundColor DarkYellow
        }
    }
}
else {
    Write-Step "Service startup skipped"
    Write-Host "NoStartServices flag set. Start services manually when ready." -ForegroundColor DarkYellow
}

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "API:      http://localhost:5000"