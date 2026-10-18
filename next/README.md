# MyCut Next — photo slice 0.1, обновление интерфейса 16.10.2026

Не законченный фоторедактор и не замена текущего MyCut. Обычный `../Start-MyCut.cmd` не менялся. Новый запуск: `../Start-MyCut-Rust.cmd`.

По умолчанию открывается **[UI Lab — сцена разработки интерфейса](UI_LAB.md)**: настоящие базовые компоненты, живые настройки и debug overlays. Photo Editor открывает редактор; кнопка UI Lab возвращает обратно. Прямой запуск редактора — `mycut-next.exe --editor`.

## Работает и проверено

- Rust, egui/eframe 0.36.2, wgpu 30.0.1. Проверочное окно действительно запущено на NVIDIA RTX 5060 Ti / Vulkan; снимок `window-check.png` получен через viewport screenshot API.
- Open PNG/JPEG/BMP/TIFF/WebP; drag-and-drop одного файла; импорт изображения отдельным слоем.
- Прозрачный новый слой, дублирование, удаление, порядок, visibility, lock, opacity, rename, X/Y.
- Move выбирает верхний видимый непустой пиксель; кисть/ластик, crop drag, zoom wheel, pan Space/H. Восемь ручек масштаба и кольцо поворота; зоны учитывают скорость/расстояние, имеют инерцию уменьшения и плавную визуализацию. Кольцо исключает максимальные зоны углов и затухает вдали от курсора.
- Transform и Flip не изменяют исходный растр. Углы пропорциональны, края меняют одну ось; Shift переключает пропорции, Alt фиксирует центр, Ctrl снижает чувствительность; Shift при вращении даёт шаг 15°. Escape отменяет жест, Undo — одна транзакция.
- T + щелчок создаёт редактируемый текст; двойной щелчок Move открывает существующий. На канвасе работают каретка, выделение, замена, copy/paste. Размер шрифта автоматически пересчитывает область. Ctrl+Enter применяет, Escape отменяет. Можно выбрать установленный шрифт или TTF/OTF; файлы шрифтов не распространяются.
- Rotate90/grayscale/invert/brightness/contrast/blur — **деструктивные undoable операции**, не универсальные нодовые эффекты и не замена параметров Exposure.
- Единый тёмный стиль Details/Settings/Outliner/Content Browser. Transform: Scale со связью X/Y → Position → Rotation → Opacity → отдельный Flip с двумя иконками. Подсказки и доступные названия иконок, анимация наведения с регулируемой силой.
- Общие базовые компоненты и docking: Tools, Details, Outliner и Content Browser переносятся за вкладку и закрепляются у края либо объединяются во вкладки. Floating отключён. Правый клик / Settings → Panels: блокировка, анимации, скрытие/восстановление и сброс раскладки. [Архитектура и управление](UI_COMPONENTS.md).
- Outliner Local показывает слои, Global — Project → текущий документ → слои; выделение общее с канвасом и браузером. Это пока один документ, не Prefab-иерархия всего проекта.
- Content Browser открывается иконкой папки: Project показывает реальные слои, Folder — выбранную папку изображений. Дерево с иконками папок, поиск, Tiles/List, пропорциональные миниатюры, двухстрочное имя и отдельный тип. Двойной щелчок импортирует изображение; исходный файл не меняется. До 2000 записей и 100 миниатюр на папку, symlinks пропускаются.
- Settings: масштаб интерфейса 65–200%, сила анимаций, зоны взаимодействия. Ctrl+колесо масштабирует UI, Ctrl+0 сбрасывает; zoom канваса независим. Настройки сохраняются в `%LOCALAPPDATA%/MyCutNext/interface.json`, не в проекте.
- Crop сохраняет исходные растры/слои, меняет canvas и offsets. Resize с Lanczos3 явно flatten; Undo восстанавливает слои.
- COW snapshots, Undo/Redo, одна транзакция на stroke/move, Escape отменяет незавершённый жест.
- Save/Open отдельного формата `.mycutnext`: version 2, lossless PNG layers, stable IDs, Transform и TextSpec. Читается version 1 с identity transform. Текст имеет PNG-кэш и отображается без исходного шрифта; редактирование требует шрифт. В сохранении используется временный файл в той же директории и atomic persist; повторная запись проверена на Windows. **MYCUT 1–6 пока не импортируется и не перезаписывается этим форматом.**
- PNG/JPEG export; JPEG получает белый фон для alpha. Диалоги имеют подтверждение перезаписи. Текущий документ сохраняется при ошибках фоновой операции.
- Decode/import/export/filter и композиция preview работают в workers; одновременно один preview snapshot. Кадр отправляется после ввода текущего UI-frame; пока работа не завершена, интерфейс сам запрашивает обновление через 16 ms, без нового движения мыши. При непрерывном жесте показывается последний готовый промежуточный кадр; после Undo/Cancel/Open старые snapshots отбрасываются. Это не обещание 60 FPS обработки больших изображений. Preview не более 2048 по оси, export в полном разрешении.
- Предупреждения при замене/закрытии несохранённого документа; пользовательские ошибки видны в окне.

