param(
    [ValidateSet('afterFileEdit', 'stop')]
    [string]$Event = 'afterFileEdit'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'lib/hook-common.ps1')

function Read-HookStdin {
    try {
        $readTask = [System.Threading.Tasks.Task[string]]::Run([System.Func[string]]{
            [Console]::In.ReadToEnd()
        })

        if ($readTask.Wait(500)) {
            if ($readTask.IsFaulted) {
                return ''
            }

            return [string]$readTask.Result
        }
    } catch {
        return ''
    }

    return ''
}

$rawInput = Read-HookStdin

function Write-SemgrepMissingContext {
    param([string]$EventName)

    $message = @(
        'Semgrep Guardian is configured for Yum4Less, but the `semgrep` CLI is not currently available to this hook.'
        'Install and log in with Semgrep before treating security/dependency/secrets scans as run:'
        '- Install Semgrep CLI with pipx, uv, or another supported Semgrep install path.'
        '- Run `semgrep --version` to confirm it is available.'
        '- Run `semgrep login` if using Semgrep Code/Supply Chain/Secrets through Guardian.'
        '- Restart Cursor so the Semgrep MCP server and hooks reload.'
    ) -join "`n"

    if ($EventName -eq 'stop') {
        Write-HookJson @{
            followup_message = $message
        }
        return
    }

    Write-HookJson @{
        additional_context = $message
    }
}

function Write-SemgrepContext {
    param(
        [string]$EventName,
        [string]$Message
    )

    if ($EventName -eq 'stop') {
        Write-HookJson @{
            followup_message = $Message
        }
        return
    }

    Write-HookJson @{
        additional_context = $Message
    }
}

try {
    Add-PythonUserScriptsToPath

    if ([string]::IsNullOrWhiteSpace($rawInput)) {
        Write-HookJson $null
        exit 0
    }

    if (-not (Get-Command semgrep -ErrorAction SilentlyContinue)) {
        Write-SemgrepMissingContext -EventName $Event
        exit 0
    }

    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
        try {
            $payload = $rawInput | ConvertFrom-Json
        } catch {
            $payload = $null
        }
    }

    $workspaceRoot = Get-HookWorkspaceRoot -Payload $payload
    if ([string]::IsNullOrWhiteSpace($workspaceRoot)) {
        $workspaceRoot = (Get-Location).Path
    }

    $candidatePaths = Get-HookChangedPaths -Payload $payload -WorkspaceRoot $workspaceRoot
    $scanPaths = New-Object System.Collections.Generic.List[string]
    foreach ($candidatePath in @($candidatePaths)) {
        if ([string]::IsNullOrWhiteSpace($candidatePath)) {
            continue
        }

        $resolvedPath = if ([System.IO.Path]::IsPathRooted($candidatePath)) {
            $candidatePath
        } else {
            Join-Path $workspaceRoot $candidatePath
        }

        if (Test-Path -LiteralPath $resolvedPath -PathType Leaf) {
            [void]$scanPaths.Add($resolvedPath)
        }
    }

    if ($scanPaths.Count -eq 0) {
        Write-HookJson $null
        exit 0
    }

    $semgrepArgs = @(
        'scan',
        '--config', 'p/secrets',
        '--config', 'p/typescript',
        '--metrics', 'off',
        '--no-error',
        '--json',
        '--quiet'
    ) + @($scanPaths)

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $semgrepOutput = & semgrep @semgrepArgs 2>&1
        $semgrepExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    $textOutput = (@($semgrepOutput) -join "`n").Trim()
    if ($semgrepExitCode -ne 0) {
        $message = "Semgrep Guardian exited with code $semgrepExitCode."
        if (-not [string]::IsNullOrWhiteSpace($textOutput)) {
            $message = "$message`n$textOutput"
        }

        Write-SemgrepContext -EventName $Event -Message $message
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($textOutput)) {
        Write-HookJson $null
        exit 0
    }

    try {
        $semgrepJson = $textOutput | ConvertFrom-Json
        $resultCount = @($semgrepJson.results).Count
        $errorCount = @($semgrepJson.errors).Count

        if ($resultCount -eq 0 -and $errorCount -eq 0) {
            Write-HookJson $null
            exit 0
        }

        $lines = New-Object System.Collections.Generic.List[string]
        [void]$lines.Add("Semgrep scan completed with $resultCount finding(s) and $errorCount error(s).")

        foreach ($finding in @($semgrepJson.results | Select-Object -First 10)) {
            $path = [string]$finding.path
            $checkId = [string]$finding.check_id
            $message = [string]$finding.extra.message
            [void]$lines.Add("- $path [$checkId]: $message")
        }

        if ($resultCount -gt 10) {
            [void]$lines.Add("- Additional findings omitted from hook summary; run Semgrep manually for full output.")
        }

        foreach ($scanError in @($semgrepJson.errors | Select-Object -First 5)) {
            [void]$lines.Add("- Error: $($scanError.message)")
        }

        Write-SemgrepContext -EventName $Event -Message ($lines -join "`n")
        exit 0
    } catch {
        $message = "Semgrep Guardian ran, but returned non-JSON output:`n$textOutput"
        Write-SemgrepContext -EventName $Event -Message $message
        exit 0
    }
} catch {
    $message = "Semgrep Guardian hook failed open: $($_.Exception.Message)"
    Write-SemgrepContext -EventName $Event -Message $message
    exit 0
}
