"""Crash-isolated Resolve API probe. Prints a small machine-readable result."""
import faulthandler

faulthandler.enable()

try:
    from resolve_adapter import connect

    context = connect()
    print(f"PROBE_OK\t{context.project.GetName()}\t{context.timeline.GetName()}")
except BaseException as exc:
    print(f"PROBE_ERROR\t{type(exc).__name__}: {exc}")
    raise SystemExit(2)
