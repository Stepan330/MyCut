# MyCut — решения

## 001 — Название и последовательность

Официальное название — MyCut. Новое ядро создаётся рядом с проверенным `MyCut_Windows_Preview`; функции старого отсмотра сохраняются в отдельном приложении, пока будут переноситься по работающим срезам. Первый новый результат — реальные текстурированные Item Instances, import/export и редактируемое окно.

## 002 — C++20 / CMake

Core и graphics на C++20. CMake/Ninja и установленный MSVC позволяют собирать и тестировать без скачивания зависимостей. Core отделён от Windows/Direct3D типов; файловая atomic replacement имеет platform-specific реализацию. Полноценный cross-platform editor не заявлен.

## 003 — WPF shell / внутренний C ABI

WPF .NET 10 используется для первого Windows UI: имеющийся runtime, XAML tooling, controls, data binding и themes. Рендер и Project model остаются C++. Панели, повторяемые controls, themes и ViewModel разнесены по файлам. Это обеспечивает быстрые правки без компиляции всей графической подсистемы.

Qt остаётся вариантом будущего portable shell. Сейчас добавлять Qt не требуется для проверяемой Windows цели. Отдельный слой `NativeSession` локализует interop; текущий C ABI — внутренний API, не публичный стабильный Plugin API. Exception не пересекает ABI. Вызовы и строковые буферы принадлежат одному UI thread, lifetime строки до следующего native text call; C# немедленно копирует строки.

Компромиссы: Windows-only shell, HwndHost airspace и необходимость separate render thread при усложнении кадра. Scene flyout в 0.3 решает overlay через отдельный Popup HWND; произвольный WPF rendering в том же HWND поверх hosted native viewport остаётся ограничен.

## 004 — Direct3D 11 сначала

Первый backend — D3D11 feature level 11.0, fallback WARP. Direct3D12/Vulkan требуют больше явной синхронизации/ресурсного управления на bootstrap. D3D11 достаточен для собственной отрисовки shader-based textured planes. API изолирован в `MyCutGraphics` за Renderer interface; future Render Graph будет общей моделью.

Есть собственная frame texture: swapchain используется только для presentation. Capture читает frame texture; данные discarded swapchain после Present не используются как единственный источник экспорта. sRGB texture views декодируют в linear; pixel shader выдаёт premultiplied RGB; blend ONE/INV_SRC_ALPHA; sRGB RTV кодирует output. Целевой HDR/OCIO pipeline не реализован.

