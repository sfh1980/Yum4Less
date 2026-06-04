$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        $payload = $rawInput | ConvertFrom-Json
    }

    Add-PythonUserScriptsToPath

    $postgresUp = Test-TcpPortOpen -HostName '127.0.0.1' -Port 5433
    $devServerUp = Test-TcpPortOpen -HostName '127.0.0.1' -Port 3000
    $semgrepAvailable = [bool](Get-Command semgrep -ErrorAction SilentlyContinue)

    $postgresStatus = if ($postgresUp) {
        'Postgres port 5433: reachable (likely npm run db:up already done).'
    } else {
        'Postgres port 5433: not reachable - run npm run db:up before Postgres MCP.'
    }

    $devStatus = if ($devServerUp) {
        'Dev server port 3000: reachable (likely npm run dev already running).'
    } else {
        'Dev server port 3000: not reachable - run npm run dev before Playwright MCP.'
    }

    $semgrepStatus = if ($semgrepAvailable) {
        'Semgrep CLI: available for Guardian hooks/MCP.'
    } else {
        'Semgrep CLI: unavailable - install/login before treating Semgrep Guardian scans as passed.'
    }

    $context = @(
        'Yum4Less agent orchestration is active for this workspace.'
        ''
        'Before marking implementation work done, follow:'
        '- AGENTS.md (repo root)'
        '- .cursor/rules/yum4less-agent-orchestration.mdc'
        ''
        'MVP shoring-up phase is active: do not claim MVP-complete without ZIP 23111 core loop evidence, trust/fallback labels, npm test, and integration/e2e where the slice touches DB/CI.'
        ''
        'Session MCP preflight:'
        "- $postgresStatus"
        "- $devStatus"
        '- GitHub MCP: requires GITHUB_PERSONAL_ACCESS_TOKEN in user env (never commit tokens)'
        "- $semgrepStatus"
        ''
        'When the user asks an implementation/debug/verification question and did not @ a project agent, open your response with a short Routing section: suggested @ agent, optional rephrased prompt, likely tests/MCP.'
        ''
        'Invoke project agents with @verifier, @web-frontend-standards, @web-backend-standards, @database-codegen-standards, or @testing-cicd-standards when the orchestration trigger table applies.'
        ''
        'Do not claim verified, CI green, or merge-ready without test/MCP evidence.'
    ) -join "`n"

    Write-HookJson @{
        additional_context = $context
    }
    exit 0
} catch {
    Write-HookJson $null
    exit 0
}
