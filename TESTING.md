# MyCut — проверки

## Inline text / popup coordinates, 15 октября 2026

Сборка `out/MyCut-inline-text`: 0 warnings/errors, CTest 9/9, managed interface/model console suites PASS. GUI **147/147 на GPU и 147/147 на WARP**; результаты `smoke/hardware-result.json` и `software-result.json`. Новые проверки: popup screen coordinates/реальное визуальное родство и mouse-move; фокус текстового ввода на канвасе, выбор подстроки, замена Unicode, auto-fit с сохранением повёрнутого/масштабированного origin, локальный Undo/Redo, единый Undo сеанса, Cancel и locked text. Pixel readback подтверждает отсутствие native-дубликата в preview при сохранении полного текста в экспорте. Дополнительно проверен hit-test текстового ввода внутри перспективной поверхности.

Просмотрены снимки `MyCut-inline-text.png` и `MyCut-inline-text-perspective.png`; дублирование глифов устранено хранением editing state отдельно от обновляемого pointer style. Снимки/проверки не заменяют ручную проверку физического drag-selection, буфера обмена, IME и mixed-DPI. [Подробности](INLINE_TEXT.md).

## 0.11 Spatial UI / глубина, 15 октября 2026

Текущая сборка `out/MyCut-spatial-fade` (старый бинарник был занят, окно не закрывалось): разрывы кольца постоянны при любой скорости/retained expansion и учитывают `handleRadius + maximumExpansion` с отступом. Добавлен smoothstep distance fade каждого сегмента от 14% до 100% непрозрачности. Interaction проверяет независимость разрывов от движения и изменение при настройке максимума; Render — пиксельную разницу яркости у ближнего/дальнего указателя. CTest 9/9, аппаратный Render PASS, GUI GPU 134/134. `Start-MyCut.cmd` направлен на новую сборку.

Уточнение кольца вращения: локальная круглая подсветка у указателя вместо широкой подсвеченной окружности; общие для отрисовки/hit-test разрывы возле углов с учётом retained expansion. Interaction проверяет доступные дуги, четыре запрещённых сектора и увеличение разрыва. Render сравнивает пиксели локальной подсветки, отсутствие подсветки удалённой полосы и отсутствие линии в разрыве. Повторно CTest 9/9, Render hardware PASS, hardware GUI 134/134; обновлён native DLL в `out/MyCut-spatial`.

Сборка `out/MyCut-spatial`: 0 warnings/errors. CTest 9/9; обе managed console suites PASS. Native Render дополнительно PASS на hardware GPU. Полный GUI smoke — **134 проверки на GPU и 134 на WARP**: круговой gizmo, компактная шапка, popup, инструменты, перспективный mesh hit-test и попадание в фактическую кнопку, неизменность документа при смене ракурса. Hardware `Presentation = GPU shared surface`, `FrameReadbacks = 0`; WARP `Presentation = readback fallback`, 137 readbacks в конкретном тестовом прогоне. Счётчик зависит от количества отрисованных кадров и не является benchmark FPS.

Результаты: `out/MyCut-spatial/smoke/hardware-result.json`, `software-result.json`. Проверены снимки фронтального и наклонённого интерфейса; исправлены выход визуала за UV-границы и светлый ореол у прозрачного края тени. Ожидание завершения popup-анимаций в smoke ограничено 1.5 секунды вместо предположения о точном времени срабатывания dispatcher. Физическая мышь / mixed-DPI / потеря GPU остаются ручными проверками. [Архитектура и ограничения](SPATIAL_UI.md).

## Фундамент параметров / Exposure, 15 октября 2026

CTest Debug 9/9: добавлены Parameters и ParameterPerformance; Bridge/Render расширены проверками Exposure. Проверены nested address isolation, типы, defaults, relative modes, legacy UI/model range, MYCUT 6 roundtrip без изменения байтов, connected Stops, shader topology, Undo и атомарный отказ. Release parameter suite PASS; 200000 разрешений без heap allocation, около 42 нс/Exposure; добавка около 3.43 мкс на подготовку 128-нодового графа. Windowless model/interface PASS. WPF build 0 warnings/errors. Hardware GUI smoke 127 checks; Render regression PASS на WARP и hardware. [Подробности и ограничения](PARAMETERS.md).

## 0.10.0 — Structure / Photo tools, 15 октября 2026

