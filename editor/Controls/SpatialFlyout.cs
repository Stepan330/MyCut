using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Markup;

namespace MyCut.Editor.Controls;
// A live 3D layer, not a Popup HWND. One host is shared by menus and pickers.
[ContentProperty(nameof(Child))]
public sealed class SpatialFlyout:FrameworkElement
{
    public static readonly DependencyProperty IsOpenProperty=DependencyProperty.Register(nameof(IsOpen),typeof(bool),typeof(SpatialFlyout),new FrameworkPropertyMetadata(false,FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,(d,e)=>((SpatialFlyout)d).OpenChanged((bool)e.NewValue)));
    public bool IsOpen{get=>(bool)GetValue(IsOpenProperty);set=>SetValue(IsOpenProperty,value);}
    public FrameworkElement? Child{get;set;}
    public FrameworkElement? PlacementTarget{get;set;}
    public PlacementMode Placement{get;set;}=PlacementMode.Bottom;
    public double HorizontalOffset{get;set;}
    public double VerticalOffset{get;set;}
    public bool StaysOpen{get;set;}=true;
    public bool AllowsTransparency{get;set;}
    public PopupAnimation PopupAnimation{get;set;}
    public event EventHandler? Opened,Closed;
    private SpatialWorkspace? space;
    private SpatialWorkspace.Layer? layer;
    private Window? window;
    private IInputElement? priorFocus;
    private void OpenChanged(bool open)
    {
        if(open){
            if(Child is null||PlacementTarget is null||SpatialWorkspace.GetOwner(PlacementTarget) is not {} workspace){SetCurrentValue(IsOpenProperty,false);return;}
            space=workspace;window=Window.GetWindow(workspace);priorFocus=Keyboard.FocusedElement;
            Child.DataContext=PlacementTarget.DataContext;Child.SetValue(SpatialWorkspace.OwnerProperty,space);
            var offset=new Point(HorizontalOffset,VerticalOffset);if(Placement==PlacementMode.Bottom)offset.Y+=PlacementTarget.ActualHeight;else if(Placement==PlacementMode.Right)offset.X+=PlacementTarget.ActualWidth;
            layer=space.ShowLayer(Child,PlacementTarget,offset);
            if(Mouse.Captured==PlacementTarget)Mouse.Capture(null);
            if(window is not null){window.PreviewMouseDown+=Outside;window.PreviewKeyDown+=Key;window.Deactivated+=Deactivate;}
            Opened?.Invoke(this,EventArgs.Empty);
        }else{
            if(window is not null){window.PreviewMouseDown-=Outside;window.PreviewKeyDown-=Key;window.Deactivated-=Deactivate;}
            bool restore=Child?.IsKeyboardFocusWithin==true;
            if(layer is not null)space?.HideLayer(layer);layer=null;space=null;window=null;
            if(restore&&priorFocus is not null)Keyboard.Focus(priorFocus);Closed?.Invoke(this,EventArgs.Empty);
        }
    }
    private void Outside(object sender,MouseButtonEventArgs e){if(!StaysOpen&&Child?.IsMouseOver!=true&&PlacementTarget?.IsMouseOver!=true)SetCurrentValue(IsOpenProperty,false);}
    private void Key(object sender,KeyEventArgs e){if(e.Key==System.Windows.Input.Key.Escape){SetCurrentValue(IsOpenProperty,false);e.Handled=true;}}
    private void Deactivate(object? sender,EventArgs e)=>SetCurrentValue(IsOpenProperty,false);
}
