import datetime as dt
import importlib.util
from pathlib import Path
import threading
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("scheduler", Path(__file__).parents[1] / "scripts" / "prompt_scheduler.py")
scheduler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scheduler)


class SchedulerTests(unittest.TestCase):
    def test_next_night(self):
        now = dt.datetime(2026, 10, 14, 23, 0)
        self.assertEqual(scheduler.scheduled_time("01:40", now), dt.datetime(2026, 10, 15, 1, 40))

    def test_explicit_past_rejected(self):
        with self.assertRaises(ValueError):
            scheduler.scheduled_time("2026-10-14T01:40", dt.datetime(2026, 10, 14, 23))

    def test_exact_destination_and_stdin(self):
        job = scheduler.make_job("Привет\n& $(not-a-command)", dt.datetime(2026, 10, 15, 1, 40))
        args = scheduler.command(job, "codex.exe")
        self.assertEqual(args[-2:], [scheduler.CHAT_ID, "-"])
        self.assertNotIn("--last", args)
        self.assertNotIn(job["prompt"], args)

    def test_no_send_in_dry_run(self):
        now = dt.datetime(2026, 10, 15, 1, 40)
        job = scheduler.make_job("Test", now)
        with patch.object(scheduler, "find_codex", return_value="codex.exe"):
            scheduler.wait_and_send(job, threading.Event(), lambda _: None, dry_run=True,
                                    runner=lambda *a, **k: self.fail("Unexpected actual send"), clock=lambda: now)

    def test_late_wakeup_refused(self):
        when = dt.datetime(2026, 10, 15, 1, 40)
        job = scheduler.make_job("Test", when)
        with patch.object(scheduler, "find_codex", return_value="codex.exe"):
            with self.assertRaises(RuntimeError):
                scheduler.wait_and_send(job, threading.Event(), lambda _: None,
                                        clock=lambda: when + dt.timedelta(hours=2))

    def test_single_attempt_and_utf8_payload_with_fake_runner(self):
        now = dt.datetime(2026, 10, 15, 1, 40)
        job = scheduler.make_job("Привет\n& $test", now)
        calls = []
        def fake_runner(args, **kwargs):
            calls.append(args)
            self.assertEqual(kwargs["input"], job["prompt"])
            self.assertFalse(kwargs["shell"])
            return SimpleNamespace(returncode=0)
        temp_root = scheduler.PROJECT / "out" / "scheduler-tests"
        temp_root.mkdir(parents=True, exist_ok=True)
        temp_root.resolve().relative_to(scheduler.PROJECT.resolve())
        with tempfile.TemporaryDirectory(dir=temp_root) as folder, patch.object(scheduler, "JOBS", Path(folder)), patch.object(scheduler, "find_codex", return_value="codex.exe"):
            scheduler.wait_and_send(job, threading.Event(), lambda _: None, runner=fake_runner, clock=lambda: now)
            with self.assertRaises(FileExistsError):
                scheduler.wait_and_send(job, threading.Event(), lambda _: None, runner=fake_runner, clock=lambda: now)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
