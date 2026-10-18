using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using MyCut.Editor.Motion;

namespace MyCut.Editor.Controls;

// Click-open menu in its own HWND, so it can overlap the native viewport.
public sealed class ProjectMenuController : IDisposable
{
    private readonly Window owner;
    private readonly Button icon;
    private readonly SpatialFlyout popup;
    private readonly FrameworkElement shell;
    private readonly MotionEngine motion;
    private readonly TranslateTransform slide = new();
    private double progress;
    public bool IsOpen => popup.IsOpen;
    public ProjectMenuController(Window owner, Button icon, SpatialFlyout popup, FrameworkElement shell, MotionEngine motion)
    {
        this.owner = owner; this.icon = icon; this.popup = popup; this.shell = shell; this.motion = motion;
        shell.RenderTransform = slide;
        icon.Click += Toggle;
        icon.PreviewKeyDown += IconKeyDown;
        shell.AddHandler(Button.ClickEvent, new RoutedEventHandler(CommandClick));
        shell.PreviewKeyDown += KeyDown;
        owner.PreviewMouseDown += OutsideClick;
        owner.Deactivated += Deactivated;
        owner.LocationChanged += Moved;
        owner.SizeChanged += Resized;
    }
    public void Open()
    {
        SpatialCoordinates.AnchorPopup(popup,icon,new Point(0,icon.ActualHeight+6));
        popup.IsOpen = true;
        motion.Animate(this, "reveal", progress, 1, .14, Apply);
        icon.ToolTip = "Close project menu";
    }
    public void Close(bool immediate = false)
    {
        if (!IsOpen) return;
        icon.ToolTip = "Project menu · New, Open, Save, Import, Export";
        if (immediate) { motion.Cancel(this); Apply(0); popup.IsOpen = false; return; }
        motion.Animate(this, "reveal", progress, 0, .10, Apply, () => popup.IsOpen = false);
    }
    private void Apply(double value) { progress = value; shell.Opacity = value; slide.Y = -6 * (1 - value); }
    private void Toggle(object sender, RoutedEventArgs e) { if (IsOpen) Close(true); else Open(); }
    private void IconKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Down) { Open(); shell.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); e.Handled = true; }
    }
    private void CommandClick(object sender, RoutedEventArgs e) { Close(true); }
    private void OutsideClick(object sender, MouseButtonEventArgs e) { if (!icon.IsMouseOver && !shell.IsMouseOver) Close(true); }
    private void KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape) { Close(true); icon.Focus(); e.Handled = true; }
    }
    private void Deactivated(object? sender, EventArgs e) => Close(true);
    private void Moved(object? sender, EventArgs e) => Close(true);
    private void Resized(object sender, SizeChangedEventArgs e) => Close(true);
    public void Dispose()
    {
        Close(true); motion.Cancel(this);
        icon.Click -= Toggle; icon.PreviewKeyDown -= IconKeyDown; shell.RemoveHandler(Button.ClickEvent, new RoutedEventHandler(CommandClick));
        shell.PreviewKeyDown -= KeyDown; owner.PreviewMouseDown -= OutsideClick;
        owner.Deactivated -= Deactivated; owner.LocationChanged -= Moved; owner.SizeChanged -= Resized;
    }
}