- Native CTest: 7/7; WPF build: 0 warnings / 0 errors.
- Console interface suite: PASS, исходная adaptive-zone формула и инерция сохранены.
- Windowless model suite: PASS, дополнительно измерение ColorPicker, расширение текста, общие параметры маски canvas/node, одиночный Undo / Cancel, все 11 фотоопераций; отражение проверено по пикселям, исходный файл не изменяется.
- Hardware GUI smoke: **127 checks, Passed=true**, `out/MyCut-structure/smoke/result.json`. Найден и исправлен stale-ID Outliner при удалении. Добавлены реальные HWND drag/Undo маски.
- Просмотрен composited screenshot `MyCut-mask-editing.png`. Полная ручная проверка всех popup, длительных фотоопераций, multi-monitor DPI и клавиатурной доступности пока не выполнена. Наличие теста backend не означает полный ручной прогон окна Photo tools.

## Подтверждённый результат 14 октября 2026

**0.9.4 Compact panels:** `out/MyCut-compact`, сборка 0 warnings / 0 errors; native CTest 7/7; обе console suites passed; окончательная GUI GPU smoke — 125 checks passed. Windowless WPF layout дополнительно проверяет компактную высоту полей, Position X/Y в одной строке, высоту пустого блока Effects только по заголовку, плотные строки слоёв, высоту одного эффекта и освобождение места при сворачивании Transform. Панель отрисована и визуально проверена при ширине 300 DIP; полный Photo screenshot проверен на GPU. Зоны hit-test не уменьшались вслед за визуальными полями. Физическая мышь / multi-monitor DPI остаются ручной проверкой.

**0.9.3 Smooth zones / scheduler:** `out/MyCut-smooth`, build без warnings/errors; CTest 7/7; GUI GPU smoke 125 checks passed. Native ZonePresentation проверяет fade-in, большой скачок радиуса, плавное уменьшение/fade-out и Reduced motion. Renderer отдельно хранит display radius/opacity по 13 handle slots; input/debug берут исходные radii. Pending presentation поддерживает redraw до завершения перехода без постоянного idle redraw. Python scheduler: 6 unit tests passed (next 01:40, past datetime guard, explicit UUID + stdin, dry-run, late wakeup, UTF-8 + at-most-one attempt with fake runner). Реальная CLI-отправка/обновление сообщения в Codex **не проверялись**, ночное задание не включено. Scheduler не читает auth tokens и не обходится с approval/sandbox bypass.

**0.9.2 Unified zones:** `out/MyCut-unified`. CTest 7/7, console interface suite passed; полный GUI smoke на GPU — 125 checks passed. Native Interaction дополнительно проверяет общую формулу и регулируемое уменьшение зоны поворота. Политика передаётся через `mc_zone_config`, одинаковые параметры используются native scene/gizmos и managed UI/node/timeline. Сборка без ошибок/предупреждений. Физическая мышь / DPI по-прежнему требует ручной проверки.

**0.9.1 Adaptive zones:** `out/MyCut-zones`; build 0 warnings / 0 errors, CTest 7/7, обе console suites passed. Полный GUI smoke — **125 checks passed на WARP и 125 на GPU**, свежие results в `out/MyCut-zones/smoke`. Проверены новые settings fields и preset roundtrip; console проверки подтверждают speed × coefficient × proximity, cap/threshold и event-frequency-independent rate release; windowless model — nearest eligible surface, direction independence и остановку текущей скорости отдельно от forecast. Физическая мышь и multi-monitor DPI остаются ручной проверкой. Native gizmo / NodeCanvas ports сохраняют прежний закон; новый закон относится к WPF controls.

**Текущий срез 0.9 Sketch workspace:** `out/MyCut-sketch`, build 0 warnings / 0 errors; native CTest — 7/7; обе console suites passed. Полное окно запущено отдельным smoke-экземпляром на **WARP и GPU: 122 checks passed в каждом режиме**. Свежие `result-warp.json` / `result-hardware.json` находятся в `out/MyCut-sketch/smoke`. Включены regression-тест окна settings (presentation на границах и после scroll), поле Animation strength, Photo/Item/Graph layouts и port proximity. Сохранены composited WPF + D3D screenshots `MyCut-photo-workspace.png`, `MyCut-graph-workspace.png`, `MyCut-item-workspace.png`, `MyCut-video-workspace.png`, `MyCut-interface-laboratory.png`. Windowless model suite дополнительно проверяет 1497 exact-clip attraction cases, typed palette rollback, effect chain, single Undo, shared timeline context и locks. Физическая мышь / multi-monitor DPI и Animator ещё не покрыты и не считаются реализованными.

**Новый срез 0.8:** сборка находится в `out/MyCut-next`; native CTest Core/Interaction/Timeline/Nodes/Bridge/Render/Media — 7/7. `dotnet run --project tests/MyCut.InterfaceTests.csproj` проверяет actual radius release 0,5 s и перераспределение layout extent; `dotnet run --project tests/model/MyCut.ModelTests.csproj` проверяет canvas tool → native Project, Windows text/font edits, single Undo, shape drag/Shift/cancel, full fill, full-resolution clean sampling, gradient direction и exclusive workspace без открытия окна. Это не физическая UI-проверка. Полный повторный GUI smoke **не выполнялся** после изменений palette/Color/elastic layout: запуск был отклонён сервисом подтверждений из-за лимита. Ниже сохранён ранее подтверждённый baseline, который нельзя приписывать новым UI-функциям.

