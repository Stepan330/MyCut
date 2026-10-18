# MyCut

Rust-версия теперь начинает работу со сцены **[UI Lab](next/UI_LAB.md)**: разработка базовых компонентов, live-параметры и debug. Переход в Photo Editor — кнопкой вверху. Запуск `Start-MyCut-Rust.cmd`; старый WPF launcher сохранён.

**MyCut Next / Rust — отдельный рабочий photo slice, ещё не законченная замена:** запуск `Start-MyCut-Rust.cmd`, [возможности, тесты и честные ограничения](next/README.md). Сначала исследованы исходники десяти Rust-проектов: [карта повторного использования](RUST_REUSE_MAP.md), [план миграции и критерии готовности](RUST_MIGRATION_PLAN.md). Основной запуск ниже сохранён.

Обновление Rust UI: общие [базовые компоненты и docking панелей](next/UI_COMPONENTS.md), умные ручки масштаба/поворота, текст на канвасе, единый Content Browser/Details/Settings, Outliner Local/Global, UI zoom. 84 теста; [проверка дизайна](next/DESIGN_REVIEW_2026-10-16.md).

Текущий запуск `Start-MyCut.cmd`: `out/MyCut-inline-text` — исправлено преобразование координат popup и добавлен текстовый ввод прямо на канвасе с выделением фрагментов, заменой, Undo/Redo и отменой сеанса. [Управление и ограничения](INLINE_TEXT.md). Постоянные разрывы кольца и distance fade сохранены. Предыдущая открытая сборка не закрывалась.

**0.11 — пространственный интерфейс:** `out/MyCut-spatial`. Компактные верхние вкладки по эскизу, круговое вращение объекта, живой GPU-канвас внутри перспективного WPF-интерфейса. Геометрическая толщина, тень и удалённая сетка добавляют глубину. F6 / `3D UI` — обзор, F7 — рабочий вид, Alt + ПКМ — ракурс. [Архитектура, управление и ограничения](SPATIAL_UI.md). Это 3D-представление интерфейса, не новый 3D-формат документа.

**Первый этап универсальных параметров (сохранён):** предыдущая сборка `out/MyCut-parameters`. Типизированные IDs/значения/descriptors, полный путь экземпляров и resolver; Exposure использует общий CPU/GPU путь подготовки. Сохранён MYCUT 6, старые значения и приоритет подключённого Stops. Полный отчёт, список файлов, замеры и ограничения — [PARAMETERS.md](PARAMETERS.md). Полноценные Prefab/Animation пока не реализованы.

**0.10.0 — первый этап интеграции (предыдущая сборка):** `out/MyCut-structure`. Общий Outliner Global/Local и вкладки Parameters/Outliner в Graph; выбранная EllipseMask редактируется на канвасе и в параметрах с одним Undo. ColorPicker для инструментов и цветовых нод; расширение области текста при изменении шрифта. Кнопка **Photo tools…** обрабатывает импортированный PNG/JPEG/BMP/TIFF через Magick.NET: Preview → Import processed copy. Результат — новый слой, оригинал сохраняется; это пока не недеструктивный стек фильтров. Полный план и незавершённые функции: [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md). Лицензии библиотек включены в ThirdParty сборки.

**0.9.4 Compact panels (предыдущая сборка):** `out/MyCut-compact`. Числовые поля 26 DIP, интервалы 2 DIP; Position / Scale X-Y и Tint RGB сгруппированы по строкам. Transform и Shared definition сворачиваются. Эффекты занимают высоту по содержимому. Общие зоны нажатия и drag/click-ввод сохранены.

**0.9.3 Smooth zones (предыдущая сборка):** `out/MyCut-smooth`. Рабочие круги масштаба/поворота плавно появляются/исчезают и сглаживают размер, независимо от фактического hit-test и debug. [Python-скрипт отправки по времени и ограничения](PROMPT_SCHEDULER.md): `Prompt-scheduler.cmd`.

Предыдущая **0.9.2 Unified zones**, `out/MyCut-unified`. [Общие радиус / скорость × коэффициент × близость / сжатие для UI, масштаба, поворота, сцены, нод и таймлайна](ADAPTIVE_ZONES.md).

Собственный творческий движок и редактор для Windows. Сборка **0.9 Sketch workspace**: `out/MyCut-sketch`, запуск `Start-MyCut.cmd` или `Start-MyCut-sketch.cmd`. [Расшифровка набросков, общие классы панелей и ограничения](SKETCH_WORKSPACE.md). Photo / Item / Video / Color / Graph используют один документ; панель настроек исправлена, сила анимаций настраивается. Предыдущая 0.8 остаётся в `out/MyCut-next`. Расширенная цель остаётся в работе: [исследование](RESEARCH.md) и [аудит выполнения](IMPLEMENTATION_PLAN.md).

## Запуск

