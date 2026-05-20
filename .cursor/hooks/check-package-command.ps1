$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = if ([string]::IsNullOrWhiteSpace($rawInput)) {
        $null
    } else {
        $rawInput | ConvertFrom-Json
    }
} catch {
    # Fail open if the hook input is malformed.
    @{ permission = 'allow' } | ConvertTo-Json -Compress
    exit 0
}

$command = ''

if ($null -ne $payload -and $null -ne $payload.command) {
    $command = $payload.command.ToString()
}

if ([string]::IsNullOrWhiteSpace($command)) {
    @{ permission = 'allow' } | ConvertTo-Json -Compress
    exit 0
}

$riskyPatterns = @(
    '\bnpm\s+(install|i|update|upgrade|uninstall|remove|audit\s+fix|exec)\b',
    '\bnpx\b',
    '\bpnpm\s+(add|install|update|up|remove|dlx)\b',
    '\byarn\s+(add|install|upgrade|remove|dlx)\b'
)

$mcpPatterns = @(
    '\bmcp\b',
    '@playwright/mcp',
    'github-mcp',
    'context7',
    'browserbase',
    'postman-mcp',
    '\bpostgres\b'
)

$isRisky = $false
$isMcpRelated = $false

foreach ($pattern in $riskyPatterns) {
    if ($command -match $pattern) {
        $isRisky = $true
        break
    }
}

if (-not $isRisky) {
    @{ permission = 'allow' } | ConvertTo-Json -Compress
    exit 0
}

foreach ($pattern in $mcpPatterns) {
    if ($command -match $pattern) {
        $isMcpRelated = $true
        break
    }
}

if ($isMcpRelated) {
    @{
        permission = 'ask'
        user_message = 'This command appears to add or run MCP-related tooling. Review it against the Yum4Less MCP adoption sequence before continuing.'
        agent_message = 'Yum4Less should stay lean on MCPs. Prefer native Cursor tools first, add read-only PostgreSQL MCP before other MCPs once a dev database exists, add GitHub MCP only after CI and PR workflows matter, and compare native Browser against Playwright MCP on real UI flows before installing browser MCP tooling.'
    } | ConvertTo-Json -Compress
    exit 0
}

@{
    permission = 'ask'
    user_message = 'This command installs, updates, or executes package-managed code. Review it carefully before continuing.'
    agent_message = 'Yum4Less uses a security-first, low-dependency workflow. Confirm the package or command is necessary, trustworthy, and consistent with the project''s minimal-dependency direction before running it.'
} | ConvertTo-Json -Compress