MyCut 0.6 собран в Debug C++20/MSVC и WPF/.NET 10: ошибок и предупреждений нет. CTest Core, Interaction и Render — 3/3 passed. Native Render дополнительно выполнен на аппаратном GPU, включая Windows text/Unicode/alpha, linear-light gradients, shapes, primary correction/identity и editor overlays: passed. Полное приложение выполнено на WARP и на GPU: **92 проверки в каждом режиме passed**, exit code 0. Results сохранены как `smoke/result-warp.json` и `smoke/result-hardware.json`; итоговый `result.json` содержит `D3D11 / GPU`. Новые превью — `MyCut-workbench.png`, `MyCut-interface-laboratory.png`, `MyCut-color-panel.png`; legacy UI previews также сохраняются. Физические mouse/keyboard interactions и multi-monitor DPI остаются ручной проверкой. Полная расширенная цель ещё не выполнена: результаты доказывают реализованный срез, а не готовность timeline, nodes или всех photo/color tools.

## Автоматические suites

`Build.ps1 -Test` компилирует проект и запускает семь CTest suites; проверки работают в Debug и не зависят от assert/NDEBUG. `-OutputDirectory out/MyCut-next` позволяет собрать новую версию, не перезаписывая открытый exe. Console suites запускаются отдельно.

**Core**: независимое изменение Instance, распространение shared Definition, undo/redo, grouped gesture, duplicate/remove и stable IDs, exact float + UTF-8 serialization roundtrip, отказ invalid references/scale/duplicate IDs/version/count, failed command leaves active Project intact, inverse transform hit testing, replace clears history.

**Interaction**: click selection, move/isolation, один undo на весь drag, Shift axis lock, anchored uniform scale, rotation и 15° snap, Escape without extra history, empty/overlapping click, constant screen-size tolerance и rotation снаружи угла. Дополнительно: большой margin ручки, ближайший центр в перекрывающихся handle zones, ближайшая поверхность между соседними объектами, совпадение hover/down и отсутствие зон невидимых объектов.

**Render**: скрытый native HWND и настоящее D3D11/WARP device; shader compile и pixel readback; textured pixels vs background; один source texture на три instances; transform/tint меняют pixels; PNG write/read exact roundtrip; WIC import и upload нового Definition; viewport resize; half-transparent red проверяет premultiplied blending в linear light; invisible instance не рисуется. Рамка/hover/selection transition изменяют interactive pixels и не попадают в чистый output. Output — `build/native/render-test.png`. Аппаратный backend проверяется отдельно и не считается доказанным WARP тестом.

## Проверка приложения

После сборки:

```powershell
$process = Start-Process -FilePath '.\out\MyCut\MyCut.exe' -ArgumentList '--smoke-test' -PassThru -WindowStyle Hidden
$process.WaitForExit()
$process.ExitCode
Get-Content '.\out\MyCut\smoke\result.json'
```

Режим smoke создаёт настоящее WPF окно и hosted D3D11 viewport, вызывает команды через тот же ViewModel/interop, проверяет независимое/общее редактирование, undo/redo и gesture grouping, duplicate/delete, save/load по Unicode path, failed load preserves document, PNG export/import, separate layout persistence. Автоматически закрывает окно. Exit code 0 означает успешный test, 1 — ошибку. Проверка использует WARP для воспроизводимости; отдельные pixels проверены Render suite.

В 0.3 добавлена actual HWND dispatch проверка WM_NCHITTEST/down/move/up/Escape для клика, движения, scale/rotate и отмены; проверки reversal/cleanup/reduced motion; routed hover/click события открывают/закрывают/закрепляют flyout. Реальные animation frames проверяют промежуточную opacity, обратный переход и отсутствие stale-close; viewport width остаётся прежней.

В 0.4 проверяются near-object/near-handle hits, pixel feedback конкретной ручки, nearest UI control в пересекающихся margins и реальное исполнение bound button command за border. Numeric checks идут через тот же ParameterRow state machine и привязанный C++ Project: sub-threshold click, unchanged text, typed number/decimal comma, relative scrub, fine/coarse modifiers без скачка, отсутствие ввода после drag, single undo, cancel, invalid/non-finite и bounded opacity. Hover-preview ручки задаёт ту же presentation state через resolver; курсор пользователя при этом не перемещается.

