"""One-shot local Codex session scheduler; no UI automation or API-key handling."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import uuid

CHAT_ID = "01a13594-289a-77e2-9d27-583903848d4a"
PROJECT = Path(__file__).resolve().parents[1]
JOBS = PROJECT / "out" / "prompt-scheduler"


def scheduled_time(value: str, now: dt.datetime | None = None) -> dt.datetime:
    """HH:MM = next local occurrence; full ISO local datetime must be in future."""
    now = now or dt.datetime.now()
    if len(value) == 5 and value[2] == ":":
        time = dt.datetime.strptime(value, "%H:%M").time()
        result = dt.datetime.combine(now.date(), time)
        if result <= now:
            result += dt.timedelta(days=1)
    else:
        result = dt.datetime.fromisoformat(value)
        if result.tzinfo is not None:
            raise ValueError("Use local PC time without a UTC offset.")
        if result <= now:
            raise ValueError("Дата и время уже прошли.")
    return result


def make_job(prompt: str, when: dt.datetime, thread_id: str = CHAT_ID) -> dict:
    uuid.UUID(thread_id)  # Never use --last: the destination must be explicit.
    if not prompt.strip():
        raise ValueError("Введите текст промпта.")
    return {"version": 1, "id": str(uuid.uuid4()), "thread_id": thread_id,
            "at_local": when.isoformat(timespec="seconds"), "prompt": prompt,
            "cwd": str(PROJECT)}


def find_codex() -> str:
    executable = shutil.which("codex")
    if executable:
        return executable
    root = Path(os.environ.get("LOCALAPPDATA", "")) / "OpenAI" / "Codex" / "bin"
    candidates = list(root.glob("*/codex.exe"))
    if not candidates:
        raise RuntimeError("Codex CLI не найден. Установите/откройте Codex и проверьте codex --help.")
    return str(max(candidates, key=lambda p: p.stat().st_mtime))


def command(job: dict, executable: str) -> list[str]:
    uuid.UUID(job["thread_id"])
    return [executable, "exec", "resume", "--json", job["thread_id"], "-"]


def save_job(job: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".writing")
    temporary.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def load_job(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if data.get("version") != 1:
        raise ValueError("Неизвестная версия задания.")
    result = make_job(data["prompt"], dt.datetime.fromisoformat(data["at_local"]), data["thread_id"])
    result["id"] = str(uuid.UUID(data["id"]))
    if Path(data["cwd"]).resolve() != PROJECT:
        raise ValueError("Рабочая папка задания не совпадает с MyCut.")
    return result


def wait_and_send(job: dict, cancel: threading.Event, report, *, dry_run=False,
                  runner=subprocess.run, clock=dt.datetime.now, max_late=180) -> None:
    when = dt.datetime.fromisoformat(job["at_local"])
    executable = find_codex()
    args = command(job, executable)
    report(f"Ожидание: {when:%Y-%m-%d %H:%M:%S} — местное время ПК. Чат: {job['thread_id']}")
    while not cancel.is_set():
        remaining = (when - clock()).total_seconds()
        if remaining <= 0:
            break
        cancel.wait(min(1.0, remaining))
    if cancel.is_set():
        report("Отменено до отправки.")
        return
    if (clock() - when).total_seconds() > max_late:
        raise RuntimeError("ПК проснулся слишком поздно. Не отправлено; назначьте новое время.")
    if dry_run:
        report("DRY RUN: таймер сработал. Codex не запускался; сообщение НЕ отправлено.")
        return
    JOBS.mkdir(parents=True, exist_ok=True)
    # Mark the single attempt before submission. No blind retries after timeout/crash:
    # the session might already have accepted the prompt.
    attempt = JOBS / (job["id"] + ".attempt.json")
    with attempt.open("x", encoding="utf-8") as file:
        json.dump({"thread_id": job["thread_id"], "started_at": clock().isoformat()}, file)
    report("Отправка через codex exec resume. Повтор автоматически не выполняется.")
    log = JOBS / (job["id"] + ".jsonl")
    with log.open("w", encoding="utf-8") as output:
        result = runner(args, input=job["prompt"], text=True, encoding="utf-8",
                        cwd=PROJECT, stdout=output, stderr=subprocess.STDOUT,
                        shell=False, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode:
        raise RuntimeError(f"Codex завершился с кодом {result.returncode}. Проверьте {log}. Повтор не запущен.")
    report(f"Codex завершил запуск в указанной сессии. Журнал: {log}. Если чат не обновился — переоткройте его.")


def gui() -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    root = tk.Tk()
    root.title("MyCut · промпт по расписанию")
    root.geometry("780x620")
    root.minsize(620, 470)
    panel = ttk.Frame(root, padding=16)
    panel.pack(fill="both", expand=True)
    ttk.Label(panel, text="Отправка в текущую сессию MyCut через официальный Codex CLI").pack(anchor="w")
    ttk.Label(panel, text=f"Чат: {CHAT_ID}").pack(anchor="w", pady=(4, 12))
    line = ttk.Frame(panel)
    line.pack(fill="x")
    ttk.Label(line, text="Дата (пусто = ближайшее время):").pack(side="left")
    date = ttk.Entry(line, width=14)
    date.pack(side="left", padx=6)
    ttk.Label(line, text="Время ПК:").pack(side="left", padx=6)
    time = ttk.Entry(line, width=8)
    time.insert(0, "01:40")
    time.pack(side="left")
    ttk.Label(panel, text="Промпт:").pack(anchor="w", pady=(12, 4))
    text = tk.Text(panel, wrap="word", height=14, undo=True)
    text.pack(fill="both", expand=True)
    ttk.Label(panel, text="ПК и программа должны оставаться включёнными. Не отправляйте в занятый чат.\n"
              "Это CLI-продолжение сессии, не клик Send в приложении. Лимиты не обходятся.",
              wraplength=730).pack(anchor="w", pady=10)
    status = tk.StringVar(value="Задание ещё не включено.")
    ttk.Label(panel, textvariable=status, wraplength=730).pack(anchor="w")
    actions = ttk.Frame(panel)
    actions.pack(fill="x", pady=10)
    messages = queue.Queue()
    cancel = threading.Event()
    worker = None

    def job_from_form():
        value = (date.get().strip() + "T" if date.get().strip() else "") + time.get().strip()
        return make_job(text.get("1.0", "end-1c"), scheduled_time(value))

    def arm():
        nonlocal worker, cancel
        try:
            if worker and worker.is_alive():
                raise ValueError("Сначала отмените активное ожидание.")
            job = job_from_form()
            find_codex()
            if not messagebox.askokcancel("Подтвердите отправку", f"{job['at_local']} (время ПК)\nВ сессию {CHAT_ID}\n\n{job['prompt'][:350]}\n\nОтправить ОДИН раз?"):
                return
            save_job(job, JOBS / (job["id"] + ".job.json"))
            cancel = threading.Event()
            def run():
                try:
                    wait_and_send(job, cancel, messages.put)
                except Exception as exc:
                    messages.put("Ошибка: " + str(exc))
            worker = threading.Thread(target=run, daemon=True)
            worker.start()
        except Exception as exc:
            messagebox.showerror("Не включено", str(exc))

    def import_text():
        path = filedialog.askopenfilename(filetypes=[("Текст UTF-8", "*.txt *.md"), ("Все файлы", "*.*")])
        if path:
            try:
                contents = Path(path).read_text(encoding="utf-8-sig")
                text.delete("1.0", "end")
                text.insert("1.0", contents)
            except Exception as exc:
                messagebox.showerror("Ошибка файла", str(exc))

    def tick():
        while not messages.empty():
            status.set(messages.get())
        root.after(200, tick)

    def close():
        if worker and worker.is_alive() and not messagebox.askokcancel("Закрыть?", "Ожидание будет отменено. Уже начатую отправку закрытие не отзывает."):
            return
        cancel.set()
        root.destroy()

    ttk.Button(actions, text="Загрузить текст…", command=import_text).pack(side="left")
    ttk.Button(actions, text="Назначить отправку", command=arm).pack(side="left", padx=8)
    ttk.Button(actions, text="Отменить ожидание", command=lambda: cancel.set()).pack(side="left")
    root.protocol("WM_DELETE_WINDOW", close)
    root.after(200, tick)
    root.mainloop()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--at", help="HH:MM or YYYY-MM-DDTHH:MM, local PC time")
    parser.add_argument("--prompt-file", type=Path)
    parser.add_argument("--job", type=Path, help="Previously saved .job.json; not auto-restored")
    parser.add_argument("--dry-run", action="store_true", help="Wait, but NEVER launch Codex")
    args = parser.parse_args()
    if not args.at and not args.job:
        gui()
        return
    if args.job:
        job = load_job(args.job)
    else:
        if not args.prompt_file:
            parser.error("--at requires --prompt-file")
        job = make_job(args.prompt_file.read_text(encoding="utf-8-sig"), scheduled_time(args.at))
    wait_and_send(job, threading.Event(), print, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
