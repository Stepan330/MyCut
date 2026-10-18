# MyCut — сборка Windows x64

## Требования

- Windows x64 с Direct3D 11; аппаратный backend или WARP.
- Visual Studio с **Desktop development with C++**, Windows SDK, CMake и Ninja.
- .NET SDK 10 и Desktop Runtime 10 (WPF).
- Windows PowerShell 5.1 или PowerShell 7.

Пакеты NuGet, готовые игровые движки и внешние SDK в первой сборке не нужны. Имеющиеся Windows/.NET reference packs используются локально.

## Сборка

Из корня репозитория:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Build.ps1 -Test
```

Скрипт находит Visual Studio через vswhere, включает x64 developer environment, конфигурирует CMake/Ninja, компилирует ядро и renderer, запускает CTest, собирает WPF shell и копирует `MyCutNative.dll` рядом с exe.

Результат: `out/MyCut/MyCut.exe`. Запуск: `Start-MyCut.cmd` из корня, либо этот exe. После изменения исходников повторять Build.ps1; launcher не пересобирает уже существующий exe.

Только ядро/renderer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Build.ps1 -NativeOnly -Test
```

Полная повторная native сборка:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Build.ps1 -Test -Clean
```

Debug использует `/Z7` вместо `/Zi`: символы записываются в object files, без compiler PDB server. Linker PDB сохраняется. Русская-only MSVC установка отдельно учитывается при выборе `/showIncludes` prefix для корректных зависимостей Ninja. Compile source encoding — UTF-8.

`build/`, `out/`, `bin/`, `obj/` — generated и исключены из Git. Приложение — developer build, пока без self-contained package/installer и без утверждённого redistribution набора. Для машины без developer tools потребуется Release packaging с runtimes, smoke test и license manifest.

## Диагностика

`out/MyCut/logs/mycut.log` содержит startup/interop/runtime errors. Native HRESULT выводится в сообщении. Неподдерживаемое изображение, потерянный source или слишком большой файл дают понятную ошибку; текущий документ при failed load сохраняется. Отсутствие аппаратного D3D11 приводит к попытке WARP.
