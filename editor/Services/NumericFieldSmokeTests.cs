using System.Windows;
using MyCut.Editor.Controls;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;
internal static class NumericFieldSmokeTests
{
    internal static void Run(MainWindow window, EditorViewModel vm, Action<bool, string> check)
    {
        vm.Engine.Reset(); vm.Reload(); window.UpdateLayout();
        var row = MainWindow.Descendants<ParameterRow>(window).First(r => r.Label == "Position X / px");
        row.PointerForTest(0, new Point(10, 10)); row.PointerForTest(1, new Point(13, 10));
        check(vm.X == 410 && !vm.Engine.CanUndo, "Sub-threshold numeric pointer movement does not change the value");
        row.PointerForTest(2, new Point(13, 10));
        check(row.IsTextEditing, "Single click opens the numeric text editor");
        check(row.TextForTest(row.Value.ToString("G9", System.Globalization.CultureInfo.CurrentCulture)) && !vm.Engine.CanUndo,
            "Accepting an unchanged numeric value does not create an undo step");
        check(row.TextForTest("697.94") && Math.Abs(vm.Engine.Items()[0].X - 697.94) < .003, "Typed numeric input updates the real C++ model");
        vm.UndoCommand.Execute(null); check(vm.X == 410 && !vm.Engine.CanUndo, "Typed number is one undo step");
        row.PointerForTest(0, new Point(10, 10)); row.PointerForTest(1, new Point(35, 10));
        check(vm.X == 435, "Numeric drag changes the value by relative horizontal motion");
        row.PointerForTest(1, new Point(45, 10), true); check(vm.X == 436, "Shift numeric drag applies fine increments without jumping");
        row.PointerForTest(1, new Point(55, 10), false, true); check(vm.X == 536, "Ctrl numeric drag applies coarse increments without jumping");
        row.PointerForTest(2, new Point(55, 10)); check(!row.IsTextEditing, "Numeric drag release does not open text editing");
        vm.UndoCommand.Execute(null); check(vm.X == 410 && !vm.Engine.CanUndo, "Entire numeric scrub gesture is one undo step");
        row.PointerForTest(0, new Point(10, 10)); row.PointerForTest(1, new Point(40, 10)); row.PointerForTest(3, new Point(40, 10));
        check(vm.X == 410 && !vm.Engine.CanUndo, "Cancelling a numeric scrub restores the original value and history");
        check(!row.TextForTest("NaN") && vm.X == 410 && row.IsTextEditing, "Invalid numeric input stays editable and leaves the model unchanged");
        check(row.TextForTest("0,5") && vm.X == .5, "Numeric input accepts a decimal comma");
        vm.UndoCommand.Execute(null);
        var opacity = MainWindow.Descendants<ParameterRow>(window).First(r => r.Label == "Opacity");
        check(!opacity.TextForTest("2") && vm.Opacity == 1, "Bounded numeric input rejects out-of-range opacity");
        check(opacity.TextForTest("0.65") && Math.Abs(vm.Opacity - .65) < .001, "Bounded numeric input accepts a valid opacity");
        vm.UndoCommand.Execute(null); vm.Engine.Reset(); vm.Reload();
        check(ProximityInput.Distance(new Point(95, 20), new Rect(100, 0, 50, 40)) == 5, "UI proximity distance is measured to the visible control surface");
    }
}
