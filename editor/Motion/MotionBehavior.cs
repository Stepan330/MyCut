using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Controls;

namespace MyCut.Editor.Motion;
public static class MotionBehavior
{
    public static readonly DependencyProperty EngineProperty = DependencyProperty.RegisterAttached("Engine", typeof(MotionEngine), typeof(MotionBehavior), new FrameworkPropertyMetadata(null, FrameworkPropertyMetadataOptions.Inherits));
    public static void SetEngine(DependencyObject element, MotionEngine engine) => element.SetValue(EngineProperty, engine);
    public static MotionEngine? GetEngine(DependencyObject element) => (MotionEngine?)element.GetValue(EngineProperty);
    public static readonly DependencyProperty EnabledProperty = DependencyProperty.RegisterAttached("Enabled", typeof(bool), typeof(MotionBehavior), new PropertyMetadata(false, Changed));
    public static void SetEnabled(DependencyObject element, bool value) => element.SetValue(EnabledProperty, value);
    public static bool GetEnabled(DependencyObject element) => (bool)element.GetValue(EnabledProperty);
    public static void Attract(FrameworkElement control,double scale,Vector pull,double opacity=1)
    {
        if(control.GetValue(StateProperty) is State state)state.Attract(scale,pull,opacity);
    }
    public static Rect LayoutBounds(FrameworkElement control,Visual root)
    {
        var actual=control.TransformToAncestor(root).TransformBounds(new Rect(control.RenderSize));
        if(control.GetValue(StateProperty) is not State state)return actual;
        double width=actual.Width/state.Scale,height=actual.Height/state.Scale;
        return new Rect(actual.Left+actual.Width/2-state.Pull.X-width/2,actual.Top+actual.Height/2-state.Pull.Y-height/2,width,height);
    }
    public static Point PresentationPoint(FrameworkElement control,Visual root,Point layoutPoint)
    {
        if(control.GetValue(StateProperty) is not State state)return layoutPoint;
        var bounds=LayoutBounds(control,root);var center=new Point(bounds.Left+bounds.Width/2,bounds.Top+bounds.Height/2);
        return center+(layoutPoint-center)*state.Scale+state.Pull;
    }
    public static (double Scale,Vector Pull) FitAttraction(FrameworkElement control,FrameworkElement root,double requested,Vector offset)
    {
        var bounds=LayoutBounds(control,root);if(bounds.Width<1||bounds.Height<1)return(1,default);
        var clip=new Rect(root.RenderSize);
        for(DependencyObject? node=VisualTreeHelper.GetParent(control);node is not null&&node!=root;node=node is Visual?VisualTreeHelper.GetParent(node):null)
            if(node is FrameworkElement parent&&(parent.ClipToBounds||parent is ScrollContentPresenter))clip.Intersect(parent.TransformToAncestor(root).TransformBounds(new Rect(parent.RenderSize)));
        return AttractionGeometry.Fit(bounds,clip,requested,offset);
    }
    private static readonly DependencyProperty StateProperty = DependencyProperty.RegisterAttached("State", typeof(State), typeof(MotionBehavior));
    private static void Changed(DependencyObject element, DependencyPropertyChangedEventArgs e)
    {
        if (element is not FrameworkElement control) return;
        if (control.GetValue(StateProperty) is State previous) previous.Dispose();
        control.ClearValue(StateProperty);
        if ((bool)e.NewValue) control.SetValue(StateProperty, new State(control));
    }
    private sealed class State : IDisposable
    {
        private readonly FrameworkElement control;
        private readonly ScaleTransform scale = new(1, 1);
        private readonly TranslateTransform pull=new();
        private double desiredScale=1,desiredOpacity=1;
        private Vector desiredPull;
        public double Scale=>scale.ScaleX;
        public Vector Pull=>new(pull.X,pull.Y);
        private bool pressed;
        private bool hasAttraction;
        private bool InElasticLayout()
        {
            for(DependencyObject? node=VisualTreeHelper.GetParent(control);node is Visual;node=VisualTreeHelper.GetParent(node))
            {
                if(node is Controls.ElasticControlPanel)return true;
                if(node is Window or ScrollViewer)return false;
            }
            return false;
        }
        public State(FrameworkElement target)
        {
            control = target; control.RenderTransformOrigin = new Point(.5, .5);
            var group=new TransformGroup();group.Children.Add(scale);group.Children.Add(pull);control.RenderTransform=group;
            control.MouseEnter += Hover; control.MouseLeave += Hover;
            control.PreviewMouseLeftButtonDown += Down; control.PreviewMouseLeftButtonUp += Up;
            control.LostMouseCapture += LostCapture; control.Unloaded += Unloaded;
        }
        private void Hover(object sender, MouseEventArgs e) => Animate();
        private void Down(object sender, MouseButtonEventArgs e) { pressed = true; Animate(); }
        private void Up(object sender, MouseButtonEventArgs e) { pressed = false; Animate(); }
        private void LostCapture(object sender, MouseEventArgs e) { pressed = false; Animate(); }
        private void Animate()
        {
            if (!control.IsEnabled) return;
            double strength=Services.InterfaceSettings.Current.MotionStrength;
            double target = pressed ? 1-.025*strength : hasAttraction?desiredScale:control.IsMouseOver?1+.025*strength:1;
            if(InElasticLayout())target=pressed?.975:1;
            if (GetEngine(control) is { } engine)
                engine.Spring(control, "scale", scale.ScaleX, target, .26, v => scale.ScaleX = scale.ScaleY = Math.Max(.7,v));
        }
        public void Attract(double target,Vector offset,double opacity)
        {
            if(InElasticLayout()){target=1;offset=default;}
            if(hasAttraction&&Math.Abs(desiredScale-target)<.001&&(desiredPull-offset).Length<.1&&Math.Abs(desiredOpacity-opacity)<.001)return;
            hasAttraction=true;
            desiredScale=target;desiredPull=offset;desiredOpacity=opacity;Animate();
            if(GetEngine(control) is {} engine)
            {
                engine.Spring(control,"pullX",pull.X,offset.X,.24,v=>pull.X=v);
                engine.Spring(control,"pullY",pull.Y,offset.Y,.24,v=>pull.Y=v);
                engine.Animate(control,"emphasis",control.Opacity,opacity,.14,v=>control.Opacity=v);
            }
        }
        private void Unloaded(object sender, RoutedEventArgs e) { GetEngine(control)?.Cancel(control); scale.ScaleX = scale.ScaleY = 1;pull.X=pull.Y=0;desiredScale=desiredOpacity=control.Opacity=1;desiredPull=default;pressed = false; }
        public void Dispose()
        {
            GetEngine(control)?.Cancel(control);
            control.MouseEnter -= Hover; control.MouseLeave -= Hover; control.PreviewMouseLeftButtonDown -= Down;
            control.PreviewMouseLeftButtonUp -= Up; control.LostMouseCapture -= LostCapture; control.Unloaded -= Unloaded;
        }
    }
}
