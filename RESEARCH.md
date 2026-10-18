# MyCut — исследование редакторов и алгоритмов

Исходная цель: расширить MyCut до удобного редактора фото, рабочего пространства монтажа и базового нодового композитинга; построить общий интерактивный интерфейс с настройками и наблюдаемой отладкой. Этот документ описывает исследование, а не заявляет готовность функций.

## Этап 1. Выбранные источники

**Krita — открытый фоторедактор.** Изучены [репозиторий](https://github.com/KDE/krita), [слои и маски](https://docs.krita.org/en/reference_manual/layers_and_masks.html), [текст](https://docs.krita.org/en/reference_manual/tools/text.html), [фильтры](https://docs.krita.org/en/reference_manual/filters.html), [заливка](https://docs.krita.org/sl/reference_manual/tools/fill.html) и [реализация fill painter](https://github.com/KDE/krita/blob/master/libs/image/kis_fill_painter.cc). Полезные архитектурные идеи: слой отдельно от инструмента, выделение как маска, заливка по связной области с допуском, корректировки с сохранением исходника. Текст должен сохранять строку и свойства шрифта, чтобы его можно было редактировать после открытия проекта. Исходники Krita используют GPL; код в MyCut пишется самостоятельно, ссылки служат изучению архитектуры.

**Shotcut — открытый видеоредактор.** Изучены [репозиторий](https://github.com/mltframework/shotcut) и [Clip.qml](https://github.com/mltframework/shotcut/blob/master/src/qml/views/timeline/Clip.qml). В клипе разделены перемещение тела, входной/выходной trim, fades и выбор дорожки. Жест ниже порога остаётся выделением, чтобы snap не создавал случайное изменение на один кадр. Для MyCut: раздельные временные координаты клипа/исходника, целые номера кадров, один Undo на жест, отдельная библиотека медиа. GPL-код Shotcut не переносится в исходники MyCut.

**Blender — таймлайн.** Изучены [sequencer_edit.cc](https://github.com/blender/blender/blob/main/source/blender/editors/space_sequencer/sequencer_edit.cc) и [руководство editing strips](https://docs.blender.org/manual/en/5.2/video_editing/edit/montage/editing.html). Нужны дорожки, перемещение, trim, split, ripple, snapping, zoom и pan. В MyCut ось начинается с нуля и расширяется при прокрутке/добавлении клипов; рабочий In/Out диапазон устанавливает пользователь. Автоматического ограничения всей оси выбранным клипом не будет.

**DaVinci Resolve — цвет.** [Официальный обзор Color](https://www.blackmagicdesign.com/products/davinciresolve/color) описывает primary wheels/bars, log-коррекцию, кривые, HSL qualifier, геометрические Power Windows, соединённые корректирующие ноды и scopes. Карта MyCut включает эти категории. Начальное рабочее ядро: exposure/contrast/saturation/temperature, lift/gamma/gain по каналам, RGB/luma curves, маски, LUT и scopes. Продвинутые категории (tracking, temporal denoise, HDR/ACES, camera matching) требуют отдельных алгоритмов и проверки; наличие панели не будет считаться их реализацией.

**Unreal — взаимодействие с нодами.** [Material Editor User Guide](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-material-editor-user-guide?lang=en-US) использован для структуры graph/preview/palette и live update. В MyCut: контекстный поиск, drag от pin с созданием подходящей ноды, типизированные входы, соединения, панорамирование и zoom. Минимальный полезный граф должен исполняться: Image/Color/Scalar → Add/Multiply/Mix/Mask/Color → Output. Создание кружков и линий без вычисления изображения не считается нодовым редактором.

**Voronoi.** [CGAL 2D Voronoi manual](https://doc.cgal.org/latest/Voronoi_diagram_2/index.html) изучен для разбиения пространства между ближайшими sites. Для UI используется расстояние до поверхности control и направленная добавка вероятности. При конфликте побеждает один минимальный score; границы равных score образуют клетки. Это геометрическое разбиение, случайный шум для определения цели не нужен. Отладка должна показывать исходные зоны, их пересечения и итогового владельца области.

## Карта функций и алгоритмов MyCut

| Область | Требуемые функции | Алгоритм/представление | Доказательство готовности |
|---|---|---|---|
| Документ | размеры/фон, import/export, save/load, Undo/Redo | валидируемый Project, immutable источники, versioned storage, snapshots | повторное открытие без потери данных, отказ повреждённых файлов |
| Слои | image/text/fill/shape, порядок, hide/lock, duplicate, группы, blend modes | stable IDs, порядок bottom→top, compositing graph | пиксели, порядок выбора, Undo и сохранение |
| Геометрия | move/rotate, corners, 4 edges, flip, crop, zoom/pan | affine inverse, independent X/Y, opposite anchor, UV crop | повернутые рёбра/углы, неподвижный anchor, clean export |
| Текст | Windows fonts, Unicode, размер, начертание, alignment, multiline, цвет | системный shaping/rasterizer, сохранённые параметры, texture cache | кириллица, выбор установленного font, редактирование после load |
| Заливки | solid, gradient, pattern, bucket/tolerance | generator, линейная интерполяция, scanline flood fill | контрольные пиксели, alpha, selection boundaries |
| Выделение/маски | rectangle/ellipse/lasso/wand, add/subtract/invert, feather | grayscale mask, polygon rasterization, color distance, convolution | операция влияет только на выбранную область |
| Рисование | brush/eraser, размер/opacity/hardness, picker, clone | интерполированные dabs, alpha composite, immutable raster revisions | непрерывный stroke, один Undo, ограничение selection |
| Фильтры | blur/sharpen, levels/curves, invert/grayscale, noise | separable convolution, LUT, matrices, unsharp mask | сравнение с аналитическими входами и PNG |
| Цвет | primary wheels, bars, curves, qualifier/windows, LUT, scopes | float linear processing, tonal weights, 1D/3D LUT, histogram/waveform/vectorscope | параметры меняют pixels; identity сохраняет исходник |
| Монтаж | media bin, source/program preview, tracks, move/trim/split, ripple, fades, playback | integer frames, source offset, bounded decoder/cache, timeline evaluation | разные кадры до/после cut, сохранение edit, экспорт |
| Ноды | поиск, pin drag, typed connections, scalar/math/color/mask/output | DAG, cycle/type checks, topological evaluation, cache | изменение графа меняет exported image, invalid edge rejected |
| UI engine | layers/head/scroll/resize, adaptive controls, drag panels, persistence | reusable panel shell, unclipped presentation canvas, constrained layout | маленькое окно, move/resize/scroll и restart |
| Интерактивность | скорость/направление, прогноз, рост зон, magnet, nearest, layer cycling | filtered velocity, decaying intent, weighted distances, captured target | slow/fast, turn/reversal/timeout, hover/down parity |
| Анимации | пружина кнопки/ручки, лёгкий overshoot, инерция прокрутки, живые связи | damped spring, velocity damping, presentation-only offsets | обратимый переход, точность документа, reduced motion |
| Настройки/debug | тема, радиусы, sensitivity, lifetime, magnet, motion, прогноз/клетки | observable settings, JSON, overlay shared with resolver | live change, roundtrip настроек, visual/debug target совпадает |

Большинство перечисленных инструментов — общие задачи редакторов. Реализация MyCut опирается на их алгоритмы и собственный код; совместимость с документами PSD, DRP, сторонними плагинами и закрытыми эффектами не предполагается автоматически.

## Этап 2. Устройство интерфейса

Одна компактная верхняя строка: MyCut/project menu и режимы Photo/Video/Color/Nodes. Общие документ, источники и history. Рабочая сцена занимает свободную площадь. Инструменты слева, раскрываемые слои, инспектор справа. Панели используют общий shell (основание, content, overlay, header, resize, scroll). Развёрнутые панели размещаются в отдельном HWND поверх native viewport, если это необходимо.

В режиме Video снизу появляется растягиваемый timeline, слева media bin, preview остаётся общим. Color получает wheels/curves/scopes. Nodes получает свободный canvas с palette и preview. Настройки интерфейса доступны через project menu, работают сразу и сохраняются отдельно от документа. Debug overlay использует те же расстояния и параметры, что input resolver.

## Реальные аналогии, на которых строится поведение

- Лист на столе: захват сохраняет место прикосновения; бумага следует руке без прыжка центра.
- Растягиваемая рамка: противоположный край удерживается, захваченный край движется по своей оси.
- Пружина: control вырастает при приближении, возвращается с затуханием; небольшой visual overshoot не меняет точное значение документа.
- Канат и груз: scrollbar реагирует на скорость, после отпускания скорость плавно затухает и ограничивается краями.
- Живой объект: близкий элемент становится заметнее, дальние вспомогательные элементы уменьшаются; главный контент остаётся читаемым.
- Лианы/ветви: провода нод изгибаются между pins, при создании следуют за рукой, при перестановке узлов плавно принимают новую форму. Тип и направление данных остаются явными.

## Этап 3. Правило реализации

Каждый инструмент проходит путь command → document → renderer → inspector → persistence/Undo → проверка реального результата. Пункты текущей готовности и оставшаяся работа находятся в IMPLEMENTATION_PLAN.md. Полная цель остаётся активной, пока нужные инструменты и их проверки не выполнены.
