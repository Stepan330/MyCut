using System.ComponentModel;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

// Coordinates remain in document frames. Zoom/pan and elastic handles are presentation only.
public sealed class TimelineCanvas:FrameworkElement
{
    private const double LabelWidth=116,RulerHeight=38,TrackHeight=68;
    private readonly EditorViewModel vm;
    private readonly PointerIntentTracker tracker;
    private readonly MotionEngine motion;
    private double viewStart,pixelsPerFrame=3,hoverStrength;
    private int firstTrack;
    private (ulong Id,int Part) hover;
    private NativeClip original;
    private Point down,lastPoint;
    private double originalMouseFrame,panStart;
    private int dragPart;
    private bool downClip,editing,panning,seeking;
    private PointerIntent intent;
    private readonly ZoneExpansionMemory zones=new();
    private bool pointerInside;
    private readonly DispatcherTimer inputTimer=new(DispatcherPriority.Input){Interval=TimeSpan.FromMilliseconds(33)};
    public double ViewStart=>viewStart;
    public double PixelsPerFrame=>pixelsPerFrame;
    public TimelineCanvas(EditorViewModel model,MotionEngine animations,PointerIntentTracker pointer)
    {
        vm=model;motion=animations;tracker=pointer;Focusable=true;MinHeight=240;ClipToBounds=true;AllowDrop=true;
        ProximityInput.SetOwnInput(this,true);
        vm.PropertyChanged+=Changed;InterfaceSettings.Current.PropertyChanged+=Changed;
        Loaded+=(_,_)=>inputTimer.Start();
        Unloaded+=(_,_)=>{inputTimer.Stop();Cancel();vm.PropertyChanged-=Changed;InterfaceSettings.Current.PropertyChanged-=Changed;motion.Cancel(this);};
        inputTimer.Tick+=(_,_)=>
        {
            if(editing){double pan=lastPoint.X>ActualWidth-20?8/pixelsPerFrame:lastPoint.X<LabelWidth+20?-8/pixelsPerFrame:0;double next=Math.Clamp(viewStart+pan,0,1_000_000_000);if(next!=viewStart){viewStart=next;UpdateDrag(lastPoint);}return;}
            if(!pointerInside||IsMouseCaptured)return;
            var current=tracker.Snapshot(InterfaceSettings.Current.MaximumExpansion);bool changed=Math.Abs(current.Expansion-intent.Expansion)>.05;intent=current;UpdateHover();if(changed)InvalidateVisual();
        };
        DragOver+=(_,e)=>{e.Effects=e.Data.GetDataPresent("MyCut.Media")?DragDropEffects.Copy:DragDropEffects.None;e.Handled=true;};
        Drop+=(_,e)=>
        {
            if(e.Data.GetData("MyCut.Media") is not ulong id)return;Point point=e.GetPosition(this);int track=TrackAt(point.Y);
            if(track<0||track>=vm.TimelineTracks.Count||vm.TimelineTracks[track].Locked)return;
            vm.SelectedMedia=vm.MediaBin.FirstOrDefault(i=>i.Id==id);vm.SelectedTrackId=vm.TimelineTracks[track].Id;vm.PlayheadFrame=FrameAt(point.X);vm.InsertMedia();e.Handled=true;
        };
    }
    private void Changed(object? sender,PropertyChangedEventArgs e){if(e.PropertyName is not "Metrics" and not "Status")InvalidateVisual();}
    private Brush Brush(string key)=>TryFindResource(key) as Brush??Brushes.Gray;
    private static Brush Solid(byte r,byte g,byte b,byte a=255)=>new SolidColorBrush(Color.FromArgb(a,r,g,b));
    private void Text(DrawingContext dc,string text,Point point,Brush color,double size=11,double maximum=1000)
    {
        if(maximum<=0)return;var value=new FormattedText(text,CultureInfo.InvariantCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),size,color,VisualTreeHelper.GetDpi(this).PixelsPerDip){MaxTextWidth=Math.Max(1,maximum),Trimming=TextTrimming.CharacterEllipsis};dc.DrawText(value,point);
    }
    private double X(double frame)=>LabelWidth+(frame-viewStart)*pixelsPerFrame;
    private long FrameAt(double x)=>(long)Math.Round(Math.Clamp(viewStart+(x-LabelWidth)/pixelsPerFrame,0,1_000_000_000));
    private int TrackAt(double y)=>firstTrack+(int)Math.Floor((y-RulerHeight)/TrackHeight);
    private Rect ClipBounds(TimelineClip clip)
    {
        int track=vm.TimelineTracks.ToList().FindIndex(t=>t.Id==clip.Value.Track);
        return new Rect(X(clip.Value.Start),RulerHeight+(track-firstTrack)*TrackHeight+9,Math.Max(8,clip.Value.Duration*pixelsPerFrame),50);
    }
    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);dc.DrawRectangle(Brush("CanvasBrush"),null,new Rect(RenderSize));
        var line=new Pen(Brush("BorderBrush"),1);dc.DrawRectangle(Brush("RaisedBrush"),null,new Rect(0,0,ActualWidth,RulerHeight));
        double ideal=70/pixelsPerFrame,power=Math.Pow(10,Math.Floor(Math.Log10(Math.Max(1,ideal)))),step=new[]{1d,2,5,10}.Select(x=>x*power).First(x=>x>=ideal);
        dc.PushClip(new RectangleGeometry(new Rect(LabelWidth,0,Math.Max(0,ActualWidth-LabelWidth),ActualHeight)));
        if(vm.RangeOut>=0){var range=new Rect(X(vm.RangeIn),0,(vm.RangeOut-vm.RangeIn)*pixelsPerFrame,ActualHeight);dc.DrawRectangle(Solid(70,210,180,18),null,range);}
        for(double frame=Math.Floor(viewStart/step)*step;X(frame)<ActualWidth;frame+=step)
        {
            if(frame<0)continue;double x=X(frame);dc.DrawLine(line,new Point(x,RulerHeight),new Point(x,ActualHeight));dc.DrawLine(line,new Point(x,28),new Point(x,RulerHeight));
            Text(dc,$"{frame/vm.FrameRate:0.##}s",new Point(x+5,10),Brush("MutedBrush"));
        }
        foreach(var clip in vm.TimelineClips)
        {
            var bounds=ClipBounds(clip);if(bounds.Bottom<RulerHeight||bounds.Top>ActualHeight||bounds.Right<LabelWidth||bounds.Left>ActualWidth)continue;
            bool selected=vm.SelectedClipId==clip.Id,hot=hover.Id==clip.Id;
            var fill=clip.Kind switch{8=>Solid(40,93,128),1=>Solid(115,82,46),_=>Solid(71,58,112)};
            var track=vm.TimelineTracks.First(t=>t.Id==clip.Value.Track);double opacity=track.Muted||clip.Value.Muted!=0?.35:track.Locked?.6:1;
            dc.PushOpacity(opacity);dc.DrawRoundedRectangle(fill,new Pen(selected?Brush("AccentBrush"):hot?Brush("TextBrush"):Brush("BorderBrush"),selected?2:1),bounds,6,6);
            void Fade(long count,bool outgoing)
            {
                if(count==0)return;double width=Math.Min(bounds.Width,count*pixelsPerFrame);var triangle=new StreamGeometry();using(var ctx=triangle.Open())
                {ctx.BeginFigure(outgoing?new Point(bounds.Right-width,bounds.Top):bounds.TopLeft,true,true);ctx.LineTo(outgoing?bounds.TopRight:new Point(bounds.Left+width,bounds.Top),true,false);ctx.LineTo(outgoing?bounds.BottomRight:bounds.BottomLeft,true,false);}dc.DrawGeometry(Solid(190,235,230,40),null,triangle);
            }
            Fade(clip.Value.FadeIn,false);Fade(clip.Value.FadeOut,true);
            if(bounds.Width>75)Text(dc,clip.Name,new Point(Math.Max(LabelWidth+8,bounds.Left+12),bounds.Top+8),Brush("TextBrush"),12,Math.Max(1,Math.Min(ActualWidth,bounds.Right)-Math.Max(LabelWidth,bounds.Left)-24));
            if(bounds.Width>80)Text(dc,$"{clip.Value.Duration}f · {clip.Value.Speed:0.##}×",new Point(Math.Max(LabelWidth+8,bounds.Left+12),bounds.Top+29),Brush("MutedBrush"),10,bounds.Width-24);
            foreach(int part in new[]{1,2})
            {
                double x=part==1?bounds.Left+3:bounds.Right-3,emphasis=hot&&hover.Part==part?hoverStrength:0;
                double displacement=Math.Clamp(lastPoint.X-x,-10,10)*emphasis*InterfaceSettings.Current.MagnetStrength;
                double width=4+5*emphasis;var handle=new Rect(x+displacement-width/2,bounds.Top+12-3*emphasis,width,26+6*emphasis);
                dc.DrawRoundedRectangle(selected||emphasis>0?Brush("AccentBrush"):Solid(205,219,235,100),null,handle,2,2);
            }
            dc.Pop();
        }
        foreach(var (frame,name) in new[]{(vm.RangeIn,"I"),(vm.RangeOut,"O")})if(frame>=0){double x=X(frame);dc.DrawLine(new Pen(Brush("AccentBrush"),1),new Point(x,RulerHeight),new Point(x,ActualHeight));Text(dc,name,new Point(x+4,2),Brush("AccentBrush"));}
        double head=X(vm.PlayheadFrame);dc.DrawLine(new Pen(Brush("AccentBrush"),2),new Point(head,24),new Point(head,ActualHeight));dc.DrawRoundedRectangle(Brush("AccentBrush"),null,new Rect(head-6,24,12,12),3,3);dc.Pop();
        dc.DrawRectangle(Brush("PanelBrush"),null,new Rect(0,0,LabelWidth,ActualHeight));Text(dc,vm.FrameRateText,new Point(14,11),Brush("MutedBrush"),10);
        for(int n=firstTrack;n<vm.TimelineTracks.Count&&RulerHeight+(n-firstTrack)*TrackHeight<ActualHeight;++n)
        {
            var track=vm.TimelineTracks[n];double top=RulerHeight+(n-firstTrack)*TrackHeight;
            dc.DrawLine(line,new Point(0,top),new Point(ActualWidth,top));if(track.Id==vm.SelectedTrackId)dc.DrawRectangle(Solid(100,210,185,18),null,new Rect(0,top,LabelWidth,TrackHeight));
            Text(dc,track.Name,new Point(12,top+10),Brush("TextBrush"),12,LabelWidth-20);
            Text(dc,track.Muted?"MUTE":"M",new Point(14,top+38),track.Muted?Brush("AccentBrush"):Brush("MutedBrush"),11);
            Text(dc,track.Locked?"LOCK":"L",new Point(63,top+38),track.Locked?Brush("AccentBrush"):Brush("MutedBrush"),11);
        }
        dc.DrawLine(line,new Point(LabelWidth,0),new Point(LabelWidth,ActualHeight));
        if(vm.TimelineTracks.Count==0)Text(dc,"Add a track, then insert or drop media at the playhead.",new Point(LabelWidth+24,80),Brush("MutedBrush"),13,Math.Max(1,ActualWidth-LabelWidth-48));
    }
    private (ulong Id,int Part) Hit(Point point)
    {
        if(point.X<LabelWidth||point.Y<RulerHeight)return default;double best=double.PositiveInfinity; (ulong,int) result=default;
        // Shared speed / proximity policy and per-handle rate-limited memory.
        foreach(var clip in vm.TimelineClips.Reverse())
        {
            var bounds=ClipBounds(clip);if(bounds.Top<RulerHeight||bounds.Top>ActualHeight)continue;
            for(int part=1;part<=2;++part)
            {
                var center=new Point(part==1?bounds.Left:bounds.Right,bounds.Top+bounds.Height/2);var delta=center-point;
                double dx=Math.Abs(delta.X),dy=Math.Max(0,Math.Abs(delta.Y)-bounds.Height/2+6),distance=Math.Sqrt(dx*dx+dy*dy);var s=InterfaceSettings.Current;
                double desired=AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,distance,s.MouseSpeedCoefficient,s.ZoneInfluenceDistance,s.SpeedThreshold,s.MaximumExpansion);
                double radius=s.HandleRadius+zones.UpdateWithRate((clip.Id,part),desired,s.ZoneShrinkSpeed);
                if(distance<=radius&&distance<best){best=distance;result=(clip.Id,part);}
            }
        }
        if(result.Item1!=0)return result;
        foreach(var clip in vm.TimelineClips.Reverse())
        {
            var bounds=ClipBounds(clip);if(bounds.Top<RulerHeight||bounds.Top>ActualHeight)continue;double distance=ProximityInput.Distance(point,bounds);var s=InterfaceSettings.Current;
            double extra=AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,distance,s.MouseSpeedCoefficient,s.ZoneInfluenceDistance,s.SpeedThreshold,s.MaximumExpansion);
            if(distance<=s.HandleRadius+zones.UpdateWithRate((clip.Id,0),extra,s.ZoneShrinkSpeed)&&distance<best){best=distance;result=(clip.Id,0);}
        }
        return result;
    }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);pointerInside=true;lastPoint=e.GetPosition(this);intent=tracker.ObserveScreen(SpatialCoordinates.ToScreen(this,lastPoint),VisualTreeHelper.GetDpi(this).DpiScaleX,InterfaceSettings.Current.MaximumExpansion);
        if(panning){viewStart=Math.Clamp(panStart-(lastPoint.X-down.X)/pixelsPerFrame,0,1_000_000_000);InvalidateVisual();return;}
        if(seeking){vm.PlayheadFrame=FrameAt(lastPoint.X);return;}
        if(downClip){UpdateDrag(lastPoint);return;}
        UpdateHover();InvalidateVisual();
    }
    private void UpdateHover()
    {
        var next=Hit(lastPoint);if(next!=hover){hover=next;motion.Spring(this,"handle",hoverStrength,next.Id!=0?1:0,.2,v=>{hoverStrength=v;InvalidateVisual();});InvalidateVisual();}
        Cursor=next.Id==0?Cursors.Arrow:next.Part==0?Cursors.SizeAll:Cursors.SizeWE;
    }
    protected override void OnMouseDown(MouseButtonEventArgs e)
    {
        base.OnMouseDown(e);Focus();lastPoint=down=e.GetPosition(this);
        if(e.ChangedButton==MouseButton.Middle){panning=true;panStart=viewStart;CaptureMouse();e.Handled=true;return;}
        if(e.ChangedButton!=MouseButton.Left)return;vm.StopPlayback();
        if(down.X<LabelWidth){int row=TrackAt(down.Y);if(row>=0&&row<vm.TimelineTracks.Count){var track=vm.TimelineTracks[row];vm.SelectedTrackId=track.Id;if((down.Y-RulerHeight)%TrackHeight>32)vm.ToggleTrack(track.Id,down.X>=58);}e.Handled=true;return;}
        intent=tracker.ObserveScreen(SpatialCoordinates.ToScreen(this,down),VisualTreeHelper.GetDpi(this).DpiScaleX,InterfaceSettings.Current.MaximumExpansion);var hit=Hit(down);
        if(hit.Id!=0){vm.SelectClip(hit.Id);if(vm.CanEditClip){original=vm.SelectedClip!.Value;originalMouseFrame=FrameAt(down.X);dragPart=hit.Part;downClip=true;CaptureMouse();}}
        else{seeking=true;vm.PlayheadFrame=FrameAt(down.X);CaptureMouse();}e.Handled=true;
    }
    private long Snap(long proposed)
    {
        if(Keyboard.Modifiers.HasFlag(ModifierKeys.Alt))return proposed;long tolerance=Math.Max(1,(long)Math.Ceiling(12/pixelsPerFrame)),best=proposed,distance=tolerance+1;
        void Candidate(long frame){long d=Math.Abs(proposed-frame);if(d<distance){best=frame;distance=d;}}
        Candidate(0);Candidate(vm.PlayheadFrame);foreach(var c in vm.TimelineClips)if(c.Id!=original.Id){Candidate(c.Value.Start);Candidate(c.End);}
        return distance<=tolerance?best:proposed;
    }
    private void UpdateDrag(Point point)
    {
        if(!editing&&(point-down).Length<5)return;
        if(!editing){vm.BeginGesture();editing=true;}
        try
        {
            var value=original;long delta=FrameAt(point.X)-(long)originalMouseFrame;
            if(dragPart==0)
            {
                long start=Math.Max(0,original.Start+delta),snapped=Snap(start),snappedEnd=Snap(start+original.Duration)-original.Duration;
                if(snapped==start&&snappedEnd>=0)snapped=snappedEnd;value.Start=snapped;
                int row=TrackAt(point.Y);if(row>=0&&row<vm.TimelineTracks.Count&&!vm.TimelineTracks[row].Locked)value.Track=vm.TimelineTracks[row].Id;
            }
            else if(dragPart==1)
            {
                bool video=vm.Items.First(i=>i.Id==value.Instance).Content.Kind==8;
                long earliest=video?Math.Max(0,original.Start-(long)Math.Floor(original.SourceIn/original.Speed)):0;long start=Math.Clamp(Snap(original.Start+delta),earliest,original.Start+original.Duration-1);
                value.Start=start;value.Duration=original.Start+original.Duration-start;value.SourceIn=Math.Max(0,original.SourceIn+(long)Math.Round((start-original.Start)*original.Speed));
            }
            else
            {
                long end=Math.Max(original.Start+1,Snap(original.Start+original.Duration+delta));value.Duration=end-original.Start;
                var source=vm.Items.First(i=>i.Id==value.Instance);if(source.Content.Kind==8){double available=Math.Ceiling(source.MediaDuration*vm.FrameRate-1e-5);value.Duration=Math.Min(value.Duration,Math.Max(1,(long)Math.Ceiling((available-value.SourceIn)/value.Speed-1e-5)));}
            }
            value.FadeIn=Math.Min(value.FadeIn,value.Duration);value.FadeOut=Math.Min(value.FadeOut,value.Duration);
            vm.EditClip(value);InvalidateVisual();
        }
        catch(Exception ex){vm.Status=ex.Message;App.Log(ex);Cancel();if(vm.Smoke)throw;}
    }
    protected override void OnMouseUp(MouseButtonEventArgs e)
    {
        base.OnMouseUp(e);if(editing)vm.EndGesture();editing=downClip=panning=seeking=false;ReleaseMouseCapture();InvalidateVisual();e.Handled=true;
    }
    private void Cancel(){if(editing)vm.CancelGesture();editing=downClip=panning=seeking=false;if(IsMouseCaptured)ReleaseMouseCapture();InvalidateVisual();}
    protected override void OnLostMouseCapture(MouseEventArgs e){base.OnLostMouseCapture(e);if(downClip||panning||seeking)Cancel();}
    protected override void OnMouseLeave(MouseEventArgs e){base.OnMouseLeave(e);pointerInside=false;if(!IsMouseCaptured){hover=default;motion.Spring(this,"handle",hoverStrength,0,.2,v=>{hoverStrength=v;InvalidateVisual();});}}
    protected override void OnMouseWheel(MouseWheelEventArgs e)
    {
        base.OnMouseWheel(e);var point=e.GetPosition(this);
        if(Keyboard.Modifiers.HasFlag(ModifierKeys.Control)){double anchor=viewStart+(point.X-LabelWidth)/pixelsPerFrame;pixelsPerFrame=Math.Clamp(pixelsPerFrame*Math.Pow(1.2,e.Delta/120.0),.002,24);viewStart=Math.Clamp(anchor-(point.X-LabelWidth)/pixelsPerFrame,0,1_000_000_000);}
        else if(Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))firstTrack=Math.Clamp(firstTrack-e.Delta/120,0,Math.Max(0,vm.TimelineTracks.Count-1));
        else viewStart=Math.Clamp(viewStart-e.Delta/pixelsPerFrame,0,1_000_000_000);InvalidateVisual();e.Handled=true;
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);if(e.Key==Key.Escape){Cancel();e.Handled=true;return;}
        if(downClip||panning||seeking)return;
        switch(e.Key)
        {
            case Key.Space:vm.TogglePlayback();break;
            case Key.Left:vm.StopPlayback();vm.PlayheadFrame-=Keyboard.Modifiers.HasFlag(ModifierKeys.Shift)?10:1;break;
            case Key.Right:vm.StopPlayback();vm.PlayheadFrame+=Keyboard.Modifiers.HasFlag(ModifierKeys.Shift)?10:1;break;
            case Key.Home:vm.StopPlayback();vm.PlayheadFrame=0;RevealPlayhead();break;
            case Key.I:vm.MarkInCommand.Execute(null);break;
            case Key.O:vm.MarkOutCommand.Execute(null);break;
            case Key.S:if(Keyboard.Modifiers==ModifierKeys.None&&vm.SplitClipCommand.CanExecute(null))vm.SplitClipCommand.Execute(null);else return;break;
            case Key.Delete:if(vm.CanEditClip)vm.DeleteClip(Keyboard.Modifiers.HasFlag(ModifierKeys.Shift));break;
            default:if(!vm.HandleShortcut(e.Key,Keyboard.Modifiers))return;break;
        }
        e.Handled=true;
    }
    public void RevealPlayhead(){viewStart=Math.Max(0,vm.PlayheadFrame-40/pixelsPerFrame);InvalidateVisual();}
    public void FitClips(){viewStart=0;pixelsPerFrame=Math.Clamp(Math.Max(1,ActualWidth-LabelWidth-40)/Math.Max(30,vm.TimelineEnd),.002,24);InvalidateVisual();}
    internal Point ClipPointForTest(ulong id,int part){var bounds=ClipBounds(vm.TimelineClips.First(c=>c.Id==id));return new Point(part==1?bounds.Left:part==2?bounds.Right:bounds.Left+Math.Min(bounds.Width/2,40),bounds.Top+bounds.Height/2);}
    internal void DragForTest(ulong id,int part,double deltaFrames,bool cancel=false)
    {
        vm.SelectClip(id);original=vm.SelectedClip!.Value;down=ClipPointForTest(id,part);originalMouseFrame=FrameAt(down.X);dragPart=part;downClip=true;
        UpdateDrag(new Point(down.X+deltaFrames*pixelsPerFrame,down.Y));if(cancel)Cancel();else{vm.EndGesture();editing=downClip=false;}
    }
    internal (ulong Id,int Part) HitForTest(Point point)=>Hit(point);
    internal void NavigateForTest(double first,double scale){viewStart=Math.Clamp(first,0,1_000_000_000);pixelsPerFrame=Math.Clamp(scale,.002,24);InvalidateVisual();}
}
