# MindPulse Start Script
# Starts both backend and frontend servers

param(
    [switch]$FrontendOnly,
    [switch]$BackendOnly,
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$projectRoot = "D:\Projects\Algoquest\mini"
$backendDir = "$projectRoot\backend"
$frontendDir = "$projectRoot\frontend"

function Start-Backend {
    Write-Host "Starting MindPulse Backend on port 5000..." -ForegroundColor Cyan
    $backendProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000" -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru
    return $backendProcess
}

function Start-Frontend {
    Write-Host "Starting MindPulse Frontend on port 3000..." -ForegroundColor Cyan
    $frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru
    return $frontendProcess
}

function Test-Port {
    param([int]$Port)
    $tcpConnection = New-Object System.Net.Sockets.TcpClient
    try {
        $tcpConnection.Connect("localhost", $Port)
        return $true
    } catch {
        return $false
    } finally {
        $tcpConnection.Close()
    }
}

# Main execution
$running = @()

try {
    # Stop any existing servers
    Write-Host "Checking for existing servers..." -ForegroundColor Yellow
    Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*next*" -or $_.CommandLine -like "*next*dev*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    if (-not $FrontendOnly) {
        # Start backend first
        if (-not (Test-Port -Port 5000)) {
            $running += Start-Backend
            Start-Sleep -Seconds 5
        } else {
            Write-Host "Backend already running on port 5000" -ForegroundColor Green
        }
    }

    if (-not $BackendOnly) {
        # Start frontend
        if (-not (Test-Port -Port 3000)) {
            $running += Start-Frontend
            Start-Sleep -Seconds 8
        } else {
            Write-Host "Frontend already running on port 3000" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "MindPulse is running!" -ForegroundColor Green
    Write-Host "  Backend: http://localhost:5000" -ForegroundColor White
    Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to stop servers" -ForegroundColor Yellow

    # Wait for interrupt
    while ($true) {
        Start-Sleep -Seconds 5
        
        # Check if processes are still running
        $backendRunning = $running | Where-Object { $_.Id -and -not $_.HasExited }
        if (-not $backendRunning) {
            Write-Host "Backend stopped, shutting down..." -ForegroundColor Yellow
            break
        }
    }

} finally {
    # Cleanup on exit
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    foreach ($proc in $running) {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}