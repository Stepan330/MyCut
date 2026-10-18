# MyCut Next: карта повторного использования

Дата: 2026-10-16. Исследование предшествует реализации новых аналогов. Клоны находятся в `../MyCut-research`, вне исходного дерева MyCut. Целые сторонние редакторы не переносились. Это проверка выбранных компонентов, не сертификация всех приложений.

### Интегрировано: Craft UI docking — A

Commit `8f5a2831614e632f91ad367f7af2a6e5b61b9529`, исходники `crates/ui/src/docking/{model,surface,targets}.rs`, `layout`, `tabs`. Реализует validated atomic layout changes, split/tab drag targets, preview, resize, cancel и стабильные UI IDs. В MyCut подключено как самостоятельный path crate `next/vendor/craft-ui`; 20 файлов src проверены SHA256, без изменений. Только Cargo.toml заменяет upstream workspace metadata и фиксирует egui 0.36.2. Зависимости: egui и optional serde; новых внешних packages не потребовалось. MIT option, LICENSE-MIT/LICENSE-APACHE/NOTICE/UPSTREAM сохранены и включены в сбор уведомлений (208 packages).

Ограничения: один viewport, нет native docking между окнами/мониторами и app-specific auto-hide. Адаптер MyCut запрещает floating, защищает Canvas, владеет registry/policies/persistence. Сложность интеграции средняя; fork не потребовался. Реальные pointer tests MyCut проверяют side dock, tab merge, отмену, сохранение и отсутствие изменений документа. Полный upstream suite не заявляется повторно пройденным. Подробнее: [UI_COMPONENTS.md](next/UI_COMPONENTS.md).

## Зафиксированные исходники

Ссылки ведут на исследованные ревизии; пути в таблице ниже относительно соответствующего репозитория.