## Запуск и проверка

```powershell
./scripts/Build-Rust.ps1 -Test
./Start-MyCut-Rust.cmd
```

Команды выше из корня MyCut. Скрипт использует изолированный toolchain соседнего `MyCut-research/toolchain`, если он имеется, иначе установленный `cargo`. Проверялось на rustc 1.99.1 x64 MSVC; системный PATH не менялся.

```powershell
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo fmt -p mycut-next -p mycut-photo-core --check
cargo build -p mycut-next --locked
```

Команды Cargo из `next/`. Текущий результат: **84/84** (20 core + 64 UI/event tests), Clippy без предупреждений. Проверяются preview, Undo/Cancel, Transform/Flip, version 1, текст, браузер, docking/отмена/сохранение раскладки, политики компонентов и контраст. Тесты с системным шрифтом выполнялись на Windows с Arial (без него соответствующие тесты пропускают проверку рендера). Отдельно исследовательские библиотеки/interop probe: **169/169**, см. `../RUST_REUSE_MAP.md`. Эти числа нельзя складывать в обещание полного приложения.

Повторяемая проверка настоящего GPU-окна (создаёт собственный тестовый документ, пишет PNG и закрывается):

```powershell
./target/debug/mycut-next.exe --capture ./window-check.png
./target/debug/mycut-next.exe --capture-browser ./browser-check.png
./target/debug/mycut-next.exe --capture-settings ./settings-check.png
./target/debug/mycut-next.exe --capture-text ./text-check.png
```

Внешняя автоматизация физических Windows-кликов сейчас недоступна: helper сообщает `failed to write kernel assets (os error 3)` даже после reset/retry. Снимок не заменяет такую проверку. UI event tests проходят через реальные обработчики egui, но не проверяют OS dialogs/IME/multi-monitor input.

## Ограничения — обязательная следующая работа

- Это независимый растровый срез. Ещё нет универсального Rust Data/Parameter resolver, MYCUT 6 import, Prefab, Animation, выполнения Graph, Space3D, timeline/audio/video. Канонические контракты старого ядра должны переноситься отдельно с fixtures, не заменяться состоянием widgets.
- Пока нет masks, blend modes, selections/lasso/fill, curves/LUT, pressure/soft brush, GPU photo kernels, ICC/HDR/16-bit editing. Простой capsule brush — базовый инструмент среза, **не перенос профессионального PhotoCraft paint**.
- Текст: базовые LTR glyph advance/kerning, multiline; нет rich text, bidi/сложного shaping. Во время ввода редактор текста осевой, повернутый/неравномерно масштабированный текст окончательно отображается после Done. Для рисования по тексту нужна явная растеризация.
- Core RGBA8/sRGB, обычный alpha blend из image. Нет linear-light compositing guarantee. EXIF orientation/ICC/metadata при импорте не сохраняются. Не предназначено для профессионального цветоуправляемого выпуска.
- Манипуляторы используют MyCut speed/distance/inertia law; обычные widgets — egui nearest-widget radius с ограниченным скоростным расширением и инерцией. Это ещё не единая per-widget predictive intent система всех старых кнопок. Docking работает в одном viewport; нет native multi-window docking, auto-hide и кинематических панелей.
- Не реализованы autosave/crash recovery, установщик, локализация UI и полноценная accessibility. Интерфейс первого среза на английском. Файловые диалоги системные, не трёхмерные.
- Safety limits: до 16 Mi pixels, до 16384 по оси, 32 layers / 256 MiB raw rasters, 192 MiB project/input file. Decoder allocation limit best-effort внутри image codecs, не строгий лимит RSS процесса. История консервативно ограничена 40 snapshots / ~256 MiB оценкой raster bytes, текущий документ/redo/workers учитываются отдельно. Не обещать общий RSS=256 MiB.
- Resize пока выполняется синхронно; на больших изображениях может задержать UI. Некоторые layer operations тоже выделяют память на UI-потоке. Требуется профилирование и перевод тяжёлых команд в scheduler.
- Данные обрабатываются локально. Сборка впервые скачивает crates; приложение не содержит сетевых функций.

## Лицензии

`ThirdParty/manifest.json` перечисляет 208 Windows dependency packages из Cargo metadata, включая vendored Craft UI (не все обязательно реально linked). Рядом собраны LICENSE/NOTICE, включая font OFL/UFL. Недостающие в опубликованном crate лицензии получены из официального upstream на SHA из `.cargo_vcs_info.json`; происхождение записано в `fetchedFrom`. Трансформации используют imageproc 0.26.2, текст — ab_glyph 0.2.32, docking — Craft UI с зафиксированным commit. Ни одно стороннее приложение целиком не копировалось.

Для двойных MIT/Apache зависимостей использовать MIT или Apache; для `self_cell` — Apache branch, не GPL branch. Сохраняются дополнительные Unicode/font/BSL/Zlib/ISC notices. Это сбор уведомлений, не юридическое заключение и не исчерпывающий аудит всех файлов кодеков. Перед распространением закрыть оставшиеся packaging/license gates. Перегенерация: `../scripts/Rust-Notices.ps1 -FetchMissing`.
