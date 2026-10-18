namespace MyCut.Editor.Services;

// Distance is measured to the actual control surface, in DIPs (not its center).
public static class AdaptiveZoneLaw
{
    public static double Expansion(double speed,double distance,double coefficient,double influenceDistance,double threshold,double maximum)
    {
        if(!double.IsFinite(speed)||!double.IsFinite(distance)||!double.IsFinite(coefficient)||!double.IsFinite(influenceDistance)||!double.IsFinite(threshold)||!double.IsFinite(maximum)||influenceDistance<=0||coefficient<=0||maximum<=0)return 0;
        double proximity=Math.Clamp(1-Math.Max(0,distance)/influenceDistance,0,1);
        return Math.Clamp(Math.Max(0,speed-Math.Max(0,threshold))*coefficient*proximity*proximity,0,maximum);
    }
}
