# MyCut 0.9 — интерфейс по наброскам

Запуск: `Start-MyCut-sketch.cmd` или основной `Start-MyCut.cmd`. Сборка: `out/MyCut-sketch/MyCut.exe`.

## Прочтение листов

За основу взяты оригиналы, а не сгенерированная «контрастная» расшифровка. AI-обработка первого листа исказила надписи. Пользователь прислал исправленный лист: **базовые классы окон, аутлайнер, инспектор — настройки, таймлайн, viewport**; рядом Graph. Именно это исправление является источником требований.

| Лист | Читаемая структура | Адаптация |
|---|---|---|
| 1, исправленный | data: image/video/audio; image editor, item editor, animator, timeline, Graph; общие компоненты окон | один NativeSession и документ, общие outliner/inspector/viewport; централизованный WorkspaceKind; переиспользуемые панели |
| 2 | большой preview, узкий transport, таймлайн снизу; боковые панели компактные | Video без постоянного правого inspector; transport непосредственно над таймлайном; inspector включается иконкой; низ растягивается по ширине |
| 3 | image/item, инструменты слева, параметры сверху; справа параметры эффекта, эффекты, слои; цвета снизу слева | Photo: выбираемые иконки, contextual options, swatches, три изменяемые по высоте панели справа; эффект выбирается для редактирования наверху |
| 4 | viewport слева, Item Details справа, X.Pos/Y.Pos curves, таймлайн снизу | Item Details вынесен в отдельный режим. Кривые/ключи/траектории ещё **не реализованы**; Animator отключён с явным пояснением, фальшивых кривых нет |
| 5 | viewport слева; Graph справа, Details под ним; image/value → nodes → out | рабочий Graph рядом с тем же viewport; реальные типизированные соединения и параметры, а не статичная схема |

Надписи «Win 11 / Панель Windows 11» трактуются как системная панель задач, не как ещё одна полоса внутри MyCut. Нечитаемые маленькие значки не назначались новым инструментам по догадке. Audio и raster brush/eraser/selection/crop пока отсутствуют.

## Общие классы и данные

- `WorkspacePane`: foundation, head с elastic actions, body, overlay. Body содержит собственный scroll или canvas, поэтому весь граф не попадает в глобальную прокрутку.
- `LayeredPanelWindow`: общая основа всех плавающих редакторов и settings; draggable head, resize, scroll, footer, overlay, сохранение geometry.
- `PanelLayoutOptions.Shared`: общие размеры/отступы/chrome семейства плавающих окон. Specialized windows меняют только нужные параметры.
- `EditorViewModel.Workspace`: единственное взаимоисключающее состояние Photo/Item/Video/Color/Graph. Переключение не копирует и не изменяет документ. При переходе Video → Graph/Color/Item сохраняется контекст timeline preview и блокировка дорожек; Photo возвращает scene context.
- Тот же NodeGraph используется списком Effects и NodeCanvas. Exposure/Grayscale/Invert/Ellipse mask добавляются в реальную цепочку изображения. Добавление эффекта или node+wire — одна Undo-транзакция; невалидная связь откатывает и создание ноды.

Graph: `+`, Tab или правый клик — поиск нод; drag порта — кабель; Alt-click входа — отключить кабель; header drag — перемещение; Ctrl — сетка; middle drag — pan; wheel — zoom; F — fit; Ctrl+D/Delete — ноды; Esc — отмена. Зоны портов расширяются по намерению и отпускаются плавно за 0,5 s.

## Исправление настроек и сила анимаций

Журнал `out/MyCut/logs/mycut.log` подтвердил исключение из `MotionBehavior.FitAttraction`: округление давало почти нулевой перевёрнутый диапазон `+2.2737367544323207e-14 .. -2.2737367544323207e-14`. Общая `AttractionGeometry` теперь определяет отсутствие места и возвращает нулевое смещение; безопасный envelope учитывает сильный spring rebound.

MyCut → Interface settings / Debug → **Animation strength · 0–2**: 0 — без переходов, 1 — обычный отклик, 2 — сильнее. Настройка влияет на elastic reflow, притяжение UI, импульсы и overshoot пружин; сохраняется в preset JSON. Magnet, Hover growth, Reduced motion и Scroll inertia остаются отдельными настройками. Инерция зоны нажатия независима от косметических анимаций.

Физические аналогии: панели — секции одного верстака; кнопки в elastic row занимают место и сдвигают соседей; притяжение упирается в реальные стенки панели; node cables следуют за закреплёнными концами, как гибкие провода. Презентационный rebound возвращается к точным координатам документа.

## Проверки и ограничения

Native CTest — семь suites. Windowless model suite проверяет tools, effect chain, atomic palette creation, shared workspaces/timeline context, locks, Undo и attraction на сотнях размеров. Реальные WPF боковые панели измеряются и отрисовываются без запуска окна приложения. Отдельный GUI smoke проверяет настоящее окно, прокрутку настроек, proximity на границах, поле силы анимаций и новые рабочие раскладки. Результаты лежат в `out/MyCut-sketch/smoke`, отдельные pane renders — в `out/MyCut-sketch/qa`.

Это промежуточный срез, не весь творческий движок. Ключевая анимация, произвольные кривые/траектории, аудио, raster tools и advanced color остаются в `IMPLEMENTATION_PLAN.md`. Физические mouse / mixed-DPI / multi-monitor сценарии ещё требуют ручной проверки.
