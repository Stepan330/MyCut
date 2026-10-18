using System.Windows;
using System.Windows.Documents;
using System.Windows.Media;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public sealed record InputZone(FrameworkElement Owner,Rect Bounds,double Expansion=-1);
public sealed class InputDebugAdorner(UIElement element):Adorner(element)
{
    private IReadOnlyList<InputZone> zones=[];
    private Point pointer;
    private PointerIntent intent;
    private FrameworkElement? chosen;
    public void Update(Point point,PointerIntent current,IReadOnlyList<InputZone> controls,FrameworkElement? target)
    {
        IsHitTestVisible=false;pointer=point;intent=current;zones=controls;chosen=target;InvalidateVisual();
    }
    public static double Score(Point point,Rect bounds,PointerIntent intent,out double radius,double expansion=-1)
    {
        double distance=ProximityInput.Distance(point,bounds);
        var settings=InterfaceSettings.Current;
        radius=settings.HandleRadius+(expansion>=0?expansion:AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,distance,settings.MouseSpeedCoefficient,settings.ZoneInfluenceDistance,settings.SpeedThreshold,settings.MaximumExpansion));
        // A retained large zone must not steal a click from a closer eligible control.
        return distance<=radius?distance:double.PositiveInfinity;
    }
    protected override void OnRender(DrawingContext dc)
    {
        var settings=InterfaceSettings.Current;
        if(settings.DebugZones)
        {
            foreach(var zone in zones)
            {
                Score(pointer,zone.Bounds,intent,out var radius,zone.Expansion);var expanded=zone.Bounds;expanded.Inflate(radius,radius);
                dc.DrawRoundedRectangle(new SolidColorBrush(Color.FromArgb(15,60,220,235)),new Pen(zone.Owner==chosen?Brushes.Cyan:Brushes.SlateGray,1),expanded,radius,radius);
            }
        }
        if(settings.DebugConflicts)
        {
            // Sample the same nearest-eligible-surface resolver, clipped by retained radii.
            for(double y=Math.Max(0,pointer.Y-110);y<Math.Min(ActualHeight,pointer.Y+110);y+=10)
            for(double x=Math.Max(0,pointer.X-110);x<Math.Min(ActualWidth,pointer.X+110);x+=10)
            {
                var point=new Point(x+5,y+5);InputZone? best=null;double score=double.PositiveInfinity,center=double.PositiveInfinity;int owners=0;
                foreach(var zone in zones)
                {
                    double current=Score(point,zone.Bounds,intent,out _,zone.Expansion);if(double.IsPositiveInfinity(current))continue;owners++;
                    double d=(point-new Point(zone.Bounds.Left+zone.Bounds.Width/2,zone.Bounds.Top+zone.Bounds.Height/2)).Length;
                    if(current<score-.001||Math.Abs(current-score)<=.001&&d<center){best=zone;score=current;center=d;}
                }
                if(best is null)continue;
                var color=best.Owner==chosen?Color.FromArgb(40,50,225,235):Color.FromArgb(25,150,110,245);
                dc.DrawRectangle(new SolidColorBrush(color),owners>1?new Pen(new SolidColorBrush(Color.FromArgb(55,245,173,62)),.7):null,new Rect(x,y,9,9));
            }
        }
        if(settings.DebugPrediction&&intent.Speed>0)
        {
            var vector=intent.PredictedOffset(settings.PredictionHorizon);if(vector.Length>240)vector*=240/vector.Length;
            var end=pointer+vector;dc.DrawLine(new Pen(Brushes.Gold,2),pointer,end);
            foreach(double t in new[]{.15,.4,1.0})
            {
                var predicted=intent.PredictedOffset(t*settings.PredictionHorizon);if(predicted.Length>240)predicted*=240/predicted.Length;
                dc.DrawEllipse(null,new Pen(Brushes.Gold,1),pointer+predicted,6+t*intent.Expansion*.45,6+t*intent.Expansion*.45);
            }
        }
    }
}
