# MyCut — архитектура

## Реализованный срез 0.7

```
WPF Panels + reusable Controls + Theme tokens
          ↓ Commands / ViewModel (UI state)
NativeSession → versioned internal C ABI → Session (undo transactions)
                                              ↓
                                      Project / Definitions / Instances
                                              ↓ evaluateScene()
                                      immutable draw data (Plane)
                                              ↓ Renderer interface
                                      Direct3D 11 backend
                                              ↓
                                      own frame texture / sRGB RTV
                                          ↙                ↘
                              copy → swapchain         explicit readback
                                   Viewport             WIC → PNG
```

`MyCutCore` содержит только модель, проверку данных, сериализацию и историю действий; графических заголовков нет. `MyCutGraphics` владеет устройством и ресурсами. `MyCutNative` адаптирует внутренний C++ API к C ABI; `MyCut` — WPF executable. Модель Item не содержит HWND, ID3D11Texture или WPF объектов. Это позволяет добавлять backend и headless export без смены модели документа.

UI состоит из отдельных представлений, theme dictionaries и reusable controls. ViewModel направляет операции в ядро. Source/text/font/fill/generator и общий tint принадлежат Definition; положение, поворот, scaleX/scaleY, opacity, visibility/lock и ColorGrade принадлежат Instance. Повторные Definition используют одну source texture, отдельная коррекция выполняется в shader на экземпляре.

В 0.3 добавлены portable `Manipulator`/gizmo geometry в Core, собственный Win32 viewport host, GPU handles/hover feedback, window-owned `MotionEngine` и scene flyout Popup. Взаимодействия и анимации подробнее описаны в [INTERACTION.md](INTERACTION.md). Presentation feedback отделён от Project; экспорт вызывает renderer без editor overlay.

В 0.4 один proximity resolver выбирает Item/tool/handle для hover и down; размеры input зон вынесены в InteractionStyle. WPF controls имеют отдельный reusable ProximityInput. ParameterRow использует click/scrub/text state machine и общую Session transaction; оно не дублирует модель undo и числовые данные проекта.

## Владение, память и время жизни

- `App` владеет одним `NativeSession`; handle C ABI владеет `Session` и `Renderer`.
- `Session` владеет активным документом и историей максимум из 100 снимков. UI списки — копии read model, ядро остаётся источником данных.
- Stable ID — непустой uint64, уникальный между Definition, Instance, Track и Clip в пределах документа; nextId сериализуется. При future linked external assets добавится UUID документа. Undo восстанавливает весь снимок, включая allocator.
- GPU объекты имеют RAII lifetime через ComPtr. При уничтожении hosted HWND renderer сначала освобождается. При resize старые RTV/frame texture освобождаются до ResizeBuffers.
- Из текстуры чтение на CPU выполняется только по явной команде capture/export. Обычный кадр остаётся на GPU.
- Color scopes имеют отдельный cached renderer/hidden target 320×180: чтение clean composition происходит при открытой панели и изменении документа. Основной viewport и его overlays не перерисовываются ради scope capture.
- Decode ограничен 64 MiB и 8192 px на сторону; общий texture cache — 256 MiB. Записи для больше не используемых Definitions удаляются. Реальная оптимизация eviction/streaming — следующий этап.
- Документ/его C ABI handle принадлежат UI/STA thread и не допускают конкурентного доступа. VideoSource владеет собственным MTA decoder worker; MP4 export получает serialized immutable snapshot и создаёт независимые renderer/decoder/encoder на worker. Пустой неизменившийся viewport не рендерится заново; pending video требует повторного кадра.
- Timeline использует int64 frames + rational FPS. Media duration сохраняется в seconds double как метаданные decoder, не как положение монтажных границ. Звука и физики пока нет. Clip владеет independent Instance; evaluateTimeline возвращает только активные planes, evaluateScene исключает clip instances. Track order задаёт compositing order.

## Целевая модель времени

Будущий `Time` — рациональное значение `(int64 ticks, uint32 rate)`, нормализуемое с проверкой overflow. FPS также rational, включая 24000/1001 и 30000/1001. В графе отдельно передаются project time, composition local time и source/media time. Вложенный Instance применяет explicit mapping start/duration/offset/speed/loop. Изменение длительности без remap означает trim/hold, а не автоматическое замедление.

Audio обрабатывается по sample index и блокам с собственной частотой; transport связывает clocks, без зависимости audio block size от video FPS. Физика живёт по фиксированному tick, произвольный seek использует checkpoints и пересчёт. Stateful nodes явно объявляют state domain и delay. Чистые математические ноды — функции от входов и времени.

## Целевые подсистемы и путь вычисления

Реализованы Project/Items, простая Scene evaluation, Render backend, image Media path, Editor и PNG Export. Timeline, Animation, ParameterGraph, NodeGraph, Cameras, Physics, Scheduler, полноценный Cache, Scripting/Plugins и Audio пока описаны как целевой дизайн, без пустых API-заглушек.

Путь будущего кадра:

1. Timeline выбирает активные Instance по точному project time и создаёт local time mapping.
2. Instance разрешает Definition по ID; общие ресурсы и структура разделяются, overrides остаются локальными.
3. Parameter evaluation разрешает публичные параметры, expressions и project variables в типизированном dependency DAG.
4. Scene формирует camera-space представление, transforms, visibility и explicit composite order.
5. Authoring Node Graph lowering создаёт граф зависимостей обработки images/audio/geometry; graph не содержит API-specific ресурсов.
6. Scheduler строит CPU/GPU Execution Graph с приоритетами, cancellation generation и reusable cached outputs.
7. Render Graph выделяет transient GPU resources, сортирует passes, считает hazards/lifetimes и передаёт задачи backend.
8. Viewport получает interactive/preview output; Export получает final-size target с теми же семантикой и colour rules.

