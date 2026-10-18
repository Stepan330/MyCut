# MyCut 0.6 — взаимодействие и motion engine

## Управление объектами

Клик использует тот же resolver, что и hover. Выделение рисуется GPU overlay; четыре угловые, четыре Edge ручки и круг поворота имеют размеры в screen DIPs с учётом DPI/viewport. Рост и магнитное смещение — presentation feedback. Клик вне всех зон снимает выделение.

`InteractionStyle`: размер угловой ручки 16 DIP, радиус зоны 24 DIP, толщина frame 2.4 DIP. Круг поворота отстоит от верхнего края на 48 DIP; снаружи углов существуют rotation zones. Все кандидаты ручек сравниваются по расстоянию к их центру; в overlap побеждает ближайший, а не первый в массиве. Ручки — foreground interaction layer. Hover показывает halo и увеличивает выбранную ручку; именно она запускает drag.

Для тел объектов используется настраиваемый margin (default 16 DIP) вокруг повёрнутого прямоугольника. Прямой hit выбирает topmost доступный слой; повторный клик в пределах 6 DIP и 1.2 s циклически выбирает следующий ниже. Вне тела сравнивается weighted distance к поверхности с направленным расширением. Невидимые/locked/нулевой opacity Items не имеют зоны. `resolveHit` и Context.resolve совместно используются begin/hover; drag сохраняет исходную цель.

## Зоны controls и числа

`ProximityInput` обслуживает Window и Popup roots. Кнопки, list items и numeric surfaces имеют margin 8 DIP вокруг своей видимой геометрии. Минимальная высота кнопки — 34 DIP. Resolver учитывает enabled/visible/hit-test состояния и clipping, сравнивает расстояния до поверхности, а при равенстве — до центра. Hover отмечает одну ближайшую цель. Прямые клики сохраняют обычное WPF поведение; клик в дополнительном margin перенаправляется той же цели. Button использует стандартный Invoke provider, поэтому Click и ICommand исполняются обычным путём. Mouse up за пределами её зоны не активирует кнопку.

`ParameterRow` объединяет label, значение и индикатор диапазона в поле высотой 42 DIP. Down запоминает число; movement менее 5 DIP ещё считается click. За пределами порога начинается relative scrub: горизонтальное изменение × Step, без абсолютного прыжка по диапазону. Shift меняет чувствительность ×0.1, Ctrl ×10; переключение modifier в середине drag не пересчитывает уже пройденное расстояние. Один gesture — один undo; Escape восстанавливает snapshot.

Click без drag открывает настоящий TextBox с выделением значения. Enter/потеря фокуса принимают конечное число, Escape отбрасывает буфер. Некорректный Enter оставляет редактор открытым; при уходе фокуса некорректный буфер отбрасывается. NaN/Infinity запрещены, точка и запятая принимаются. Повторное принятие неизменённого значения ничего не записывает. Ctrl+Z/Ctrl+Y в режиме текста работают с текстом, Ctrl+S принимает текущий ввод перед сохранением проекта. Bounded параметры соблюдают диапазон; position/rotation допускают выход за номинальный display range, ограничения модели остаются в C++.

Drag по телу сохраняет место захвата. Drag за угол сохраняет пропорции вокруг противоположного угла; за Edge изменяет только ширину/высоту вокруг противоположного ребра. Модель хранит scaleX/scaleY. Круг/наружная зона угла поворачивают вокруг центра. Shift: ось/15°/scale 0.1; до 4 DIP движения жест остаётся выбором. Flip ещё не реализован.

На down создаётся одна Session transaction, move изменяет её кандидат, up записывает одну undo entry. Escape восстанавливает исходный снимок без добавления undo/redo. Потеря mouse capture завершает жест по последнему состоянию. Переключение выделения само по себе не создаёт undo. Во время drag project coordinates обновляются сразу, без задержки от анимации.

`engine/Interaction` содержит геометрию и state machine. Один `gizmo()` используется renderer и hit testing; размеры/точки не вычисляются независимо в WPF. `ViewportHost` переводит client pixels в canvas units с учётом letterbox и viewport scale, захватывает mouse, обновляет cursor и отправляет events через internal C ABI.

GPU viewport размещён в зарегистрированном собственном Win32 class `MyCut.GpuViewport`, с настоящим client hit (HTCLIENT). Заменён прежний STATIC host; тест проверяет WM_NCHITTEST и направляет WM_LBUTTONDOWN/MOVE/UP/KEYDOWN в HWND. Исключения input handler перехватываются до возвращения в unmanaged window procedure.

## Список сцены

По умолчанию в левой полосе шириной 44 DIP находится иконка. Hover открывает панель после 90 ms; переход занимает 180 ms. Панель — WPF Popup с отдельным HWND, поэтому находится поверх D3D11 HwndHost. Ширина viewport не меняется. Техническая основа: [WPF Popup](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/popup).

