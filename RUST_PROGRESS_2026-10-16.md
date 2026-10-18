# Фактический результат 2026-10-16

Уточнение HorizontalBox: новый `next/app/src/ui_core/horizontal_box.rs` реализует фиксированный размер и центр-anchored симметричный reflow, минимальные ширины и ограничение роста. В ui_lab добавлен образец из пяти настоящих кнопок и live-параметры; обычные intrinsic строки отделены в FlowBox. **60 passed**, Clippy и build успешны; снимок `next/horizontal-box-check.png`. Формат проекта/рендерер не менялись, старые Lab-пресеты читаются через defaults новых полей.

Последующий этап: [UI Lab — стартовая сцена](next/UI_LAB.md). Добавлен `next/app/src/ui_lab.rs`, переключение сцен/общий capture handler в main, регулируемая длительность общей анимации в ui_core/icons. Образцы используют production widgets; пресет/раскладка Lab изолированы от документа и editor preferences. **55 тестов** (35 app + 20 core), build и Clippy успешны; проверка настоящего GPU-окна. Новых зависимостей и изменений формата проектов нет. История прежних этапов ниже.

Последующее обновление: [UI Core и docking](next/UI_COMPONENTS.md). Основные панели Rust UI собираются из общих компонентов, переносятся к краям/в группы вкладок, имеют собственные политики и сохраняемую раскладку. Добавлены `next/app/src/{ui_core,workspace}.rs`, обновлены main/icons/browser/properties/text_edit/ui_settings/theme, app/Cargo.toml, workspace/Cargo.toml, Cargo.lock, ThirdParty и сборщик уведомлений. Подключена только библиотека Craft UI (20 неизменённых исходных файлов, pinned SHA), не чужой редактор. Формат проектов и photo-core в этом этапе не менялись. Итог: **49 passed**, Clippy без предупреждений, build успешен; GPU-снимки и ограничения — в UI_COMPONENTS.md. Остальные разделы ниже сохраняют историю предыдущих этапов.

## Изменённые/новые файлы

- `RUST_REUSE_MAP.md`: десять репозиториев, SHA/paths, A–D, зависимости/лицензии и реальные результаты tests.
- `RUST_MIGRATION_PLAN.md`: границы Data/Time/Space/Parameters, порядок reuse-first внедрения, parity/release gates.
- `next/Cargo.toml`, `next/Cargo.lock`: отдельный workspace, зафиксированные зависимости.
- `next/photo-core/Cargo.toml`, `next/photo-core/src/lib.rs`: независимый растровый документ, image adapters, COW history, bounded decode/IO, lossless project и export.
- `next/app/Cargo.toml`, `next/app/src/main.rs`, `next/app/src/icons.rs`: egui/wgpu приложение, фотоинструменты/слои, workers, UI event tests, векторные иконки.
- `next/README.md`: воспроизведение сборки, управление, точные ограничения.
- `next/ThirdParty/**`: license/notice collection для 162 Windows dependency packages, provenance manifest. Это не доказательство полного license audit кодеков.
- `scripts/Build-Rust.ps1`, `scripts/Rust-Notices.ps1`, `Start-MyCut-Rust.cmd`: отдельные сборка/запуск/атрибуция.
- `README.md`, `.gitignore`: ссылка на новый срез, исключение Rust target.
- Исследовательский код `../MyCut-research/probes/component-gate/**` остаётся вне продукта; Cargo manifests с path dependencies на клоны не попадают в application workspace.

## Проверено

- 164 upstream unit tests + 5 interop probe tests, все passed.
- 19 MyCut Rust tests (13 core + 6 UI/events), все passed. Brush click/drag, Move selection/delta, Crop persistence проходят через egui pointer events; это не OS-level input test.
- `cargo fmt --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, штатный Build-Rust с Test: успешно.
- Настоящее wgpu окно + viewport screenshot: успешно, RTX 5060 Ti, Vulkan. Визуально найдены отсутствующие glyph-иконки и заменены code-native векторными. Снимок: `next/window-check.png`.
- Старые бинарники `out/MyCut-inline-text/{MyCut.exe,MyCut.dll,MyCutNative.dll}` имеют прежние SHA256; основной launcher не менялся. Полный C++/WPF GUI smoke в этой работе не запускался: этот код не изменялся.

## Что НЕ завершено

Срез не объявляется законченным фоторедактором. Остались masks/selection/text/curves, интеллектуальные зоны, MYCUT 6 import, универсальные Rust параметры/граф, профилирование больших документов и выпуск. Входящий скриншот ошибки `codex-clipboard-90a72354-7040-43c5-a2ef-2e81da7fc55f.png` отсутствует по указанному пути: конкретный сбой с него не установлен и не считается исправленным.

Средство физического управления Windows не инициализируется (`failed to write kernel assets`, os error 3, повтор после reset тоже неуспешен). Не заявлять проверенными физические диалоги/IME/multi-monitor. Не подменять это утверждением, что headless UI tests равны полному пользовательскому тестированию.

Следующий безопасный шаг: получить повторный скриншот/текст точной ошибки, затем выполнить профильный fix. Для полного photo editor перед расширением кистей/масок — gate PhotoCraft paint/raster/algo и адаптер к своему документу, а не копирование целого приложения. Не переключать основной запуск на Rust до legacy import/parity и закрытия перечисленных ограничений.

## Последующее обновление UI и текста — текущий результат

Разделы выше сохраняют состояние первого среза. Теперь реализованы восемь smart scale handles, кольцо поворота с разрывами максимальных угловых зон, distance fade, инерция и плавная визуализация; Transform/Flip недеструктивны. Исправлена потеря граничных пикселей при Flip/вращении: imageproc получает padding с репликацией края, premultiplied alpha и явно ограниченную область семплирования.

Добавлен редактируемый текст с автоподгонкой области, системными шрифтами, выделением/заменой на канвасе и одной Undo-транзакцией. Единые Details/Settings/Outliner/Content Browser, папки с иконками, двухстрочные названия карточек, реальные миниатюры, Local/Global одного документа, изменяемые панели/плавающий Inspector, масштаб UI и анимации с настройками.

Файлы: `next/photo-core/src/{lib,transform,text}.rs`; `next/app/src/{main,interaction,text_edit,properties,icons,theme,ui_settings,browser}.rs`; manifests/Cargo.lock; ThirdParty; README и этот отчёт. Формат `.mycutnext` version 2 читает version 1; старые MYCUT 1–6 не изменяются и пока не импортируются. Новые зависимости подключены как crates, см. дополнение к reuse map.

Результаты: **40/40** (20 core + 20 app), `cargo fmt`, Clippy `-D warnings`, debug build — успешно. Реальные GPU-снимки: `next/browser-check.png`, `next/settings-check.png`, `next/text-check.png`. Проверка дизайна и оставшиеся несоответствия: [DESIGN_REVIEW_2026-10-16.md](next/DESIGN_REVIEW_2026-10-16.md). Уведомления пересобраны для 207 Windows dependency packages.

Не объявляется завершённым весь фоторедактор: masks, blend modes, сложная типографика, универсальные Rust параметры/Prefab/Graph, legacy import и полный accessibility/OS-input audit остаются открытыми. Подробные ограничения текста, зон и сохранения перечислены в [next/README.md](next/README.md).
