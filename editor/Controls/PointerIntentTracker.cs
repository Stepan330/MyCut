using System.Diagnostics;
using System.Windows;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public readonly record struct PointerIntent(Vector Direction, double Expansion, double Speed,double MeasuredSpeed=-1)
{
    public double ButtonSpeed=>MeasuredSpeed>=0?MeasuredSpeed:Speed;
    public Vector PredictedOffset(double seconds) => Direction*(Speed*.25*(1-Math.Exp(-seconds/.25)));
}

// Estimates a short-lived forward probability lobe from recent pointer velocity.
// It is presentation/input state only: no project data or undo entries are touched.
public sealed class PointerIntentTracker
{
    private readonly Func<double> clock;
    private Point last;
    private Vector velocity;
    private double lastTime;
    private bool observed;
    private double screenDensity;
    public Point LastPoint=>last;
    public PointerIntent ObserveScreen(Point physical,double density,double maximumExpansion)
    {
        if(Math.Abs(screenDensity-density)>.001)Reset();screenDensity=density;
        return Observe(new Point(physical.X/density,physical.Y/density),maximumExpansion);
    }
    public PointerIntentTracker(Func<double>? time = null)
    {
        var stopwatch = Stopwatch.StartNew(); clock = time ?? (() => stopwatch.Elapsed.TotalSeconds);
    }
    public PointerIntent Observe(Point point, double maximumExpansion = 36)
    {
        double now = clock();
        if (observed)
        {
            double dt = now - lastTime;
            if((point-last).Length<.05 || dt<.004)return Snapshot(maximumExpansion);
            if (dt <= .20)
            {
                var instant = (point - last) / dt;
                velocity = Vector.Multiply(velocity,instant)<0?instant:velocity * .45 + instant * .55;
            }
            else if (dt > .20) velocity = (point-last)/dt;
        }
        observed = true; last = point; lastTime = now;
        return Snapshot(maximumExpansion);
    }
    public PointerIntent Snapshot(double maximumExpansion = 36)
    {
        if (!observed) return default;
        var settings=InterfaceSettings.Current;
        if(!settings.AdaptiveInput)return default;
        double age = Math.Max(0, clock() - lastTime);
        if (age >= settings.IntentLifetime) return default;
        double retention = 1 - age / settings.IntentLifetime;
        double speed = velocity.Length;
        double factor = Math.Clamp((speed - settings.SpeedThreshold) / 1500, 0, 1) * retention * retention;
        var direction = speed > .01 ? velocity / velocity.Length : default;
        // Buttons use a current velocity estimate. After input stops their own
        // per-target memory handles release; the forecast retains its separate lobe.
        return new PointerIntent(direction, maximumExpansion * factor, speed*retention,age<=.06?speed:0);
    }
    public void Reset() { observed = false; velocity = default; }
}