После выхода мыши действует bridge delay 240 ms: курсор успевает перейти между иконкой и панелью. Закрытие длится 150 ms, затем HWND скрывается. Повторный hover разворачивает текущий переход, не перезапускает его от начала. Клик по иконке или Pin закрепляет список; Unpin возвращает hover поведение. При уходе в другое приложение Popup скрывается, а закреплённый список возвращается после активации. Размеры и pin state сохраняются отдельно от проекта.

## Компактная верхняя строка и меню проекта

Логотип и переключатели режимов находятся в одной строке 52 DIP (прежде 114 DIP). Название документа располагается справа с обрезкой длинного текста; повторный номер версии и отдельная полоса режимов удалены. Заголовок viewport — 40 DIP, строка подсказки — 30 DIP, статус — 30 DIP. Это увеличивает доступную рабочую область без уменьшения интерактивных зон кнопок.

Клик по MyCut открывает отдельный Popup с командами New/Open/Save/Import/Export/Restore demo. Панель не участвует в измерении workspace, перекрывает native viewport и использует общий MotionEngine для opacity/slide. Повторный клик, Escape, команда, клик снаружи (включая native viewport), деактивация или изменение положения окна закрывают её. Down на сфокусированном логотипе открывает меню и переводит фокус к первой команде. Команды и proximity зоны работают так же, как в остальном UI. New/Ctrl+N создаёт пустой Project после обычной проверки несохранённых изменений; Restore demo отдельно возвращает демонстрационную композицию.

## Motion engine

Shared PointerIntentTracker получает screen positions в DIPs от WPF roots и native viewport. Высокочастотные события накапливаются до достаточного интервала, velocity фильтруется; reversal заменяет старое направление. Score = surface distance / (base radius + forward expansion), expansion зависит от alignment³ и скорости. После остановки оно затухает за настраиваемый lifetime (default 1 s). Forecast использует замедление; дальность визуализации ограничена. Direct hits имеют score 0 и приоритет перед соседними расширенными зонами.

MotionBehavior отделяет стабильную layout geometry от scale/pull transform. FitAttraction ограничивает рост и притяжение ancestor clip/root bounds, резервируя место для spring overshoot; широкие numeric fields дополнительно увеличивают число. Root input перенаправляет выбор при пересечении визуальных transforms, сохраняет цель до release. InputDebugAdorner рисует те же weighted cells; native overlay рисует handle cells, зоны и trajectory. InterfaceSettings меняет реальные options и сериализует preset отдельно от Project.

MotionCurve поддерживает damped spring и краткий impulse. После перемещения объекта presentation offset слегка продолжает направление и возвращается к точной сохранённой позиции; export/scopes не получают этот offset. InertialScrollBehavior затухающе продолжает wheel/scrollbar motion и останавливается на границах. LayeredPanelWindow содержит foundation/content/overlay/head/scroll/footer; footer переносит кнопки при недостатке ширины, geometry сохраняется в panels.json.

`MotionEngine` принадлежит окну; один frame clock `CompositionTarget.Rendering` обслуживает активные каналы. Канал адресуется `(owner, channel)`. `MotionCurve` вычисляет eased value от монотонного времени (cubic ease-out), без накопления frame delta. Ретаргетинг начинает новую кривую с текущего значения старой и заменяет completion callback, поэтому отменённое закрытие не скрывает вновь открытую панель.

Треки обновляют presentation properties через callbacks. Сейчас engine анимирует:

- opacity и slide панели списка;
- небольшое scale кнопок/list items на hover и press;
- hover highlight объектов в GPU shader;
- яркость и размер handles при смене выделения.

`MotionBehavior.Engine` — наследуемая attached property; Popup получает тот же instance явно. Когда активные треки заканчиваются, frame clock отписывается. Unload/close отменяет callbacks и освобождает owners. Системная `ClientAreaAnimation=false` включает reduced motion: значения применяются сразу, кадры не планируются.

Это animation subsystem **для взаимодействия и визуальной реакции**, не timeline/keyframes engine проекта. Hover и выделение не меняют Item Definition/Instance, не сохраняются в `.mycut`, не создают undo и не попадают в PNG. Для статической композиции renderer обновляется при изменениях/активных эффектах, а не постоянно на idle.

## Проверки

Interaction CTest проверяет click/move, isolate Instance, single-step undo, Shift axis, opposite anchor, rotate/snap, Escape, empty/topmost hits, screen-sized tolerance и outside-corner rotation. Render CTest проверяет пиксели рамки/hover, изменение selection feedback и полное отсутствие overlays в clean output.

Full app smoke использует настоящее HWND message dispatch для мыши и Escape. Routed hover/click events проверяют список; frame pumping проверяет постепенное закрытие, reversal и pin/unpin. Pure-clock tests проверяют непрерывность retarget, отмену старых completion, idle cleanup и reduced motion. Превью `MyCut-ui.png` и `MyCut-ui-scene.png` собираются из настоящего WPF rendering и D3D readback; это composited previews, не screen capture.

Проверка через SendMessage не равна физической проверке мышью на всех мониторах; multi-monitor DPI, pen/touch, edge cases с перемещением окна и real-user cursor motion остаются ручными сценариями.
