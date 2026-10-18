# MyCut: аудит и предложение постепенной миграции

Дата: 15 октября 2026. Основание: приложенное задание «архитектурная переработка и продолжение разработки».

Это результат исследования текущего кода, а не отчёт о реализации новой архитектуры. Исходники приложения, зависимости, формат проекта и стартовый скрипт в рамках этого аудита не менялись. Крупная переработка начинается после подтверждения плана.

## 1. Карта существующей программы

| Слой | Реальные файлы и сущности | Назначение |
|---|---|---|
| Переносимое ядро C++20 | `engine/include/mycut/Project.h`, `engine/src/Project.cpp` | `Project`, `Definition`, `Instance`, двумерный `Transform`, снимок `Plane`; валидация ID, данных и ссылок |
| Документ и история | `engine/include/mycut/Session.h`, `engine/src/Session.cpp` | Транзакционное редактирование копии Project, Undo/Redo, объединение жестов, отмена |
| Граф | `engine/include/mycut/Nodes.h`, `engine/src/Nodes.cpp` | 12 видов нод, типы Scalar/Color/Image/Mask, проверка связей и циклов, достижимый порядок вычисления, CPU reference и генерация HLSL |
| Монтаж | `engine/include/mycut/Timeline.h`, `engine/src/Timeline.cpp` | Треки, клипы, trim/split/ripple delete, скорость, fade, рациональная частота кадров, вычисление видимых Plane |
| Хранение | `engine/src/Serialization.cpp` | Текстовый MYCUT 6, чтение версий 1–6, атомарная замена файла через временный файл |
| Windows rendering | `native/include/mycut/Renderer.h`, `native/src/D3D11Renderer.cpp` | D3D11, WARP fallback, текстуры, сцена из плоскостей, скомпилированные графы, интерактивные контуры, capture/PNG |
| Генераторы и текст | `native/src/Generators.cpp` | DirectWrite/Direct2D/WIC, текст, фигуры, градиенты, измерение текста и ключи текстур |
| Видео | `native/include/mycut/Media.h`, `native/src/Media.cpp` | Media Foundation, фоновый VideoSource, ограниченный кэш кадров, экспорт H.264 MP4 без аудио |
| Межъязыковая граница | `native/include/mycut/Bridge.h`, `native/src/Bridge.cpp`, `editor/Services/NativeMethods.cs`, `NativeSession.cs` | C ABI и P/Invoke; ручные структуры Item/Content/Grade/Node/Clip |
| Приложение | `editor/ViewModels/EditorViewModel*.cs` | Состояние выбора, режимы, команды, параметры, жесты, запуск операций |
| Представление | `editor/MainWindow.xaml*`, `editor/Controls/*`, `editor/Views/*`, `editor/Themes/*` | WPF .NET 10; один документ в Photo/Item/Video/Color/Graph; собственные NodeCanvas и TimelineCanvas |
| Фотооперации | `editor/Services/PhotoProcessor.cs`, `Controls/PhotoProcessingWindow.cs` | Magick.NET Q16 x64 15.0.0: CPU-обработка в фоне и новый PNG-слой |
| UI-анимация и попадание | `editor/Motion/*`, `Services/AdaptiveZoneLaw.cs`, `ZoneExpansionMemory.cs`, `engine/include/mycut/ZonePresentation.h`, `engine/src/Interaction.cpp` | Адаптивные зоны, их инерция, сглаживание контуров и анимации интерфейса |

`CMakeLists.txt` уже разделяет MyCutCore, MyCutGraphics и MyCutNative. Ядро не включает WPF или D3D11. Но публичный Windows-интерфейс Renderer включает `windows.h` и HWND, а ядро генерирует HLSL: полное отделение от графического API пока не закончено.

`MyCut_Windows_Preview/` — самостоятельный старый PowerShell/WPF-прототип с собственным `Start-MyCut.cmd` и `MyCut.ps1`; он не входит в CMake или текущий .csproj. Его аудио/preview-возможности нельзя приписывать основной программе.

Версии расходятся: .csproj — 0.10.0, CMake — 0.9.0, формат документа — 6. Это три разных понятия, но версии продукта следует согласовать при следующем выпуске.

## 2. Что подтверждено кодом и тестами

