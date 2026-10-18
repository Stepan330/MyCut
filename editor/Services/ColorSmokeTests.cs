using System.IO;
using System.Windows;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;

internal static class ColorSmokeTests
{
    internal static void Run(MainWindow owner,EditorViewModel vm,ViewportHost viewport,MotionEngine motion,string folder,Action<bool,string> check)
    {
        vm.Engine.Reset();vm.Reload();viewport.RenderNow();var baseline=vm.Engine.ScopeFrame();
        vm.Exposure=1;var exposed=vm.Engine.ScopeFrame();check(!baseline.Pixels.SequenceEqual(exposed.Pixels),"Primary color correction changes the clean native image used by scopes");
        check(vm.Engine.Items()[1].Grade.Exposure==0,"Per-layer color correction does not leak to linked instances");
        vm.UndoCommand.Execute(null);check(vm.Exposure==0&&baseline.Pixels.SequenceEqual(vm.Engine.ScopeFrame().Pixels),"Undo restores identity correction and its exact scope pixels");
        var window=new ColorWindow(vm,motion,new PointerIntentTracker()){Owner=owner};window.Show();window.UpdateLayout();window.LiftWheel.BalanceForTest(new Point(90,76));
        check(vm.LiftRed!=vm.LiftBlue&&vm.Engine.Items()[0].Grade.LiftR!=0,"Dragging a bound color wheel balances real per-channel correction");
        vm.UndoCommand.Execute(null);check(vm.LiftRed==0&&vm.LiftGreen==0&&vm.LiftBlue==0,"A complete RGB color-wheel gesture is a single Undo step");
        vm.BeginGesture();vm.Exposure=.5;vm.Contrast=1.2;vm.Saturation=.7;vm.Temperature=.25;vm.GammaGreen=1.1;vm.EndGesture();
        string path=Path.Combine(folder,"color-grade.mycut");vm.Engine.Save(path);vm.Engine.Reset();vm.Engine.Load(path);vm.Reload();
        check(Math.Abs(vm.Exposure-.5)<.001&&Math.Abs(vm.Contrast-1.2)<.001&&Math.Abs(vm.GammaGreen-1.1)<.001,"Saved project preserves primary correction and individual color-wheel channels");
        viewport.RenderNow();string before=Path.Combine(folder,"before-scopes.png"),after=Path.Combine(folder,"after-scopes.png");vm.Engine.Capture(before);window.RefreshScopes();vm.Engine.ScopeFrame();vm.Engine.Capture(after);
        check(File.ReadAllBytes(before).SequenceEqual(File.ReadAllBytes(after)),"Clean scope evaluation leaves the editor frame and its handles intact");
        window.Close();vm.Engine.Reset();vm.Reload();viewport.RenderNow();
    }
}
