param([switch]$Test)
$ErrorActionPreference='Stop'
$mycutRepo=Split-Path -Parent $PSScriptRoot
$mycutResearch=Join-Path (Split-Path -Parent $mycutRepo) 'MyCut-research'
$mycutIsolated=Join-Path $mycutResearch 'toolchain'
$mycutCargo=Join-Path $mycutIsolated 'cargo/bin/cargo.exe'
if (Test-Path -LiteralPath $mycutCargo) {
    $env:RUSTUP_HOME=Join-Path $mycutIsolated 'rustup'
    $env:CARGO_HOME=Join-Path $mycutIsolated 'cargo'
} else {
    $mycutCargo=(Get-Command cargo -ErrorAction Stop).Source
}
$env:CARGO_BUILD_JOBS='4'
$env:CARGO_TARGET_DIR=Join-Path $mycutRepo 'next/target'
Push-Location (Join-Path $mycutRepo 'next')
try {
    if ($Test) {
        & $mycutCargo test --workspace --locked
        if ($LASTEXITCODE) { throw 'Rust tests failed.' }
    }
    & $mycutCargo build --package mycut-next --locked
    if ($LASTEXITCODE) { throw 'Rust editor build failed.' }
    Write-Host 'MyCut Next ready: next/target/debug/mycut-next.exe'
} finally { Pop-Location }
