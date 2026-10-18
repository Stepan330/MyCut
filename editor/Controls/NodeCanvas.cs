using System.ComponentModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class NodeCanvas:FrameworkElement
{
    private const double WidthOfNode=208;
    private readonly EditorViewModel vm;
    private readonly MotionEngine motion;
    private readonly PointerIntentTracker tracker;
    private readonly DispatcherTimer timer=new(){Interval=TimeSpan.FromMilliseconds(33)};
    private readonly Dictionary<ulong,Vector> offsets=[];
    private readonly ZoneExpansionMemory zones=new();
    private double zoom=1,hotProgress;
    private Vector pan=new(20,20),panDown;
    private Point point,down,downWorld;
    private PointerIntent intent;
    private (ulong Id,int Port) hot,wire;
    private bool inside,panning,dragging,editing,wiring;
    private NativeNode original;
    private ulong dragOwner,observedOwner;
    public NodeCanvas(EditorViewModel model,MotionEngine animations,PointerIntentTracker pointer)
    {
        vm=model;motion=animations;tracker=pointer;Focusable=true;ClipToBounds=true;MinHeight=300;ProximityInput.SetOwnInput(this,true);
        Loaded+=(_,_)=>{observedOwner=vm.GraphOwner;vm.PropertyChanged+=Changed;InterfaceSettings.Current.PropertyChanged+=Changed;timer.Start();};
        Unloaded+=(_,_)=>{timer.Stop();Cancel();vm.PropertyChanged-=Changed;InterfaceSettings.Current.PropertyChanged-=Changed;motion.Cancel(this);};
        timer.Tick+=(_,_)=>{if(inside&&!IsMouseCaptured){intent=tracker.Snapshot(InterfaceSettings.Current.MaximumExpansion);Hover();}};
    }
    private void Changed(object? sender,PropertyChangedEventArgs e)
    {
        if(e.PropertyName is "Metrics" or "Status")return;
        if(observedOwner!=vm.GraphOwner){observedOwner=vm.GraphOwner;Cancel();motion.Cancel(this);zones.Clear();offsets.Clear();hot=default;}InvalidateVisual();
    }
    private Brush Brush(string name)=>TryFindResource(name) as Brush??Brushes.Gray;
    private static Brush TypeBrush(int type)=>new SolidColorBrush(type switch{0=>Color.FromRgb(205,213,226),1=>Color.FromRgb(250,186,84),3=>Color.FromRgb(192,145,249),_=>Color.FromRgb(76,212,209)});
    private Point Screen(Point world)=>new(world.X*zoom+pan.X,world.Y*zoom+pan.Y);
    private Point World(Point screen)=>new((screen.X-pan.X)/zoom,(screen.Y-pan.Y)/zoom);
    private Rect Bounds(NativeNode n,bool animated=false)
    {
        Vector offset=animated&&offsets.TryGetValue(n.Id,out var v)?v:default;var p=Screen(new Point(n.X,n.Y))+offset;
        return new Rect(p.X,p.Y,WidthOfNode*zoom,(62+Math.Max(1,NodeSchema.InputCount(n.Kind))*26)*zoom);
    }
    private Point Pin(NativeNode n,int port,bool animated=false)
    {
        var bounds=Bounds(n,animated);return new Point(port<0?bounds.Right:bounds.Left,bounds.Top+(49+Math.Max(0,port)*26)*zoom);
    }
    private void Text(DrawingContext dc,string text,Point at,Brush color,double width,double size=12)
    {
        var label=new FormattedText(text,CultureInfo.InvariantCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),Math.Max(8,size*zoom),color,VisualTreeHelper.GetDpi(this).PixelsPerDip){MaxTextWidth=Math.Max(1,width),MaxTextHeight=Math.Max(14,18*zoom),Trimming=TextTrimming.CharacterEllipsis};dc.DrawText(label,at);
    }
    private static void Cable(DrawingContext dc,Point start,Point end,Pen pen)
    {
        double bend=Math.Clamp(Math.Abs(end.X-start.X)*.5,45,180);var curve=new StreamGeometry();using(var ctx=curve.Open()){ctx.BeginFigure(start,false,false);ctx.BezierTo(new Point(start.X+bend,start.Y),new Point(end.X-bend,end.Y),end,true,false);}dc.DrawGeometry(null,pen,curve);
    }
    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);dc.DrawRectangle(Brush("CanvasBrush"),null,new Rect(RenderSize));double grid=32*zoom;var gridPen=new Pen(Brush("BorderBrush"),.4);
        for(double x=pan.X%grid;x<ActualWidth;x+=grid)dc.DrawLine(gridPen,new Point(x,0),new Point(x,ActualHeight));for(double y=pan.Y%grid;y<ActualHeight;y+=grid)dc.DrawLine(gridPen,new Point(0,y),new Point(ActualWidth,y));
        foreach(var node in vm.GraphNodes)for(int port=0;port<NodeSchema.InputCount(node.Kind);++port)if(node.Input(port)!=0)
        {
            var source=vm.GraphNodes.FirstOrDefault(n=>n.Id==node.Input(port));if(source.Id==0)continue;Cable(dc,Pin(source,-1,true),Pin(node,port,true),new Pen(TypeBrush(source.Type),2.3));
        }
        if(wiring){var n=vm.GraphNodes.FirstOrDefault(n=>n.Id==wire.Id);if(n.Id!=0){var origin=Pin(n,wire.Port,true);Cable(dc,wire.Port<0?origin:point,wire.Port<0?point:origin,new Pen(TypeBrush(wire.Port<0?n.Type:NodeSchema.InputType(n,wire.Port)),2.5));}}
        foreach(var n in vm.GraphNodes)
        {
            var bounds=Bounds(n,true);if(!bounds.IntersectsWith(new Rect(RenderSize)))continue;bool selected=n.Id==vm.SelectedNodeId;
            dc.DrawRoundedRectangle(Brush("PanelBrush"),new Pen(selected?Brush("AccentBrush"):Brush("BorderBrush"),selected?2:1),bounds,7,7);
            dc.DrawRoundedRectangle(Brush("RaisedBrush"),null,new Rect(bounds.Left+1,bounds.Top+1,bounds.Width-2,32*zoom),6,6);
            Text(dc,NodeSchema.Names[n.Kind],new Point(bounds.Left+12*zoom,bounds.Top+8*zoom),Brush("TextBrush"),bounds.Width-24*zoom,13);
            for(int port=-1;port<NodeSchema.InputCount(n.Kind);++port)
            {
                var logical=Pin(n,port);var shown=Pin(n,port,true);bool targeted=hot==(n.Id,port)||wiring&&wire==(n.Id,port);double strength=targeted?hotProgress:0;
                Vector pull=point-logical;if(pull.Length>8)pull*=8/pull.Length;shown+=pull*strength*InterfaceSettings.Current.MagnetStrength;
                double radius=4.5+3.5*strength;int type=port<0?n.Type:NodeSchema.InputType(n,port);dc.DrawEllipse(TypeBrush(type),new Pen(Brush("CanvasBrush"),1),shown,radius,radius);
                if(port>=0)Text(dc,NodeSchema.InputName(n.Kind,port),new Point(bounds.Left+12*zoom,logical.Y-7*zoom),Brush("MutedBrush"),bounds.Width*.5);
                else Text(dc,NodeSchema.Types[n.Type],new Point(bounds.Right-78*zoom,logical.Y-7*zoom),TypeBrush(n.Type),70*zoom,10);
                if(InterfaceSettings.Current.DebugZones&&inside){double r=Radius(logical,n.Id,port);if((logical-point).Length<r+70)dc.DrawEllipse(null,new Pen(TypeBrush(type),.8),logical,r,r);}
            }
            Text(dc,$"#{n.Id}"+(n.Id==vm.GraphOutput?" · ACTIVE OUTPUT":""),new Point(bounds.Left+12*zoom,bounds.Bottom-18*zoom),Brush("MutedBrush"),bounds.Width-24*zoom,9);
        }
        if(vm.GraphNodes.Count==0)Text(dc,"Select a layer and create a graph. Right-click or Tab to search for nodes.",new Point(24,40),Brush("MutedBrush"),ActualWidth-48,13);
        if(inside&&InterfaceSettings.Current.DebugPrediction){var end=point+intent.PredictedOffset(InterfaceSettings.Current.PredictionHorizon);dc.DrawLine(new Pen(Brush("AccentBrush"),1),point,end);dc.DrawEllipse(null,new Pen(Brush("AccentBrush"),1),end,6,6);}
    }
    private double Radius(Point target,ulong id,int port){var s=InterfaceSettings.Current;double desired=AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,(target-point).Length,s.MouseSpeedCoefficient,s.ZoneInfluenceDistance,s.SpeedThreshold,s.MaximumExpansion);return s.HandleRadius+zones.UpdateWithRate((id,port),desired,s.ZoneShrinkSpeed);}
    private bool Allowed(NativeNode n,int port)
    {
        if(!wiring)return true;if(n.Id==wire.Id)return false;var source=vm.GraphNodes.FirstOrDefault(n=>n.Id==wire.Id);
        return wire.Port<0?port>=0&&NodeSchema.Compatible(source.Type,NodeSchema.InputType(n,port)):port<0&&NodeSchema.Compatible(n.Type,NodeSchema.InputType(source,wire.Port));
    }
    private (ulong Id,int Port) HitPin(Point cursor)
    {
        if(vm.GraphNodes.Any(n=>new Rect(Bounds(n).Left,Bounds(n).Top,Bounds(n).Width,32*zoom).Contains(cursor)))return default;
        double best=double.PositiveInfinity;(ulong,int) target=default;
        foreach(var n in vm.GraphNodes.Reverse())for(int port=-1;port<NodeSchema.InputCount(n.Kind);++port){if(!Allowed(n,port))continue;var center=Pin(n,port);double score=(cursor-center).Length;double radius=Radius(center,n.Id,port);if(score<=radius&&score<best){target=(n.Id,port);best=score;}}
        return target;
    }
    private void Hover()
    {
        var next=HitPin(point);if(next!=hot){hot=next;motion.Spring(this,"port",hotProgress,next.Id!=0?1:0,.2,v=>{hotProgress=v;InvalidateVisual();});}
        Cursor=next.Id!=0?Cursors.Hand:Cursors.Arrow;InvalidateVisual();
    }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);inside=true;point=e.GetPosition(this);intent=tracker.ObserveScreen(SpatialCoordinates.ToScreen(this,point),VisualTreeHelper.GetDpi(this).DpiScaleX,InterfaceSettings.Current.MaximumExpansion);
        if(panning){pan=panDown+(point-down);InvalidateVisual();return;}if(wiring){Hover();return;}
        if(dragging)
        {
            if(!editing&&(point-down).Length<5)return;if(!editing){vm.BeginGesture();editing=true;}
            var position=World(point);var value=original;value.X=(float)Math.Clamp(original.X+position.X-downWorld.X,-100000,100000);value.Y=(float)Math.Clamp(original.Y+position.Y-downWorld.Y,-100000,100000);
            if(Keyboard.Modifiers.HasFlag(ModifierKeys.Control)){value.X=MathF.Round(value.X/16)*16;value.Y=MathF.Round(value.Y/16)*16;}
            try{vm.EditGraphNode(dragOwner,value);}catch(Exception ex){App.Log(ex);vm.Status=ex.Message;Cancel();if(vm.Smoke)throw;}return;
        }
        Hover();
    }
    protected override void OnMouseDown(MouseButtonEventArgs e)
    {
        base.OnMouseDown(e);Focus();point=down=e.GetPosition(this);downWorld=World(down);
        if(e.ChangedButton==MouseButton.Middle){panning=true;panDown=pan;CaptureMouse();e.Handled=true;return;}if(e.ChangedButton!=MouseButton.Left)return;
        intent=tracker.ObserveScreen(SpatialCoordinates.ToScreen(this,point),VisualTreeHelper.GetDpi(this).DpiScaleX,InterfaceSettings.Current.MaximumExpansion);hot=HitPin(point);
        if(hot.Id!=0&&vm.CanEdit)
        {
            vm.SelectNode(hot.Id);if(hot.Port>=0&&Keyboard.Modifiers.HasFlag(ModifierKeys.Alt)){vm.LinkGraphNode(0,hot.Id,hot.Port);e.Handled=true;return;}
            wire=hot;wiring=true;CaptureMouse();e.Handled=true;return;
        }
        NativeNode body=default;double bestBody=double.PositiveInfinity;var policy=InterfaceSettings.Current;
        foreach(var n in vm.GraphNodes.Reverse())
        {
            double distance=ProximityInput.Distance(point,Bounds(n));double extra=AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,distance,policy.MouseSpeedCoefficient,policy.ZoneInfluenceDistance,policy.SpeedThreshold,policy.MaximumExpansion);
            if(distance<=policy.HandleRadius+zones.UpdateWithRate((n.Id,99),extra,policy.ZoneShrinkSpeed)&&distance<bestBody){bestBody=distance;body=n;}
        }
        if(body.Id!=0)
        {
            var n=body;
            vm.SelectNode(n.Id);if(vm.CanEdit&&point.Y<Bounds(n).Top+34*zoom){original=n;dragOwner=vm.GraphOwner;dragging=true;CaptureMouse();}e.Handled=true;return;
        }
        vm.SelectNode(0);e.Handled=true;
    }
    protected override void OnMouseUp(MouseButtonEventArgs e)
    {
        base.OnMouseUp(e);point=e.GetPosition(this);if(e.ChangedButton==MouseButton.Right&&!IsMouseCaptured){Palette(point);e.Handled=true;return;}
        bool wasWire=wiring;var from=wire;var target=wasWire?HitPin(point):default;bool moved=editing;
        if(editing)vm.EndGesture();editing=dragging=panning=wiring=false;ReleaseMouseCapture();
        if(wasWire&&(point-down).Length>=5)
        {
            if(target.Id!=0){if(from.Port<0)vm.LinkGraphNode(from.Id,target.Id,target.Port);else vm.LinkGraphNode(target.Id,from.Id,from.Port);}
            else Palette(point,from);
        }
        if(moved&&vm.SelectedNode is {} n)
        {
            double amplitude=Math.Min(8,intent.Speed*.003);var id=n.Id;
            motion.Kick(this,$"node{id}x",intent.Direction.X*amplitude,.3,v=>{offsets.TryGetValue(id,out var old);offsets[id]=new Vector(v,old.Y);InvalidateVisual();});motion.Kick(this,$"node{id}y",intent.Direction.Y*amplitude,.3,v=>{offsets.TryGetValue(id,out var old);offsets[id]=new Vector(old.X,v);InvalidateVisual();});
        }
        Hover();e.Handled=true;
    }
    private void Cancel(){bool revert=editing;editing=dragging=wiring=panning=false;if(IsMouseCaptured)ReleaseMouseCapture();if(revert)vm.CancelGesture();InvalidateVisual();}
    protected override void OnLostMouseCapture(MouseEventArgs e){base.OnLostMouseCapture(e);if(editing||dragging||wiring||panning)Cancel();}
    protected override void OnMouseLeave(MouseEventArgs e){base.OnMouseLeave(e);inside=false;if(!IsMouseCaptured){hot=default;motion.Spring(this,"port",hotProgress,0,.2,v=>{hotProgress=v;InvalidateVisual();});}}
    protected override void OnMouseWheel(MouseWheelEventArgs e)
    {
        base.OnMouseWheel(e);if(IsMouseCaptured)return;var cursor=e.GetPosition(this);var anchor=World(cursor);zoom=Math.Clamp(zoom*Math.Pow(1.15,e.Delta/120.0),.25,2.5);pan=new Vector(cursor.X-anchor.X*zoom,cursor.Y-anchor.Y*zoom);InvalidateVisual();e.Handled=true;
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);if(e.Key==Key.Escape){Cancel();e.Handled=true;return;}if(IsMouseCaptured)return;
        if(e.Key==Key.Tab||e.Key==Key.Space&&Keyboard.Modifiers.HasFlag(ModifierKeys.Control)){Palette(point);e.Handled=true;}
        else if(e.Key==Key.Delete){vm.DeleteGraphNode();e.Handled=true;}
        else if(e.Key==Key.F){Fit();e.Handled=true;}
        else if(Keyboard.Modifiers==ModifierKeys.Control&&e.Key==Key.D){vm.DuplicateGraphNode();e.Handled=true;}
        else if(Keyboard.Modifiers==ModifierKeys.Control&&e.Key is Key.Z or Key.Y){vm.HandleShortcut(e.Key,Keyboard.Modifiers);e.Handled=true;}
    }
    private void Palette(Point location,(ulong Id,int Port) connection=default)
    {
        if(!vm.CanEdit)return;var world=World(location);var menu=new SpatialFlyout{PlacementTarget=this,Placement=System.Windows.Controls.Primitives.PlacementMode.RelativePoint,HorizontalOffset=location.X,VerticalOffset=location.Y,StaysOpen=false};
        var box=new StackPanel{Width=245};var search=new TextBox{Margin=new Thickness(0,0,0,8)};var list=new ListBox{MaxHeight=330,DisplayMemberPath="Name"};box.Children.Add(search);box.Children.Add(list);var chrome=new Border{Child=box,Padding=new Thickness(10),BorderThickness=new Thickness(1)};chrome.SetResourceReference(Border.BackgroundProperty,"PanelBrush");chrome.SetResourceReference(Border.BorderBrushProperty,"BorderBrush");menu.Child=chrome;
        var possible=new List<(int Kind,string Name)>();var origin=vm.GraphNodes.FirstOrDefault(n=>n.Id==connection.Id);
        for(int kind=0;kind<NodeSchema.Names.Length;++kind)
        {
            int type=kind==1?0:kind==2?1:kind==6?3:2;var candidate=new NativeNode{Kind=kind,Type=kind is >=3 and <=5?(connection.Port<0?origin.Type:NodeSchema.InputType(origin,connection.Port)):type};
            bool allowed=connection.Id==0||connection.Port<0&&Enumerable.Range(0,NodeSchema.InputCount(kind)).Any(p=>NodeSchema.Compatible(origin.Type,NodeSchema.InputType(candidate,p)))||connection.Port>=0&&NodeSchema.Compatible(candidate.Type,NodeSchema.InputType(origin,connection.Port));
            if(allowed)possible.Add((kind,NodeSchema.Names[kind]));
        }
        void Filter(){list.ItemsSource=possible.Where(n=>n.Name.Contains(search.Text,StringComparison.OrdinalIgnoreCase)).Select(n=>new PaletteItem(n.Kind,n.Name)).ToArray();list.SelectedIndex=0;}
        void Create()
        {
            if(list.SelectedItem is not PaletteItem item)return;
            if(vm.AddLinkedGraphNode(item.Kind,world.X,world.Y,connection.Id,connection.Port)!=0)menu.IsOpen=false;
        }
        search.TextChanged+=(_,_)=>Filter();list.MouseDoubleClick+=(_,_)=>Create();search.PreviewKeyDown+=(_,e)=>{if(e.Key==Key.Enter){Create();e.Handled=true;}else if(e.Key==Key.Down){list.Focus();e.Handled=true;}};list.KeyDown+=(_,e)=>{if(e.Key==Key.Enter){Create();e.Handled=true;}};
        SpatialCoordinates.AnchorPopup(menu,this,location);
        ProximityInput? zones=null;menu.Opened+=(_,_)=>{zones=new ProximityInput(chrome,tracker);search.Focus();};menu.Closed+=(_,_)=>zones?.Dispose();MotionBehavior.SetEngine(chrome,motion);Filter();menu.IsOpen=true;
    }
    private sealed record PaletteItem(int Kind,string Name);
    public void OpenPalette()=>Palette(new Point(Math.Max(24,ActualWidth*.3),Math.Max(24,ActualHeight*.25)));
    public void Fit()
    {
        if(vm.GraphNodes.Count==0){zoom=1;pan=new Vector(20,20);InvalidateVisual();return;}double left=vm.GraphNodes.Min(n=>n.X),top=vm.GraphNodes.Min(n=>n.Y),right=vm.GraphNodes.Max(n=>n.X+WidthOfNode),bottom=vm.GraphNodes.Max(n=>n.Y+140);
        zoom=Math.Clamp(Math.Min(Math.Max(1,ActualWidth-50)/(right-left),Math.Max(1,ActualHeight-50)/(bottom-top)),.25,1.3);pan=new Vector(25-left*zoom,25-top*zoom);InvalidateVisual();
    }
    internal Point PinPointForTest(ulong id,int port)=>Pin(vm.GraphNodes.First(n=>n.Id==id),port);
    internal (ulong Id,int Port) HitForTest(Point cursor){point=cursor;intent=default;return HitPin(cursor);}
}
