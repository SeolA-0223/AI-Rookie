$ErrorActionPreference = "Stop"

function Resolve-GitExecutable {
  $candidates = @(
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe"
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

$gitExe = Resolve-GitExecutable
$repoRoot = & $gitExe rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Failed to resolve repository root."
}

Set-Location $repoRoot.Trim()
& $gitExe config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
  throw "Failed to set core.hooksPath."
}

Write-Output "[hooks] core.hooksPath set to .githooks"
