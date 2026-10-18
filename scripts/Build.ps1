param([switch]$NativeOnly, [switch]$Test, [switch]$Clean, [string]$OutputDirectory='out/MyCut')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (!(Test-Path $vswhere)) { throw 'Visual Studio Installer / C++ tools not found.' }
    $vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (!$vs) { throw 'Install Visual Studio Desktop development with C++ and Windows SDK.' }
    $vcvars = Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat'
    $cmake = Join-Path $vs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
    $ctest = Join-Path (Split-Path $cmake) 'ctest.exe'
    $ninja = Join-Path $vs 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe'
    # Prefer English diagnostics when the installation provides them.
    $env:VSLANG = '1033'
    foreach ($tool in @($vcvars,$cmake,$ninja)) { if (!(Test-Path $tool)) { throw "Missing build tool: $tool" } }
    & $env:ComSpec /d /c "call `"$vcvars`" >nul && `"$cmake`" -S . -B build/native -G Ninja -DCMAKE_BUILD_TYPE=Debug `"-DCMAKE_CXX_FLAGS_DEBUG=/Z7 /Od /RTC1`" `"-DCMAKE_MAKE_PROGRAM=$ninja`""
    if ($LASTEXITCODE) { throw 'Native configure failed.' }
    $cleanArgument = if ($Clean) { ' --clean-first' } else { '' }
    & $env:ComSpec /d /c "call `"$vcvars`" >nul && `"$cmake`" --build build/native$cleanArgument"
    if ($LASTEXITCODE) { throw 'Native build failed.' }
    if ($Test) {
        & $ctest --test-dir build/native --output-on-failure
        if ($LASTEXITCODE) { throw 'Native tests failed.' }
    }
    if (!$NativeOnly) {
        & dotnet build editor/MyCut.Editor.csproj --configuration Debug --output $OutputDirectory --nologo
        if ($LASTEXITCODE) { throw 'Editor build failed.' }
        Copy-Item -LiteralPath 'build/native/MyCutNative.dll' -Destination (Join-Path $OutputDirectory 'MyCutNative.dll') -Force
        Write-Host "MyCut ready: $(Join-Path $repo $OutputDirectory)\MyCut.exe"
    }
} finally { Pop-Location }
