from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class ClipSpan:
    index: int
    name: str
    asset_id: str
    timeline_start: int
    timeline_end: int
    source_start: int
    source_end: int

    @property
    def duration(self) -> int:
        return self.timeline_end - self.timeline_start

    @property
    def source_duration(self) -> int:
        return self.source_end - self.source_start + 1

    @property
    def is_normal_speed(self) -> bool:
        return abs(self.source_duration - self.duration) <= 1

    def source_at(self, timeline_frame: int) -> int:
        return self.source_start + timeline_frame - self.timeline_start


@dataclass(frozen=True)
class Replacement:
    clip: ClipSpan
    source_start: int
    source_end: int


@dataclass(frozen=True)
class RejectedClip:
    clip: ClipSpan
    reason: str


@dataclass(frozen=True)
class SyncConflict:
    asset_id: str
    expected_base: int
    calculated_base: int


@dataclass(frozen=True)
class Plan:
    anchor: ClipSpan
    asset_bases: dict[str, int]
    replacements: tuple[Replacement, ...]
    rejected: tuple[RejectedClip, ...]
    conflicts: tuple[SyncConflict, ...]


def build_sync_plan(
    video_clips: Iterable[ClipSpan],
    audio_clips: Iterable[ClipSpan],
    *,
    multicam_duration: int,
    anchor_multicam_frame: int = 0,
    tolerance_frames: int = 2,
) -> Plan:
    """Recover continuous recording time through alternating A/V overlaps."""
    video = sorted(video_clips, key=lambda c: (c.timeline_start, c.index))
    audio = sorted(audio_clips, key=lambda c: (c.timeline_start, c.index))
    if not video:
        raise ValueError("На выбранной видеодорожке нет клипов.")
    if not audio:
        raise ValueError("На выбранной аудиодорожке нет клипов.")
    if multicam_duration <= 0:
        raise ValueError("Resolve не сообщил положительную длительность Multicam Clip.")

    anchor = video[0]
    if not anchor.is_normal_speed:
        raise ValueError("Первый видеофрагмент имеет retime/speed change и не может быть якорем.")

    graph: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for v in video:
        if not v.is_normal_speed:
            continue
        for a in audio:
            if not a.is_normal_speed:
                continue
            at = max(v.timeline_start, a.timeline_start)
            if at >= min(v.timeline_end, a.timeline_end):
                continue
            # base_audio = base_video + video_local(t) - audio_local(t)
            delta = v.source_at(at) - a.source_at(at)
            graph[v.asset_id].append((a.asset_id, delta))
            graph[a.asset_id].append((v.asset_id, -delta))

    bases = {anchor.asset_id: anchor_multicam_frame - anchor.source_start}
    conflicts: list[SyncConflict] = []
    queue = deque([anchor.asset_id])
    while queue:
        current = queue.popleft()
        for neighbor, delta in graph[current]:
            calculated = bases[current] + delta
            if neighbor not in bases:
                bases[neighbor] = calculated
                queue.append(neighbor)
            elif abs(bases[neighbor] - calculated) > tolerance_frames:
                conflict = SyncConflict(neighbor, bases[neighbor], calculated)
                if conflict not in conflicts:
                    conflicts.append(conflict)

    replacements: list[Replacement] = []
    rejected: list[RejectedClip] = []
    for clip in video:
        if not clip.is_normal_speed:
            rejected.append(RejectedClip(clip, "retime/speed change: автоматическая замена небезопасна"))
            continue
        if clip.asset_id not in bases:
            rejected.append(RejectedClip(clip, "нет цепочки синхронизации через выбранное аудио"))
            continue
        start = bases[clip.asset_id] + clip.source_start
        end = start + clip.duration - 1
        if start < 0:
            rejected.append(RejectedClip(clip, "расчётный In раньше начала Multicam"))
        elif end >= multicam_duration:
            rejected.append(RejectedClip(clip, "расчётный Out позже конца Multicam"))
        else:
            replacements.append(Replacement(clip, start, end))

    return Plan(anchor, bases, tuple(replacements), tuple(rejected), tuple(conflicts))