Работают создание/открытие/сохранение документа, импорт изображений и поддерживаемого Windows видео, общий Definition для нескольких Instance, независимое перемещение/поворот/масштабирование Instance, порядок слоёв, видимость/блокировка, текст Windows, фигуры и градиенты. Редактирование Definition распространяется на использующие его Instance. Дублирование сохраняет ссылку на Definition, но копирует граф с новыми ID нод.

Есть реальные GPU-эффекты графа: Add/Multiply/Mix, маска EllipseMask, ApplyMask, Grayscale, Invert, Exposure, Scalar, Color, Source и Output. Невалидные связи и циклы отклоняются транзакционно. Вычисляются только ноды, достижимые от Output; валидация проверяет также отключённые ветки. Текущая арифметика объединяется в один pixel shader; отдельная текстура на каждую такую ноду не создаётся. Значения параметров передаются отдельно от ключа топологии shader.

Есть цветокоррекция exposure/contrast/saturation/temperature/tint и lift/gamma/gain/offset, scopes и отдельный Color-контекст. Это ещё не полноценный профессиональный color pipeline.

Таймлайн поддерживает монтаж видео: треки, клипы, trim, split, snap, fade, скорость, In/Out и экспорт. Видео декодируется отдельным worker на источник/владельца, кэш ограничивается числом кадров и бюджетом памяти. Экспорт ждёт нужные кадры. Общий scheduler вычислительного графа отсутствует.

Маска из графа выбирается через Outliner/список эффектов; числовые параметры и контур канваса изменяют одну Node. Перемещение и радиусы маски участвуют в Undo/Cancel. Это UV-маска, а не независимый Space-объект.

PhotoProcessor содержит 11 операций. Он читает исходник, выполняет операцию и возвращает PNG; UI импортирует файл из LocalAppData/MyCut/assets новым слоем. Исходник сохраняется, но цепочка операций в Project не сохраняется. Preview рассчитывается в полном разрешении, затем показывается уменьшенным. Отмена проверяется перед/после native-операции, не прерывая её посередине.

Повторно выполнено в этом аудите:

- `scripts/Build.ps1 -NativeOnly -Test`: CTest Core/Interaction/Timeline/Nodes/Bridge/Render/Media — 7/7.
- `dotnet build editor/MyCut.Editor.csproj --no-restore --output out/MyCut-audit`: успешно, 0 warnings / 0 errors. Это проверка managed-сборки; каталог audit не объявляется новым готовым выпуском.
- `dotnet run --project tests/model/MyCut.ModelTests.csproj --configuration Debug --no-restore`: PASS, включая текст, маску, фотооперации, связи, Undo и измерение панелей.
- `dotnet run --project tests/MyCut.InterfaceTests.csproj --configuration Debug --no-restore`: PASS, зоны и инерция.

Новый полный GUI smoke не запускался: продуктовый код не менялся. Исторический результат 127 проверок находится в `out/MyCut-structure/smoke/result.json`; он не заменяет будущие тесты миграции. Профессиональная нагрузка, HDR, длинные проекты и multi-monitor DPI этим аудитом не измерялись.

## 3. Соответствие новой концепции

| Новое понятие | Ближайший текущий аналог | Несовпадение |
|---|---|---|
| Data | Definition и частично Instance.graph/grade | Содержимое и обработка разнесены между общей Definition и экземпляром; нет самостоятельной Data-композиции |
| Space | Transform у Instance | Только 2D x/y/scaleX/scaleY/rotation; нет pivot, parent, z, геометрии, камеры; opacity уже относится скорее к композиции |
| Item | Instance → Definition | Есть независимый трансформ и общая ссылка; нет Override и возможности Space без визуальной Data |
| Data Editor | Photo/Graph/Color | Режимы UI есть, но граф привязан к выбранному Instance, а не к самостоятельной Data |
| Item Editor | Item workspace | Работает с тем же Instance; отдельный путь выбора вложенной композиции отсутствует |
| Animation | Timeline и UI MotionEngine | Timeline задаёт время клипа/fade; MotionEngine — presentation clock. Универсальных треков параметров документа нет |
| Prefab | Общий Definition | Нельзя вынести параметры, переопределить текст экземпляра или вложить композицию |
| Bounds | Definition.width/height | Размер источника, поверхности и области рендера смешаны; нет origin/отрицательного padding эффекта |

## 4. Основные конфликты, в порядке влияния

