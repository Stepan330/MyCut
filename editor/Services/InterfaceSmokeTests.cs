using System.IO;
using System.Windows;
using System.Windows.Media;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;

internal static class InterfaceSmokeTests
{
    internal static void Run(MainWindow owner,EditorViewModel vm,ViewportHost viewport,MotionEngine motion,string folder,Action<bool,string> check)
    {
        var settings=InterfaceSettings.Current;
        double now=0;var tracker=new PointerIntentTracker(()=>now);
        tracker.Observe(new Point(0,0),44);now=.001;tracker.Observe(new Point(5,0),44);now=.008;var fast=tracker.Observe(new Point(40,0),44);
        check(fast.Speed>settings.SpeedThreshold&&fast.Expansion>20&&fast.Direction.X>.99,"High-frequency pointer samples accumulate into a forward intent field");
        now=.20;check(tracker.Snapshot(44).Expansion>0,"Fast intent remains clickable briefly after the pointer stops");
        check(tracker.Snapshot(44).ButtonSpeed==0,"Stopped pointer uses per-button zone inertia rather than retained forecast velocity");
        now=.21;var reverse=tracker.Observe(new Point(0,0),44);check(reverse.Direction.X<-.99,"Direction reversal cancels the previous forward lobe immediately");
        now=2;check(tracker.Snapshot(44).Expansion==0,"Intent field expires after its configurable lifetime");
        check(fast.PredictedOffset(1).X>0&&fast.PredictedOffset(1).X<fast.Speed,"One-second forecast includes deceleration rather than unlimited linear travel");
        string preset=Path.Combine(folder,"interface-preset.json");settings.HandleRadius=35;settings.ControlMargin=13;settings.DebugPrediction=true;settings.Export(preset);settings.Reset();settings.Import(preset);
        check(settings.HandleRadius==35&&settings.ControlMargin==13&&settings.DebugPrediction,"Interface preset roundtrip preserves radii and debug options");
        settings.BeginGesture();settings.HandleRadius=42;settings.CancelGesture();check(settings.HandleRadius==35,"Escape restores an interface numeric gesture without editing the project");
        settings.HandleRadius=double.NaN;check(double.IsFinite(settings.HandleRadius),"Non-finite interface settings cannot reach native hit testing");
        settings.Reset();viewport.RenderNow();
        var copy=vm.Engine.Duplicate(2);vm.Reload();vm.Select(0);
        viewport.DispatchForTest(0x0201,410,340);viewport.DispatchForTest(0x0202,410,340);
        check(vm.Selected?.Id==copy,"First overlapping body click selects the topmost layer");
        viewport.DispatchForTest(0x0201,410,340);viewport.DispatchForTest(0x0202,410,340);
        check(vm.Selected?.Id==2,"Repeated body click cycles to the layer below");
        vm.Engine.Reset();vm.Reload();
        var window=new InterfaceSettingsWindow(motion,tracker){Owner=owner,Width=430,Height=530};window.Show();window.UpdateLayout();
        check(window.Body.ScrollableHeight>0&&window.Head.ActualHeight>=42&&window.Footer.ActualHeight>0,"Layered panel keeps its head/footer visible and scrolls content in a small window");
        window.Body.ScrollToEnd();window.UpdateLayout();check(window.Body.VerticalOffset>0,"Layered panel can reach controls below its visible area");
        var row=MainWindow.Descendants<ParameterRow>(window).First(r=>r.Label=="Base zone radius / DIP");
        window.Body.ScrollToHome();window.UpdateLayout();row.TextForTest("32");check(settings.HandleRadius==32,"Live settings numeric field updates the shared interaction radius");
        using(var zones=new ProximityInput((FrameworkElement)window.Content,tracker))
        {
            zones.PresentForTest(new Point(30,50));zones.PresentForTest(new Point(400,250));window.Body.ScrollToEnd();window.UpdateLayout();zones.PresentForTest(new Point(20,400));
            check(true,"Settings proximity presentation remains safe at clip boundaries and after scrolling (tiny reversed clamp regression)");
        }
        var strength=MainWindow.Descendants<ParameterRow>(window).First(r=>r.Label=="Animation strength · 0–2");strength.TextForTest("1.7");check(settings.MotionStrength==1.7,"Debug animation-strength field updates the shared engine setting");
        MainWindow.Descendants<ParameterRow>(window).First(r=>r.Label=="Mouse speed coefficient").TextForTest("0.09");MainWindow.Descendants<ParameterRow>(window).First(r=>r.Label=="Distance influence / DIP").TextForTest("200");MainWindow.Descendants<ParameterRow>(window).First(r=>r.Label=="Zone shrink / DIP/s").TextForTest("40");
        check(settings.MouseSpeedCoefficient==.09&&settings.ZoneInfluenceDistance==200&&settings.ZoneShrinkSpeed==40,"Live settings fields control the button zone law and release rate");
        window.Close();settings.Reset();
        string zonePreset=Path.Combine(folder,"adaptive-zone-preset.json");settings.MouseSpeedCoefficient=.08;settings.ZoneInfluenceDistance=220;settings.ZoneShrinkSpeed=44;settings.Export(zonePreset);settings.Reset();settings.Import(zonePreset);
        check(settings.MouseSpeedCoefficient==.08&&settings.ZoneInfluenceDistance==220&&settings.ZoneShrinkSpeed==44,"Adaptive zone coefficient, proximity distance and shrink rate survive preset roundtrip");settings.Reset();
        viewport.RenderNow();
    }
}
