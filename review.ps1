[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5173,

    [ValidatePattern('^/')]
    [string]$Path = '/__dev/material',

    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$url = "http://127.0.0.1:$Port$Path"
$browserJob = $null

Push-Location -LiteralPath $repoRoot

try {
    if (-not $NoBrowser) {
        $browserJob = Start-Job -ScriptBlock {
            param($Url)

            $deadline = (Get-Date).AddSeconds(30)
            while ((Get-Date) -lt $deadline) {
                try {
                    $response = Invoke-WebRequest `
                        -UseBasicParsing `
                        -Uri $Url `
                        -TimeoutSec 1
                    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
                        $startInfo.FileName = $Url
                        $startInfo.UseShellExecute = $true
                        [void][System.Diagnostics.Process]::Start($startInfo)
                        return
                    }
                }
                catch {
                    Start-Sleep -Milliseconds 200
                }
            }

            throw 'The review server did not become ready within 30 seconds.'
        } -ArgumentList $url
    }

    Write-Host "[Bismuth] Starting the current progress view at $url"
    Write-Host '[Bismuth] Press Ctrl+C to stop the server.'
    & npm.cmd run dev -- --host 127.0.0.1 --port $Port --strictPort
    if ($LASTEXITCODE -ne 0) {
        throw "The development server exited with code $LASTEXITCODE."
    }
}
finally {
    if ($null -ne $browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }

    Pop-Location
}
