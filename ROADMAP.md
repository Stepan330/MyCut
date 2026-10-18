# MyCut — план вертикальных срезов

## 0.7 — текущий результат

C++ core, собственный D3D11 renderer, shared Definitions / independent Instances, selection/move/transform/tint, image import, native PNG export, undo, project storage, модульное WPF окно и автоматические проверки. Это bootstrap, включающий минимальную часть Stage 2 из мастер-промпта. Perspective camera/3D geometry ещё отсутствуют.

В 0.3: исправлен native mouse routing, добавлены corner scale/rotation gizmo, constrained gestures/Escape, hover/pinned scene flyout и общий presentation motion engine. В тестах используется actual HWND input dispatch.

В 0.4: крупные DPI-aware handles, ближайшие зоны объектов/controls, однозначный hover/click resolver, combined numeric scrub/text fields с fine/coarse sensitivity и транзакционной отменой.

Раскладка 0.4 уплотнена: одна верхняя строка 52 DIP с логотипом и режимами вместо 114 DIP. Команды проекта перенесены в click-open меню логотипа; добавлен пустой New/Ctrl+N. Меню не меняет размер viewport. Отдельного менеджера проектов пока нет: существующие документы открываются через системный выбор `.mycut`.

## Следующий срез — Photo / Scene editing

В 0.6 выполнены retained Windows text, generators (solid/gradients/pattern/shapes), layer order/lock/unique и primary Color/scopes. UI получил shared pointer intent, magnet/spring/overshoot, layered panels, live settings/debug и контрастную тему. В 0.7: rational-frame timeline, Windows MF decode, bin/program preview, transport, move/trim/split/snap/ripple, lock/mute, manual In/Out, speed/fades и snapshot H.264 export. Подробный аудит расширенной пользовательской цели: IMPLEMENTATION_PLAN.md. Следующие обязательные срезы — исполняемый node editor, raster selection/masks/brush/filters и advanced Color; видео требует audio и развития.

Сохранить существующий import/export/manipulators и добавить: text Item, layer order, independent-instance variant, mask basic primitive, source relink, save-as, workspace selection/layout и autosave/recovery. Проверяемая цель: открыть фото, добавить и разместить текст, сохранить проект и экспортировать PNG без timeline.

Прежде чем большие источники/сложные сцены: перенести decode/render/export в отдельные execution domains, добавить requests with revision/cancellation, source reload и GPU device-loss recovery. Проверить отзывчивость на 4K assets. Решение Popup для списка развивать в переиспользуемую систему вспомогательных панелей.

## Timeline & Media

Первая рабочая версия реализована через системный Windows Media Foundation без bundled FFmpeg; подробности VIDEO.md. Далее: audio clock/mixer, project FPS/resolution, proxies, thumbnails/waveforms, review/markers/saved fragments из старого prototype. Продолжать проверять frame mapping, seek, playback и real export.

## Typed Nodes & Parameters

Node registry/type checking, cycle traces, parameter overrides/Expose, project variable source ownership, CPU math и GPU image effects. Authoring/Dependency/Execution/Render graphs раздельны. Проверяемая цель: публичный параметр через разные формулы управляет несколькими экземплярами.

## Cameras & Effectors

Scene depth/orthographic/perspective камеры, Camera Output resources, dependency validation, spatial compositing stages. Проверяемая цель: Camera2 снимает обработанный Output Camera1; взаимный cycle показывает понятную ошибку.

## Cache / scheduler / colour

Content/revision keys, descendants invalidation, memory budgets/eviction, playback priorities, CPU/GPU metrics, real GPU timestamps и adaptive preview. OCIO/ICC/HDR после проверки библиотеки и точных colour contracts. Проверяемая цель: правка последнего эффекта сохраняет upstream cache и корректный final output.

## Animation & Physics

Shared keyframes/curves и отдельный fixed-tick physics domain, checkpoints/bake. Начать с 2D после выбора библиотеки. Проверяемая цель: два Item в одном world сталкиваются, bake повторяется при произвольном seek.

## Самостоятельные редакторы и расширения

Последовательно Animation, Audio, VFX и 3D на общем ядре; сохраняемые workspace states. Python/Plugins/AI после стабилизации command, node и document APIs. Каждый этап заканчивается сборкой и проверенным user scenario; объём мастер-промпта не считается реализованным по наличию вкладок.
