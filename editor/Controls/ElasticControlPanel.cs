using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;
public sealed class ElasticControlPanel:Panel
{
    public static readonly DependencyProperty OrientationProperty=DependencyProperty.Register(nameof(Orientation),typeof(Orientation),typeof(ElasticControlPanel),new FrameworkPropertyMetadata(Orientation.Horizontal,FrameworkPropertyMetadataOptions.AffectsMeasure));
    public Orientation Orientation{get=>(Orientation)GetValue(OrientationProperty);set=>SetValue(OrientationProperty,value);}
    public static readonly DependencyProperty SpacingProperty=DependencyProperty.Register(nameof(Spacing),typeof(double),typeof(ElasticControlPanel),new FrameworkPropertyMetadata(4d,FrameworkPropertyMetadataOptions.AffectsMeasure));
    public double Spacing{get=>(double)GetValue(SpacingProperty);set=>SetValue(SpacingProperty,value);}
    private readonly Stopwatch watch=Stopwatch.StartNew();
    private readonly Dictionary<UIElement,double> emphasis=[];
    private bool subscribed;
    private double last;
    public ElasticControlPanel(){ClipToBounds=false;Loaded+=(_,_)=>{InterfaceSettings.Current.PropertyChanged+=SettingsChanged;Start();};Unloaded+=(_,_)=>{InterfaceSettings.Current.PropertyChanged-=SettingsChanged;Stop();};PreviewMouseMove+=(_,_)=>Start();MouseLeave+=(_,_)=>Start();}
    private void SettingsChanged(object? sender,System.ComponentModel.PropertyChangedEventArgs e){InvalidateArrange();Start();}
    public void RefreshMotion(){if(IsLoaded)Start();}
    private void Start(){if(subscribed)return;last=watch.Elapsed.TotalSeconds;CompositionTarget.Rendering+=Frame;subscribed=true;}
    private void Stop(){if(!subscribed)return;CompositionTarget.Rendering-=Frame;subscribed=false;}
    private void Frame(object? sender,EventArgs e)
    {
        double now=watch.Elapsed.TotalSeconds,dt=Math.Min(.1,now-last);last=now;bool changed=false;
        foreach(UIElement child in InternalChildren)
        {
            double target=child.IsEnabled&&(ProximityInput.GetIsNear(child)||child.IsMouseOver)?1:0;double old=emphasis.GetValueOrDefault(child);
            double next=InterfaceSettings.Current.ReducedMotion?target:old+(target-old)*(1-Math.Exp(-dt/(target>old?.075:.16)));
            if(Math.Abs(next-target)<.001)next=target;if(Math.Abs(next-old)>.0001)changed=true;emphasis[child]=next;
        }
        if(changed)InvalidateArrange();else Stop();
    }
    protected override Size MeasureOverride(Size available)
    {
        double length=0,cross=0;int count=0;foreach(UIElement child in InternalChildren){if(child.Visibility==Visibility.Collapsed)continue;child.Measure(Orientation==Orientation.Horizontal?new Size(double.PositiveInfinity,available.Height):new Size(available.Width,double.PositiveInfinity));var s=child.DesiredSize;length+=Orientation==Orientation.Horizontal?s.Width:s.Height;cross=Math.Max(cross,Orientation==Orientation.Horizontal?s.Height:s.Width);++count;}
        length+=Spacing*Math.Max(0,count-1);return Orientation==Orientation.Horizontal?new Size(length,cross):new Size(cross,length);
    }
    protected override Size ArrangeOverride(Size final)
    {
        var children=InternalChildren.Cast<UIElement>().Where(c=>c.Visibility!=Visibility.Collapsed).ToArray();bool horizontal=Orientation==Orientation.Horizontal;
        var natural=children.Select(c=>horizontal?c.DesiredSize.Width:c.DesiredSize.Height).ToArray();var weights=children.Select(c=>emphasis.GetValueOrDefault(c)).ToArray();double available=Math.Max(0,(horizontal?final.Width:final.Height)-Spacing*Math.Max(0,children.Length-1));
        var sizes=ElasticLayout.Allocate(natural,weights,InterfaceSettings.Current.HoverGrowth*InterfaceSettings.Current.MotionStrength*2.5,available,24);double at=0;
        for(int n=0;n<children.Length;++n){children[n].Arrange(horizontal?new Rect(at,0,sizes[n],final.Height):new Rect(0,at,final.Width,sizes[n]));at+=sizes[n]+Spacing;}return final;
    }
}
