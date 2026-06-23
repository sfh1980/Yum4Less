$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        $payload = $rawInput | ConvertFrom-Json
    }

    $prompt = Get-HookUserPrompt -Payload $payload
    if ([string]::IsNullOrWhiteSpace($prompt)) {
        Write-HookJson $null
        exit 0
    }

    $lower = $prompt.ToLowerInvariant()

    if ($lower -match '@verifier|@web-frontend-standards|@web-backend-standards|@database-codegen-standards|@ingest-standards|@testing-cicd-standards|@senior-auditor') {
        Write-HookJson $null
        exit 0
    }

    $routes = @()

    function Add-Route {
        param(
            [string]$Pattern,
            [string]$Agent,
            [string]$Rephrase,
            [string]$Likely
        )

        if ($lower -match $Pattern) {
            $script:routes += [pscustomobject]@{
                Agent    = $Agent
                Rephrase = $Rephrase
                Likely   = $Likely
            }
        }
    }

    Add-Route '(ui|map|carousel|component|css|modal|trust|leaflet|accessibility|frontend|layout|meal card|store list)' '@web-frontend-standards' '@web-frontend-standards Update [specific UI] for coordinate-first fixture (37.6085, -77.3739 primary; ZIP 23111 fallback-path only); follow orchestration before done.' 'npm test; Playwright MCP after npm run dev if trust copy is visible'
    Add-Route '(api|route handler|provider|recommendation|rate limit|geocod|market-search|shopping-route|backend|validation|saniti)' '@web-backend-standards' '@web-backend-standards Fix [route/service]; keep public API read-only default and run npm test + build if routes changed.' 'npm test; npm run build when routes/imports changed'
    Add-Route '(ingest|weekly-ad|scrape|map-catalog|snap-retailer|scheduled.*ingest|parser|provider-sync|themealdb|live-scrape|live-ingest|probe:)' '@ingest-standards' '@ingest-standards [ingest/pipeline/scrape task]; npm test + test:integration when Postgres behavior changed; Postgres MCP after npm run db:up for row truth.' 'npm test; npm run test:integration; Postgres MCP'
    Add-Route '(database|schema|seed|postgres|price_observation|migration|sql|market repository)' '@database-codegen-standards' '@database-codegen-standards [schema/SQL task]; run npm run test:integration and Postgres MCP after npm run db:up when claiming row truth.' 'npm test; npm run test:integration; Postgres MCP'
    Add-Route '(ci|github actions|workflow|e2e|playwright test|release|merge-ready|pull request|\bpr\b|vitest config)' '@testing-cicd-standards' '@testing-cicd-standards [CI/test task]; inspect workflow status before claiming green.' 'GitHub MCP or gh; npm test / test:integration / test:e2e:ci as applicable'
    Add-Route '(verify|verified|trust|fresh|coverage|fallback|promotion|rollout|merge-ready|beta v1|demo-complete|deploy-ready|production-ready)' '@verifier' '@verifier Review [trust claim]; require test/MCP evidence before verified language.' '@verifier plus area-specific tests/MCP'
    Add-Route '(security|dependency|audit|secret|bola|rate limit bypass|vulnerability)' '@senior-auditor' '@senior-auditor Audit [area]; do not claim safe without evidence.' 'review + npm test for security-sensitive routes'

    if ($routes.Count -eq 0) {
        if ($lower -match '(fix|implement|add|update|refactor|debug|ship|finish|beta v1|yum4less)') {
            $routes += [pscustomobject]@{
                Agent    = '@web-backend-standards or the area-specific agent from the orchestration trigger table'
                Rephrase = 'Start with the matching @ agent from .cursor/rules/yum4less-agent-orchestration.mdc; end with: follow orchestration before done.'
                Likely   = 'npm test at minimum'
            }
        } else {
            Write-HookJson $null
            exit 0
        }
    }

    $uniqueRoutes = $routes | Select-Object -Unique Agent, Rephrase, Likely
    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add('Yum4Less prompt routing (beforeSubmitPrompt):')
    [void]$lines.Add('The user did not @ a project agent. At the start of your response, include a short **Routing** section with:')
    [void]$lines.Add('- suggested @ agent (if applicable)')
    [void]$lines.Add('- one optional rephrased prompt the user can paste next time')
    [void]$lines.Add('- likely tests/MCP for this slice')
    [void]$lines.Add('Skip the Routing section only for trivial acknowledgments or when the user already picked the right @ agent.')
    [void]$lines.Add('')

    foreach ($route in $uniqueRoutes) {
        [void]$lines.Add("- Suggested agent: $($route.Agent)")
        [void]$lines.Add("  Rephrase: $($route.Rephrase)")
        [void]$lines.Add("  Likely gates: $($route.Likely)")
    }

    [void]$lines.Add('')
    [void]$lines.Add('Reference: AGENTS.md agent index and .cursor/rules/yum4less-agent-orchestration.mdc trigger table')

    Write-HookJson @{
        additional_context = ($lines -join "`n")
    }
    exit 0
} catch {
    Write-HookJson $null
    exit 0
}