В 0.6: independent edge resize и sub-threshold pointer click; shared pointer tracker high-frequency accumulation, остановка/retention, разворот, expiry и замедляющийся forecast; preset roundtrip/finite/cancel; реальный topmost/cyclic выбор через HWND; маленькое LayeredPanelWindow и прокрутка. Live text editor пишет Unicode и formatting в C++ Project, save/load сохраняет редактируемые параметры; layer order/unique/lock проверяются через тот же API. Native generator tests проверяют прозрачные/непрозрачные glyph pixels, linear gradient midpoint и ellipse alpha. Color smoke сравнивает реальные clean pixel buffers, isolation, exact Undo restoration, bound wheel RGB/gesture и roundtrip. Отдельно проверено, что scope readback не меняет main editor frame. Отрисованные panels осмотрены; обнаруженное clipping роста numeric fields исправлено ограничением по ancestor clip и запасом для spring overshoot.

Артефакты — `out/MyCut/smoke/result.json`, `export.png`, `viewport.png`, `MyCut-ui.png`, `Проверка.mycut`. Test preferences также сохраняются здесь, обычный пользовательский `%LOCALAPPDATA%` не затрагивается. `MyCut-ui.png` — composited preview реальных WPF controls + native GPU readback; это не снимок рабочего стола, поскольку WPF RenderTargetBitmap не захватывает HwndHost.

Компактная раскладка проверяется через ActualHeight/позицию workspace (52 DIP вместо 114). Клик логотипа открывает меню без resize viewport, повторный клик/Escape/native click/исполнение команды закрывают его. New вызывается через стандартный Invoke provider и очищает scene/selection/history. Proximity tests используют вертикальные соседние кнопки меню. Managed/native feedback проверяется различием реальных PNG readbacks для разных handle indices, а финальный resolver выбирает ожидаемую ручку. Для иллюстративного target preview состояние применено после WPF snapshot; это исключает его сброс настоящим WM_MOUSELEAVE при неподвижном курсоре пользователя.

Программный smoke не доказывает все физические mouse/keyboard interactions, DPI на каждом мониторе, crash recovery или video/audio/physics features. WARP результат сам по себе не доказывает аппаратный driver: hardware smoke выполняется отдельно. После изменения этих областей расширять проверки соответствующим сценарием.

Для аппаратного backend запустить native test с `build/native/MyCutRenderTests.exe build/native/hardware-test.png --hardware`, а приложение с `--smoke-test --hardware`. Фактический backend выводится в stdout / JSON Metrics: `GPU` подтверждает hardware, `WARP` означает fallback. Это отдельная проверка установленного драйвера.

## Ручной сценарий

1. Запустить корневой Start-MyCut.cmd; увидеть три cards и Photo workspace.
2. Кликнуть B, перетащить его; изменить scale за угловую ручку, rotation за круг или снаружи угла, opacity в Inspector: A/C остаются на своих местах. Проверить Shift и отмену Escape.
3. Изменить Definition tint: все связанные cards меняют цвет.
4. Duplicate, Delete, Undo/Redo; один drag отменяется одним шагом.
5. Импортировать PNG с alpha и JPEG; выбрать/редактировать экземпляры.
6. Сохранить .mycut, открыть его, проверить positions/tint; открыть повреждённый файл и убедиться, что проект не потерялся.
7. Export PNG: 1280×720, без selection outline, opaque background.
8. Навести на левую иконку: список открывается поверх viewport. Перейти в панель, затем наружу; проверить плавное закрытие и быстрое повторное наведение. Pin/Unpin и перезапуск сохраняют закрепление. Проверить маленькое окно и display scaling.
9. Навести и нажать рядом с ручкой/кнопкой; проверить, что подсветка и действие совпадают. Между соседними зонами цель должна меняться на ближайшую.
10. Числовое поле: короткий click включает ввод; drag меняет значение без входа в текст. Проверить Shift/Ctrl, Escape и single Undo, десятичную запятую, клавиши Enter/F2 и текстовый Ctrl+Z.
11. + Text: изменить строку, Windows font, size, bold/italic/underline, alignment/color; сохранить и открыть документ, редактировать текст снова.
12. + Fill / + Shape: переключить тип, цвета/alpha/gradient/outline; проверить order, lock и Make unique в нескольких связанных копиях.
13. Color: wheel/master/primary fields, Undo/Redo, export; сверить scopes с clean composition. Проверить reset и наличие коррекции после load.
14. Interface laboratory: менять настройки при движении между scene/buttons, смотреть зоны/клетки/прогноз; экспортировать JSON и импортировать обратно. Уменьшить окно, убедиться в сохранении head/footer и доступности всех controls через scroll.

Текущие ограничения: синхронный decode/export, отсутствие video/timeline в новом ядре, никаких ICC/HDR гарантий, absolute source paths, без automatic relink и recovery. Тесты для будущих graphs/time/cache/physics появятся вместе с их рабочими implementations.
