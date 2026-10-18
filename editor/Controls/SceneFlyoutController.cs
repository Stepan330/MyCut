using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MyCut.Editor.Motion;

namespace MyCut.Editor.Controls;
// Hover bridge, pin state and reversible presentation animation. No scene/document ownership.
public sealed class SceneFlyoutController : IDisposable
{
    private readonly Window owner;
    private readonly Button icon, pin;
    private readonly SpatialFlyout popup;
    private readonly FrameworkElement shell;
    private readonly MotionEngine motion;
    private readonly TranslateTransform slide = new();
    private readonly DispatcherTimer enter = new() { Interval = TimeSpan.FromMilliseconds(90) };
    private readonly DispatcherTimer leave = new() { Interval = TimeSpan.FromMilliseconds(240) };
    private double progress;
    private bool pinned;
    public bool IsPinned => pinned;
    public bool IsOpen => popup.IsOpen;
    public double Progress => progress;
    public SceneFlyoutController(Window window, Button trigger, Button pinButton, SpatialFlyout flyout, FrameworkElement content, MotionEngine animations)
    {
        owner = window; icon = trigger; pin = pinButton; popup = flyout; shell = content; motion = animations;
        shell.RenderTransform = slide; shell.Opacity = 0;
        icon.MouseEnter += Enter; icon.MouseLeave += Leave; shell.MouseEnter += Enter; shell.MouseLeave += Leave;
        icon.Click += TogglePin; pin.Click += TogglePin;
        enter.Tick += OpenAfterDelay; leave.Tick += CloseAfterDelay;
        owner.Deactivated += Deactivate; owner.LocationChanged += Reposition;
        owner.Activated += Activate;
        owner.SizeChanged += SizeChanged;
    }
    private void Enter(object sender, MouseEventArgs e) { leave.Stop(); enter.Stop(); enter.Start(); }
    private void Leave(object sender, MouseEventArgs e) { enter.Stop(); if (!pinned) { leave.Stop(); leave.Start(); } }
    private void OpenAfterDelay(object? sender, EventArgs e) { enter.Stop(); Open(); }
    private void CloseAfterDelay(object? sender, EventArgs e)
    {
        leave.Stop(); if (!pinned && !icon.IsMouseOver && !shell.IsMouseOver) Close();
    }
    public void Open()
    {
        leave.Stop();SpatialCoordinates.AnchorPopup(popup,icon,new Point(icon.ActualWidth+5,0));popup.IsOpen = true;
        motion.Animate(this, "reveal", progress, 1, .18, Apply);
    }
    public void Close(bool immediate = false)
    {
        enter.Stop(); leave.Stop();
        if (!popup.IsOpen) return;
        if (immediate) { motion.Cancel(this); Apply(0); popup.IsOpen = false; return; }
        motion.Animate(this, "reveal", progress, 0, .15, Apply, () => popup.IsOpen = false);
    }
    public void SetPinned(bool value)
    {
        pinned = value; pin.Content = value ? "Unpin" : "Pin";
        icon.ToolTip = value ? "Scene items · click to unpin" : "Scene items · hover to peek, click to pin";
        if (value) Open(); else if (!shell.IsMouseOver) Close();
    }
    private void TogglePin(object sender, RoutedEventArgs e) => SetPinned(!pinned);
    private void Apply(double value) { progress = value; shell.Opacity = value; slide.X = -14 * (1 - value); }
    private void Deactivate(object? sender, EventArgs e) => Close(true);
    private void Activate(object? sender, EventArgs e) { if (pinned) Open(); }
    private void Reposition(object? sender, EventArgs e)
    {
        if (popup.IsOpen) { popup.HorizontalOffset += .01; popup.HorizontalOffset -= .01; }
    }
    private void SizeChanged(object sender, SizeChangedEventArgs e) => Reposition(sender, e);
    public void Dispose()
    {
        Close(true); motion.Cancel(this);
        icon.MouseEnter -= Enter; icon.MouseLeave -= Leave; shell.MouseEnter -= Enter; shell.MouseLeave -= Leave;
        icon.Click -= TogglePin; pin.Click -= TogglePin; enter.Tick -= OpenAfterDelay; leave.Tick -= CloseAfterDelay;
        owner.Deactivated -= Deactivate; owner.LocationChanged -= Reposition; owner.SizeChanged -= SizeChanged;
        owner.Activated -= Activate;
    }
}
