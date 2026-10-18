# Unreal UI: исследование и первый стенд MyCut

## Доработка Outliner · 2026-10-16

Общий компонент `app/src/ui_core/outliner.rs` подключён к UE Study: компактные строки 20 DIP, выделение на всю ширину, отдельные колонки видимости/имени/типа, раскрываемый корень, поиск по имени и типу, очистка поиска, сортировка заголовками и счётчик. Поиск раскрывает корень, не сбрасывая сохранённое состояние раскрытия. Сортируется представление, не сцена; выбранный объект и Details сохраняют общий индекс. Нажатие на глаз не меняет выделение. Векторные иконки переиспользуют общий `icons::paint_icon`; зависимость от отсутствующих символов шрифта убрана после GPU-проверки.

Основание: локальный UE 5.8.2, `Editor/EditorStyle/Private/StarshipStyle.cpp:1215–1224` (иконки, AlternatingRow), `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:2244–2246` (Recessed/Background), `Styling/StyleColors.cpp:111–114` (Select/SelectInactive/SelectHover). Код и SVG Epic не переносились. Пока используется активный цвет Select без отдельного неактивного выделения.

Проверки: 81 тест (61 app + 20 core), включая сортировку/фильтр без изменения модели и реальный pointer input по строке и глазу; Clippy `-D warnings`, сборка. Снимок собственного приложения: `unreal-outliner-check.png`. Ограничения: это пока Outliner демонстрационной сцены UE Study, не замена Outliner фото-документа; не реализованы папки/reparent, множественное выделение, клавиатурная навигация и изменяемая ширина колонок. Пиксельное совпадение с живым UE не подтверждено.

Дата: 2026-10-16. Цель: повторить полезные правила текста, параметров и Sequencer собственной реализацией, не переносить Unreal Engine в Rust.

Уточнение пользователя: требуется полное совпадение интерфейса, включая цвета, а не стилизация; эталон — самый стандартный UE. Зафиксирован UE 5.8.2 / заводская тёмная тема / DefaultLayout.ini. **Реконструкция пока не отвечает критерию полной копии.** DPI/состояния/отрисовку нужно ещё сравнить живыми эталонными кадрами. C++/Slate остаётся кандидатом для feasibility-пилота; массовая миграция не начата, существующий Rust-редактор сохранён.

## Что реально исследовано

Epic Launcher manifest указал локальную установку `D:/Hight/UE/UE_5.8`. `Engine/Build/Build.version` подтвердил **5.8.2, changelist 56702186, ++UE5+Release-5.8**. Commit SHA неизвестен: это launcher build, не Git checkout.

Прочитаны соответствующие реализации/контракты исходников установленного движка. REA не установлен и не запускался: для этих вопросов уже доступны исходники, поэтому декомпиляция не добавила бы доказательств. Unreal Editor не запускался; результаты не являются записью живых взаимодействий или pixel-perfect сравнением. Снимки пользователя — дополнительные визуальные референсы.

## Доказательства → решения

Пути ниже относительно `D:/Hight/UE/UE_5.8/Engine/Source`.