Audio и physics имеют собственные execution domains, а связываются через явные время и dependency edges. Ни render callback, ни Inspector не должны напрямую шагать симуляцию.

## Node engine и зависимости

Порты имеют конкретный тип: scalar/vector/color/image/mask/depth/audio/geometry/transform/time. Допустимые conversions явны. Node registry хранит type ID, schema version, input/output metadata и supported CPU/GPU implementation. Plugin API вводится после стабилизации внутренних contracts.

Authoring Graph, Dependency Graph, Execution Graph и GPU Render Graph — разные уровни. Кэш не привязан к положению визуального узла. Узлы topology/camera/item nesting проходят cycle detection; недопустимый цикл возвращает trace dependency edges. Feedback разрешается только через отдельный оператор задержки. Глубина корректного DAG ограничивается реальным бюджетом, а не условным числом камер.

Project Variable имеет один определённый источник. Несколько источников требуют combine node. Простая связь — typed `input × multiplier + offset`, range/remap/clamp добавляются явно. Project namespace предотвращает утечки между открытыми документами.

## Cache / scheduler / invalidation

Целевой ключ результата: node type + schema/version + canonical parameter hash + upstream output revisions + rational time + resolution/quality + color domain + shader revision + source content revision. GPU handles в сериализацию не попадают. Изменение downstream effect инвалидирует его и descendants; upstream cache entries остаются.

Source revision должен учитывать изменения файла на месте (сейчас texture key содержит Definition ID и source path; live reload ещё не реализован). CPU/GPU/disk/physics/media caches имеют отдельные лимиты; незаменимые пользовательские данные не зависят от cache. Для asynchronous results scheduler публикует только matching document revision и request generation. Старые запросы отменяются или их результаты игнорируются.

## Проверка сложных сценариев A–F

| Сценарий | Архитектурное решение | Статус 0.4 |
|---|---|---|
| A: фото, маска, анимация и звук внутри Item; пять экземпляров | Composition Definition хранит вложенную структуру; каждый Instance получает свои override/time contexts, чистые общие результаты разделяются | Три экземпляра с независимым transform и общим tint проверены; mask/audio/animation ещё не реализованы |
| B: Camera2 снимает обработанный Output Camera1 | Camera output — graph resource; visibility excludes own output; общий DAG проверяет взаимные циклы | Дизайн; пока фиксированная ортографическая проекция |
| C: переменная управляет дымом, светом и звуком | Один source variable и три typed mapping nodes; аудио вычисляет envelope в своём time domain | Дизайн; общая связь tint доказана только на Definitions |
| D: два Item в общей 2D-физике + bake | Physics world ID вне local Item; fixed tick/checkpoints; bake пишет explicit animation asset | Дизайн; библиотека ещё не включена |
| E: правка одного из десяти эффектов | Revision/content keys и descendants invalidation; unchanged upstream outputs сохраняются | Сейчас изменение tint/transform не пересоздаёт shared source texture; произвольный graph ещё не реализован |
| F: фото → редактирование → PNG без timeline | Статическая Composition использует тот же Item/Scene/Render path, time optional | Импорт фото, transform, tint, PNG экспорт работают; text/masks ещё впереди |

## Риски и границы

| Риск | Решение / следующий шаг |
|---|---|
| Рекурсивный render камер/Item | Проверка DAG до scheduling; resource outputs вместо recursion внутри renderer |
| GPU memory pressure | Явные budgets сейчас; далее LRU eviction, transient aliasing и decode scaling |
| Вложенное время | Рациональные clocks и явный time mapping; тесты seek/trim/hold/loop |
| Прозрачность и глубина | Сейчас explicit vector order и premultiplied linear blending; далее отдельные camera depth и compositing order |
| Детерминированность physics | Fixed step и checkpoints; воспроизводимость проверять по backend/version, bake для доставки |
| CPU/GPU synchronization | Readback только export/capture; дальше dedicated render thread и fences |
| UI responsiveness | Статические lightweight кадры сейчас на UI thread; decode и final export перенести в workers перед video/большими изображениями |
| Сериализация | Version header, validation-before-replace, temp+atomic rename; migrations и portable asset manifest в следующем формате |
| История действий | Snapshot undo прост и проверяем для малой модели; заменить на typed inverse commands перед большим graph |
| WPF/Win32 airspace | Scene flyout использует Popup с отдельным HWND и не меняет viewport layout. Внутри того же HWND произвольные WPF overlays по-прежнему требуют другого presentation path |
| Цвет | sRGB upload → linear shader/blend → sRGB target сейчас; ICC/HDR/display profile и OCIO после отдельного среза |

## Сохранение

`.mycut` version 6 — UTF-8 text с quoted strings, stable IDs и full float precision. Читатель поддерживает versions 1–6: v1 uniform scale преобразуется в X/Y; v2 хранит X/Y, v3 — retained text/generators/lock, v4 — individual ColorGrade, v5 — media timing и TIMELINE/Track/Clip/range, v6 — per-instance typed NodeGraph. Ноды входят в глобальное пространство ID; duplicate/clip/split remap internal links. Shader key зависит от topology/types, не от layout/параметров; значения обновляются в отдельном GPU constant buffer. Проверяются UTF-8, finite values, bounds и ссылки до замены документа. Bridge preflights referenced images/video; generated text/fills не требуют внешних bitmap assets. Sources остаются абсолютными внешними путями; relink/portable paths ещё отсутствуют.

UI размеры отдельно сериализуются как versioned JSON `layout.json`. Это персональная настройка пользователя; content edits и selection не должны становиться зависимостями render assets. Shared themes не требуют изменений движка.
