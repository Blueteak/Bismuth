$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$BindHost = "127.0.0.1"
$StartPort = 4173
$EndPort = 4190
$PreviewProcess = $null

Set-Location -LiteralPath $RepoRoot

function Pause-BeforeExit {
  if ([Environment]::UserInteractive) {
    Write-Host ""
    Read-Host "Press Enter to close this window"
  }
}

function Get-NpmCommand {
  $NpmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($NpmCommand) {
    return $NpmCommand.Source
  }

  $NpmCommand = Get-Command "npm" -ErrorAction SilentlyContinue
  if ($NpmCommand) {
    return $NpmCommand.Source
  }

  throw "Could not find npm. Install Node.js, then run this launcher again."
}

function Test-PortIsFree {
  param(
    [int]$Port
  )

  $Address = [System.Net.IPAddress]::Parse($BindHost)
  $Listener = [System.Net.Sockets.TcpListener]::new($Address, $Port)

  try {
    $Listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $Listener.Stop()
  }
}

function Get-PreviewPort {
  for ($Port = $StartPort; $Port -le $EndPort; $Port++) {
    if (Test-PortIsFree -Port $Port) {
      return $Port
    }
  }

  throw "No available preview port found between $StartPort and $EndPort."
}

function Wait-ForServer {
  param(
    [string]$Url,
    [System.Diagnostics.Process]$Process
  )

  for ($Attempt = 0; $Attempt -lt 60; $Attempt++) {
    if ($Process.HasExited) {
      return $false
    }

    try {
      $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  return $false
}

try {
  $Npm = Get-NpmCommand
  $Port = Get-PreviewPort
  $Url = "http://${BindHost}:$Port/"

  Write-Host "Building production bundle..."
  & $Npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
  }

  Write-Host ""
  Write-Host "Starting local build server at $Url"
  $PreviewProcess = Start-Process `
    -FilePath $Npm `
    -ArgumentList @("run", "preview", "--", "--port", "$Port", "--strictPort") `
    -NoNewWindow `
    -PassThru

  if (Wait-ForServer -Url $Url -Process $PreviewProcess) {
    Start-Process $Url
    Write-Host "Browser opened. Leave this window open while using the app."
    Write-Host "Press Ctrl+C here to stop the local server."
  } else {
    throw "Preview server did not start successfully."
  }

  $PreviewProcess.WaitForExit()
  exit $PreviewProcess.ExitCode
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message
  Pause-BeforeExit
  exit 1
} finally {
  if ($PreviewProcess -and -not $PreviewProcess.HasExited) {
    Stop-Process -Id $PreviewProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
