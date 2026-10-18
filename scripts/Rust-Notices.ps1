param([string]$Destination,[switch]$FetchMissing)
$ErrorActionPreference='Stop'
$mycutRepo=Split-Path -Parent $PSScriptRoot
if (!$Destination) { $Destination=Join-Path $mycutRepo 'next/ThirdParty' }
$mycutToolchain=Join-Path (Split-Path -Parent $mycutRepo) 'MyCut-research/toolchain'
$mycutCargo=Join-Path $mycutToolchain 'cargo/bin/cargo.exe'
if (Test-Path -LiteralPath $mycutCargo) {
    $env:RUSTUP_HOME=Join-Path $mycutToolchain 'rustup'
    $env:CARGO_HOME=Join-Path $mycutToolchain 'cargo'
} else { $mycutCargo=(Get-Command cargo -ErrorAction Stop).Source }
$mycutMetadata=& $mycutCargo metadata --manifest-path (Join-Path $mycutRepo 'next/Cargo.toml') --locked --format-version 1 --filter-platform x86_64-pc-windows-msvc
if ($LASTEXITCODE) { throw 'Cargo metadata failed; notices were not declared complete.' }
$mycutGraph=($mycutMetadata -join "`n") | ConvertFrom-Json
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$mycutResolved=@{}
foreach ($mycutNode in $mycutGraph.resolve.nodes) { $mycutResolved[$mycutNode.id]=$true }
$mycutRows=@()
$mycutLicenseCache=@{}
foreach ($mycutPackage in $mycutGraph.packages) {
    if ((!$mycutPackage.source -and $mycutPackage.name -ne 'craft-ui') -or !$mycutResolved.ContainsKey($mycutPackage.id)) { continue }
    $mycutSource=Split-Path -Parent $mycutPackage.manifest_path
    $mycutPackageTarget=Join-Path $Destination "$($mycutPackage.name)-$($mycutPackage.version)"
    New-Item -ItemType Directory -Path $mycutPackageTarget -Force | Out-Null
    $mycutFiles=@(Get-ChildItem -LiteralPath $mycutSource -File -Recurse | Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS|COPYRIGHT|OFL|UFL)([._-].*)?$' })
    if ($mycutPackage.name -eq 'craft-ui') { Copy-Item -LiteralPath (Join-Path $mycutSource 'UPSTREAM.md') -Destination $mycutPackageTarget -Force }
    foreach ($mycutLicense in $mycutFiles) {
        $mycutRelative=[IO.Path]::GetRelativePath($mycutSource,$mycutLicense.FullName)
        $mycutTarget=Join-Path $mycutPackageTarget $mycutRelative
        New-Item -ItemType Directory -Path (Split-Path -Parent $mycutTarget) -Force | Out-Null
        Copy-Item -LiteralPath $mycutLicense.FullName -Destination $mycutTarget -Force
    }
    $mycutFetched=@()
    if ($FetchMissing -and $mycutFiles.Count -eq 0) {
        $mycutVcsPath=Join-Path $mycutSource '.cargo_vcs_info.json'
        if ((Test-Path -LiteralPath $mycutVcsPath) -and $mycutPackage.repository -match '^https://github.com/([^/]+/[^/]+)') {
            $mycutSlug=$Matches[1].TrimEnd('/')
            $mycutRevision=(Get-Content -LiteralPath $mycutVcsPath -Raw | ConvertFrom-Json).git.sha1
            $mycutCacheKey="$mycutSlug/$mycutRevision"
            if (!$mycutLicenseCache.ContainsKey($mycutCacheKey)) {
                $mycutTree=Invoke-RestMethod -Uri "https://api.github.com/repos/$mycutSlug/git/trees/$mycutRevision" -Headers @{'User-Agent'='MyCut-license-collector'}
                $mycutLicenseCache[$mycutCacheKey]=@($mycutTree.tree | Where-Object {$_.type -eq 'blob' -and $_.path -match '^(LICENSE|LICENCE|COPYING|NOTICE)([._-].*)?$'} | ForEach-Object {
                    $mycutUrl="https://raw.githubusercontent.com/$mycutSlug/$mycutRevision/$($_.path)"
                    $mycutResponse=Invoke-WebRequest -Uri $mycutUrl
                    [pscustomobject]@{file=$_.path;url=$mycutUrl;bytes=$mycutResponse.RawContentStream.ToArray()}
                })
            }
            foreach ($mycutRemote in $mycutLicenseCache[$mycutCacheKey]) {
                [IO.File]::WriteAllBytes((Join-Path $mycutPackageTarget $mycutRemote.file),$mycutRemote.bytes)
                $mycutFetched += $mycutRemote.url
            }
            Write-Host "Pinned upstream notices: $($mycutPackage.name) $mycutRevision"
        }
    }
    $mycutRows += [pscustomobject]@{name=$mycutPackage.name;version=$mycutPackage.version;license=$mycutPackage.license;repository=$mycutPackage.repository;source=$mycutPackage.source;copiedLicenseFiles=$mycutFiles.Count;fetchedFrom=$mycutFetched}
}
# Generated manifest, not an assertion that every license obligation was audited.
$mycutRows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Destination 'manifest.json') -Encoding utf8
$mycutRows | Group-Object license | Select-Object Count,Name | Format-Table -AutoSize
Write-Host "Collected notices for $($mycutRows.Count) resolved Windows packages in $Destination"
$mycutRows | Where-Object {$_.copiedLicenseFiles -eq 0 -and $_.fetchedFrom.Count -eq 0} | Select-Object name,version,license | Format-Table -AutoSize