Дважды нажмите **Start-MyCut.cmd** в корне репозитория. Готовый исполняемый файл находится в `out/MyCut-parameters/MyCut.exe`. Уже открытый старый экземпляр нужно закрыть и запустить заново. Для запуска этой сборки нужны Windows x64, .NET Desktop Runtime 10 и компоненты Visual C++ текущей локальной сборки. Это developer build, ещё не установщик для распространения.

При отсутствии готового exe стартовый скрипт запускает сборку; необходимы Visual Studio с C++/CMake/Windows SDK и .NET SDK 10. Инструкции: [BUILD.md](BUILD.md).

## Что работает

- Собственный Direct3D 11-рендерер, аппаратное устройство и программный WARP fallback.
- Одна верхняя строка высотой 44 DIP: logo/project menu, иконки режимов с подсказками и имя документа. Photo справа содержит параметры/эффекты/слои; Graph — ноды/Details; Video освобождает preview и ставит transport над широким таймлайном. Новый проект — пустая композиция, Ctrl+N.
- При обычном запуске — пример Workbench с изображением, редактируемым текстом, градиентным фоном и эллипсом. Restore demo сохраняет прежние три связанных cards.
- Выбор кликом в сцене или списке, перетаскивание, четыре угловые и четыре Edge ручки: углы сохраняют пропорции, рёбра меняют X/Y независимо с неподвижным противоположным краем. Поворот — через круг или снаружи угла.
- Крупные ручки 16 DIP и зоны захвата радиусом 24 DIP. Пересекающиеся зоны ручек выбирают ближайший центр, hover подсвечивает именно будущую цель клика. Видимые объекты имеют дополнительный margin 16 DIP.
- Кнопки, поля, checkbox/combobox и строки списка получают UI proximity margin 8 DIP. Быстрое движение создаёт направленное расширение до 44 DIP, затухающее за 1 s; разворот меняет направление поля. В конфликте выбирается ближайшая доступная цель по взвешенному расстоянию.
- Близкие элементы растут и притягиваются в пределах доступного места. Дальние вспомогательные элементы становятся менее заметными. Spring отклик сохраняет пространство для overshoot; числовые значения дополнительно увеличиваются при приближении.
- Прямой клик выбирает верхний доступный слой; повторный клик в том же месте циклически выбирает нижние. Порядок слоёв, rename, lock и Make unique редактируются и сохраняются.
- Shift: движение по одной оси / поворот с шагом 15° / округление масштаба до 0.1. Escape отменяет текущий жест, клик в пустоту снимает выделение.
- Всплывающий список сцены: слева только иконка, наведение открывает панель поверх viewport; Pin закрепляет её, повторный клик снимает закрепление.
- Общий motion engine: плавные переходы панели, hover/press кнопок и списка, анимированная подсветка объектов и рамки. Переходы обратимы, учитывается системная настройка уменьшенной анимации.
- Точное редактирование положения, масштаба, поворота, прозрачности и видимости в Inspector.
- Число и slider объединены в поле высотой 42 DIP. Drag меняет значение относительно текущего; обычный click включает ввод. Shift — точная настройка, Ctrl — ускоренная, Escape — отмена; весь drag отменяется одним Undo. Enter/потеря фокуса принимают ввод, Escape его отменяет; десятичные точка и запятая поддерживаются.
- Общий RGB tint определения; изменения распространяются на связанные экземпляры.
- Duplicate/Delete, Undo/Redo; перетаскивание и slider drag отменяются одним действием.
- Импорт PNG/JPEG/BMP/TIFF через Windows Imaging Component; исходники остаются внешними файлами.
- Сохранение/открытие `.mycut`, UTF-8 текст и пути с кириллицей; проверка данных перед заменой текущего документа.
- Экспорт непрозрачной sRGB PNG-композиции 1280 × 720.
- Изменяемые размеры панелей и отдельное сохранение UI layout.
- + Text / + Fill / + Shape создают реальные слои; Edit content открывает их свойства. Windows fonts, кириллица/multiline, размер, line height, bold/italic/underline, alignment и цвет сохраняются в документе. Слой текста остаётся редактируемым после открытия.
- Solid, linear/radial gradient, pattern, rectangle и ellipse. Цвета/alpha/направление градиента и outline фигуры редактируются; градиенты интерполируются в linear light.
- Color: exposure, contrast/pivot, saturation, temperature/tint, Lift/Gamma/Gain/Offset с независимыми RGB и master полями, grayscale/invert. Коррекция индивидуальна для слоя и входит в PNG export.
- RGB histogram, waveform и vectorscope вычисляются из отдельного чистого native target, не стирая handles в редакторе.
- MyCut → Interface settings / Debug: радиусы, скорость/срок прогноза, magnet, growth, motion, inertia, тема и debug overlays. Настройки меняются сразу, сохраняются и импортируются/экспортируются как JSON.
- Общий LayeredPanelWindow: основание/content/overlay, draggable head, resize, scroll и wrap footer; geometry сохраняется. Scroll получает затухающую инерцию, перемещённый объект — краткий presentation overshoot с возвратом к точной позиции документа.

