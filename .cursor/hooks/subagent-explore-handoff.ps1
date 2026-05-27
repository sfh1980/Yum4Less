$ErrorActionPreference = 'Stop'

$rawInput = [Console]::In.ReadToEnd()

try {
    $message = @(
        'The explore subagent finished. Before editing:'
        '- Apply the scoped workflow rule for the files you will change (frontend, API, or DB/ingest).'
        '- For multi-file MVP work, keep one slice per chat when possible.'
        '- Follow yum4less-agent-orchestration.mdc before saying done (npm test; MCP/agents when triggered).'
        '- Open your next user-facing reply with a Routing section if the user did not already @ the right project agent.'
    ) -join "`n"

    @{
        followup_message = $message
    } | ConvertTo-Json -Compress
    exit 0
} catch {
    Write-Output '{}'
    exit 0
}
