$ErrorActionPreference = 'Stop'

$rawInput = [Console]::In.ReadToEnd()

try {
    $server = $null

    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        $payload = $rawInput | ConvertFrom-Json

        foreach ($key in @('server', 'server_name', 'mcp_server', 'tool_name', 'toolName')) {
            if ($null -ne $payload.$key -and -not [string]::IsNullOrWhiteSpace([string]$payload.$key)) {
                $server = [string]$payload.$key
                break
            }
        }
    }

    $message = if ($server) {
        "Before CallMcpTool against '$server': read the tool schema under mcps/<server>/tools/ and honor Yum4Less orchestration prerequisites."
    } else {
        'Before CallMcpTool: read the MCP tool schema under mcps/<server>/tools/ before calling. Postgres needs npm run db:up; Playwright needs npm run dev on localhost:3000.'
    }

    @{
        permission    = 'allow'
        agent_message = $message
    } | ConvertTo-Json -Compress
    exit 0
} catch {
    Write-Output '{ "permission": "allow" }'
    exit 0
}
