$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        $payload = $rawInput | ConvertFrom-Json
    }

    $filePath = Get-HookEditedFilePath -Payload $payload
    if ([string]::IsNullOrWhiteSpace($filePath)) {
        Write-HookJson $null
        exit 0
    }

    $normalized = $filePath.Replace('\', '/')
    $lines = New-Object System.Collections.Generic.List[string]

    if ($normalized -eq 'PROJECT_CONTINUITY.md' -or $normalized -like '*/PROJECT_CONTINUITY.md') {
        [void]$lines.Add('PROJECT_CONTINUITY.md edited: keep journal format — Changelog newest-first at top, one-screen Resume, Decision log, Appendix tables; link transcripts only; do not paste chat summaries or duplicate README/AGENTS.md.')
        [void]$lines.Add('See .cursor/rules/yum4less-continuity-journal.mdc')
    }

    if (Test-FrontendOrchestrationPath -Path $normalized) {
        [void]$lines.Add("Frontend/trust file edited: $normalized")
        [void]$lines.Add('- Run npm test before done.')
        [void]$lines.Add('- If trust labels, map, carousel, or modal copy changed: npm run dev, then Playwright MCP on localhost:3000 with coordinates 37.6085, -77.3739 primary (ZIP 23111 fallback-path only).')
        [void]$lines.Add('- Consider @web-frontend-standards; use @verifier when trust wording or rollout claims changed.')
    }

    if (Test-DatabaseOrchestrationPath -Path $normalized) {
        if ($lines.Count -gt 0) {
            [void]$lines.Add('')
        }

        [void]$lines.Add("DB/ingest file edited: $normalized")
        [void]$lines.Add('- Run npm test; run npm run test:integration when merge-gating Postgres behavior changed.')
        [void]$lines.Add('- Run npm run db:up before Postgres MCP for ingest/row truth claims.')
        [void]$lines.Add('- Consider @database-codegen-standards for schema/SQL changes.')
    }

    if ($lines.Count -eq 0) {
        Write-HookJson $null
        exit 0
    }

    $touchedOrchestration = (Test-FrontendOrchestrationPath -Path $normalized) -or
        (Test-DatabaseOrchestrationPath -Path $normalized) -or
        (Test-ApiOrchestrationPath -Path $normalized) -or
        (Test-CiOrchestrationPath -Path $normalized)

    if ($touchedOrchestration -and $normalized -notlike '*PROJECT_CONTINUITY.md') {
        [void]$lines.Add('')
        [void]$lines.Add('When this slice is complete: update PROJECT_CONTINUITY.md (changelog top, Resume, Decision log / verification snapshot if applicable). No transcript dumps.')
    }

    [void]$lines.Insert(0, 'Yum4Less afterFileEdit orchestration nudge:')
    [void]$lines.Add('')
    [void]$lines.Add('Follow .cursor/rules/yum4less-agent-orchestration.mdc before saying done.')

    Write-HookJson @{
        additional_context = ($lines -join "`n")
    }
    exit 0
} catch {
    Write-HookJson $null
    exit 0
}
