[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('prepare', 'verify', 'build', 'cleanup')]
    [string]$Action,
    [string]$Builder,
    [string]$BaseCommit,
    [ValidateSet('true', 'false')]
    [string]$Dirty,
    [string]$Workspace,
    [string]$EnvFile
)

# Opt-in only. No automatic invocation from the ordinary command sheet.
# The Node owner validates paths, inputs, command results and captured context.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$captureScript = Join-Path $PSScriptRoot '..\mofacts\scripts\security-audit\qualification\captureBuildSource.mjs'
$captureArgs = @($captureScript, $Action)
if ($Builder) { $captureArgs += @('--builder', $Builder) }
if ($BaseCommit) { $captureArgs += @('--base-commit', $BaseCommit) }
if ($Dirty) { $captureArgs += @('--dirty', $Dirty) }
if ($Workspace) { $captureArgs += @('--workspace', $Workspace) }
if ($EnvFile) { $captureArgs += @('--env-file', $EnvFile) }

& node @captureArgs
$captureExitCode = $LASTEXITCODE
if ($captureExitCode -ne 0) {
    throw 'Build-source operation failed; no qualification was issued.'
}
