function Get-HookWorkspaceRoot {
    param($Payload)

    $roots = @()

    if ($null -ne $Payload -and $null -ne $Payload.workspace_roots) {
        $roots += @($Payload.workspace_roots)
    }

    if ($env:CURSOR_PROJECT_DIR) {
        $roots += $env:CURSOR_PROJECT_DIR
    }

    if ($env:CLAUDE_PROJECT_DIR) {
        $roots += $env:CLAUDE_PROJECT_DIR
    }

    $root = $roots |
        Where-Object { $_ -and $_.ToString().Trim() } |
        ForEach-Object { $_.ToString().Trim() } |
        Select-Object -First 1

    if ($root -and (Test-Path -LiteralPath $root -PathType Container)) {
        return $root
    }

    return $null
}

function Get-HookUserPrompt {
    param($Payload)

    if ($null -eq $Payload) {
        return $null
    }

    foreach ($key in @('prompt', 'user_prompt', 'message', 'text', 'content')) {
        if ($null -ne $Payload.$key -and -not [string]::IsNullOrWhiteSpace([string]$Payload.$key)) {
            return [string]$Payload.$key
        }
    }

    return $null
}

function Get-HookEditedFilePath {
    param($Payload)

    if ($null -eq $Payload) {
        return $null
    }

    foreach ($key in @('file_path', 'path', 'filePath', 'edited_file', 'editedFile')) {
        if ($null -ne $Payload.$key -and -not [string]::IsNullOrWhiteSpace([string]$Payload.$key)) {
            return ([string]$Payload.$key).Replace('\', '/')
        }
    }

    return $null
}

function Get-HookChangedPaths {
    param(
        $Payload,
        [string]$WorkspaceRoot
    )

    $paths = New-Object System.Collections.Generic.HashSet[string]

    function Add-PathCandidate {
        param([string]$Candidate)

        if ([string]::IsNullOrWhiteSpace($Candidate)) {
            return
        }

        $normalized = $Candidate.Replace('\', '/').Trim()

        if ($normalized.StartsWith('./')) {
            $normalized = $normalized.Substring(2)
        }

        [void]$paths.Add($normalized)
    }

    $directFile = Get-HookEditedFilePath -Payload $Payload
    if ($directFile) {
        Add-PathCandidate $directFile
    }

    foreach ($key in @('edited_files', 'file_paths', 'changed_files', 'files', 'paths')) {
        $value = $Payload.$key
        if ($null -eq $value) {
            continue
        }

        foreach ($item in @($value)) {
            if ($item -is [string]) {
                Add-PathCandidate $item
                continue
            }

            if ($null -ne $item.path) {
                Add-PathCandidate ([string]$item.path)
            } elseif ($null -ne $item.file_path) {
                Add-PathCandidate ([string]$item.file_path)
            }
        }
    }

    if ($WorkspaceRoot -and (Test-Path -LiteralPath (Join-Path $WorkspaceRoot '.git') -PathType Container)) {
        $gitArgs = @('-C', $WorkspaceRoot, 'diff', '--name-only', 'HEAD')
        try {
            $output = & git @gitArgs 2>$null
            foreach ($line in @($output)) {
                Add-PathCandidate $line
            }
        } catch {
            # Fail open when git is unavailable.
        }
    }

    return @($paths)
}

function Test-OrchestrationPath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    $normalized = $Path.Replace('\', '/')

    return (
        $normalized -match '^(src/|db/|e2e/|\.github/workflows/)' -or
        $normalized -match '/(src/|db/|e2e/|\.github/workflows/)'
    )
}

function Test-FrontendOrchestrationPath {
    param([string]$Path)

    $normalized = $Path.Replace('\', '/')

    return (
        $normalized -match '(^|/)(src/components/|src/app/globals\.css|src/app/page\.tsx|src/app/layout\.tsx|e2e/)' -or
        $normalized -match '^src/app/globals\.css$'
    )
}

function Test-DatabaseOrchestrationPath {
    param([string]$Path)

    $normalized = $Path.Replace('\', '/')

    return (
        $normalized -match '(^|/)(db/|src/lib/market-repository|src/lib/weekly-ad-ingestion/|src/lib/price-observation)' -or
        $normalized -match '(^|/)scripts/.*weekly' -or
        $normalized -match '(^|/)vitest\.integration\.config\.ts$'
    )
}

function Test-ApiOrchestrationPath {
    param([string]$Path)

    $normalized = $Path.Replace('\', '/')
    return $normalized -match '(^|/)(src/app/api/|src/lib/recommendation-service|src/lib/provider-|src/lib/providers/|src/lib/public-api-|src/lib/rate-limit)'
}

function Test-CiOrchestrationPath {
    param([string]$Path)

    $normalized = $Path.Replace('\', '/')
    return $normalized -match '(^|/)\.github/workflows/'
}

function Test-TcpPortOpen {
    param(
        [string]$HostName = '127.0.0.1',
        [int]$Port = 5433,
        [int]$TimeoutMs = 400
    )

    $client = $null

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $connect = $client.BeginConnect($HostName, $Port, $null, $null)
        $completed = $connect.AsyncWaitHandle.WaitOne($TimeoutMs)

        if ($completed -and $client.Connected) {
            return $true
        }
    } catch {
        return $false
    } finally {
        if ($null -ne $client) {
            $client.Close()
        }
    }

    return $false
}

function Write-HookJson {
    param($Object)

    if ($null -eq $Object -or ($Object -is [hashtable] -and $Object.Count -eq 0)) {
        Write-Output '{}'
        return
    }

    $Object | ConvertTo-Json -Compress
}
