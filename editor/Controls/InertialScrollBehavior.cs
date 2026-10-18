using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public static class InertialScrollBehavior
{
    public static readonly DependencyProperty EnabledProperty=DependencyProperty.RegisterAttached("Enabled",typeof(bool),typeof(InertialScrollBehavior),new PropertyMetadata(false,Changed));
    private static readonly DependencyProperty StateProperty=DependencyProperty.RegisterAttached("State",typeof(State),typeof(InertialScrollBehavior));
    public static bool GetEnabled(DependencyObject o)=>(bool)o.GetValue(EnabledProperty);
    public static void SetEnabled(DependencyObject o,bool value)=>o.SetValue(EnabledProperty,value);
    private static void Changed(DependencyObject o,DependencyPropertyChangedEventArgs e)
    {
        if(o is not ScrollViewer viewer)return;
        if(viewer.GetValue(StateProperty) is State old)old.Dispose();viewer.ClearValue(StateProperty);
        if((bool)e.NewValue)viewer.SetValue(StateProperty,new State(viewer));
    }
    private sealed class State:IDisposable
    {
        private readonly ScrollViewer viewer;
        private readonly DispatcherTimer timer=new(DispatcherPriority.Render){Interval=TimeSpan.FromMilliseconds(16)};
        private readonly Stopwatch clock=Stopwatch.StartNew();
        private double velocity,lastTime,lastOffset;
        private bool dragging;
        public State(ScrollViewer control)
        {
            viewer=control;viewer.PreviewMouseWheel+=Wheel;viewer.ScrollChanged+=Scrolled;viewer.Unloaded+=Unload;
            viewer.AddHandler(Thumb.DragStartedEvent,new DragStartedEventHandler(Started));viewer.AddHandler(Thumb.DragCompletedEvent,new DragCompletedEventHandler(Completed));timer.Tick+=Tick;
        }
        private void Wheel(object sender,MouseWheelEventArgs e)
        {
            var settings=InterfaceSettings.Current;
            if(viewer.CanContentScroll||viewer.ScrollableHeight<=0||Keyboard.Modifiers!=ModifierKeys.None||settings.ReducedMotion||settings.ScrollInertia==0)return;
            velocity-=e.Delta*4*settings.MotionStrength;lastTime=clock.Elapsed.TotalSeconds;timer.Start();e.Handled=true;
        }
        private static bool IsBar(object original)
        {
            for(DependencyObject? node=original as DependencyObject;node is not null;node=node is Visual?VisualTreeHelper.GetParent(node):null)if(node is ScrollBar)return true;
            return false;
        }
        private void Started(object sender,DragStartedEventArgs e){if(!IsBar(e.OriginalSource))return;dragging=true;velocity=0;timer.Stop();lastOffset=viewer.VerticalOffset;lastTime=clock.Elapsed.TotalSeconds;}
        private void Scrolled(object sender,ScrollChangedEventArgs e)
        {
            if(!dragging||viewer.CanContentScroll)return;
            double now=clock.Elapsed.TotalSeconds,dt=now-lastTime;if(dt<.005)return;
            velocity=velocity*.45+(viewer.VerticalOffset-lastOffset)/dt*.55;lastOffset=viewer.VerticalOffset;lastTime=now;
        }
        private void Completed(object sender,DragCompletedEventArgs e)
        {
            if(!dragging)return;dragging=false;lastTime=clock.Elapsed.TotalSeconds;
            if(!InterfaceSettings.Current.ReducedMotion&&InterfaceSettings.Current.ScrollInertia>0&&Math.Abs(velocity)>2)timer.Start();
        }
        private void Tick(object? sender,EventArgs e)
        {
            double now=clock.Elapsed.TotalSeconds,dt=Math.Clamp(now-lastTime,.001,.05);lastTime=now;
            var settings=InterfaceSettings.Current;
            double next=Math.Clamp(viewer.VerticalOffset+velocity*dt,0,viewer.ScrollableHeight);viewer.ScrollToVerticalOffset(next);
            velocity*=Math.Pow(settings.ScrollInertia,dt*60);
            if(Math.Abs(velocity)<2||next==0||next==viewer.ScrollableHeight||settings.ReducedMotion)timer.Stop();
        }
        private void Unload(object sender,RoutedEventArgs e){timer.Stop();velocity=0;}
        public void Dispose(){timer.Stop();viewer.PreviewMouseWheel-=Wheel;viewer.ScrollChanged-=Scrolled;viewer.Unloaded-=Unload;viewer.RemoveHandler(Thumb.DragStartedEvent,new DragStartedEventHandler(Started));viewer.RemoveHandler(Thumb.DragCompletedEvent,new DragCompletedEventHandler(Completed));timer.Tick-=Tick;}
    }
}