| Область | Найдено в UE | Применение в MyCut |
|---|---|---|
| Текст | `Runtime/Slate/Private/Widgets/Text/STextBlock.cpp:258,312,337`: OnPaint и ComputeDesiredSize разделены; layout cache обновляется, при изменившемся переносе требуется новая раскладка | Сохранить egui layout/font cache, проверять измерение/перенос/клип после смены размера; не подменять строки рисунками |
| Формирование глифов | `Runtime/SlateCore/Public/Fonts/FontCache.h:791,1067,1077`: shaping, HarfBuzz, кеширование shaped glyphs в атласе | Это отдельная от внешнего стиля задача. Текущий egui preview не объявляется эквивалентом Slate shaping; для сложных письменностей нужен отдельный выбор библиотеки и тесты |
| Стиль текста | `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:34,38,40`: отдельные normal/small/large стили | Использовать типографические роли и компактный UI; не копировать размеры между движками как одинаковые физические пиксели |
| Числовое поле | `Runtime/Slate/Public/Widgets/Input/SNumericEntryBox.h:165–199,267–310`: разные пределы модели/ползунка, отдельные change/commit/begin/end, spin и text entry | Общий PropertyRow поверх NumberField: XYZ в одной строке, drag/ввод, reset строки, признаки начала/изменения/окончания. Не вводить диапазон модели автоматически |
| Транзакции | `Editor/DetailCustomizations/Private/MathStructCustomizations.cpp:743,752`: начало/конец slider gesture ограничивают transaction | Будущая интеграция должна давать одну Undo-запись на жест. В стенде пока только UI-события, не полноценная транзакционная подсистема |
| Временные диапазоны | `Editor/Sequencer/Private/SSequencer.cpp:253–305,350–376`: ViewRange, PlaybackRange, DisplayRate, TickResolution передаются отдельно | Шкала просмотра не должна менять диапазон воспроизведения или точность времени |
| Навигация | `Editor/Sequencer/Private/SequencerTimeSliderController.cpp:119,154,1843`: snap, перевод мыши во время; Ctrl+wheel zoom, Shift+wheel pan | В стенде реализованы эти сочетания, RMB pan, scrubbing с опциональным snap |

