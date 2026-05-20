$rawInput = [Console]::In.ReadToEnd()

try {
    $payload = if ([string]::IsNullOrWhiteSpace($rawInput)) {
        $null
    } else {
        $rawInput | ConvertFrom-Json
    }
} catch {
    # Fail open if the hook input is malformed.
    Write-Output '{}'
    exit 0
}

$roots = @()

if ($null -ne $payload -and $null -ne $payload.workspace_roots) {
    $roots += @($payload.workspace_roots)
}

if ($env:CURSOR_PROJECT_DIR) {
    $roots += $env:CURSOR_PROJECT_DIR
}

if ($env:CLAUDE_PROJECT_DIR) {
    $roots += $env:CLAUDE_PROJECT_DIR
}

$roots = $roots |
    Where-Object { $_ -and $_.ToString().Trim() } |
    ForEach-Object { $_.ToString().Trim() } |
    Select-Object -Unique

if ($roots.Count -eq 0) {
    Write-Output '{}'
    exit 0
}

$missingReadmeRoots = @()

foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        continue
    }

    $hasReadme = Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^README(\..+)?$' } |
        Select-Object -First 1

    if (-not $hasReadme) {
        $missingReadmeRoots += $root
    }
}

if ($missingReadmeRoots.Count -eq 0) {
    Write-Output '{}'
    exit 0
}

$context = @(
    "No README file was found at the workspace root for:"
    ($missingReadmeRoots | ForEach-Object { "- $_" })
    "If documentation would help this project, ask the user for the project's goals, setup steps, key commands, architecture, and conventions before drafting a README."
) -join "`n"

@{
    additional_context = $context
} | ConvertTo-Json -Compress
