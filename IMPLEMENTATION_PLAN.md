# MyCut — выполнение расширенной цели

Цель взята из пользовательского `goal-objective.md`: исследование фото/видеоредакторов, UI engine, необходимые рабочие инструменты, цветокоррекция, базовый исполняемый node editor и окно settings/debug. Ранее запрошенные прогноз движения мыши и 4 Edge handles также входят в работу.

## Этапы

1. Исследование функций и алгоритмов — выполнено: RESEARCH.md, первичные источники Krita/Shotcut/Blender/Resolve/Unreal/CGAL.
2. Общий интерактивный UI engine — реализован первый рабочий срез: shared tracker, settings/debug, weighted cells, magnet/scale, layered panels, spring/inertia. Обобщение для timeline/node canvas и расширение проверки debug/physical input продолжается.
3. Рабочие инструменты — в работе. Text/Windows fonts, generated fills/shapes, primary Color/scopes, базовые Video timeline и исполняемый typed Graph реализованы. Raster tools, advanced masks/filters/Color и Animator остаются обязательной работой; Video требует audio и дальнейшего расширения.

## Аудит требований (обновляется только по текущим доказательствам)

| Требование | Состояние | Доказательства/следующая работа |
|---|---|---|
| Анализ открытого фото/видеоредактора, алгоритмов и адаптация UI | выполнено | RESEARCH.md, ссылки на исследованные исходники и manuals |
| Compact header, сцена без постоянной левой колонки | реализовано | 44-DIP icon header, shared outliner flyout; Photo по новым наброскам также имеет справа компактные layers/effects; текущий GPU/WARP smoke |
| 4 corner + 4 edge handles, независимое растяжение | реализовано | CTest и actual HWND edge-resize smoke; opposite-anchor и aspect-ratio проверки |
| Скорость/направление, кратковременные расширенные зоны | реализовано | WPF 0.9.1: measured speed × coefficient × proximity², per-control stable DIP/s release, nearest eligible surface; native gizmo / node ports — прежний directional law. ADAPTIVE_ZONES.md; console/model + GUI 125 checks/backend |
| Рост и притяжение кнопок/ручек, снижение визуального шума | реализован базовый механизм | MotionBehavior/FitAttraction и native drawGizmo; visual artifacts; physical/DPI/узкие сложные layouts требуют дальнейшей проверки |
| Динамические конфликтующие зоны и debug Voronoi | частично реализовано | WPF/native цель сохраняет расширение и сжимается за 0,5 s; weighted-cell/overlap overlay и handle cells; native body-cell debug и полная visual QA ещё нужны |
| Выбор верхнего слоя, повторные клики к нижнему | реализовано | hitStack, Context.resolve и HWND overlap/cycle smoke |
| Windows text/fonts, formatting, multiline | реализовано | retained Definition, DirectWrite/D2D; glyph alpha/Unicode pixels; live editor и save/load smoke |
| Заливки/градиенты/bucket | частично реализовано | solid, linear/radial, checker, rectangle/ellipse; linear-light и alpha tests; bucket ещё отсутствует |
| Основные photo tools, masks, filters, layer operations | частично | order/rename/lock/unique/Undo; raster brush/eraser/selections/masks/crop/filters остаются |
| Color tools и scopes с реальной обработкой | частично | GPU primary correction/wheels; clean scopes и roundtrip/undo/isolation tests; curves/LUT/qualifier/windows/tracking/advanced color остаются |
| Video workspace, preview/bin/timeline с нулевой осью | базовая версия реализована | Video enabled; MF video decoder, bin/program, tracks, move/trim/split/snap/ripple, lock/mute, transport, manual In/Out, speed/fades, snapshot MP4; Timeline/Media/Bridge CTest + app smoke; audio/advanced editing остаются |
| Базовый исполняемый node editor | базовая версия реализована | typed DAG, GPU Image/Color/Scalar/Add/Multiply/Mix/mask/output, v6; NodeCanvas подключён к Graph workspace и shared Effects, Details/search/cables/Undo; current model + GUI/pixel tests; physical drag/DPI и advanced nodes остаются |
| Reusable windows: foundation/content/overlay/head/scroll/resize | реализован foundation и dock integration | LayeredPanelWindow + PanelLayoutOptions.Shared, WorkspacePane, shared outliner/inspector/viewport, Photo/Graph dock panes; small-window/head/footer/scroll и текущие layout tests |
| Settings/debug, persistence, темы/радиусы/прогноз/conflicts | реализовано | Animation strength 0–2; исправлен tiny reversed clamp в attraction; geometry regression и actual settings-window proximity/scroll tests; preset roundtrip/cancel/finite |
| Физические аналогии, motion/inertia и описание пользователю | частично | RESEARCH.md, spring/scroll inertia/drag settling; node vines ещё не реализованы; итоговое описание после полной версии |
| Photo palette / canvas-first workflow / icons | реализовано, UI QA остаётся | 9 выбираемых инструментов, текст клик+верхние параметры, shape drag, fill/gradient/picker; windowless model suite; brush/selection/crop ещё остаются |
| Упругие размеры и реальные позиции соседних кнопок | реализован механизм | ElasticControlPanel / ElasticLayout; перераспределение размеров и сдвиг позиций, conserving extent; console checks; narrow/physical UI ещё требуется |
| Отдельный Color workspace и color window | реализовано, UI QA остаётся | main primaries снизу, scopes/parameters справа, отдельное перестроенное окно с master под каждым колесом; CPU/GPU color pipeline прежний |
| Интерфейс по пользовательским наброскам | реализован рабочий срез | SKETCH_WORKSPACE.md, Photo/Item/Video/Color/Graph; общий NativeSession и preview context. Animator curves/keys/trajectory из листа 4 ещё отсутствуют |
| Итоговая версия, сборка, проверенные artifacts | промежуточная версия | out/MyCut-sketch/MyCut.exe 0.9; CTest 7/7, обе console suites и новый полный GUI GPU/WARP по 122 checks; вся расширенная цель ещё не выполнена |

Изображения тестовых интерфейсов — composited WPF + D3D readback. Они не заменяют проверки реального результата инструмента и не доказывают все физические mouse/DPI сценарии.
