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

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Is-LfOnlyFile {
  param([string]$Path)

  $content = Get-Content -Raw -LiteralPath $Path
  return -not $content.Contains("`r")
}

$gitExe = Resolve-GitExecutable
$repoRoot = (& $gitExe rev-parse --show-toplevel).Trim()
Assert-True (-not [string]::IsNullOrWhiteSpace($repoRoot)) "Failed to resolve repository root."

Set-Location $repoRoot

$hooksPath = (& $gitExe config --get core.hooksPath).Trim()
$expectedHooksPath = ".githooks"
Assert-True ($hooksPath -eq $expectedHooksPath) "core.hooksPath mismatch. expected='$expectedHooksPath', actual='$hooksPath'"

$preCommitPath = Join-Path $repoRoot ".githooks\pre-commit"
$prePushPath = Join-Path $repoRoot ".githooks\pre-push"

Assert-True (Test-Path $preCommitPath) "Missing hook file: .githooks/pre-commit"
Assert-True (Test-Path $prePushPath) "Missing hook file: .githooks/pre-push"

$preCommitContent = Get-Content -Raw -LiteralPath $preCommitPath
$prePushContent = Get-Content -Raw -LiteralPath $prePushPath

Assert-True ($preCommitContent.Contains("scripts/update-handover.ps1")) "pre-commit does not invoke update-handover.ps1"
Assert-True ($prePushContent.Contains("Direct push to main is blocked")) "pre-push guard message not found"

Assert-True (Is-LfOnlyFile -Path $preCommitPath) "pre-commit must use LF line endings"
Assert-True (Is-LfOnlyFile -Path $prePushPath) "pre-push must use LF line endings"

Write-Output "[hooks:doctor] OK"
Write-Output "- repo: $repoRoot"
Write-Output "- core.hooksPath: $hooksPath"
Write-Output "- pre-commit: present, LF-only, handover update wired"
Write-Output "- pre-push: present, LF-only, main-branch guard wired"
