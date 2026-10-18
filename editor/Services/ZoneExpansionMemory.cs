using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace MyCut.Editor.Services;
// Fast acquisition, slow release. Input and debug consume this same radius, not a visual imitation.
public sealed class ZoneExpansionMemory
{
    private sealed class State{public double From,To,Start,Duration,Seen;public double Sample(double now){double t=Math.Clamp((now-Start)/Math.Max(.001,Duration),0,1);return From+(To-From)*(t*t*(3-2*t));}}
    private readonly Dictionary<object,State> states=[];
    private sealed class RateState{public double Radius,Time;}
    private readonly ConditionalWeakTable<object,RateState> rateStates=new();
    private readonly Dictionary<object,RateState> valueRateStates=[];
    private readonly Func<double> clock;
    public ZoneExpansionMemory(Func<double>? time=null){var watch=Stopwatch.StartNew();clock=time??(()=>watch.Elapsed.TotalSeconds);}
    public double Update(object key,double desired,double release=.5)
    {
        double now=clock();desired=double.IsFinite(desired)?Math.Max(0,desired):0;release=Math.Clamp(release,.05,2);
        if(!states.TryGetValue(key,out var state)||now-state.Seen>Math.Max(.6,release*2)){state=new State{From=desired,To=desired,Start=now,Seen=now};states[key]=state;return desired;}
        double current=state.Sample(now);state.Seen=now;
        if(desired>=current){state.From=state.To=desired;state.Start=now;state.Duration=0;return desired;}
        if(Math.Abs(desired-state.To)>.001){state.From=current;state.To=desired;state.Start=now;state.Duration=release;}
        return state.Sample(now);
    }
    public double UpdateWithRate(object key,double desired,double shrinkSpeed)
    {
        double now=clock();desired=double.IsFinite(desired)?Math.Max(0,desired):0;
        shrinkSpeed=double.IsFinite(shrinkSpeed)?Math.Clamp(shrinkSpeed,1,2000):88;
        bool valueKey=key.GetType().IsValueType;RateState? state;
        bool exists=valueKey?valueRateStates.TryGetValue(key,out state):rateStates.TryGetValue(key,out state);
        if(!exists||state is null){state=new RateState{Radius=desired,Time=now};if(valueKey)valueRateStates[key]=state;else rateStates.Add(key,state);return desired;}
        double dt=Math.Max(0,now-state.Time);state.Time=now;
        // Never restart a decay curve on every pointer sample. The radius loses
        // at most shrinkSpeed DIPs each second, regardless of event frequency.
        state.Radius=desired>=state.Radius?desired:Math.Max(desired,state.Radius-shrinkSpeed*dt);
        return state.Radius;
    }
    public void Clear(){states.Clear();rateStates.Clear();valueRateStates.Clear();}
}
