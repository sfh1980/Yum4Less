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

    if (Test-FrontendOrchestrationPath -Path $normalized) {
        [void]$lines.Add("Frontend/trust file edited: $normalized")
        [void]$lines.Add('- Run npm test before done.')
        [void]$lines.Add('- If trust labels, map, carousel, or modal copy changed: npm run dev, then Playwright MCP on localhost:3000 with ZIP 23111.')
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