Документация Microsoft: [HwndHost/Win32 hosting](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/walkthrough-hosting-a-win32-control-in-wpf), [WARP device](https://learn.microsoft.com/en-us/windows/win32/direct3d11/overviews-direct3d-11-devices-create-warp).

## 005 — Image import через WIC

Используется системный [Windows Imaging Component](https://learn.microsoft.com/en-us/windows/win32/wic/-wic-about-windows-imaging-codec). Decode в BGRA8, texture upload явно в backend. Bootstrap использует кадр 0 TIFF и не заявляет EXIF autorotation/ICC workflow. Видео/аудио пока живут в старом prototype; FFmpeg будет включён в отдельном media срезе после проверки выбранной конфигурации, лицензии и кодеков.

## 006 — Транзакции и сериализация

Candidate copy → edit → validate → commit. При ошибке текущий Project не меняется. Slider drag/viewport drag объединяет изменения в один undo step. Undo snapshots — сознательная небольшая реализация для bootstrap, а не final journal для многогигабайтного проекта.

`.mycut` format 1 хранит только реализованную модель. Temp write + flush + MoveFileEx replacement предотвращают публикацию частичного проекта при обычной ошибке записи; power-loss durability и crash recovery требуют отдельной проверки и autosave. Размер файла ограничен 16 MiB; количество объектов — 10k каждого типа. Проект и UI layout разделены.

## 007 — Зависимости и распространение

На этом этапе не добавлены сторонние исходники, Qt, FFmpeg, OCIO или physics libraries. Используются Microsoft Windows SDK API/import libraries и установленный .NET Desktop Runtime; исходники соответствующих библиотек не копируются. Кандидаты для дальнейших этапов: FFmpeg с фиксированной конфигурацией и проверенными LGPL/GPL obligations; OpenColorIO; Box2D; 3D physics после определения требований. Это кандидаты, ещё не проверенные и не включённые зависимости.

Developer build зависит от установленного .NET 10 Desktop Runtime и Debug MSVC CRT. Прежде чем выдавать installer, переключить C++/C# сборку на Release, подтвердить права redistribution Runtime/SDK components, собрать dependency/license manifest и провести тест на чистой Windows. Лицензия самого MyCut остаётся решением владельца проекта.

## 008 — Native interaction и отдельный presentation motion

В 0.3 STATIC host заменён собственным Win32 class с явным HTCLIENT. Это даёт корректный client mouse routing, capture и keyboard handling. Общая portable geometry используется pointer state machine и GPU gizmo. Gestures фиксируются одной transaction, Escape отменяет без нового history entry.

Список сцены размещён в отдельном Popup HWND, а не в постоянной колонке. Motion clock один на окно, tracks адресуются owner/channel; retarget сохраняет текущее значение, stale completion отменяется. Presentation-анимация не меняет документ, renderer получает editor feedback отдельно, clean export не содержит handles/glow. Reduced motion учитывает системный параметр. Введение project keyframes остаётся отдельным этапом.

## 009 — Proximity input и combined numeric fields

Зоны определены в экранных DIPs независимо от zoom и Item scale. Ручки foreground layer сравниваются по расстоянию к центрам, тела Items — по поверхности и затем центру; UI controls сравниваются по видимой геометрии с учётом clipping. Hover/down используют одинаковый resolver. Ввод не полагается на конкретный render pixel и не меняет project data до жеста.

Numeric field различает click и relative scrub по movement threshold. Ввод цифры использует отдельный текстовый буфер, а не пишет невалидные промежуточные строки в model. Одна native Session transaction обеспечивает общий Undo/Escape для transform и definition tint. UI proximity расширяет доступную область без изменения layout; кнопка выполняет стандартный Invoke/Command путь, а не копию её команды.

## 010 — Компактная строка и меню логотипа

Глобальные команды проекта не занимают постоянную верхнюю полосу. Режимы и логотип объединены в строку 52 DIP, команды находятся в отдельном Popup HWND под логотипом. Меню использует общий presentation clock и отдельный ProximityInput root, не участвует в workspace layout и закрывается при переходе к работе на сцене. New создаёт пустую композицию, Restore demo остаётся отдельной командой. При замене документа bridge отменяет активный manipulator перед Session.replace, чтобы жест не продолжился на новом документе.

## 011 — Shared intent, cells и physical presentation

Pointer tracker общий для surfaces; prediction/retention bounded и настраиваются. Stable layout bounds отделены от animated transforms, direct hits получают приоритет, в конфликте побеждает weighted distance. Grow/pull ограничены clip bounds с запасом для spring overshoot. Numeric value emphasis сохраняет заметность широкого поля без обрезки. LayeredPanelWindow переиспользует header/content/overlay/scroll/footer; physics-like response остаётся presentation state и не меняет export/document.

## 012 — Retained text и generated sources

Текст/font/style/colors сохраняются как Definition, Windows shaping и antialiased transparent bitmap выполняют DirectWrite/D2D. Generated fill/shape textures кешируются по полному content key; gradient interpolation — linear light. Никакие исходники Krita/Shotcut не копируются. `.mycut` v4 читает предыдущие v1–v3; invalid UTF-8 и параметры отклоняются до Session.replace.

## 013 — Individual color correction и clean scopes

ColorGrade принадлежит Instance; shader использует exposure/balance/contrast/LGG/offset/saturation/flags. Linked source copies остаются независимыми по коррекции. Scopes получают отдельный cached clean render target, исключающий handles, hover, debug и settling. Histogram/waveform/vectorscope обновляются при изменениях; advanced color/curves/LUT/qualifier и tracking остаются отдельными вертикальными срезами, наличие primary panel не означает их готовность.
