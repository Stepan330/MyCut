# UI Lab — стартовая сцена разработки интерфейса

Вкладка **UE Study** теперь открывается при обычном запуске: реконструкция заводской темы/раскладки UE 5.8.2, выбранные точные sRGB-роли Starship, Roboto Regular с Apache 2.0 notice, docking. Сначала открыты Viewport/Outliner/Details; Content и Cinematics открывают Content Browser/Sequencer. Поиск, выделение, переименование, видимость и XYZ/reset работают на sample state. Это **не полная копия Unreal**: фото-документ/анимация проекта не подключены, ключи демонстрационные, viewport плоский. [Доказательства и ограничения](UNREAL_UI_STUDY.md). Снимок: `unreal-ui-study-check.png`; capture: `--capture-lab-unreal`.

Режим **Concept** повторяет эскиз через UI Core: верхняя панель, вертикальный Toolbar, белый демонстрационный холст, Outliner и Transform. Инструменты выбираются, Transform включается/выключается, круглая кнопка сворачивает содержимое Outliner, меню показывает демонстрационные свойства. `Concept settings` управляет оформлением и sample content. Фото-документ не редактируется. Оформление Concept пока хранится только в памяти сессии. **Components** возвращает галерею и её отладку. Docking галереи сохранён; раскладка Concept фиксирована по пропорциям эскиза.

GPU-снимок: `ui-concept-check.png`, команда `./target/debug/mycut-next.exe --capture-lab-concept ./ui-concept-check.png`.

Rust-версия теперь открывает UI Lab по умолчанию. Запуск: `../Start-MyCut-Rust.cmd`. Старый WPF launcher не менялся.

В сцене используются **те же компоненты UI Core**, что и в редакторе: TextBlock, InputField (single/multiline), NumberField, ParameterSlider, Button, IconButton, HorizontalBox/Spacer, Window. Дополнительно представлены checkbox, combo, color picker, дерево Outliner, составная строка Details и карточки Content Browser. Иерархия/ресурсы — демонстрационные данные, не обещание работающей маски или Prefab.

## Как экспериментировать

- Слева — Components, справа — Properties, снизу — Events & diagnostics. Панели переносятся и объединяются во вкладки существующим docking; закрытие и floating основных панелей Lab запрещены. Reset Lab layout возвращает исходную раскладку.
- Выбрать компонент можно щелчком по интерактивному образцу или через Selected component. Отображаются ID, размеры в DIP, hover/focus/enabled. Кнопка действительно считает нажатия, поля редактируют текст, slider/числовое поле показывают одну общую величину.
- Properties меняет UI без правки кода. Панель настроек не наследует экспериментальный размер шрифта/отступов, поэтому остаётся управляемой. Масштаб UI меняет всю сцену; Ctrl+0 возвращает 100%.
- Sample Window — настоящий общий Window, а не нарисованный макет. Его можно двигать/масштабировать, включать/отключать movable/resizable/collapsible. Initial size применяется при Recreate sample window. Это специально плавающий образец компонента окна; рабочие панели сцены остаются docked.
- Photo Editor переключает в редактор. Кнопка UI Lab в редакторе возвращает в лабораторию. Изображение, выделение, Undo и несохранённые изменения сохраняются в памяти. Закрытие приложения из Lab предупреждает о несохранённом фото-проекте.
- Прямой запуск редактора: `./target/debug/mycut-next.exe --editor` из `next/`.

## Параметры

| Группа | Настройки |
|---|---|
| Layout & typography | UI scale 65–200%, шрифт 10–32 DIP, высота строк, X/Y spacing, padding, rounding, ширина preview, Spacer, wrap, текст, текстовый/фоновый/акцентный цвета. |
| HorizontalBox | Фиксированные width/height, neutral/minimum child width, Spacer preferred/minimum, requested width с отдельным Manual resize (opt-in), hover growth. Эластичные спейсеры есть между всеми детьми и по краям; сжимаются до минимума раньше кнопок. Их фактические ширины видны под образцом. Общая duration управляет демпфированием всей раскладки. По умолчанию кнопки равны и не выбраны. |
| Buttons & input | Размеры кнопок и полей, enabled/selected, сила и длительность анимации, Inherit/On/Off для панели и отдельной кнопки. Есть контрольный образец Animation OFF. |
| Interaction zones | Adaptive input, базовый радиус, максимальное расширение, коэффициент скорости, скорость уменьшения. Используется та же функция expansion, что в редакторе; это тестовый глобальный egui input margin, не новая per-widget вероятностная модель. |
| Window capabilities | Видимость образца, movable, resizable, collapsible, блокировка docking, initial width/height, пересоздание окна. |
| Debug overlays | Bounds, candidate hit margins, ID, сетка, траектория/направление мыши, непрерывная перерисовка. Overlays не перехватывают ввод. |
| Diagnostics | Скорость указателя, добавочный радиус, stable input dt, число образцов, hover/focus/enabled и журнал кликов/изменений/фокуса. Журнал ограничен 128 событиями; можно остановить/очистить. |

Candidate zones — диагностические прямоугольные поля вокруг интерактивных элементов, не доказательство конечного выбора egui при пересечении. Stable dt — оценка egui, **не измерение GPU frame time/FPS**. Continuous repaint по умолчанию выключен; анимации и изменение зон запрашивают кадры по необходимости.

## Пресет и изоляция

Save preset / Load preset: `%LOCALAPPDATA%/MyCutNext/ui-lab.json`. Туда записываются параметры и docking Lab; при нормальном выходе/переходе в редактор они тоже сохраняются. Сцена всё равно стартует в UI Lab, даже если приложение закрыто из редактора.

Загрузка ограничена 64 KiB, схема/панели/диапазоны проверяются, запись атомарна. Reset properties не меняет документ или настройки редактора. Runtime-ввод образцов, журнал, фокус и временная позиция Sample Window не являются дизайном проекта и в пресет не записываются. Настройки редактора `interface.json`, `workspace.json` и формат `.mycutnext` не менялись. Экспериментальный zoom/animation duration сбрасываются при возврате в редактор; preview typography scoped.

## Реализация и проверка

Новый `app/src/ui_lab.rs` содержит сцену, конфигурацию, пресет и диагностику. `main.rs` выбирает режим, переключает его и защищает несохранённый проект. `ui_core.rs`/`icons.rs` получают общий регулируемый animation duration; приложение не создаёт отдельные копии widgets для Lab. Зависимости и renderer не менялись.

Проверено: 84 теста (64 app + 20 core), Clippy `-D warnings`, сборка. Дополнительно к проверкам Lab: зеркальность reflow, постоянный центр активного элемента, геометрия у краёв/в слишком узком контейнере, возврат без накопленной ошибки, стабильные ID/границы и реальные клики после сжатия. Регрессия проверяет равный старт даже со старым requested width, переход hover к соседу без скачка и возврат к нейтральным размерам. GPU-снимки через собственный viewport API: `ui-lab-check.png`, `ui-lab-debug-check.png`, `horizontal-box-check.png`. Это не полная проверка OS-level ввода, IME или accessibility.

```powershell
./target/debug/mycut-next.exe --capture-lab ./ui-lab-check.png
./target/debug/mycut-next.exe --capture-lab-debug ./ui-lab-debug-check.png
./target/debug/mycut-next.exe --capture-lab-hbox ./horizontal-box-check.png
```

Тестовые capture-режимы не перезаписывают пользовательские настройки.
