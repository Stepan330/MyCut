using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;
public partial class ParameterRow : UserControl
{
    public static readonly DependencyProperty LabelProperty = DependencyProperty.Register(nameof(Label), typeof(string), typeof(ParameterRow), new PropertyMetadata(""));
    public static readonly DependencyProperty ShortLabelProperty = DependencyProperty.Register(nameof(ShortLabel), typeof(string), typeof(ParameterRow), new PropertyMetadata(null));
    public static readonly DependencyProperty LabelWidthProperty = DependencyProperty.Register(nameof(LabelWidth), typeof(GridLength), typeof(ParameterRow), new PropertyMetadata(new GridLength(1, GridUnitType.Star)));
    public string? ShortLabel { get => (string?)GetValue(ShortLabelProperty); set => SetValue(ShortLabelProperty, value); }
    public GridLength LabelWidth { get => (GridLength)GetValue(LabelWidthProperty); set => SetValue(LabelWidthProperty, value); }
    public static readonly DependencyProperty ValueProperty = DependencyProperty.Register(nameof(Value), typeof(double), typeof(ParameterRow), new FrameworkPropertyMetadata(0d, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, ValueChanged));
    public static readonly DependencyProperty MinimumProperty = DependencyProperty.Register(nameof(Minimum), typeof(double), typeof(ParameterRow), new PropertyMetadata(0d, ValueChanged));
    public static readonly DependencyProperty MaximumProperty = DependencyProperty.Register(nameof(Maximum), typeof(double), typeof(ParameterRow), new PropertyMetadata(1d, ValueChanged));
    public static readonly DependencyProperty StepProperty = DependencyProperty.Register(nameof(Step), typeof(double), typeof(ParameterRow), new PropertyMetadata(.01d));
    public static readonly DependencyProperty ClampToRangeProperty = DependencyProperty.Register(nameof(ClampToRange), typeof(bool), typeof(ParameterRow), new PropertyMetadata(true));
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    public double Value { get => (double)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public double Minimum { get => (double)GetValue(MinimumProperty); set => SetValue(MinimumProperty, value); }
    public double Maximum { get => (double)GetValue(MaximumProperty); set => SetValue(MaximumProperty, value); }
    public double Step { get => (double)GetValue(StepProperty); set => SetValue(StepProperty, value); }
    public bool ClampToRange { get => (bool)GetValue(ClampToRangeProperty); set => SetValue(ClampToRangeProperty, value); }
    private enum InputMode { Idle, Pending, Scrub, Text }
    private InputMode mode;
    private NumericDrag? drag;
    private Services.IEditGesture? transaction;
    private bool ending;
    private bool near;
    private string originalText = "";
    internal FrameworkElement InputSurface => ValueSurface;
    internal void NearChanged(bool value)
    {
        near=value;SetChrome();
        if(MyCut.Editor.Motion.MotionBehavior.GetEngine(this) is {} engine)
        {
            engine.Spring(this,"valueEmphasis",ValueDisplay.FontSize,value?12.5:12,.24,v=>ValueDisplay.FontSize=Math.Max(10,v));
            engine.Spring(this,"hintEmphasis",DragHint.FontSize,value?12:11,.24,v=>DragHint.FontSize=Math.Max(10,v));
        }
    }
    internal void NearPointerDown(MouseButtonEventArgs e) => OnPointerDown(ValueSurface, e);
    internal bool IsTextEditing => mode == InputMode.Text;
    public ParameterRow()
    {
        InitializeComponent(); Focusable = true; PreviewKeyDown += OnFieldKeyDown;
        Unloaded += (_, _) => { if (mode is InputMode.Scrub or InputMode.Pending) CancelPointer(); };
        RefreshPresentation();
    }
    private static void ValueChanged(DependencyObject owner, DependencyPropertyChangedEventArgs e) => ((ParameterRow)owner).RefreshPresentation();
    private void RefreshPresentation()
    {
        if (ValueDisplay is null) return;
        ValueDisplay.Text = Value.ToString("0.###", CultureInfo.CurrentCulture);
        FillScale.ScaleX = Maximum > Minimum ? Math.Clamp((Value - Minimum) / (Maximum - Minimum), 0, 1) : 0;
    }
    private void OnHover(object sender, MouseEventArgs e) => SetChrome();
    private void SetChrome(bool error = false)
    {
        ValueSurface.BorderBrush = error ? new SolidColorBrush(Color.FromRgb(235, 146, 125)) :
            (Brush)FindResource(mode != InputMode.Idle || ValueSurface.IsMouseOver || near ? "AccentBrush" : "BorderBrush");
    }
    private void OnPointerDown(object sender, MouseButtonEventArgs e)
    {
        if (mode == InputMode.Text) return; // The real TextBox owns caret and text selection.
        StartPointer(e.GetPosition(ValueSurface)); ValueSurface.CaptureMouse(); e.Handled = true;
    }
    private void StartPointer(Point position)
    {
        Focus(); mode = InputMode.Pending;
        drag = new NumericDrag(Value, position, Step, Minimum, Maximum, ClampToRange); SetChrome();
    }
    private void OnPointerMove(object sender, MouseEventArgs e)
    {
        if (mode is not InputMode.Pending and not InputMode.Scrub) return;
        MovePointer(e.GetPosition(ValueSurface), Keyboard.Modifiers.HasFlag(ModifierKeys.Shift), Keyboard.Modifiers.HasFlag(ModifierKeys.Control));
        e.Handled = true;
    }
    private void MovePointer(Point position, bool fine, bool coarse)
    {
        if (drag is null || !drag.Move(position, fine, coarse)) return;
        if (mode == InputMode.Pending)
        {
            transaction = DataContext as Services.IEditGesture; transaction?.BeginGesture(); mode = InputMode.Scrub;
        }
        SetCurrentValue(ValueProperty, drag.Value);
    }
    private void OnPointerUp(object sender, MouseButtonEventArgs e)
    {
        if (mode is not InputMode.Pending and not InputMode.Scrub) return;
        EndPointer(); e.Handled = true;
    }
    private void EndPointer()
    {
        bool click = mode == InputMode.Pending;
        mode = InputMode.Idle; drag = null;
        ValueSurface.ReleaseMouseCapture(); transaction?.EndGesture(); transaction = null;
        if (click) BeginText(); else SetChrome();
    }
    private void CancelPointer()
    {
        mode = InputMode.Idle; drag = null; ValueSurface.ReleaseMouseCapture();
        transaction?.CancelGesture(); transaction = null; SetChrome();
    }
    private void OnLostCapture(object sender, MouseEventArgs e)
    {
        // Capture may be lost when the window deactivates; preserve the last actual value as one edit.
        if (mode is InputMode.Pending or InputMode.Scrub)
        {
            mode = InputMode.Idle; drag = null; transaction?.EndGesture(); transaction = null; SetChrome();
        }
    }
    private void BeginText()
    {
        mode = InputMode.Text; ValueDisplay.Visibility = DragHint.Visibility = Visibility.Collapsed;
        originalText = Value.ToString("G9", CultureInfo.CurrentCulture); ValueEditor.Text = originalText; ValueEditor.Visibility = Visibility.Visible;
        ValueEditor.Focus(); ValueEditor.SelectAll(); SetChrome();
    }
    private bool CommitText(bool losingFocus = false)
    {
        if (mode != InputMode.Text) return true;
        if (ValueEditor.Text == originalText) { EndText(); return true; }
        if (!NumericDrag.TryNumber(ValueEditor.Text, out double value) || ClampToRange && (value < Minimum || value > Maximum))
        {
            if (losingFocus) EndText(); else SetChrome(true);
            return false;
        }
        var vm = DataContext as Services.IEditGesture;
        vm?.BeginGesture(); SetCurrentValue(ValueProperty, value); vm?.EndGesture();
        EndText(); return true;
    }
    private void EndText()
    {
        mode = InputMode.Idle; ending = true;
        ValueEditor.Visibility = Visibility.Collapsed; ValueDisplay.Visibility = DragHint.Visibility = Visibility.Visible;
        ending = false; RefreshPresentation(); SetChrome();
    }
    private void OnEditorLostFocus(object sender, KeyboardFocusChangedEventArgs e) { if (!ending) CommitText(true); }
    private void OnEditorKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) { if (CommitText()) Focus(); e.Handled = true; }
        else if (e.Key == Key.Escape) { EndText(); Focus(); e.Handled = true; }
    }
    private void OnFieldKeyDown(object sender, KeyEventArgs e)
    {
        if (mode == InputMode.Text)
        {
            if (Keyboard.Modifiers == ModifierKeys.Control && e.Key is Key.Z or Key.Y)
            {
                if (e.Key == Key.Z) ValueEditor.Undo(); else ValueEditor.Redo(); e.Handled = true;
            }
            else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key is Key.S or Key.D or Key.O or Key.I)
                e.Handled = !CommitText();
            return;
        }
        if (e.Key == Key.Escape && mode is InputMode.Pending or InputMode.Scrub) { CancelPointer(); e.Handled = true; return; }
        if (mode is InputMode.Pending or InputMode.Scrub) { e.Handled = true; return; }
        if (e.Key is Key.Enter or Key.F2) { BeginText(); e.Handled = true; }
        else if (e.Key is Key.Left or Key.Right)
        {
            double value = Value + (e.Key == Key.Right ? Step : -Step);
            if (ClampToRange) value = Math.Clamp(value, Minimum, Maximum);
            SetCurrentValue(ValueProperty, value); e.Handled = true;
        }
    }
    // Exercise the same pointer state machine on the bound live WPF control.
    internal void PointerForTest(int phase, Point position, bool fine = false, bool coarse = false)
    {
        if (phase == 0) StartPointer(position);
        else if (phase == 1) MovePointer(position, fine, coarse);
        else if (phase == 2) EndPointer();
        else if (phase == 3) CancelPointer();
    }
    internal bool TextForTest(string text) { if (mode != InputMode.Text) BeginText(); ValueEditor.Text = text; return CommitText(); }
}
