$ErrorActionPreference = "Stop"

function Resolve-GitExecutable {
  $candidates = @(
    "git",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe"
  )

  foreach ($candidate in $candidates) {
    try {
      & $candidate --version *> $null
      if ($LASTEXITCODE -eq 0) {
        return $candidate
      }
    } catch {
      # try next candidate
    }
  }

  throw "Git executable not found. Please install Git or add it to PATH."
}

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args,
    [string]$Fallback = ""
  )

  try {
    $output = & $script:GitExe @Args 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $Fallback
    }
    return (($output | Out-String).TrimEnd())
  } catch {
    return $Fallback
  }
}

function To-Bullets {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @("- (none)")
  }

  return $Text -split "\r?\n" |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { "- $($_.Trim())" }
}

function Filter-HandoverPathFromList {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  return (($Text -split "\r?\n") |
    Where-Object {
      $line = $_.Trim()
      -not [string]::IsNullOrWhiteSpace($line) -and $line -ne "docs/09_handover_status.txt"
    }) -join "`n"
}

function Convert-RemoteToGithubUrl {
  param([string]$RemoteUrl)

  if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
    return ""
  }

  if ($RemoteUrl.StartsWith("https://github.com/")) {
    return ($RemoteUrl -replace "\.git$", "")
  }

  $sshMatch = [regex]::Match($RemoteUrl, "^git@github\.com:(.+)$")
  if ($sshMatch.Success) {
    return "https://github.com/" + ($sshMatch.Groups[1].Value -replace "\.git$", "")
  }

  return ""
}

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-LatestCiSummary {
  param(
    [string]$GithubRepoUrl,
    [string]$BranchName
  )

  if ([string]::IsNullOrWhiteSpace($GithubRepoUrl) -or [string]::IsNullOrWhiteSpace($BranchName)) {
    return "(unavailable)"
  }

  $repoPath = $GithubRepoUrl -replace "^https://github.com/", ""
  $apiUrl = "https://api.github.com/repos/$repoPath/actions/runs?branch=$BranchName&per_page=1"

  try {
    $response = Invoke-RestMethod -Method Get -Uri $apiUrl -Headers @{ "User-Agent" = "ai-rookie-handover" } -TimeoutSec 8
    if ($null -eq $response.workflow_runs -or $response.workflow_runs.Count -eq 0) {
      return "(no runs found)"
    }

    $run = $response.workflow_runs[0]
    $status = if ([string]::IsNullOrWhiteSpace($run.status)) { "unknown" } else { $run.status }
    $conclusion = if ([string]::IsNullOrWhiteSpace($run.conclusion)) { "n/a" } else { $run.conclusion }
    return "$($run.name): $status/$conclusion ($($run.html_url))"
  } catch {
    return "(unavailable)"
  }
}

$manualStart = "### [MANUAL NOTES START]"
$manualEnd = "### [MANUAL NOTES END]"

$GitExe = Resolve-GitExecutable
$repoRoot = Invoke-Git -Args @("rev-parse", "--show-toplevel") -Fallback (Get-Location).Path
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  $repoRoot = (Get-Location).Path
}

Set-Location $repoRoot

$handoverPath = Join-Path $repoRoot "docs\09_handover_status.txt"
$existingText = ""
if (Test-Path $handoverPath) {
  $existingText = Get-Content -Raw -Encoding UTF8 $handoverPath
}

$manualMemo = "- Add next-turn tasks here`n- Add blockers/risk notes here"
if (-not [string]::IsNullOrWhiteSpace($existingText)) {
  $pattern = [regex]::Escape($manualStart) + "(.*?)" + [regex]::Escape($manualEnd)
  $match = [regex]::Match($existingText, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($match.Success) {
    $candidate = $match.Groups[1].Value.Trim()
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      $manualMemo = $candidate
    }
  }
}

$tz = [TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
$nowKst = [TimeZoneInfo]::ConvertTime((Get-Date), $tz).ToString("yyyy-MM-dd HH:mm:ss 'KST'")

$branch = Invoke-Git -Args @("rev-parse", "--abbrev-ref", "HEAD") -Fallback "(unknown)"
$upstream = Invoke-Git -Args @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") -Fallback "(none)"
$latestCommit = Invoke-Git -Args @("log", "-1", "--oneline", "--decorate") -Fallback "(none)"
$recentCommits = Invoke-Git -Args @("log", "--oneline", "--decorate", "-n", "8") -Fallback ""
$statusShortBranch = Invoke-Git -Args @("status", "--short", "--branch") -Fallback "(status unavailable)"
$stagedFiles = Filter-HandoverPathFromList -Text (Invoke-Git -Args @("diff", "--cached", "--name-only") -Fallback "")
$unstagedFiles = Filter-HandoverPathFromList -Text (Invoke-Git -Args @("diff", "--name-only") -Fallback "")
$untrackedFiles = Invoke-Git -Args @("ls-files", "--others", "--exclude-standard") -Fallback ""
$isClean = [string]::IsNullOrWhiteSpace((Invoke-Git -Args @("status", "--porcelain") -Fallback ""))

$remoteUrl = Invoke-Git -Args @("remote", "get-url", "origin") -Fallback ""
$githubRepoUrl = Convert-RemoteToGithubUrl -RemoteUrl $remoteUrl
$latestCiSummary = Get-LatestCiSummary -GithubRepoUrl $githubRepoUrl -BranchName $branch
$prUrl = if ($branch -eq "main") {
  "(not applicable on main)"
} elseif (-not [string]::IsNullOrWhiteSpace($githubRepoUrl) -and $branch -ne "HEAD" -and $branch -ne "(unknown)") {
  "$githubRepoUrl/pull/new/$branch"
} else {
  "(unavailable)"
}

$lines = @(
  "[AI-Rookie Auto Handover]"
  "Auto-updated: $nowKst"
  ""
  "1) Branch Sync"
  "- Current branch: $branch"
  "- Upstream: $upstream"
  "- Latest commit at update time: $latestCommit"
  "- Latest CI run: $latestCiSummary"
  "- PR link: $prUrl"
  ""
  "2) Working Tree"
  "- Clean: $(if ($isClean) { "yes" } else { "no" })"
  "- git status --short --branch"
)

$lines += To-Bullets -Text $statusShortBranch
$lines += @(
  ""
  "3) Recent Commits (max 8)"
)
$lines += To-Bullets -Text $recentCommits
$lines += @(
  ""
  "4) Staged Files"
)
$lines += To-Bullets -Text $stagedFiles
$lines += @(
  ""
  "5) Unstaged Files"
)
$lines += To-Bullets -Text $unstagedFiles
$lines += @(
  ""
  "6) Untracked Files"
)
$lines += To-Bullets -Text $untrackedFiles
$lines += @(
  ""
  "7) Manual Notes"
  $manualStart
)
$lines += $manualMemo -split "\r?\n"
$lines += @(
  $manualEnd
  ""
  "8) Quick Commands"
  "- status: git status --short --branch"
  "- check: npm run check"
  "- smoke: npm run smoke"
  "- manual refresh: npm run handover:update"
  ""
)

$content = $lines -join "`r`n"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $handoverPath) | Out-Null
Write-Utf8NoBomFile -Path $handoverPath -Content $content