1. **Владение графом.** `Instance` содержит `NodeGraph graph` и `ColorGrade grade` (`Project.h`); `Session::duplicate`, `addClip`, `splitClip` вызывают `copyGraph`. Если просто переименовать Definition в Data, общий prefab всё равно не появится. Нужна самостоятельная Data-композиция с графом и локальная таблица Override у Item. При миграции разные legacy-графы должны оставаться разными Data-ветками, даже если читают общий старый Definition.

2. **Один физический Source на весь граф.** `graphShaderBody()` объявляет один `src=image.Sample(...)`; каждый Source возвращает его. Renderer связывает одну image-текстуру с plane. Mix двух Source сейчас смешивает один и тот же вход. Нельзя соединить изображения из двух разных Item; нет DataReference/ObjectReference. Требуются несколько логических входов и план привязки ресурсов, а не ещё одна кнопка Mix.

3. **Параметры не имеют идентичности.** `Node.values[8]`, `inputs[3]`, `NodeKind` и ручные switch в Nodes.cpp; в C# `NodeSchema` повторяет имена, типы, диапазоны и совместимость. Добавление эффекта требует синхронных правок ядра, CPU evaluator, HLSL и UI. `ContentText` меняет Definition через `mc_content_set`, поэтому текст меняется у всех её экземпляров. Нет ParameterId, Exposed mapping, defaults/override/reset и диагностики потерянных ссылок.

4. **Геометрия и bounds.** Renderer строит поверхность из width/height относительно фиксированного центра .5; viewport и экспорт используют 1280×720. `fitText()` увеличивает width/height, но сохраняет старый размер при уменьшении текста, измеряет без переноса, тогда как отрисовка layout использует заданную область. Даже неизменный Transform не гарантирует сохранения положения прежней верхней левой точки после изменения размеров. Blur с выходом за старый прямоугольник в существующем графе выразить нельзя.

5. **Нет универсального времени параметров.** Сохранение не содержит кривых/ключей; evaluateTimeline меняет время источника и прозрачность clip. Добавлять анимацию отдельно в каждый setter эффекта нельзя. Нужен один resolver параметра по контексту и времени.

6. **Outliner показывает граф, а не пространственную иерархию.** `OutlinerControl` создаёт корень Instance и дочерние Node, а метка Item появляется при непустом графе. Global/Local фильтрует набор строк; это ещё не путь вложенной композиции. Ни parent-связи, ни Group/Merge/Bake в модели не определены. В новой концепции обычное изображение также является Item независимо от наличия эффектов.

7. **Ресурсы и вычисление недостаточно абстрагированы.** Definition хранит путь строкой, `textureKey` для изображения опирается на путь, не на ревизию файла; изменение файла по тому же пути не задаёт полноценную инвалидацию. Нет единого кэша Data по времени/контексту/override, запроса bounds/ROI, общего бюджета decoder workers. Операции Magick.NET находятся в managed editor и создают внешние PNG, поэтому не включены в ленивый граф ядра.

8. **Пределы производительности и формата.** Session копирует и валидирует Project на каждое изменение; это надёжный текущий механизм, но будущая стоимость зависит от размера документа. Графы ограничены 128 нодами, проект — 8192 нодами, GPU-текстуры — 256 MiB. Экспорт делает GPU readback и CPU-копию каждого кадра, видео идёт через RGB32. Render pipeline — BGRA8/sRGB, не HDR/широкий gamut. Это ограничения конкретной реализации, а не повод сейчас переписывать все подсистемы.

9. **Межслойные зависимости.** Renderer-интерфейс смешивает изображение, модель и Windows presentation, Media зависит от него. UI/VM знают числовые NodeKind и поля legacy-структур. Обновления Outliner читают Items и Nodes на большинство уведомлений. Потребуются document events и read models, но сокращать стоимость надо после измерений.

## 5. Решения A / B / C / D

