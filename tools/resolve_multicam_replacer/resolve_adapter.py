from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from core import ClipSpan, Plan, build_sync_plan


class ResolveError(RuntimeError):
    pass


@dataclass
class ResolveContext:
    resolve: Any
    project: Any
    media_pool: Any
    timeline: Any
    multicam: Any


def _load_resolve_module():
    global _DLL_DIRECTORY
    install = Path(os.environ.get("RESOLVE_INSTALL_DIR", r"C:\Program Files\Blackmagic Design\DaVinci Resolve"))
    explicit_lib = os.environ.get("RESOLVE_SCRIPT_LIB")
    candidates = [
        Path(explicit_lib) if explicit_lib else None,
        install / "fusionscript.dll",
        install / "libs" / "Fusion" / "fusionscript.dll",
        install.parent / "fusionscript.dll",
    ]
    script_lib = next((p for p in candidates if p and p.is_file()), None)
    if script_lib:
        os.environ["RESOLVE_SCRIPT_LIB"] = str(script_lib)
        install = script_lib.parent
    if sys.platform.startswith("win") and hasattr(os, "add_dll_directory"):
        dll_dirs = {install}
        configured_root = Path(os.environ.get("RESOLVE_INSTALL_DIR", str(install)))
        dll_dirs.add(configured_root)
        _DLL_DIRECTORY = [
            os.add_dll_directory(str(directory))
            for directory in dll_dirs if directory.is_dir()
        ]
    try:
        import DaVinciResolveScript as dvr_script
        return dvr_script
    except ImportError:
        api = Path(os.environ.get(
            "RESOLVE_SCRIPT_API",
            r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting",
        ))
        modules = api / "Modules"
        if modules.is_dir():
            sys.path.insert(0, str(modules))
        try:
            import DaVinciResolveScript as dvr_script
            return dvr_script
        except ImportError as exc:
            searched = ", ".join(str(p) for p in candidates if p)
            raise ResolveError(
                "Не удалось загрузить DaVinci Resolve Scripting API. "
                "Сначала запустите Resolve, затем открывайте приложение через Start-Resolve-Multicam-Replacer.cmd. "
                f"Искали fusionscript.dll здесь: {searched}. Техническая причина: {exc}"
            ) from exc


def connect() -> ResolveContext:
    dvr_script = _load_resolve_module()
    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        raise ResolveError("DaVinci Resolve не запущен или External scripting отключён.")
    manager = resolve.GetProjectManager()
    project = manager and manager.GetCurrentProject()
    if not project:
        raise ResolveError("В Resolve не открыт проект.")
    timeline = project.GetCurrentTimeline()
    if not timeline:
        raise ResolveError("В проекте не открыт таймлайн.")
    media_pool = project.GetMediaPool()
    selected = list(media_pool.GetSelectedClips() or [])
    if len(selected) != 1:
        raise ResolveError("В Media Pool должен быть выбран ровно один Multicam Clip.")
    return ResolveContext(resolve, project, media_pool, timeline, selected[0])


def _to_int(value: Any, label: str) -> int:
    try:
        return int(round(float(str(value).replace(",", "."))))
    except (TypeError, ValueError) as exc:
        raise ResolveError(f"Не удалось прочитать {label}: {value!r}") from exc


def multicam_duration(multicam: Any) -> int:
    props = multicam.GetClipProperty() or {}
    for key in ("Frames", "Duration"):
        value = props.get(key)
        if value not in (None, ""):
            if key == "Frames":
                return _to_int(value, "длительность Multicam Clip")
    raise ResolveError(
        "Resolve не вернул свойство Frames для выбранного клипа. "
        "Убедитесь, что выбран именно клип, а не bin."
    )


def _read_track(timeline: Any, track_type: str, track_index: int):
    count = int(timeline.GetTrackCount(track_type) or 0)
    prefix = "V" if track_type == "video" else "A"
    if not 1 <= track_index <= count:
        raise ResolveError(f"Дорожка {prefix}{track_index} не существует (всего: {count}).")
    items = list(timeline.GetItemListInTrack(track_type, track_index) or [])
    spans = []
    for i, item in enumerate(items):
        media = item.GetMediaPoolItem()
        if not media:
            continue
        asset_id = str(media.GetUniqueId() or media.GetMediaId() or media.GetName())
        spans.append(ClipSpan(
            i, item.GetName() or f"clip-{i + 1}", asset_id,
            _to_int(item.GetStart(), "начало клипа"),
            _to_int(item.GetEnd(), "конец клипа"),
            _to_int(item.GetSourceStartFrame(), "Source Start"),
            _to_int(item.GetSourceEndFrame(), "Source End"),
        ))
    return spans, items


def inspect_tracks(ctx: ResolveContext, video_track: int, audio_track: int, offset_frames: int = 0):
    video, video_items = _read_track(ctx.timeline, "video", video_track)
    audio, _ = _read_track(ctx.timeline, "audio", audio_track)
    plan = build_sync_plan(video, audio, multicam_duration=multicam_duration(ctx.multicam),
                           anchor_multicam_frame=offset_frames)
    return plan, video_items


def unique_copy_name(project: Any, base: str) -> str:
    existing = {
        project.GetTimelineByIndex(i).GetName()
        for i in range(1, int(project.GetTimelineCount() or 0) + 1)
    }
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    candidate = f"{base} [Multicam {stamp}]"
    serial = 2
    while candidate in existing:
        candidate = f"{base} [Multicam {stamp}] {serial}"
        serial += 1
    return candidate


def apply_plan(ctx: ResolveContext, track_index: int, plan: Plan) -> tuple[Any, list[str]]:
    copy_name = unique_copy_name(ctx.project, ctx.timeline.GetName())
    duplicate = ctx.timeline.DuplicateTimeline(copy_name)
    if not duplicate:
        raise ResolveError("Resolve не смог создать копию таймлайна. Исходник не изменён.")
    if not ctx.project.SetCurrentTimeline(duplicate):
        raise ResolveError(f"Копия {copy_name!r} создана, но Resolve не смог её открыть.")

    duplicate_items = list(duplicate.GetItemListInTrack("video", track_index) or [])
    errors: list[str] = []
    for replacement in plan.replacements:
        index = replacement.clip.index
        if index >= len(duplicate_items):
            errors.append(f"{replacement.clip.name}: клип не найден в копии таймлайна")
            continue
        item = duplicate_items[index]
        if (_to_int(item.GetStart(), "начало клипа в копии") != replacement.clip.timeline_start
                or _to_int(item.GetEnd(), "конец клипа в копии") != replacement.clip.timeline_end):
            errors.append(f"{replacement.clip.name}: структура копии отличается от исходника")
            continue
        before = int(item.GetTakesCount() or 0)
        if not item.AddTake(ctx.multicam, replacement.source_start, replacement.source_end):
            errors.append(f"{replacement.clip.name}: AddTake отклонён Resolve")
            continue
        after = int(item.GetTakesCount() or 0)
        if after <= before or not item.SelectTakeByIndex(after):
            errors.append(f"{replacement.clip.name}: take добавлен, но не удалось выбрать его")

    if errors:
        duplicate.SetName(copy_name + " [CHECK ERRORS]")
    return duplicate, errors