| Репозиторий | Commit SHA |
|---|---|
| [PhotoCraft](https://github.com/storytold/photocraft/tree/c11ef015b7640b4dad43bf775373fd345902e382) | `c11ef015b7640b4dad43bf775373fd345902e382` |
| [EffectCraft](https://github.com/storytold/effectcraft/tree/0311bdc34d0dc10c2d18ff7875b4f52d483e5e27) | `0311bdc34d0dc10c2d18ff7875b4f52d483e5e27` |
| [FilmCraft](https://github.com/storytold/filmcraft/tree/8309f21a6c3f34ddf190af7fd9bfd913053a1fd5) | `8309f21a6c3f34ddf190af7fd9bfd913053a1fd5` |
| [VectorCraft](https://github.com/storytold/vectorcraft/tree/2cdd00cf7b4afb7ad61efac72e2d28c252dbb317) | `2cdd00cf7b4afb7ad61efac72e2d28c252dbb317` |
| [craft-libs](https://github.com/storytold/craft-libs/tree/8f5a2831614e632f91ad367f7af2a6e5b61b9529) | `8f5a2831614e632f91ad367f7af2a6e5b61b9529` |
| [egui HEAD](https://github.com/emilk/egui/tree/86099aca1276fe786921992c8d5a68914ee79bec) | `86099aca1276fe786921992c8d5a68914ee79bec` — 0.37, только чтение |
| [egui 0.36.2](https://github.com/emilk/egui/tree/49682f8baa058bf49e011035cfbd6e825f88a5ef) | `49682f8baa058bf49e011035cfbd6e825f88a5ef` — VCS metadata проверенного registry crate |
| [egui-snarl](https://github.com/zakarumych/egui-snarl/tree/23e7489b51b56e9f51e756bae8efdabc49f12fec) | `23e7489b51b56e9f51e756bae8efdabc49f12fec` |
| [wgpu](https://github.com/gfx-rs/wgpu/tree/14328f49918cce19f7cc8bf703435968c8293035) | `14328f49918cce19f7cc8bf703435968c8293035` — HEAD не собирался |
| [Bevy](https://github.com/bevyengine/bevy/tree/b0656ebb2cd7c18d1b89dbb21758e2d48e65fc7d) | `b0656ebb2cd7c18d1b89dbb21758e2d48e65fc7d` — 0.20-dev, только чтение |
| [glam](https://github.com/bitshifter/glam-rs/tree/cf223cb70fd6ab9d00be4683c7861ccd43540151) | `cf223cb70fd6ab9d00be4683c7861ccd43540151` |

Прочитаны доступные корневые AGENTS, manifests, лицензии и выбранные архитектурные разделы/реализации. Огромные архитектурные документы изучены выборочно. Инструкции сторонних репозиториев не становятся инструкциями MyCut.

## Решения по компонентам

A — библиотека напрямую, B — адаптация, C — архитектурный образец, D — отклонение. Оценки B/C не означают уже выполненный перенос.

| Компонент / исходные пути | Реально реализовано и ограничения | Зависимости | Решение / трудоёмкость / способ |
|---|---|---|---|
| egui: `crates/egui`, `crates/eframe`, `crates/egui-wgpu/src/renderer.rs` | Widgets, Inspector, popup, texture IDs и GPU callbacks. Не документ, не граф вычислений. Проверена headless UI-совместимость 0.36.2; GPU интеграция требует отдельного запуска | epaint, winit, выбранный GPU backend | A / средняя / crate, тонкий адаптер параметров и input |
| egui-snarl: `src/lib.rs`, `src/ui/viewer.rs`, `src/ui/wire.rs` | Узлы, провода, позиции, serde, hooks подключения. Допускает циклы; NodeId — индекс UI, а не стабильный ID документа. Отсутствующий узел может вызвать panic | egui 0.36, slab, optional serde | A / средняя / без fork; команды сначала проверяет ядро, затем UI-адаптер |
| craft-libs: `crates/ui/src/docking/{model,surface,targets}.rs` | Типизированные панели, tabs/splits/floating, атомарная проверка перестройки. Ограничения глубины/числа панелей. Не готовая политика AutoHide/Peek MyCut | egui 0.36, optional serde | A / средняя / generic panel ID и собственная FSM активности |
| craft-libs: `crates/ui/src/{tabs,layout,buttons,theme,icons}` | Общие UI-компоненты уже выделены из семейства; не копировать четыре похожих приложения | egui | A-кандидат / низкая / crate после профильных тестов |
| PhotoCraft: `crates/color/src/{blend,convert,lib}.rs` | Blend и pixel format conversions; 26 unit tests passed. Цветовые/alpha соглашения должны совпасть с MyCut | cms, serde | B / средняя / отдельный color-адаптер, не второй pipeline |
| PhotoCraft: `crates/raster/src/lib.rs` | Sparse COW tiles 256×256, damage tracking. В этой проверке не тестировалось | geom/color | B-кандидат / высокая / адаптер Data storage |
| PhotoCraft: `crates/paint/src/{brush,dynamics,render,curve}.rs` | Детерминированные strokes/dabs, flow/opacity/smoothing; не готовый MyCut tool/session | geom/color/raster/serde | B-кандидат / средняя / собственный gesture adapter; профильные tests до переноса |
| PhotoCraft: `crates/algo/src/tone.rs`, `crates/compose/src/{adjust,masks}.rs` | Реальные tone/filter/mask kernels, не только декларации README. Некоторые принимают straight RGBA; весь compose связан с их doc | raster/color/geom, rustfft, rayon | B kernels / C весь compositor / средняя–высокая |
| PhotoCraft: `crates/gpu/src/{plan,lib,compose.wgsl,fx}.rs` | Pass planner, masks/blend/adjust/FX WGSL. Связан с их Document; GPU/CPU parity нами ещё не измерена | wgpu 30, half, doc/compose/raster | B отдельные kernels / C planner / высокая; не копировать renderer целиком |
| PhotoCraft: `crates/doc/src/lib.rs`, `crates/ops/src/lib.rs` | Дерево layers/masks, history snapshots через COW. Не универсальная Prefab-система MyCut | project types, raster | C / средняя / сохранить единый MyCut Session/Undo |
| EffectCraft: `crates/time/src/lib.rs` | Tick/frame-rate/timecode, 254016000000 ticks/s; 19 tests passed. Нулевой denominator имеет другую семантику, чем FilmCraft | serde | B/C / низкая / одна canonical MyCut time model, явная валидация |
| EffectCraft: `crates/keyframe/src/{lib,value,text_doc}.rs` | Linear/Hold/Bezier, speed/influence easing, spatial curves, auto tangents/roving; 37 tests passed | time/geom/color, serde/json | B / средняя / адаптер к единственному ParameterValue, не второй Value enum |
| EffectCraft: `crates/render/src/three_d/camera.rs`, `crates/render/src/lib.rs` | Камера, DOF, 2D/3D transform, композиционный pipeline. Зависимость от их Layer/EvalCtx, не универсальный Space | project/keyframe/render | C, отдельная математика B / высокая / Space adapter, не импорт приложения |
| FilmCraft: `crates/time/src/lib.rs` | Rational conversions, saturation, robust invalid input; 18 tests passed. Валидные примеры совпадают с EffectCraft, повреждённые не всегда | serde | B/C / низкая / не подключать два времени в продукт |
| FilmCraft: `crates/engine/src/trim.rs`, `*_trim_tests.rs`, `ripple_delete_tests.rs` | Trim/roll/ripple, Session commands, linked clips/sync locks. Сильная связь с Project. Монтажные тесты не запускались | engine/project/session | C/B / высокая / перенос выбранных операций через команды MyCut |
| FilmCraft: `crates/media/src/cache.rs` | Byte-budget LRU, Arc frames; eviction сортирует кандидатов. Конкурентные misses могут дублировать decode | time/color/frame/dng/rayon/image/platform | B/C / средняя / нужен in-flight dedup; decode/export ещё не проверены |
| VectorCraft: `crates/geom/src/{path,hit,bez,projective}.rs` | Anchor handles, Bezier, hit testing, projective maps; 64 tests passed. Dev testkit подтягивает большую часть приложения | kurbo 0.13, serde, thiserror | B / средняя / адаптер координат/ID; сначала проверить достаточность самого kurbo |
| VectorCraft: `crates/pathops/src/{boolean,planar,offset,fit,edit}.rs` | Boolean topology через linesweeper, восстановление кривых с tolerance. Эти tests не запускались | geom, linesweeper 0.5 | A upstream kurbo/linesweeper либо B wrapper / средняя; не писать Boolean заново |
| VectorCraft: `crates/render` | CPU vello_cpu raster; наличие wgpu не означает GPU-векторизацию всех операций | vello_cpu и doc | C / высокая / не выдавать за готовый GPU pipeline |
| wgpu: `wgpu/src`, `examples` | GPU API, ресурсы/команды; не decode, не editor. Репозиторий HEAD не заменяет version pin совместимого backend | backend/platform crates | A / средняя / через egui-wgpu, единые Device/Queue |
| Bevy: `crates/bevy_render`, `crates/bevy_ecs` | Большой ECS/render framework. Полная интеграция не проверена; для простого Data не нужен Scene | множество ECS/render crates | C; D для обязательной основы первого photo-среза / высокая |
| glam: `src/camera.rs`, `src/camera/rh/{proj,view}.rs` | Векторная математика/project-unproject, тест через probe passed. HEAD camera API отличается от старых Mat4 примеров | optional serde/bytemuck | A / низкая / явные handedness/depth convention, без Bevy |
| Branded assets Craft | Логотипы/названия/часть ресурсов имеют отдельные условия | asset-specific | D / не переносить |

## Лицензии: условия допуска

Исследованные корневые code licenses этих десяти проектов: MIT OR Apache-2.0. При прямой зависимости сохранить выбранную лицензию, copyright и применимые NOTICE; при переносе файла — также его индивидуальные заголовки и сведения об изменениях. В Craft имеются NOTICE/ATTRIBUTION и отдельная лицензия бренда: открытость кода не разрешает копировать брендинг.

Probe dependency metadata проверены для 86 packages, но это не аудит всех зависимостей четырёх приложений. `epaint_default_fonts 0.36.2` требует дополнительно OFL-1.1 и Ubuntu-font-1.0; `unicode-ident` — Unicode-3.0. `self_cell` предлагает Apache-2.0 OR GPL-2.0-only: для MyCut выбирать Apache, а не считать библиотеку автоматически GPL-only. Перед выпуском приложения сформировать notices из **его собственного Cargo.lock**, включая fonts и платформенные зависимости. Image/PDF/video codecs проверять отдельно; root MIT не заменяет их условий.

## Проверка, проведённая фактически

Изолированный rustc 1.99.1, x64 MSVC, без изменения системного PATH. Сторонние деревья не правились.

| Команда (из research root) | Результат |
|---|---|
| `cargo test --manifest-path effectcraft/Cargo.toml -p effectcraft-time --lib --locked` | 19 passed |
| `cargo test --manifest-path effectcraft/Cargo.toml -p effectcraft-keyframe --lib --locked` | 37 passed |
| `cargo test --manifest-path filmcraft/Cargo.toml -p filmcraft-time --lib --locked` | 18 passed |
| `cargo test --manifest-path photocraft/Cargo.toml -p photocraft-color --lib --locked` | 26 passed |
| `cargo test --manifest-path vectorcraft/Cargo.toml -p vectorcraft-geom --lib --locked` | 64 passed; cold build ~8 min из-за dev testkit |
| `cargo test --manifest-path probes/component-gate/Cargo.toml --lib --locked` | 5 passed |

Итого 169. Probe проверяет headless egui+snarl, serde graph, принятие циклов UI-библиотекой, атомарность docking, разные invalid time semantics, project/unproject glam. В snarl три upstream deprecation warnings (`std::f32::NAN`); они не исправлялись в чужом коде. Нельзя считать эти результаты проверкой полного PhotoCraft, playback, экспортов, GPU parity или производительности массового графа.

Вывод: совместимый первый UI cohort — egui/eframe 0.36.2 + snarl 0.12, а не произвольный HEAD egui 0.37. Iced/Slint просмотрены как альтернативы на уровне официальных описаний, но не собраны и не выбраны: второй UI toolkit сейчас добавит повторную интеграцию без доказанной выгоды.

## Дополнение: готовые компоненты для Transform и текста

Проверены опубликованные исходники из изолированного Cargo registry; версии зафиксированы Cargo.lock. Категория A: прямое подключение с небольшим собственным адаптером, без fork и копирования приложений.

| Компонент / upstream SHA | Реальный код и применение | Ограничения / зависимости / лицензия |
|---|---|---|
| imageproc 0.26.2; `32ca11ef43feb5f6518c76c707d5d6004e78fb57` | `src/geometric_transformations.rs`: Projection, warp_into_with; `next/photo-core/src/transform.rs` адаптирует premultiplied alpha, пиксельные центры, отражение и края. Интеграция средней сложности. | CPU bilinear, не GPU/nonlinear warp. Прямой bilinear терял край при отсутствующем соседе: исправлено padding в адаптере, проверено тестами. image/nalgebra и прочие зависимости — в lock/ThirdParty. MIT; сохранить copyright/license. |
| ab_glyph 0.2.32; `ffde4c677fa1095ac355174c1aa2919d7d53eff3` | `glyph/src/{font,outlined}.rs`: метрики/kerning/outline rasterization; `next/photo-core/src/text.rs` строит multiline bounds и растр. Интеграция низкой/средней сложности. | Не полноценный shaping/bidi. owned_ttf_parser/ab_glyph_rasterizer; Apache-2.0, сохранить license и применимые уведомления. Системный шрифт читается локально, не включается в дистрибутив. |

Проверка выбранных компонентов — интеграционные тесты MyCut, не утверждение о запуске полного upstream test suite: transformed render/pick/roundtrip, Flip edge pixels, multiline Cyrillic, auto bounds, cached text без font, реальные egui selection/replacement/Undo. Текущий workspace: 40 passed. Уведомления о 207 Windows packages пересобраны; происхождение сохранено в `next/ThirdParty/manifest.json`.