| Категория | Компоненты | Решение и причина |
|---|---|---|
| A — сохранить | C++20/CMake, отдельный MyCutCore, стабильные ID, транзакционная валидация, UTF-8 и атомарное сохранение | Уже дают полезную границу движка и защищают документ. Не заменять ради нового названия архитектуры |
| A — сохранить | Адаптивный input, ZonePresentation, числовой drag/type, общие панели и токены | Проверенные преимущества UX; новая модель должна подключаться под них |
| A — сохранить | Базовый монтаж, типизация/отказ от циклов, CPU reference и shader fusion | Это пригодные алгоритмы и регрессионная база |
| B — адаптировать | Definition/Instance, Plane, Session | Переходные адаптеры Data/Item/Space; Plane становится результатом extraction, а не полной моделью сцены; позже команда использует прежние транзакции |
| B — адаптировать | D3D11, DirectWrite, WIC, Media Foundation | Windows backends за интерфейсами источника, текста, устройства и presentation; сохранить работающий fallback |
| B — адаптировать | WPF, NativeSession, ViewModels, NodeCanvas/TimelineCanvas | Сначала получать схему/снимки из ядра; отделить контекст редактирования от режима рабочего пространства |
| B — адаптировать | Magick.NET, ColorPicker | Picker остаётся view-компонентом; PhotoProcessor оборачивается backend-интерфейсом и затем подключается к CPU-задачам Data |
| C — переработать | Владение графом, параметры/overrides, ссылки на другие Data | Иначе новый prefab и общий resolver невозможны |
| C — переработать | Bounds, Space hierarchy, Animation, assets, execution plan | В этих местах требуются новые модели и проверяемые контракты, а не расширение набора switch |
| D — заменить постепенно | Дублирование NodeSchema C#/C++, фиксированные значения v0…v7 в новом API | Заменить общим registry; legacy ABI оставить адаптером до переноса клиентов |
| D — вывести из основного пути | Старый MyCut_Windows_Preview и противоречащие новой модели старые планы | Пометить историческими, не удалять рабочие файлы сейчас. Старый standalone prototype не использовать вторым движком |

Ничего из D не удалено в этом аудите. Все основные файлы сейчас отображаются Git как untracked: нельзя считать, что уже существует версионированная точка восстановления. Перед миграцией нужен проверенный baseline проекта/fixtures; не делать массовый commit чужих файлов без отдельного решения.

## 6. Предлагаемые модули и границы

Создавать модули постепенно внутри нынешних `engine/`, `native/`, `editor/`, не переносить сразу всё дерево каталогов.

```text
engine/
  document/      ProjectDocument, DataDefinition, Item, Space, Composition, AssetRef
  parameters/    ParameterDescriptor, ParameterValue, ParameterPath, Override, Resolver
  graph/         NodeRegistry, DataGraph, PortDescriptor, NodeInstance, validation
  animation/     RationalTime, Channel, Keyframe, interpolation
  evaluation/    EvaluationContext, dependency graph, plan, revisions/cache, bounds
  commands/      EditParameter, ResetOverride, AddItem, Connect, grouped transaction
  persistence/   schema versions, v1–v6 reader, migration, diagnostics
native/
  backends/      D3D11, DirectWrite/WIC, MediaFoundation; optional future FFmpeg
  presentation/  HWND viewport, swapchain, overlays and hit-test adapter
  bridge/        versioned C ABI, descriptors, commands, snapshots/events
editor/
  application/   document session, selection path, edit context, command routing
  viewmodels/    Inspector/Outliner/Graph/Timeline presentation models
  controls/      replaceable WPF views, styles, pointer UX
tests/
  legacy/        unchanged behavior fixtures / compatibility
  architecture/  data sharing, overrides, bounds, time, dependencies and migration
```

Направление зависимостей: View → Application → Document/Commands; Evaluator читает неизменяемый снимок Document и обращается к backend-интерфейсам. Backend не знает WPF, Document не содержит GPU handles. Общие контракты задаёт ядро; managed backend получает задания через ограниченный bridge, а не становится вторым владельцем документа.

Минимальная композиционная модель:

```text
DataDefinition { DataId, kind, source/graph/composition, exposed schema, revision }
Space         { SpaceId, parent?, local transform, pivot, representation? }
Item          { ItemId, DataRef?, SpaceRef?, overrides }
ParameterPath { composition path, object/node ID, stable ParameterId }
Channel       { target ParameterPath + instance context, keys, interpolation }
```

Оба Ref опциональны по возможностям сущности: Data может существовать без Item/Space, Space — как пустой узел/камера без визуальной Data. Пустой Item без обеих ролей отклоняется. Для обычного 2D Item используется поверхность и ортографическая камера; Z=0 не создаёт отдельный 2D-движок. Пространственный UI и render-to-texture камер остаются последующими реализациями.

Параметры: стабильные semantic IDs, типы Number/Bool/Enum/Text/Color/Vector/Asset/DataRef, defaults, bounds/unit/step, признак animatable/exposable и версия схемы. Фиксированные ID не должны зависеть от позиции в `values[]` или отображаемого имени. ID параметра типа и ID конкретной ноды — разные уровни идентичности.

