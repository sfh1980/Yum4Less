$ErrorActionPreference = 'Stop'

# Launch official GitHub MCP over Docker stdio.
# Token resolution (never printed):
#   1) GITHUB_PERSONAL_ACCESS_TOKEN in the process environment
#   2) fallback: `gh auth token` (same keyring session as the gh CLI)

function Resolve-GitHubMcpToken {
    if ($env:GITHUB_PERSONAL_ACCESS_TOKEN -and $env:GITHUB_PERSONAL_ACCESS_TOKEN.Trim().Length -gt 0) {
        return $env:GITHUB_PERSONAL_ACCESS_TOKEN.Trim()
    }

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Error @(
            'GitHub MCP: GITHUB_PERSONAL_ACCESS_TOKEN is unset and gh CLI was not found.',
            'Set a fine-grained PAT in your user environment, or install GitHub CLI and run: gh auth login'
        ) -join ' '
        exit 1
    }

    $fromGh = & gh auth token 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $fromGh -or $fromGh.Trim().Length -eq 0) {
        Write-Error @(
            'GitHub MCP: could not resolve a token.',
            'Set GITHUB_PERSONAL_ACCESS_TOKEN for the Cursor process, or run: gh auth login'
        ) -join ' '
        exit 1
    }

    return $fromGh.Trim()
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'GitHub MCP: Docker is required (docker run ghcr.io/github/github-mcp-server).'
    exit 1
}

$token = Resolve-GitHubMcpToken
$env:GITHUB_PERSONAL_ACCESS_TOKEN = $token

# Explicit stdio subcommand — bare image entry is fragile across server versions.
& docker @(
    'run',
    '-i',
    '--rm',
    '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN',
    'ghcr.io/github/github-mcp-server',
    'stdio'
)
exit $LASTEXITCODE
