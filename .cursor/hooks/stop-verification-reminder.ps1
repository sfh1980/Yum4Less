$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        $payload = $rawInput | ConvertFrom-Json
    }

    $workspaceRoot = Get-HookWorkspaceRoot -Payload $payload
    $changedPaths = Get-HookChangedPaths -Payload $payload -WorkspaceRoot $workspaceRoot
    $orchestrationPaths = @($changedPaths | Where-Object { Test-OrchestrationPath -Path $_ })

    if ($orchestrationPaths.Count -eq 0) {
        Write-HookJson $null
        exit 0
    }

    $needsFrontend = @($orchestrationPaths | Where-Object { Test-FrontendOrchestrationPath -Path $_ }).Count -gt 0
    $needsDatabase = @($orchestrationPaths | Where-Object { Test-DatabaseOrchestrationPath -Path $_ }).Count -gt 0
    $needsApi = @($orchestrationPaths | Where-Object { Test-ApiOrchestrationPath -Path $_ }).Count -gt 0
    $needsCi = @($orchestrationPaths | Where-Object { Test-CiOrchestrationPath -Path $_ }).Count -gt 0

    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add('Before you finish this turn: orchestration paths changed in this workspace. Confirm you completed the Yum4Less checklist for the touched areas.')
    [void]$lines.Add('')
    [void]$lines.Add("Changed paths include: $($orchestrationPaths -join ', ')")
    [void]$lines.Add('')
    [void]$lines.Add('You are not done until npm test has been run and the pass count stated.')
    [void]$lines.Add('')
    [void]$lines.Add('Forbidden claims without test/MCP evidence: verified, production-ready, deploy-ready, CI green, beta v1 demo-complete, cheapest, best deal, guaranteed, save money, high confidence, fresh, live prices on search, stable, reliable.')

    if ($needsApi -or $needsCi) {
        [void]$lines.Add('API/CI touched: npm run build when routes/imports changed; route/security tests must pass; use @web-backend-standards for non-trivial API edits.')
        [void]$lines.Add('Phase 1 correctness: distinguish empty (filters) vs unavailable (dependency failure) — never ok:true empty arrays on backend failure; single snapshot/market pass-through per rank request. See yum4less-backend-api-workflow.mdc.')
    }

    if ($needsDatabase) {
        [void]$lines.Add('DB/ingest touched: npm run test:integration when Postgres merge behavior changed; Postgres MCP after npm run db:up for row/ingest truth claims; @database-codegen-standards for schema/SQL.')
        [void]$lines.Add('Phase 1 ingest: log specific row on persist failure; non-zero exit on chain-wide failure; separate skip vs fail counts. See yum4less-database-ingest-workflow.mdc.')
    }

    if ($needsFrontend) {
        [void]$lines.Add('UI/trust touched: Playwright MCP after npm run dev when Vitest alone is insufficient; @web-frontend-standards; @verifier when trust copy or rollout claims changed.')
        [void]$lines.Add('Phase 1 frontend: request-generation/AbortController for search+rank+geolocation (see multi-store-route-panel.tsx); error.tsx boundary; map async try/catch; notice+results both render. See yum4less-frontend-workflow.mdc.')
    }

    if ($needsCi) {
        [void]$lines.Add('CI touched: inspect workflow results with GitHub MCP or gh before claiming CI green or merge-ready.')
    }

    [void]$lines.Add('')
    [void]$lines.Add('Continuity journal: if this slice changed product behavior, architecture, trust, ingest, or verification gates, update PROJECT_CONTINUITY.md before done — changelog at top (newest first), refresh Resume, update Decision log / Verification snapshot as needed; no chat summaries (transcript index links only). See .cursor/rules/yum4less-continuity-journal.mdc')
    [void]$lines.Add('')
    [void]$lines.Add('Use @verifier before verified or merge-ready language on trust-sensitive behavior.')
    [void]$lines.Add('Reference: AGENTS.md and .cursor/rules/yum4less-agent-orchestration.mdc')

    Write-HookJson @{
        followup_message = ($lines -join "`n")
    }
    exit 0
} catch {
    Write-HookJson $null
    exit 0
}
