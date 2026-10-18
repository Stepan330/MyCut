using System.Windows;
using System.Windows.Media;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;

namespace MyCut.Editor.Controls;
public static class SpatialCoordinates
{
    static SpatialCoordinates()
    {
        EventManager.RegisterClassHandler(typeof(ComboBox),FrameworkElement.LoadedEvent,new RoutedEventHandler((s,_)=>{
            var box=(ComboBox)s;if(SpatialWorkspace.GetOwner(box) is null)return;UpdateCombo(box);box.DropDownOpened-=ComboOpened;box.DropDownOpened+=ComboOpened;
        }));
        EventManager.RegisterClassHandler(typeof(ComboBox),UIElement.PreviewMouseDownEvent,new MouseButtonEventHandler((s,_)=>UpdateCombo((ComboBox)s)),true);
        EventManager.RegisterClassHandler(typeof(ComboBox),UIElement.PreviewKeyDownEvent,new KeyEventHandler((s,_)=>UpdateCombo((ComboBox)s)),true);
    }
    public static void Initialize(){}
    // Popup children inherit attached properties through their logical parent, but
    // live in a different visual tree/HWND. Inheritance alone is not a 3D transform.
    internal static SpatialWorkspace? SurfaceFor(DependencyObject element){var space=SpatialWorkspace.GetOwner(element);return space?.OwnsElement(element)==true?space:null;}
    public static DpiScale Dpi(Visual element)=>VisualTreeHelper.GetDpi(SurfaceFor(element) is {} space?space:element);
    private static void ComboOpened(object? sender,EventArgs e){if(sender is ComboBox box)UpdateCombo(box);}
    private static void UpdateCombo(ComboBox box){if(SpatialWorkspace.GetOwner(box) is null)return;box.ApplyTemplate();if(box.Template.FindName("PART_Popup",box) is Popup popup)AnchorPopup(popup,box,new Point(0,box.ActualHeight));}
    public static (FrameworkElement Target,Point Point) Anchor(FrameworkElement anchor,Point point)
    {
        var space=SurfaceFor(anchor);return space is null?(anchor,point):(space,Translate(anchor,point,space));
    }
    public static void AnchorPopup(Popup popup,FrameworkElement anchor,Point point){var position=Anchor(anchor,point);popup.PlacementTarget=position.Target;popup.Placement=PlacementMode.RelativePoint;popup.HorizontalOffset=position.Point.X;popup.VerticalOffset=position.Point.Y;}
    public static void AnchorPopup(SpatialFlyout popup,FrameworkElement anchor,Point point){popup.PlacementTarget=anchor;popup.Placement=PlacementMode.RelativePoint;popup.HorizontalOffset=point.X;popup.VerticalOffset=point.Y;}
    public static Point ToScreen(FrameworkElement element,Point point)
    {
        var space=SurfaceFor(element);
        if(space is null)return element.PointToScreen(point);
        return space.PointToScreen(space.ProjectElement(element,point));
    }
    public static Point Translate(FrameworkElement element,Point point,FrameworkElement target)
    {
        var space=SurfaceFor(element);var targetSpace=SurfaceFor(target);
        var screen=ToScreen(element,point);
        if(targetSpace is not null)return targetSpace.UnprojectElement(target,targetSpace.PointFromScreen(screen));
        return target.PointFromScreen(screen);
    }
    public static Window? WindowFor(FrameworkElement element)=>Window.GetWindow(SpatialWorkspace.GetOwner(element)??element);
}
