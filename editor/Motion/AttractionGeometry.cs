using System.Windows;

namespace MyCut.Editor.Motion;

// Pure geometry shared by every animated control; it can be tested without a window.
public static class AttractionGeometry
{
    public static (double Scale,Vector Pull) Fit(Rect bounds,Rect clip,double requested,Vector offset)
    {
        if(bounds.IsEmpty||clip.IsEmpty||bounds.Width<1||bounds.Height<1||!clip.Contains(bounds)||!double.IsFinite(requested)||!double.IsFinite(offset.X)||!double.IsFinite(offset.Y))return(1,default);
        double cx=bounds.Left+bounds.Width/2,cy=bounds.Top+bounds.Height/2;
        double limitX=2*Math.Min(cx-clip.Left,clip.Right-cx)/bounds.Width,limitY=2*Math.Min(cy-clip.Top,clip.Bottom-cy)/bounds.Height;
        double limit=Math.Max(1,Math.Min(limitX,limitY));
        if(limit-1<1e-10)limit=1;
        const double reboundEnvelope=1.5; // Covers the strongest supported (2x) spring.
        double scale=Math.Min(requested,1+(limit-1)/reboundEnvelope),envelope=1+Math.Max(0,scale-1)*reboundEnvelope;
        static double FitAxis(double value,double min,double max)
        {
            // At an exact clip boundary floating-point cancellation can produce
            // +2.27e-14 .. -2.27e-14. There is no travel room, not a valid reversed range.
            if(max-min<=1e-7)return 0;
            return Math.Clamp(value,Math.Min(0,min),Math.Max(0,max));
        }
        offset.X=FitAxis(offset.X,(clip.Left-cx+bounds.Width*envelope/2)*.8,(clip.Right-cx-bounds.Width*envelope/2)*.8);
        offset.Y=FitAxis(offset.Y,(clip.Top-cy+bounds.Height*envelope/2)*.8,(clip.Bottom-cy-bounds.Height*envelope/2)*.8);
        return(scale,offset);
    }
}