Resolver: значение определения → выбранный override экземпляра → значение канала в данном контексте времени; затем входы графа вычисляются по контракту ноды. Exposed parameter — явная типизированная связь внешнего ParameterId с внутренним ParameterPath. Анимация exposed-параметра проходит через тот же resolver. Строки/bool сначала получают step-интерполяцию, числа — step/linear; сложные кривые можно добавить позже. Несовместимый Override сохраняется с диагностикой, не исчезает молча.

Кэш: ключ содержит Data/revision, рациональное время, fingerprint разрешённых Override, bounds/ROI, масштаб вычисления, color/pixel contract и backend/device generation. Изменение Space не инвалидирует чистую Data-ветку; явно Space-зависимая операция учитывает конкретную зависимость. Значение константы не должно перекомпилировать топологию shader. Позиции нод UI вообще не входят в вычислительный ключ.

Bounds: `ContentBounds` и `RenderBounds` — прямоугольники в локальных координатах с origin, а не только width/height. Blur расширяет RenderBounds на согласованный радиус и сохраняет ContentBounds. Текст возвращает свои измерения. Pivot/anchor преобразуют оба bounds в Space; padding влияет на UV/геометрию рендера, не на пользовательский Transform. Контрольный тест проверяет положение прежнего содержимого в world, а не только равенство полей Transform.

Graph registry описывает порты, параметры, bounds-функцию и evaluator/kernel. UI строит Inspector из descriptors, сериализатор хранит типизированные значения, Animation адресует ParameterPath. Новый эффект не требует отдельного окна или отдельного Animator, но автору всё равно нужно реализовать сам алгоритм и при необходимости CPU/GPU kernels. Нельзя обещать автоматическую GPU-реализацию из одного описания параметров.

Один execution plan допускает CPU, GPU, transfer и render-scene задачи. Pointwise-ветки объединяются; blur/resample могут требовать промежуточные поверхности; простая Data-ссылка их не создаёт. Общая проверка зависимостей включает nested Data, Space parent, camera render и ссылки параметров. Текущая проверка циклов внутри NodeGraph остаётся первым уровнем.

Group меняет иерархию Space, сохраняя детей; Merge создаёт Data-композицию с внутренними Item/Space; Bake материализует результат отдельным asset. TrackData(t) — логический выход трека с time mapping клипов, а не обязательная одна текстура. Эти операции должны иметь разные команды и не зависеть от решения GPU-планировщика.

## 7. Библиотеки: что применять и когда

Проверены официальные репозитории/документация 15.10.2026. Ниже — выбор по пригодности и стоимости интеграции; сравнительный benchmark кандидатов не проводился. Новые пакеты в ходе аудита не устанавливались.

| Решение | Windows / лицензия | Решение для MyCut |
|---|---|---|
| Текущие C++20 + WPF/.NET10 + D3D11 | Уже собираются и проверяются на текущем Windows x64 | Оставить на время миграции; замена GUI/GPU не устраняет конфликты модели |
| GLM | Переносимая header-only математика; MIT как один из вариантов | Добавить при вводе Space3D/матриц. Зафиксировать handedness, порядок матриц, единицы и projection conventions; не отдавать GLM layout через C ABI. Низкая стоимость |
| Magick.NET Q16 15.0.0 | Уже работает; Apache-2.0, отдельные notices native dependencies | Сохранить CPU backend, отделить от окна. Ограничить ресурсы; для интерактивного видео некоторые эффекты потребуют GPU. Не использовать PNG encode/decode как универсальную связь нод |
| PixiEditor.ColorPicker 3.4.2.3 | WPF, MIT; текущая .NET10 сборка и контроль измерены | Сохранить; документ хранит цвет, а не тип библиотеки |
| FFmpeg | Работает на Windows; LGPL-2.1+ базово, включённые GPL/nonfree-компоненты меняют условия | Кандидат для расширенных форматов и audio через IMediaSource/IEncoder. Сначала сохранить Media Foundation. Отдельный тест VFR/seek/audio sync/аппаратных кадров и выбранной DLL-сборки; интеграция средняя/высокая |
| libplacebo | LGPL-2.1; поддерживает Vulkan, OpenGL **и D3D11** | Исследовать для scaling/color/tone mapping на имеющемся D3D11. Переход на Vulkan для самого эксперимента не требуется. Проверить interop/state ownership, HDR/ICC и стоимость копирования; не заменяет scene graph |
| Qt6/QML | Windows поддерживается; LGPL/GPL либо commercial, условия различаются по модулям | Возможный будущий frontend после стабилизации application API. Сейчас высокая стоимость переписывания input/viewport/popup/docking и QA; не включать в первый этап |
| QtNodes | Qt-based, BSD-3-Clause | Имеет смысл только при выборе соответствующего Qt frontend. Не самостоятельный evaluator MyCut и не готовая замена всей QML-архитектуры |
| Nodify | WPF/MVVM, MIT | Более близкий кандидат для замены NodeCanvas. Сначала небольшой измеряемый UI-прототип после registry; проверить адаптивное попадание, undo-команды и 100/1000 нод. Не подключать второй формат графа |
| HarfBuzz + FreeType | Переносимые; HarfBuzz Old MIT; FreeType FTL либо GPLv2 | Сохранить DirectWrite на Windows; использовать через ITextLayout при необходимости переносимого текста. Потребуются font fallback, shaping, растеризация, метрики и IME-интеграция; это заметная работа |
| OpenTimelineIO | C++/Python, Apache-2.0 | Позже — import/export adapter монтажа. Не playback engine, не media container и не собственный формат всего проекта MyCut |

