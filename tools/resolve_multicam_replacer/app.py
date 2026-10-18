from __future__ import annotations

import tkinter as tk
import os
import subprocess
import sys
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from resolve_adapter import apply_plan, connect, inspect_tracks


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.ctx = None
        self.plan = None
        root.title("Resolve Multicam Replacer")
        root.minsize(760, 520)

        controls = ttk.Frame(root, padding=12)
        controls.pack(fill="x")
        ttk.Label(controls, text="Видеодорожка").grid(row=0, column=0, sticky="w")
        self.track = tk.IntVar(value=1)
        ttk.Spinbox(controls, from_=1, to=99, textvariable=self.track, width=7).grid(row=0, column=1, padx=(8, 24))
        ttk.Label(controls, text="Аудиодорожка").grid(row=0, column=2, sticky="w")
        self.audio_track = tk.IntVar(value=1)
        ttk.Spinbox(controls, from_=1, to=99, textvariable=self.audio_track, width=7).grid(row=0, column=3, padx=(8, 24))
        ttk.Label(controls, text="Multicam In первого клипа").grid(row=0, column=4, sticky="w")
        self.offset = tk.IntVar(value=0)
        ttk.Spinbox(controls, from_=0, to=10000000, textvariable=self.offset, width=12).grid(row=0, column=5, padx=8)
        ttk.Button(controls, text="Проверить", command=self.preview).grid(row=1, column=4, pady=(10, 0), padx=(20, 6))
        self.apply_button = ttk.Button(controls, text="Создать копию и заменить", command=self.apply, state="disabled")
        self.apply_button.grid(row=1, column=5, pady=(10, 0))

        ttk.Label(controls, text="Portable Resolve.exe").grid(row=2, column=0, pady=(10, 0), sticky="w")
        self.resolve_path = tk.StringVar(value=os.environ.get("RESOLVE_EXE", ""))
        ttk.Entry(controls, textvariable=self.resolve_path, width=55).grid(
            row=2, column=1, columnspan=4, pady=(10, 0), padx=8, sticky="ew"
        )
        ttk.Button(controls, text="Обзор…", command=self.choose_resolve).grid(row=2, column=5, pady=(10, 0))

        help_text = (
            "Перед запуском выберите в Media Pool ровно один Multicam Clip. "
            "Укажите синхронные видео- и аудиодорожки. Программа перенесёт время "
            "через смену файлов по их перекрытиям."
        )
        ttk.Label(root, text=help_text, wraplength=730, justify="left", padding=(12, 0, 12, 8)).pack(fill="x")
        self.output = tk.Text(root, wrap="none", font=("Consolas", 10), state="disabled")
        self.output.pack(fill="both", expand=True, padx=12, pady=(0, 12))

    def choose_resolve(self):
        path = filedialog.askopenfilename(
            title="Выберите Resolve.exe из portable-папки",
            filetypes=[("DaVinci Resolve", "Resolve.exe"), ("Executable", "*.exe")],
        )
        if path:
            self.resolve_path.set(path)

    def configure_portable(self):
        value = self.resolve_path.get().strip()
        if not value:
            return
        executable = Path(value)
        if not executable.is_file():
            raise ValueError(f"Resolve.exe не найден: {executable}")
        install = executable.parent
        candidates = [
            install / "fusionscript.dll",
            install / "libs" / "Fusion" / "fusionscript.dll",
            install.parent / "fusionscript.dll",
        ]
        library = next((path for path in candidates if path.is_file()), None)
        if not library:
            raise ValueError(
                "В portable-папке не найдена fusionscript.dll. "
                "Эта сборка Resolve не содержит Scripting API; потребуется полная установка или другая portable-сборка."
            )
        os.environ["RESOLVE_EXE"] = str(executable)
        os.environ["RESOLVE_INSTALL_DIR"] = str(install)
        os.environ["RESOLVE_SCRIPT_LIB"] = str(library)

    def probe_api(self):
        startup = None
        if os.name == "nt":
            startup = subprocess.STARTUPINFO()
            startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        child_env = os.environ.copy()
        child_env["PYTHONUTF8"] = "1"
        try:
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("probe_resolve.py"))],
                cwd=str(Path(__file__).parent),
                env=child_env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=20,
                startupinfo=startup,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Resolve Scripting API не ответил за 20 секунд.") from exc
        output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        if result.returncode != 0:
            if result.returncode < 0 or result.returncode >= 0x80000000:
                detail = f"native crash, код 0x{result.returncode & 0xFFFFFFFF:08X}"
            else:
                detail = f"код завершения {result.returncode}"
            raise RuntimeError(
                "Portable-библиотека Resolve аварийно завершила отдельную проверку "
                f"({detail}). Основное окно сохранено.\n\n{output or 'Журнал пуст.'}"
            )
        if "PROBE_OK\t" not in result.stdout:
            raise RuntimeError(f"Resolve API вернул неожиданный ответ:\n{output or 'Журнал пуст.'}")

    def write(self, text: str):
        self.output.configure(state="normal")
        self.output.delete("1.0", "end")
        self.output.insert("1.0", text)
        self.output.configure(state="disabled")

    def preview(self):
        self.apply_button.configure(state="disabled")
        try:
            self.configure_portable()
            self.probe_api()
            self.ctx = connect()
            self.plan, _ = inspect_tracks(self.ctx, self.track.get(), self.audio_track.get(), self.offset.get())
            lines = [
                f"Проект: {self.ctx.project.GetName()}",
                f"Таймлайн: {self.ctx.timeline.GetName()}",
                f"Источник: {self.ctx.multicam.GetName()}",
                f"Якорный клип: {self.plan.anchor.name}",
                f"Связанных исходных файлов: {len(self.plan.asset_bases)}",
                "",
                f"Будет заменено: {len(self.plan.replacements)}",
            ]
            for r in self.plan.replacements:
                lines.append(
                    f"  OK  [{r.clip.timeline_start}, {r.clip.timeline_end}) {r.clip.name}"
                    f"  -> source [{r.source_start}, {r.source_end}]"
                )
            if self.plan.rejected:
                lines += ["", f"Будет пропущено: {len(self.plan.rejected)}"]
                for rejected in self.plan.rejected:
                    lines.append(f"  SKIP  {rejected.clip.name}: {rejected.reason}")
            if self.plan.conflicts:
                lines += ["", "КОНФЛИКТЫ СИНХРОНИЗАЦИИ (применение заблокировано):"]
                for conflict in self.plan.conflicts:
                    lines.append(
                        f"  {conflict.asset_id}: база {conflict.expected_base}, "
                        f"другая цепочка даёт {conflict.calculated_base}"
                    )
            lines += ["", "Исходный таймлайн изменён не будет: применение всегда создаёт его копию."]
            self.write("\n".join(lines))
            if self.plan.replacements and not self.plan.conflicts:
                self.apply_button.configure(state="normal")
        except Exception as exc:
            self.write(f"ОШИБКА: {exc}")
            messagebox.showerror("Resolve Multicam Replacer", str(exc))

    def apply(self):
        if not self.ctx or not self.plan:
            return
        if not messagebox.askyesno(
            "Подтверждение",
            f"Создать копию таймлайна и заменить {len(self.plan.replacements)} фрагментов?",
        ):
            return
        self.apply_button.configure(state="disabled")
        try:
            duplicate, errors = apply_plan(self.ctx, self.track.get(), self.plan)
            if errors:
                details = "\n".join(f"- {e}" for e in errors)
                self.write(f"Создан таймлайн: {duplicate.GetName()}\n\nОшибки:\n{details}")
                messagebox.showwarning("Завершено с ошибками", "Работайте только с созданной копией; подробности в окне.")
            else:
                self.write(
                    f"ГОТОВО\n\nСоздан таймлайн: {duplicate.GetName()}\n"
                    f"Заменено фрагментов: {len(self.plan.replacements)}\n"
                    f"Пропущено при проверке: {len(self.plan.rejected)}"
                )
                messagebox.showinfo("Готово", "Замена выполнена в новом таймлайне.")
        except Exception as exc:
            self.write(f"ОШИБКА: {exc}")
            messagebox.showerror("Resolve Multicam Replacer", str(exc))


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
