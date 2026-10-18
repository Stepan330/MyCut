using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Documents;
using System.Windows.Threading;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;
// Enlarges control intent zones without enlarging layout or intercepting normal direct clicks.
public sealed class ProximityInput : IDisposable
{
    public const double Margin = 8;
    public static readonly DependencyProperty IsNearProperty = DependencyProperty.RegisterAttached("IsNear", typeof(bool), typeof(ProximityInput), new PropertyMetadata(false));
    public static readonly DependencyProperty IsPressedProperty = DependencyProperty.RegisterAttached("IsPressed", typeof(bool), typeof(ProximityInput), new PropertyMetadata(false));
    public static readonly DependencyProperty OwnInputProperty=DependencyProperty.RegisterAttached("OwnInput",typeof(bool),typeof(ProximityInput),new PropertyMetadata(false));
    public static void SetOwnInput(DependencyObject d,bool value)=>d.SetValue(OwnInputProperty,value);
    private static bool OwnSurface(DependencyObject? node){for(;node is not null;node=node is Visual?VisualTreeHelper.GetParent(node):LogicalTreeHelper.GetParent(node))if((bool)node.GetValue(OwnInputProperty))return true;return false;}
    public static bool GetIsNear(DependencyObject d) => (bool)d.GetValue(IsNearProperty);
    public static void SetIsNear(DependencyObject d, bool v){d.SetValue(IsNearProperty,v);DependencyObject? child=d;for(DependencyObject? p=d;p is not null;child=p,p=p is Visual?VisualTreeHelper.GetParent(p):LogicalTreeHelper.GetParent(p))if(p is ElasticControlPanel panel){child?.SetValue(IsNearProperty,v);panel.RefreshMotion();break;}}
    public static bool GetIsPressed(DependencyObject d) => (bool)d.GetValue(IsPressedProperty);
    public static void SetIsPressed(DependencyObject d, bool v) => d.SetValue(IsPressedProperty, v);
    private sealed record Target(FrameworkElement Owner, FrameworkElement Surface, Rect Bounds);
    private readonly FrameworkElement root;
    private readonly PointerIntentTracker intent;
    private readonly DispatcherTimer refresh=new(){Interval=TimeSpan.FromMilliseconds(40)};
    private InputDebugAdorner? debug;
    private AdornerLayer? debugLayer;
    private Point lastPoint;
    private bool observing;
    private Target? near, pressed;
    private readonly Services.ZoneExpansionMemory zoneMemory=new();
    private double Expansion(FrameworkElement owner,Rect bounds,Point pointer,PointerIntent current)
    {
        var settings=InterfaceSettings.Current;
        double desired=AdaptiveZoneLaw.Expansion(current.ButtonSpeed,Distance(pointer,bounds),settings.MouseSpeedCoefficient,settings.ZoneInfluenceDistance,settings.SpeedThreshold,settings.MaximumExpansion);
        return zoneMemory.UpdateWithRate(owner,desired,settings.ZoneShrinkSpeed);
    }
    public ProximityInput(FrameworkElement host,PointerIntentTracker? sharedIntent=null)
    {
        root = host is Window window&&window.Content is AdornerDecorator decorator&&decorator.Child is FrameworkElement child?child:host;
        if(root is SpatialWorkspace space&&space.SurfaceContent is {} content)root=content;
        intent=sharedIntent??new();
        root.PreviewMouseMove += Move; root.PreviewMouseLeftButtonDown += Down;
        root.PreviewMouseLeftButtonUp += Up; root.MouseLeave += Leave; root.LostMouseCapture += LostCapture;
        root.Loaded+=Loaded;InterfaceSettings.Current.PropertyChanged+=SettingsChanged;
        refresh.Tick+=Tick;refresh.Start();if(root.IsLoaded)AttachDebug();
    }
    private void Loaded(object sender,RoutedEventArgs e)=>AttachDebug();
    private void AttachDebug()
    {
        if(debug is not null)return;debugLayer=AdornerLayer.GetAdornerLayer(root);
        if(debugLayer is not null){debug=new InputDebugAdorner(root){IsHitTestVisible=false};debugLayer.Add(debug);}
    }
    private void SettingsChanged(object? sender,System.ComponentModel.PropertyChangedEventArgs e) {if(!InterfaceSettings.Current.AdaptiveInput)zoneMemory.Clear();if(observing)Present(lastPoint,intent.Snapshot(InterfaceSettings.Current.MaximumExpansion));else debug?.InvalidateVisual();}
    private void Tick(object? sender,EventArgs e) {if(observing&&Mouse.Captured is null)Present(lastPoint,intent.Snapshot(InterfaceSettings.Current.MaximumExpansion));}
    private PointerIntent Observe(Point point)
    {
        var density=VisualTreeHelper.GetDpi(root);var screen=SpatialCoordinates.ToScreen(root,point);
        return intent.ObserveScreen(screen,density.DpiScaleX,InterfaceSettings.Current.MaximumExpansion);
    }
    private IReadOnlyList<InputZone> Zones()
    {
        var zones=new List<InputZone>();
        foreach(var owner in Controls(root))
        {
            if(!owner.IsEnabled||!owner.IsVisible||!owner.IsHitTestVisible)continue;
            var surface=owner is ParameterRow row?row.InputSurface:owner;
            var bounds=VisibleBounds(surface);
            if(bounds.IsEmpty||bounds.Width<1||bounds.Height<1)continue;
            zones.Add(new InputZone(owner,bounds,Expansion(owner,bounds,lastPoint,intent.Snapshot(InterfaceSettings.Current.MaximumExpansion))));
        }
        return zones;
    }
    private Rect VisibleBounds(FrameworkElement surface)
    {
        var bounds=MotionBehavior.LayoutBounds(surface,root);
        for(DependencyObject? node=VisualTreeHelper.GetParent(surface);node is not null&&node!=root;node=node is Visual?VisualTreeHelper.GetParent(node):null)
            if(node is FrameworkElement parent&&(parent.ClipToBounds||parent is ScrollContentPresenter))
                bounds.Intersect(parent.TransformToAncestor(root).TransformBounds(new Rect(parent.RenderSize)));
        return bounds;
    }
    public static double Distance(Point point, Rect bounds)
    {
        double dx = Math.Max(0, Math.Max(bounds.Left - point.X, point.X - bounds.Right));
        double dy = Math.Max(0, Math.Max(bounds.Top - point.Y, point.Y - bounds.Bottom));
        return Math.Sqrt(dx * dx + dy * dy);
    }
    private Target? Resolve(Point point, PointerIntent pointerIntent = default)
    {
        Target? best = null; double distance = double.PositiveInfinity, centerDistance = double.PositiveInfinity;
        foreach (var owner in Controls(root))
        {
            if (!owner.IsEnabled || !owner.IsVisible || !owner.IsHitTestVisible) continue;
            var surface = owner is ParameterRow row ? row.InputSurface : owner;
            var bounds = VisibleBounds(surface);
            if (bounds.IsEmpty || bounds.Width < 1 || bounds.Height < 1) continue;
            double score=InputDebugAdorner.Score(point,bounds,pointerIntent,out _,Expansion(owner,bounds,point,pointerIntent));
            if(double.IsPositiveInfinity(score))continue;
            var closest = new Point(Math.Clamp(point.X, bounds.Left + .01, bounds.Right - .01), Math.Clamp(point.Y, bounds.Top + .01, bounds.Bottom - .01));
            closest=MotionBehavior.PresentationPoint(surface,root,closest);
            if (root.InputHitTest(closest) is not DependencyObject visible || !DescendantOf(visible, surface)) continue;
            double center = (point - new Point(bounds.Left + bounds.Width / 2, bounds.Top + bounds.Height / 2)).Length;
            if (score < distance - .001 || Math.Abs(score - distance) <= .001 && center < centerDistance)
            {
                best = new Target(owner, surface, bounds); distance = score; centerDistance = center;
            }
        }
        return best;
    }
    private void Present(Point point,PointerIntent current)
    {
        lastPoint=point;var target=Resolve(point,current);Show(target);
        var settings=InterfaceSettings.Current;
        foreach(var zone in Zones())
        {
            var surface=zone.Owner is ParameterRow row?row.InputSurface:zone.Owner;
            var center=new Point(zone.Bounds.Left+zone.Bounds.Width/2,zone.Bounds.Top+zone.Bounds.Height/2);
            double distance=Distance(point,zone.Bounds),closeness=Math.Clamp(1-distance/90,0,1);
            var vector=point-center;Vector pull=default;
            bool chosen=target?.Owner==zone.Owner;
            if(chosen&&vector.Length>.01)pull=vector/vector.Length*Math.Min(12,vector.Length*.13)*settings.MagnetStrength*settings.MotionStrength;
            double growth=chosen?1+settings.HoverGrowth*settings.MotionStrength*(.45+.55*closeness):1-.025*settings.MotionStrength;
            if(surface is TextBox{IsKeyboardFocusWithin:true}){growth=1;pull=default;}
            var fitted=MotionBehavior.FitAttraction(surface,root,growth,pull);
            MotionBehavior.Attract(surface,fitted.Scale,fitted.Pull,chosen?1:.94);
        }
        debug?.Update(point,current,Zones(),target?.Owner);
    }
    private static bool DescendantOf(DependencyObject child, DependencyObject ancestor)
    {
        for (DependencyObject? node = child; node is not null; node = node is Visual ? VisualTreeHelper.GetParent(node) : LogicalTreeHelper.GetParent(node))
            if (ReferenceEquals(node, ancestor)) return true;
        return false;
    }
    private static IEnumerable<FrameworkElement> Controls(DependencyObject element)
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(element); i++)
        {
            var child = VisualTreeHelper.GetChild(element, i);
            if (child is Button or ListBoxItem or ParameterRow or ComboBox or CheckBox or TextBox) yield return (FrameworkElement)child;
            else foreach (var control in Controls(child)) yield return control;
        }
    }
    private void Show(Target? target)
    {
        if (near?.Owner == target?.Owner) return;
        if (near is not null) { SetIsNear(near.Surface, false);SetIsNear(near.Owner,false); if (near.Owner is ParameterRow old) old.NearChanged(false); }
        near = target;
        if (near is not null) { SetIsNear(near.Surface, true);SetIsNear(near.Owner,true); if (near.Owner is ParameterRow row) row.NearChanged(true); }
    }
    private void Move(object sender, MouseEventArgs e)
    {
        if(OwnSurface(e.OriginalSource as DependencyObject)){Clear();return;}
        if (Mouse.Captured is not null && pressed is null) { Show(null); return; }
        observing=true;var point=e.GetPosition(root);Present(point,Observe(point));
    }
    private void Down(object sender, MouseButtonEventArgs e)
    {
        if(OwnSurface(e.OriginalSource as DependencyObject)){Clear();return;}
        if (e.Handled || Mouse.Captured is not null) return;
        observing=true;var point=e.GetPosition(root);var current=Observe(point);var target=Resolve(point,current);Show(target);
        if(target is null)return;
        if(target.Bounds.Contains(point)&&e.OriginalSource is DependencyObject actual&&DescendantOf(actual,target.Surface))return;
        if (target.Owner is ParameterRow row) row.NearPointerDown(e);
        else { pressed = target;SetIsPressed(target.Surface, true); root.CaptureMouse(); }
        e.Handled = true;
    }
    private void Up(object sender, MouseButtonEventArgs e)
    {
        if (pressed is null) return;
        var target = pressed; pressed = null; SetIsPressed(target.Surface, false);
        var point=e.GetPosition(root); bool same = Resolve(point,intent.Snapshot(InterfaceSettings.Current.MaximumExpansion))?.Owner == target.Owner;
        root.ReleaseMouseCapture(); e.Handled = true;
        if (same) Activate(target.Owner);
    }
    private static void Activate(FrameworkElement target)
    {
        target.Focus();
        if (target is Button button && UIElementAutomationPeer.CreatePeerForElement(button)?.GetPattern(PatternInterface.Invoke) is IInvokeProvider provider) provider.Invoke();
        else if (target is ListBoxItem item) item.SetCurrentValue(ListBoxItem.IsSelectedProperty, true);
        else if(target is ComboBox combo)combo.SetCurrentValue(ComboBox.IsDropDownOpenProperty,true);
        else if(target is CheckBox check&&UIElementAutomationPeer.CreatePeerForElement(check)?.GetPattern(PatternInterface.Toggle) is IToggleProvider toggle)toggle.Toggle();
        else if(target is TextBox text)text.SelectAll();
    }
    public void Clear()
    {
        observing=false;Show(null);
        foreach(var owner in Controls(root))MotionBehavior.Attract(owner is ParameterRow row?row.InputSurface:owner,1,default);
        debug?.Update(lastPoint,default,[],null);
    }
    private void Leave(object sender, MouseEventArgs e) { if (pressed is null) Clear(); }
    private void LostCapture(object sender, MouseEventArgs e) { if (pressed is not null) { SetIsPressed(pressed.Surface, false); pressed = null; } Clear(); }
    internal FrameworkElement? TargetForTest(Point point) => Resolve(point)?.Owner;
    internal FrameworkElement? IntentTargetForTest(Point point, PointerIntent pointerIntent) => Resolve(point,pointerIntent)?.Owner;
    internal void ActivateForTest(Point point) { var target = Resolve(point); if (target is not null) Activate(target.Owner); }
    internal void PresentForTest(Point point,PointerIntent current=default)=>Present(point,current);
    public void Dispose()
    {
        Clear(); if (pressed is not null) { SetIsPressed(pressed.Surface, false); pressed = null; root.ReleaseMouseCapture(); }
        root.PreviewMouseMove -= Move; root.PreviewMouseLeftButtonDown -= Down; root.PreviewMouseLeftButtonUp -= Up;
        root.MouseLeave -= Leave; root.LostMouseCapture -= LostCapture;
        root.Loaded-=Loaded;refresh.Stop();refresh.Tick-=Tick;InterfaceSettings.Current.PropertyChanged-=SettingsChanged;
        if(debug is not null)debugLayer?.Remove(debug);
    }
}
