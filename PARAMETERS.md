# Универсальные параметры: фундамент и пилот Exposure

Реализован только согласованный первый этап. DataComposition, сохраняемые Item Overrides, Prefab и Animation ещё не реализованы. Их будущие источники подключаются к существующему resolver; отдельная система значений для CPU/GPU не создаётся.

## Контракты

- `ParameterId` — отдельный тип с опубликованным 64-битным ID. Для Exposure Stops закреплён `0x4d43555400010001`, semantic name `mycut.exposure.stops`. ID нельзя менять при переименовании, локализации или смене слота хранения. Для новых параметров нужны новые уникальные ID; автоматического реестра всех эффектов пока нет.
- `ParameterValue` — variant Number (`double`), Integer (`int64_t`), Boolean, Text, Color, Vector2, Vector3. Преобразование строк, bool и чисел друг в друга не выполняется. Color/vector проверяются на конечность компонентов; смысл цвета и единиц задаёт описание конкретного параметра.
- `ParameterDescriptor` — ID, тип, default, допустимость модели, отдельные UI-подсказки диапазона/шага/единиц, признаки animatable/exposable. Строковые поля — views: описание должно ссылаться на строки, живущие не меньше самого описания. У Exposure это статические строки.
- `ParameterAddress` владеет полным упорядоченным путём экземпляров и содержит владельца и ParameterId. Сегмент пути — пара composition/item; это конкретные вхождения, а не только IDs общих определений. Различие любого сегмента разделяет адреса. Пустой путь допустим для контекста определения.
- `ParameterAddressView` заимствует путь на время синхронного вызова. Он позволяет вычислять значения без копирования пути и без heap allocation. Для хранения Override нужно владеть `ParameterAddress`, для вызова resolver достаточно view. View нельзя сохранять за пределами жизни его пути.
- `ParameterContext` передаёт рациональное время; знаменатель должен быть положительным. Вложенный контекст экземпляров находится в адресе, а не теряется в одном owner ID.
- `IParameterValueSource::sample()` возвращает optional contribution. Отсутствие — нормальный fallback; неправильный тип, NaN, infinity и выход за model limits — разные ошибки с `ParameterError`.
- `ParameterResolver` применяет Default → Data → Item Override → Animation. Источник возвращает режим Replace/Add/Multiply. Replace работает для всех типов; Add/Multiply в этом этапе реализованы для Number. Для других типов относительная операция явно отклоняется.

Resolver не изменяет источник или документ. Неактивные источники передаются как null. Несовместимый образец не превращается молча в отсутствие значения. Model limits проверяются после каждого применённого слоя. Для относительного вклада проверяется тип/конечность, а диапазон — у полученного результата; диапазон не применяется как clamp. UI suggested range вообще не ограничивает итоговое значение.

Сейчас ограничения числового диапазона задаются double-границами; сравнение Integer выполняется без округления исходного int64 через double, включая границы около ±2^63. Целочисленные значения и текст сохраняют собственный тип.

## Как работает Exposure

Точка совместимости — `LegacyParameterAdapter`. Нода пока хранится в старой структуре `Node`, Stops — в `values[0]`. Descriptor содержит default 0, UI range −20…20 EV, model range −100000…100000, animatable/exposable=true. Model range соответствует уже существовавшей проверке полей нод.

```text
нет подключения Stops:
  default 0 → legacy Data value → optional Override → optional Animation
  → общая nodeParameterValues() → текущая CPU/GPU реализация эффекта

Stops подключён:
  значение upstream-ноды → текущая реализация эффекта
  локальный fallback / его Override / его Animation не вычисляются
```

Таким образом, локальная анимация Stops управляет только неподключённым fallback. Чтобы анимировать подключённый сигнал, нужно в будущем анимировать параметр upstream-ноды. Вход графа не является очередным Override-слоем. При отключении провода снова используется сохранённый fallback.

В обоих путях эффект сохраняет старую формулу `exp2(clamp(stops, -20, 20))`; alpha не меняется. Clamp существовал до миграции и остаётся частью вычисления эффекта, не валидации или хранения. Значения 25 и −25 остаются такими же в документе. Открытие/сохранение не прогоняет значения через UI range.

CPU reference `evaluateSignal()` получает подготовленные значения из `nodeParameterValues()`. Renderer вызывает ту же функцию перед загрузкой текущего constant buffer. HLSL и topology/cache key не менялись; дополнительных проходов/текстур не добавлено. Разрешение параметра выполняется на CPU перед GPU draw, а не в каждом пикселе шейдера.

