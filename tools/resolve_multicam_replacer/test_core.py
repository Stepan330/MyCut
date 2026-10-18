import unittest

from core import ClipSpan, build_sync_plan


def clip(index, name, asset, ts, te, ss):
    return ClipSpan(index, name, asset, ts, te, ss, ss + (te - ts) - 1)


class SyncPlanTests(unittest.TestCase):
    def test_audio_bridges_two_video_files(self):
        video = [clip(0, "V1", "v1", 100, 200, 500), clip(1, "V2", "v2", 200, 300, 0)]
        audio = [clip(0, "A1", "a1", 100, 300, 1000)]
        plan = build_sync_plan(video, audio, multicam_duration=1000)
        self.assertFalse(plan.conflicts)
        self.assertEqual([(0, 99), (100, 199)], [(r.source_start, r.source_end) for r in plan.replacements])

    def test_alternating_rollovers_propagate(self):
        video = [clip(0, "V1a", "v1", 0, 150, 0), clip(1, "V1b", "v1", 150, 200, 150),
                 clip(2, "V2", "v2", 200, 300, 0)]
        audio = [clip(0, "A1", "a1", 0, 100, 50), clip(1, "A2", "a2", 100, 300, 0)]
        plan = build_sync_plan(video, audio, multicam_duration=1000)
        self.assertFalse(plan.conflicts)
        self.assertEqual([0, 150, 200], [r.source_start for r in plan.replacements])

    def test_edit_cut_uses_source_time_not_collapsed_timeline(self):
        video = [clip(0, "first", "v", 0, 10, 100), clip(1, "later", "v", 10, 20, 500)]
        audio = [clip(0, "audio", "a", 0, 20, 300)]
        plan = build_sync_plan(video, audio, multicam_duration=1000)
        self.assertEqual([0, 400], [r.source_start for r in plan.replacements])

    def test_unconnected_video_is_rejected(self):
        video = [clip(0, "V1", "v1", 0, 10, 0), clip(1, "V2", "v2", 20, 30, 0)]
        audio = [clip(0, "A", "a", 0, 10, 0)]
        plan = build_sync_plan(video, audio, multicam_duration=100)
        self.assertEqual(1, len(plan.rejected))

    def test_conflicting_paths_are_reported(self):
        video = [clip(0, "V1", "v", 0, 10, 0), clip(1, "V1 slipped", "v", 20, 30, 30)]
        audio = [clip(0, "A1", "a", 0, 10, 0), clip(1, "A2", "a", 20, 30, 20)]
        plan = build_sync_plan(video, audio, multicam_duration=100, tolerance_frames=2)
        self.assertTrue(plan.conflicts)


if __name__ == "__main__":
    unittest.main()
