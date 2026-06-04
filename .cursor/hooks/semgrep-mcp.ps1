$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

Add-PythonUserScriptsToPath

if (-not (Get-Command semgrep -ErrorAction SilentlyContinue)) {
    Write-Error 'Semgrep CLI is not available. Install Semgrep and restart Cursor before enabling the semgrep MCP server.'
    exit 1
}

& semgrep mcp
exit $LASTEXITCODE