Официальные подтверждения: [Slate architecture](https://dev.epicgames.com/documentation/en-us/unreal-engine/slate-architecture?application_version=4.27), [FontCache API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/SlateCore/FSlateFontCache), [Sequencer toolbar](https://dev.epicgames.com/documentation/unreal-engine/sequencer-cinematic-toolbar-in-unreal-engine?lang=en-US). Версия местных файлов приоритетнее документации другой версии.

## Идентичность исследованных файлов: SHA-256

| Файл | SHA-256 |
|---|---|
| SNumericEntryBox.h | BE35914B15CE1A3C342C10E218BC4C0A98053746EFF888020E2A087A5816B0E8 |
| STextBlock.cpp | 1E8040C303EB60827D7F9E2B002F64A68178D5F4E51D38C4C6C04B83BD5A069C |
| FontCache.h | 14098E9529581EACA25B5FC25DB84632ACA60BAEBEA8D2E94EA7EEF78FF71C39 |
| StarshipCoreStyle.cpp | D7E01D4AC7CBB96724D35B2749AB5A49D9129F8A0BFABA937F33FF819639062D |
| MathStructCustomizations.cpp | D933C1A01004687BDC2786AE4BFF3B8E492533F1054FC67626BCCDE8D806ABA2 |
| SSequencer.cpp | B6B18DCEB53E58529D78BD1CD78613CB93ED783482AAB493987392538F71694B |
| SequencerTimeSliderController.cpp | 47676D1EAAE080E8BDB9328D8A1601F41036EA76BB9A3BAC4FA2EAC0AB1949B0 |

## Перенос: категория C, архитектурный образец

Исходники UE и графика/иконки Epic в MyCut не копировались. Для Roboto отдельно проверен Roboto.tps и соответствующий ROBOTO_License.txt: font data copyright Google 2012, Apache 2.0. Неизменённый Roboto-Regular.ttf включён в app/assets/fonts вместе с полным уведомлением/лицензией. Остальные fallback fonts egui и code-native иконки MyCut сохранены. Новые crates не добавлялись. Отдельная лицензия Roboto не означает разрешения переноса остальных ресурсов UE.

## Реконструкция заводской темы и раскладки

`ui_core/unreal_theme.rs` хранит sRGB-роли из StyleColors.cpp:84–114: Background #151515, Panel #242424, Input #0F0F0F, InputOutline #383838, Recessed #1A1A1A, Header #2F2F2F, Foreground #C0C0C0, Primary #0070E0 и hover/press. Это точные значения выбранных ролей, **не утверждение**, что каждый пиксель уже совпадает. Перевод 10 pt в начальные 13.333 logical points — рабочая гипотеза; font metrics/DPI и антиалиасинг ещё не сверены со Slate.

Engine/Config/Layouts/DefaultLayout.ini, LevelEditor_Layout_v1.8: открыты Viewport, SceneOutliner, SelectionDetails; ContentBrowser и Sequencer закрыты. Правый столбец: коэффициент 0.25 против 1 у левого; внутри правого Outliner 0.4 против 1 у Details. После исключения закрытых узлов начальные доли — 80/20 по ширине и 0.4/1.4 по высоте правого столбца. Это исходное дерево, не измерение конечной геометрии Slate со всеми minimum sizes.

В workspace сохранены начальные доли/закрытые вкладки. Content/Cinematics и Window открывают нижние вкладки без дублей. Перетаскивание вкладок и resize используют craft-ui. Восстановление: Window → Load default layout. Макет/sample state пока не сохраняются. Outliner/Details/Content Browser разделяют выделение/свойства sample объектов; это не новая модель проекта. Viewport — плоский предпросмотр, не UE 3D-движок. Неподдержанные Save/Undo/Play world отключены, не имитируют успех.

Дополнительные pins (SHA256):

- StyleColors.cpp: 4850418DA3032E5D449FBB9AC3BBE7D74AAA72EF7BF0FDF842733FB971C5E986.
- DefaultLayout.ini: F5AF5937CA373BF5A10F759C1CDDD9446599BBC9F7ED93DC7F1EF40D75466413.
- Roboto-Regular.ttf: 16466EF65064E6F3885A6D2806B8949AC1AC38B524DD0CF8FC96565EB4CC28E8.
- ROBOTO_License.txt: 813AEC82B71FE6FC927F1F9F5C08C5A098785B0A89E3A2E76697AA4662E5F666.

До полной копии остаются: Slate text metrics/shaping/IME, геометрия/состояния всех иконок, все меню/контекстные меню/диалоги, полный Outliner/Content Browser/Details, drawer/floating/close/restore/persistence, редакторы ресурсов, viewport/camera и полный Sequencer. Нужны reference screenshots и input traces; тесты палитры/докинга не доказывают полную визуальную эквивалентность.

Результат: вкладка **UI Lab → UE Study**. `ui_core/property_row.rs` — общий компонент параметров; `ui_core/timeline.rs` — изолированный UI-прототип шкалы; `ui_lab/unreal_study.rs` — композиция для исследования. Текст использует существующие TextBlock/InputField и локальную компактную типографику.

Работает: редактирование текста, изменение шрифта с автоматической раскладкой; редактирование XYZ/reset; выбор дорожки; scrubbing; snap к 30 fps; Ctrl+wheel zoom с сохранением времени под мышью; Shift+wheel и RMB pan; Play/Pause/Stop/Fit, обновление без движения мыши. В стенде фиксированные 30 fps, 24 000 ticks/s, 8 секунд. Эти константы **не являются** новой моделью времени проекта.

Ограничения: ключи только демонстрационные, их нельзя редактировать; нет интерполяции, Curve Editor, Auto Key, undo timeline, вложенных sequence, общей вертикальной прокрутки дерева/дорожек, media playback. Параметры и шкала пока не меняют фото-документ. Не реализованы полный shaping/IME parity и визуальная эквивалентность UE. PropertyEdit — сигналы UI, не гарантия всей семантики commit/cancel UE. Стенд нельзя использовать как вторую систему Animation/ParameterResolver.

## Следующие проверяемые порции

### Пилот Details: результаты адаптации готового ввода

Итог проверки этапа: 79 тестов (59 app + 20 core), Clippy с `-D warnings`, сборка. GPU-снимок `unreal-details-pilot-check.png` получен и визуально проверен. На первом снимке обнаружено растягивание строки на высоту панели; исправлено ограничением geometry и покрыто тестом трёх компактных строк в высоком контейнере. Это проверка MyCut, не pixel-diff с запущенным UE.

Проверены реальные реализации SpinBox/EditableTextBox, а не только палитра:

- `StarshipCoreStyle.cpp:614–625`: фон Input, обводки InputOutline/Hover/Primary, TextPadding (7,2.5), пропорциональный шрифт. `CoreStyle.cpp:61–62`: radius 4, thickness 1.
- `StarshipStyle.cpp:3657–3658` и FStyleFonts Small: отдельный мелкий шрифт PropertyWindow. Начальная конверсия 8 pt → 10.667 logical points всё ещё требует проверки реальным DPI, не является измеренной эквивалентностью.
- `PropertyEditor/Private/UserInterface/PropertyEditor/PropertyEditorConstants.h:30`: строка минимум 26 units.
- `ComponentTransformDetails.cpp:517,585,640`: Location/Rotation/Scale используют цветные метки; `SVectorInputBox.h:492–535`: узкий цветной индикатор внутри поля, а не буквенный префикс XYZ. Цвета в SNumericEntryBox.h:878–884 заданы в линейном пространстве; при переносе преобразованы в sRGB, не умножены напрямую на 255.
- `SSpinBox.h:98–99,118`: Shift ×10, Ctrl ×0.1, RevertTextOnEscape. При переносе обнаружено, что DragValue egui имеет другое направление Shift и smart-aim округление. В PropertyRow используется собственный тонкий линейный адаптер delta поверх готовых ввода/фокуса; drag не делегирует эти две семантики egui.

`NumberField::starship()` выбирает оформление поля без изменения прочих старых NumberField. PropertyRow имеет стабильные ID при изменении ширины, live update, отдельные began/committed/cancelled/ended, исходный снимок значений для будущего history adapter. Escape восстанавливает значения строки; Enter/потеря фокуса/конец drag завершают жест. Reset виден только при отличии от defaults и выдаёт один commit. Новые inf/NaN не попадают в значения. Это UI-контракт, не новая история документа; полноценный Undo проекта по-прежнему не подключён. Сессии скрытых строк не продолжаются после пропуска кадров; перед внедрением в рабочий документ необходимо отдельно определить commit/cancel при скрытии владельца.

Проверки используют реальные egui pointer/key/text события: live input → Escape, input → Enter (один commit), drag/release с Shift/Ctrl, Reset, отказ от non-finite, отсутствие legacy clamp, ID при перестройке ширины. Отдельно проверены фон/обводки трёх состояний. OS-level IME, screen-reader, live UE traces и pixel-diff ещё не проверены. Поэтому даже этот пилот нельзя называть абсолютной копией Details.

Дополнительные SHA256:

- ComponentTransformDetails.cpp: `6DAD93C48195383D062110D2F253A093411C235F37F0C76E2904511A35BAFF70`.
- PropertyEditorConstants.h: `690BC3C0BC52780DA9D8DAC966996FD06DC094866B22A13B157E3A40B710F012`.
- CoreStyle.cpp: `403C8E8D08E015B2B02259B97A0873B04BC06CE46F288922B4B211B4CEB98829`.

### Дальнейшая очередь

1. Зафиксировать живые сценарии конкретной версии UE (DPI, шрифт, числовой ввод, scrub/zoom), добавить сравнительные кадры и таблицу отличий.
2. Выбрать единую модель времени/анимации ядра и привязать её к ParameterAddress; UI-демонстрационные ticks заменить адаптером этой модели.
3. Добавить транзакционные begin/update/commit/cancel с Undo, сначала на одной строке параметров; тест отмены Escape и потери фокуса.
4. Подключить выбор/перетаскивание ключей, общий scroll дерева/дорожек и Curve Editor. Не создавать отдельную копию параметров для timeline.

Проверки: unit tests zoom anchor/pan/snap/границ, настоящий egui pointer scrub и воспроизведение без новых mouse events; повторяется существующий workspace suite. GPU-capture: `./target/debug/mycut-next.exe --capture-lab-unreal ./unreal-ui-study-check.png`. Результат — Vulkan/RTX 5060 Ti, не OS-level UI-автоматизация Unreal.
