using System.Windows;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;
internal static class InteractionSmokeTests
{
    internal static void Run(EditorViewModel vm, ViewportHost viewport, Action<bool, string> check)
    {
        check(viewport.ClientHitForTest(), "Native viewport WM_NCHITTEST accepts client clicks");
        vm.Engine.Reset(); vm.Reload(); vm.Select(0);
        viewport.DispatchForTest(0x0201, 410, 340);
        if(viewport.InputFailure is {} failure)throw new InvalidOperationException("Viewport input failed",failure);
        check(vm.Selected?.Id == 2, "Actual HWND WM_LBUTTONDOWN selects the clicked object");
        viewport.DispatchForTest(0x0200, 470, 370); viewport.DispatchForTest(0x0202, 470, 370);
        check(Math.Abs(vm.Engine.Items()[0].X - 470) < 3 && Math.Abs(vm.Engine.Items()[0].Y - 370) < 3, "Native mouse messages move the selected object");
        vm.UndoCommand.Execute(null);
        check(vm.X == 410 && !vm.Engine.CanUndo, "Native pointer gesture undoes in one step");
        viewport.DispatchForTest(0x0201, 410, 340); viewport.DispatchForTest(0x0200, 500, 390); viewport.EscapeForTest();
        check(vm.X == 410 && vm.Y == 340 && !vm.Engine.CanUndo, "Native Escape cancels drag without adding history");
        var corner = vm.Engine.HandlePoint(2, 2, viewport.DipsPerUnit);
        var anchor = vm.Engine.HandlePoint(2, 0, viewport.DipsPerUnit);
        viewport.DispatchForTest(0x0201, corner.X, corner.Y);
        float tx = corner.X + (corner.X - anchor.X) * .2f, ty = corner.Y + (corner.Y - anchor.Y) * .2f;
        viewport.DispatchForTest(0x0200, tx, ty); viewport.DispatchForTest(0x0202, tx, ty);
        check(Math.Abs(vm.ScaleX - 1.2) < .02 && Math.Abs(vm.ScaleY - 1.2) < .02, "Native corner handle scales both axes");
        vm.UndoCommand.Execute(null);
        var edge = vm.Engine.HandlePoint(2, 5, viewport.DipsPerUnit); var oppositeEdge = vm.Engine.HandlePoint(2, 7, viewport.DipsPerUnit);
        viewport.DispatchForTest(0x0201, edge.X, edge.Y);
        viewport.DispatchForTest(0x0200, edge.X + (edge.X - oppositeEdge.X) * .2f, edge.Y + (edge.Y - oppositeEdge.Y) * .2f);
        viewport.DispatchForTest(0x0202, edge.X, edge.Y);
        check(Math.Abs(vm.ScaleX - 1.2) < .03 && Math.Abs(vm.ScaleY - 1) < .02, "Native edge handle scales width independently");
        vm.UndoCommand.Execute(null);
        var rotate = vm.Engine.HandlePoint(2, 8, viewport.DipsPerUnit);
        var i = vm.Selected!;
        viewport.DispatchForTest(0x0201, rotate.X, rotate.Y);
        float rx = i.X - (rotate.Y - i.Y), ry = i.Y + (rotate.X - i.X);
        viewport.DispatchForTest(0x0200, rx, ry); viewport.DispatchForTest(0x0202, rx, ry);
        check(Math.Abs(vm.Rotation - 78) < 2, "Native rotation handle rotates around the object center");
        viewport.DispatchForTest(0x0201, 5, 5); viewport.DispatchForTest(0x0202, 5, 5);
        check(vm.Selected is null, "Native empty click clears selection");
        check(viewport.InputFailure is null, "Native input dispatch completes without crossing the ABI with exceptions");
        vm.Engine.Reset(); vm.Reload(); viewport.RenderNow();
        vm.Select(0);
        var leftTop = vm.Engine.HandlePoint(2, 0, viewport.DipsPerUnit);
        var leftBottom = vm.Engine.HandlePoint(2, 3, viewport.DipsPerUnit);
        float mx = (leftTop.X + leftBottom.X) / 2, my = (leftTop.Y + leftBottom.Y) / 2;
        float nx = mx - 410, ny = my - 340, length = MathF.Sqrt(nx * nx + ny * ny);
        mx += nx / length * 12 / viewport.DipsPerUnit; my += ny / length * 12 / viewport.DipsPerUnit;
        var nearHit = vm.Engine.Hit(0, mx, my, viewport.DipsPerUnit);
        check(nearHit.Id == 2 && nearHit.Tool == 1, "Hover resolves an object from its expanded screen-space margin");
        viewport.DispatchForTest(0x0201, mx, my); viewport.DispatchForTest(0x0202, mx, my);
        check(vm.Selected?.Id == 2 && !vm.Engine.CanUndo, $"Click in the highlighted object margin selects the same object without editing it (id={vm.Selected?.Id}, undo={vm.Engine.CanUndo})");
        var expanded = vm.Engine.HandlePoint(2, 1, viewport.DipsPerUnit);
        float vx = 410 - expanded.X, vy = 340 - expanded.Y, vl = MathF.Sqrt(vx * vx + vy * vy);
        var handleHit = vm.Engine.Hit(2, expanded.X + vx / vl * 20 / viewport.DipsPerUnit, expanded.Y + vy / vl * 20 / viewport.DipsPerUnit, viewport.DipsPerUnit);
        check(handleHit.Id == 2 && handleHit.Tool == 2 && handleHit.Handle == 1, "Hover resolves a scale handle 20 DIPs beyond its visible square");
        double now = 0, value = 0; bool staleCompletion = false;
        using var motion = new MotionEngine(false, () => now, false);
        var owner = new object();
        motion.Animate(owner, "panel", 0, 1, 1, v => value = v, () => staleCompletion = true);
        now = .4; motion.Advance(); double beforeReverse = value;
        motion.Animate(owner, "panel", 0, 0, 1, v => value = v);
        check(Math.Abs(value - beforeReverse) < .00001, "Animation reverses from the current value without a jump");
        now = 2; motion.Advance();
        check(value == 0 && !staleCompletion && motion.ActiveCount == 0, "Reversed animation cancels stale completion and releases its frame clock");
        using var reduced = new MotionEngine(true, () => now, false);
        reduced.Animate(owner, "panel", 0, 1, 1, v => value = v);
        check(value == 1 && reduced.ActiveCount == 0, "Reduced motion completes without scheduling animation frames");
    }
}
