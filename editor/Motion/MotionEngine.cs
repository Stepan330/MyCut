using System.Diagnostics;
using System.Windows.Media;

namespace MyCut.Editor.Motion;
public sealed record MotionCurve(double From, double To, double Start, double Duration,bool Spring=false,double Impulse=0,double Strength=1)
{
    public double Sample(double now)
    {
        double t = Math.Clamp((now - Start) / Math.Max(Duration, .001), 0, 1);
        double eased = Spring?1-Math.Exp(-6*t)*(Math.Cos(10*t)+.6*Math.Sin(10*t)):1 - Math.Pow(1 - t, 3);
        if(Spring&&eased>1)eased=1+(eased-1)*Strength;
        return From + (To - From) * eased+Impulse*Math.Sin(Math.PI*t)*Math.Exp(-3*t);
    }
    public bool Complete(double now) => now >= Start + Duration;
}
// A window-owned presentation clock. Retargeting samples the current curve and replaces its completion.
public sealed class MotionEngine : IDisposable
{
    private sealed record Track(MotionCurve Curve, Action<double> Apply, Action? Finished);
    private readonly Dictionary<(object Owner, string Channel), Track> tracks = [];
    private readonly Func<double> time;
    private readonly bool automatic;
    private bool subscribed, disposed;
    public bool ReducedMotion { get; }
    public int ActiveCount => tracks.Count;
    public MotionEngine(bool reducedMotion = false, Func<double>? clock = null, bool automaticFrames = true)
    {
        var stopwatch = Stopwatch.StartNew();
        time = clock ?? (() => stopwatch.Elapsed.TotalSeconds);
        automatic = automaticFrames; ReducedMotion = reducedMotion;
    }
    public void Animate(object owner, string channel, double from, double to, double seconds, Action<double> apply, Action? finished = null)
        => Start(owner,channel,from,to,seconds,apply,finished,false);
    public void Spring(object owner,string channel,double from,double to,double seconds,Action<double> apply,Action? finished=null)
        => Start(owner,channel,from,to,seconds,apply,finished,true);
    public void Kick(object owner,string channel,double amplitude,double seconds,Action<double> apply)
    {
        Start(owner,channel,0,0,seconds,apply,null,false,amplitude*Services.InterfaceSettings.Current.MotionStrength);
    }
    private void Start(object owner,string channel,double from,double to,double seconds,Action<double> apply,Action? finished,bool spring,double impulse=0)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        var key = (owner, channel); double now = time();
        if (tracks.Remove(key, out var previous)) from = previous.Curve.Sample(now);
        if (ReducedMotion || Services.InterfaceSettings.Current.ReducedMotion || Services.InterfaceSettings.Current.MotionStrength==0 || seconds <= 0 || Math.Abs(to - from) < .00001&&Math.Abs(impulse)<.00001)
        {
            apply(to); finished?.Invoke(); UnsubscribeWhenIdle(); return;
        }
        tracks[key] = new Track(new MotionCurve(from, to, now, seconds,spring,impulse,Services.InterfaceSettings.Current.MotionStrength), apply, finished);
        apply(from);
        if (automatic && !subscribed) { CompositionTarget.Rendering += Frame; subscribed = true; }
    }
    public void Cancel(object owner)
    {
        foreach (var key in tracks.Keys.Where(k => ReferenceEquals(k.Owner, owner)).ToArray()) tracks.Remove(key);
        UnsubscribeWhenIdle();
    }
    public void Cancel(object owner, string channel) { tracks.Remove((owner, channel)); UnsubscribeWhenIdle(); }
    private void Frame(object? sender, EventArgs e) => Advance();
    internal void Advance()
    {
        double now = time();
        foreach (var entry in tracks.ToArray())
        {
            if (!tracks.TryGetValue(entry.Key, out var current) || !ReferenceEquals(current, entry.Value)) continue;
            bool complete = current.Curve.Complete(now)||Services.InterfaceSettings.Current.MotionStrength==0||Services.InterfaceSettings.Current.ReducedMotion;
            if (complete) tracks.Remove(entry.Key);
            current.Apply(complete ? current.Curve.To : current.Curve.Sample(now));
            if (complete) current.Finished?.Invoke();
        }
        UnsubscribeWhenIdle();
    }
    private void UnsubscribeWhenIdle()
    {
        if (tracks.Count == 0 && subscribed) { CompositionTarget.Rendering -= Frame; subscribed = false; }
    }
    public void Dispose() { tracks.Clear(); UnsubscribeWhenIdle(); disposed = true; }
}