`mc_node_set()` для Exposure использует типизированную запись адаптера внутри прежней Session-транзакции. Остальные поля и эффекты проходят прежним путём. Невалидная запись откатывается целиком, Undo/Redo и locks сохраняются. Изменения C ABI или WPF-клиента для этого не потребовались.

## Связь с будущими подсистемами

DataComposition сможет публиковать внешний ParameterId с типизированной ссылкой на внутренний ParameterAddress. Item хранит локальные значения по адресу полного вхождения. Prefab разделяет одну DataComposition, но разные пути экземпляров выбирают независимые Override. Animation реализует источник contributions по адресу/времени с выбранным режимом применения.

`NodeParameterContext` уже позволяет передавать путь, время и источники Override/Animation в подготовку нод. Тесты используют эти точки подключения. Текущий Renderer получает обычный legacy-контекст: пользовательские Overrides/Animation не добавлены в Project и не сохраняются. При появлении этих подсистем контекст будет приходить из вычисления документа; менять ParameterId/Value/Resolver для этого не требуется.

## Проверки и производительность

- CTest Debug: 9/9 — Core, Interaction, Timeline, Nodes, Parameters, ParameterPerformance, Bridge, Render, Media.
- Parameters проверяет defaults, типы, ошибки, полный nested path, порядок источников, Replace/Add/Multiply, рациональное время, неподдержанные операции, legacy limits, неизменность байтов повторного сохранения MYCUT 6, Undo и неизменность shader topology.
- Проверены CPU-значения Exposure −100000, −25, −20, −1, 0, 1, 20, 25, 100000; сохранение raw-значений и старая формула рендера.
- GPU-тесты выполнялись на WARP и аппаратном GPU: actual Exposure pixels, подключённый Stops, несатурированный результат для 25 против 20, отсутствие дополнительных source textures.
- Windowless model и interface suites: PASS. WPF build: 0 warnings / 0 errors.
- Hardware GUI smoke: 127 checks; результат в `out/MyCut-parameters/smoke/result.json`.
- Release MSVC `/O2`: финальный замер около **42 нс/Exposure**, **0 heap allocations** на 200000 разрешений. Подготовка констант 128-нодового графа: legacy **16.66 мкс**, universal **20.09 мкс**, добавка **3.43 мкс/draw**. Это локальный диагностический benchmark, не гарантия для любого оборудования. Есть небольшая вычислительная добавка; утверждения о нулевой стоимости нет.
- Автотест требует отсутствия heap allocation и корректного результата; время не превращено в нестабильный аппаратно-зависимый порог.

Первый Release configure встретил локальную MSVC C1902 при compiler probe с `/Zi`; повторная конфигурация с `/Z7` для Debug probe, как в штатном Build.ps1, прошла. Исходники и установленный toolchain для обхода не менялись. Release функциональные и performance тесты выполнены успешно.

## Изменённые файлы

Новые:

- `engine/include/mycut/Parameters.h`
- `engine/src/Parameters.cpp`
- `engine/include/mycut/LegacyParameterAdapter.h`
- `engine/src/LegacyParameterAdapter.cpp`
- `tests/ParameterTests.cpp`
- `tests/ParameterPerformanceTests.cpp`
- `PARAMETERS.md`

Адаптированы:

- `engine/include/mycut/Nodes.h`: контекст reference evaluator.
- `engine/src/Nodes.cpp`: default и вычисление Exposure через адаптер.
- `native/src/D3D11Renderer.cpp`: одна замена подготовки packed constants на общий путь.
- `native/src/Bridge.cpp`: типизированная запись Exposure внутри существующей транзакции.
- `tests/BridgeTests.cpp`, `tests/RenderTests.cpp`: legacy/atomicity/Undo и GPU regression.
- `CMakeLists.txt`: новые исходники ядра и два набора тестов.
- `Start-MyCut.cmd`, `README.md`, `TESTING.md`: запуск и документация проверенного этапа.

## Ограничения этапа

Только Exposure мигрирован. Остальные эффекты сохраняют legacy storage и поведение. Общего реестра всех нод, построения всех Inspector по descriptors и нового schema API ещё нет. UI Exposure продолжает использовать прежний NodeSchema как совместимость, а его canonical descriptor уже существует в ядре.

Format MYCUT 6 и Serialization.cpp не менялись. Новые значения Override/Animation и сопоставления Exposed не сохраняются и не представлены в UI. Этап даёт их типы, адресацию и resolver, но не реализует полноценные Prefab/Animation. Legacy хранение Exposure остаётся float32; ParameterValue Number — double, преобразование на этой границе явно ограничено существующей моделью.

Файлы предыдущей рабочей сборки остаются в `out/MyCut-structure`. Новая сборка — `out/MyCut-parameters`.