Для распространяемой сборки фиксировать точные версии, build flags, notices и лицензии транзитивных компонентов. Лицензия самого MyCut пока не определена в аудите; готовность конкретного бинарного дистрибутива к выпуску здесь не установлена.

Официальные источники:

- [Qt licensing](https://doc.qt.io/qt-6/licensing.html), [Windows](https://doc.qt.io/qt-6/windows.html).
- [FFmpeg: лицензия и состав сборки](https://ffmpeg.org/legal.html).
- [libplacebo: backends и лицензия](https://github.com/haasn/libplacebo).
- [GLM: математика и лицензии](https://github.com/g-truc/glm).
- [QtNodes](https://github.com/paceholder/nodeeditor), [Nodify](https://github.com/miroiu/nodify).
- [HarfBuzz COPYING](https://github.com/harfbuzz/harfbuzz/blob/main/COPYING), [FreeType licenses](https://freetype.org/license.html).
- [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO), [Apache license](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/LICENSE.txt).
- [Magick.NET](https://github.com/dlemstra/Magick.NET), [ColorPicker](https://github.com/PixiEditor/ColorPicker).

## 8. План небольших проверяемых этапов

Каждый этап заканчивается собираемой программой, тестами и отдельным выпускным каталогом. Переход на Qt/Vulkan и полная 3D-сцена не являются предварительным условием.

| Этап | Конкретная работа | Критерий завершения |
|---|---|---|
| 0. Baseline | Зафиксировать test fixtures v1/v6, реальные входные изображения/текст, snapshots/pixels; определить версионированную точку восстановления | Чистая повторяемая сборка и загрузка fixtures; список поддержанных сценариев |
| 1. Контракты и registry | Read-only legacy projection Data/Item/Space, ParameterDescriptor/Path, NodeRegistry текущих 12 видов, schema через ABI, генерация NodeDetails из неё | UI больше не задаёт вторую схему; старые документы/пиксели/Undo неизменны; нет второго владельца состояния |
| 2. Настоящие Data и Overrides | DataDefinition/graph вне Item, typed exposed text/color/number, Item overrides/reset; команды и диагностика; новый writer и legacy reader | Два Item одной Data с разным текстом; изменение defaults/структуры сохраняет совместимые overrides; roundtrip/Undo |
| 3. Несколько источников | DataReference node, dependency validation, ресурсные bindings в D3D11, Mix двух изображений, независимая Data без Space | Два разных источника действительно меняют итоговые пиксели; shared Data вычисляется согласованно; cycles rejected |
| 4. Bounds и Space | Content/RenderBounds с origin, pivot/anchor, родительский Space; configurable composition size; 2D на матричном контракте, перспектива позже | Рост текста/blur padding не двигает прежнее содержимое; преобразования и picking совпадают; world-preserving reparent |
| 5. Animation | Универсальные каналы ParameterPath, rational time/context, numeric step/linear, discrete text/bool, Inspector keyframe actions | Space.x и exposed effect-параметр меняются одним механизмом; seek/export/save дают одинаковый результат |
| 6. Первый сквозной выпуск | Собрать пользовательские 13 шагов, legacy-миграцию и regression suite в одной сборке | Открытие сохранённого проекта восстанавливает references/overrides/time и тот же изображённый кадр |
| 7. Расширение | Nested compositions и локальный контекст, Group/Merge/Bake, camera render-to-Data и spatial masks, TrackData, backend pilots | Каждый механизм имеет отдельный сценарий, диагностику циклов, Undo и roundtrip |

При переходе этапа 2 legacy Definition становится Data-источником; обработка каждого legacy Instance переносится в Data-обёртку, когда graph/grade различаются. Не объединять их автоматически по одному definition ID: это изменит результат старых проектов. Исходные ID по возможности сохраняются, новый graph/Data ID выделяется явно. Старый reader строит новую модель один раз; legacy adapter затем только представляет её, а не ведёт вторую изменяемую копию.

Новый формат версионируется при появлении сохраняемых сущностей; точный номер определяется после схемы. Исходный файл открывается без перезаписи; первый save миграции сохраняет отдельную версию/backup. Unknown type/несовместимый exposed parameter получает диагностику с сохранением данных. Старые нодовые координаты и UI layout не смешиваются с Data bounds.

Session первоначально остаётся транзакционной основой Command Pattern. Команды становятся явными и типизированными, но реализация Undo может пока хранить снимки. Переход на deltas/copy-on-write — после измерения latency и памяти, с теми же контрактными тестами.

## 9. Первый этап для подтверждения

Предлагаю реализовать этапы 0–1 как один ограниченный пакет:

1. Добавить `engine/include/mycut/Parameters.h` и `engine/src/Parameters.cpp`: типы, стабильные IDs и descriptors для существующих параметров. Это адреса legacy-полей, пока без изменения формата.
2. Добавить `NodeRegistry.h/.cpp` для текущих 12 типов, связав descriptors с существующим CPU/HLSL поведением; существующие NodeKind сохраняют значения.
3. Добавить `DocumentView.h/.cpp`: read-only отображение текущих Definition/Instance в Data/Item/Space с явным признаком legacy-instance обработки. Не объявлять Instance.graph общим prefab-графом.
4. Ввести запрос schema/version/capabilities в Bridge; NativeSession получает описания портов/параметров. Legacy v0…v7 остаются внутренним отображением адаптера.
5. Перевести `NodeDetailsControl`, palette и совместимость связей с `NodeSchema` switch на полученную схему; вынести общий ParameterInspector builder. Команды изменения пока вызывают проверенную Session.
6. Добавить фундаментальные проверки стабильности IDs, descriptor/type matching, schema ABI, legacy roundtrip и неизменности output при смене UI layout; повторить существующий suite.

Пакет не меняет владение графом, не мигрирует пользовательские файлы и не требует нового GUI/GPU. Его практический результат — единая схема параметров и точки подключения Override/Animation; после него этап 2 не потребует ещё раз переделывать каждый Inspector.

## 10. Проверка пользовательского первого сценария

| Шаг задания | Сейчас | Что добавит миграция |
|---|---|---|
| 1. Создать проект | Есть | Сохранить |
| 2. Добавить два изображения | Есть | Сохранить источники как Data |
| 3. Два Item с независимыми Space | Есть 2D Instance/Transform | Явные сущности/ссылки |
| 4. Перемещать/вращать/масштабировать | Есть | Pivot/матрицы и новые UX-доработки отдельно |
| 5. Добавить Data-эффект | Есть per-instance граф | Перенести обработку в Data |
| 6. Объединить две разные Data через граф | Нет | Этап 3 |
| 7. Добавить текст | Есть | Сохранить DirectWrite backend |
| 8. Expose текст | Нет | Этап 2 |
| 9. Два Item одной Data | Есть общий источник Definition | Общая композиция и graph на этапе 2 |
| 10. Разный текст через Override | Нет | Этап 2 |
| 11. Анимировать Space | Нет универсальных ключей | Этап 5 |
| 12. Сохранить/открыть | Есть для текущей модели | Новый формат и reader старых версий |
| 13. Проверить результат | Есть текущие regression tests | Сквозной test нового сценария на этапе 6 |

До подтверждения этого плана крупные изменения не начинаются. Предыдущий INTEGRATION_PLAN остаётся историей UX-пожеланий; порядок дальнейшей архитектурной работы предлагается определять этим документом.
