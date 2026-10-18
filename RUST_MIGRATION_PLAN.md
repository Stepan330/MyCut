# MyCut Next: управляемое внедрение

Дата: 2026-10-16. Основание: [карта исходников, лицензий и тестов](RUST_REUSE_MAP.md). Нельзя объявлять завершённым приложение или перенос по результатам только сборки.

## Неподвижные границы

- Текущий `Start-MyCut.cmd` продолжает запускать `out/MyCut-inline-text`. Незаконченные пространственные popup/camera в WPF не являются проверенным выпуском.
- Rust UI — нормальный независимый 2D UI. Space 2D/3D создаётся для данных по необходимости; не делать весь документ или popup обязательной 3D-сценой.
- Один документ, одни стабильные IDs и ParameterValue; egui/snarl — адаптеры, не формат проекта. NodeId UI не является ID данных.
- Одна семантика resolver: default/data/item override/animation contributions; Replace/Add/Multiply расширяемы. Полный путь экземпляров для nested prefab. Graph Stops Exposure имеет явный приоритет подключения и local fallback; UI bounds не ограничивают автоматически legacy EV=25.
- Открытие MYCUT 1–6 не должно менять данные. Новый Rust-native формат отдельный, явно именованный; нельзя молча переписать существующий файл другим форматом.
- Time без Scene; Data без обязательной Texture; Space без обязательной Timeline. CPU reference и GPU не получают независимые модели параметров.

## Структура растёт вместе с работающим кодом

Начать с двух содержательных crates: `mycut-photo-core` (не зависит от GUI/GPU) и `mycut-next` (рабочая оболочка). Это photo slice, не финальная замена универсального ядра. Не вводить пустые crates ради диаграммы. При появлении реального кода выделять `mycut-interaction`, `mycut-render`, `mycut-ui`.

В универсальном core будут data/ids/parameter/time modules; фотооперации — клиент этих контрактов, не независимый resolver. Не импортировать чужие Document/Session как второй источник истины. Зависимости application -> UI/interaction/render -> core, не наоборот.

## Последовательность и критерии

1. **Карта повторного использования:** выполнен первый проход; 169 tests. До каждого нового аналога — сначала проверить готовый компонент. GPU, paint и codec остаются отдельными gates, не автоматически одобрены.
2. **Исполняемый photo slice:** отдельный launcher, egui/eframe + wgpu; загрузка/экспорт изображений, слои, базовые операции и история. Ошибки видны пользователю, оригинал не перезаписывается без явного выбора. Core tests + запуск реального окна. В названии/отчёте обозначить прототип до parity.
3. **Данные и совместимость:** перенос типизированных параметров, импорт MYCUT 6 и fixtures старых версий, общий Exposure CPU/GPU, graph priority, no-clamp roundtrip и shader topology cache. Только после этих тестов объявлять новый движок преемником старого.
4. **Растровые инструменты:** сначала отдельный test gate PhotoCraft paint/raster; затем adapter strokes, selection/crop/masks. Один жест — один Undo, Escape отменяет. Не писать brush pipeline заново до оценки готового.
5. **Редактор проекта:** snarl adapter с валидатором DAG, Global/Local Outliner, mask node + canvas edits одной сущности, prefab children/instance path. UI serialization только layout, не document truth.
6. **Интеллектуальный ввод:** независимые physical px/DIP/world transforms, capture фиксирует цель до конца жеста, UI/canvas приоритет явный, общий adaptive zone law. Визуальное сглаживание отдельно от фактического hit test. Pinned/AutoHide/Peek/Floating с защитой активного ввода/drag/child popup.
7. **Жест Details:** FSM Idle/Armed/Right/Down/Activated/Cancelled, старт только в выделенной области, progress/timeout/disable и обычная кнопка. Не открывать панель от случайной траектории.
8. **Animation и media:** keyframe adapter до собственных кривых; Film trim/cache как образец команд, готовые codec bindings до собственного decoder. CPU/GPU parity, frame cache dedup и export cancellation. Bevy — только при доказанной пользе конкретной Space-функции.
9. **Выпуск:** окна/попапы, DPI, Unicode text/selection, keyboard/focus, crash recovery, bounded allocations, responsive operations, compatibility fixtures, package notices и установка. Только затем смена основного launcher.

## Приёмка законченного фоторедактора

Open PNG/JPEG/TIFF/BMP/WebP; слои/reorder/visibility/opacity/lock; кисть/ластик/заливка; прямоугольное и свободное выделение, crop/resize/rotate/flip; недеструктивные masks и цветокоррекция, curves; text editing на канвасе; проекты/save/open/recovery; прозрачный PNG и JPEG export; Undo/Redo/Cancel каждого инструмента; zoom/pan/shortcuts; ограничения памяти/ошибки; сохранение исходника; проверка реального окна, тесты и notices. Эта строка — критерии, **не список уже реализованного**.

## GPU gate

Один backend/device/queue с egui-wgpu; сначала texture upload и UI, затем свой photo pass. Цветовое пространство, premultiplied alpha, координаты и limits зафиксировать. Сравнить с CPU reference на прозрачных/HDR/large изображениях. UI foreground/background compositing и input routing — отдельные порядки; GPU compositing не делает весь UI пространственным.

Тесты выбирать по риску и изменённым границам. Изменение docking не требует всякий раз вручную маскировать и резать видео; изменение общего Session/serialization требует расширенной регрессии. OOP не устраняет такие общие зависимости.