Клавиши: Ctrl+N — новый проект, Ctrl+I — импорт, Ctrl+O — открыть, Ctrl+S — сохранить, Ctrl+D — дублировать, Delete — удалить, Ctrl+Z/Ctrl+Y — undo/redo. В текстовых полях Delete редактирует текст.

Photo, Item, Color, базовые Video и Graph доступны в срезе 0.9. Video: import, move/trim/split/snap/ripple, lock/mute, transport, ручной In/Out, speed/fades и snapshot H.264 MP4 export — [сценарий и ограничения](VIDEO.md). Graph исполняет typed math/color/image/mask DAG на GPU, включает поиск/соединения/параметры/Undo. Видео пока без аудио. Animator/Audio отключены; кисти, raster selections/crop, advanced filters/curves/LUT и ключевые анимации остаются в аудите. Старое окно отсмотра сохранено в `MyCut_Windows_Preview/` и запускается своим `Start-MyCut.cmd`.

## Как удобно менять интерфейс

| Что изменить | Файлы |
|---|---|
| Цвета, шрифты, радиусы | `editor/Themes/Tokens.xaml` |
| Общие кнопки, поля, slider и списки | `editor/Themes/Controls.xaml` |
| Раскладка и верхняя панель | `editor/MainWindow.xaml` |
| Список Item | `editor/Views/ScenePanel.xaml` |
| Свойства Item | `editor/Views/InspectorPanel.xaml` |
| Повторяемый редактор числа | `editor/Controls/ParameterRow.xaml` |
| Scrub/click state machine | `editor/Controls/ParameterRow.xaml.cs`, `editor/Controls/NumericDrag.cs` |
| Зоны кнопок и полей | `editor/Controls/ProximityInput.cs` |
| Команды и связанное с UI состояние | `editor/ViewModels/EditorViewModel.cs` |
| Граница с C++-ядром | `editor/Services/NativeSession.cs`, `native/include/mycut/Bridge.h` |
| Переходы и реакции UI | `editor/Motion/MotionEngine.cs`, `editor/Motion/MotionBehavior.cs` |
| Всплывающий список | `editor/Controls/SceneFlyoutController.cs` |
| Меню логотипа | `editor/Controls/ProjectMenuController.cs`, `editor/MainWindow.xaml` |
| Настройки и debug | `editor/Services/InterfaceSettings.cs`, `editor/Controls/InterfaceSettingsWindow.cs`, `editor/Controls/InputDebugAdorner.cs` |
| Общая оболочка панелей | `editor/Controls/LayeredPanelWindow.cs`, `editor/Controls/InertialScrollBehavior.cs` |
| Текст/заливки/фигуры | `native/src/Generators.cpp`, `editor/Controls/LayerContentWindow.cs` |
| Цвет и scopes | `editor/Controls/ColorWindow.cs`, `ColorWheel.cs`, `ColorScopes.cs`, `editor/ViewModels/EditorViewModel.Color.cs` |
| Таймлайн и видео | `engine/src/Timeline.cpp`, `native/src/Media.cpp`, `editor/Controls/TimelineCanvas.cs`, `TimelineWindow.cs`, `editor/ViewModels/EditorViewModel.Timeline.cs` |
| Геометрия и жесты манипулятора | `engine/include/mycut/Interaction.h`, `engine/src/Interaction.cpp` |

Значения по умолчанию задаёт `InterfaceSettingsData`, а реальные размеры ручек/зон меняются в лаборатории интерфейса. Native input и rendering получают одинаковые `InteractionOptions`/`InputAppearance`. Чувствительность числа — `Step` в InspectorPanel и tool panels. Размеры ввода измеряются в DIPs и согласованы с display scale.

UI layout и закрепление списка хранятся в `%LOCALAPPDATA%/MyCut/Editor/layout.json`. Старые layout-файлы совместимы; сохранённое поле Left теперь задаёт ширину всплывающей панели. Документ проекта не содержит анимаций hover/выделения. В PNG экспортируется чистая композиция без ручек. Ошибки пишутся в `out/MyCut/logs/mycut.log`.

## Документация

[Архитектура](ARCHITECTURE.md) · [Взаимодействие и анимации](INTERACTION.md) · [Решения](DECISIONS.md) · [План](ROADMAP.md) · [Сборка](BUILD.md) · [Проверки](TESTING.md)

Ограничения текущей сборки: Windows x64; ортографическая 2D-проекция; статическая composition и отдельный frame timeline; видео без аудио; sRGB без ICC/HDR; image decode и scopes/PNG могут ожидать результат на UI thread, video preview и MP4 имеют workers; undo хранит до 100 снимков документа. Полная расширенная цель остаётся в работе.
