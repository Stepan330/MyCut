using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using MyCut.Editor.Motion;
using System.Windows.Documents;

namespace MyCut.Editor.Controls;

// Live controls, including the shared GPU canvas, inhabit an interactive 3D surface.
// The document is independent of this presentation camera.
[ContentProperty(nameof(SurfaceContent))]
public sealed partial class SpatialWorkspace:Decorator
{
    public static readonly DependencyProperty OwnerProperty=DependencyProperty.RegisterAttached("Owner",typeof(SpatialWorkspace),typeof(SpatialWorkspace),new FrameworkPropertyMetadata(null,FrameworkPropertyMetadataOptions.Inherits));
    public static SpatialWorkspace? GetOwner(DependencyObject value)=>(SpatialWorkspace?)value.GetValue(OwnerProperty);
    private readonly Viewport3D viewport=new(){ClipToBounds=true};
    private readonly PerspectiveCamera camera=new(){FieldOfView=40,NearPlaneDistance=.1,FarPlaneDistance=100000};
    private readonly MeshGeometry3D mesh=new(){TextureCoordinates=new PointCollection{new(0,1),new(1,1),new(1,0),new(0,0)},TriangleIndices=new Int32Collection{0,1,2,0,2,3}};
    private readonly Viewport2DVisual3D front;
    private readonly AdornerDecorator surfaceHost=new(){ClipToBounds=true};
    private readonly AxisAngleRotation3D yawRotation=new(new Vector3D(0,1,0),0),pitchRotation=new(new Vector3D(1,0,0),0);
    private readonly Transform3DGroup pose=new();
    // Presentation-only geometry: no document objects and no extra native render passes.
    private readonly ModelVisual3D depthVisual=new();
    private readonly Model3DGroup depthModels=new();
    private Size depthSize;
    private readonly RadialGradientBrush backdrop=new(Color.FromRgb(22,43,62),Color.FromRgb(3,9,17)){RadiusX=.8,RadiusY=.9,Center=new Point(.5,.45),GradientOrigin=new Point(.5,.45)};
    private MotionEngine? motion;
    private FrameworkElement? surface;
    private Point orbitDown;
    private double orbitYaw,orbitPitch,yaw,pitch,zoom=1,distance;
    private bool orbiting;
    public bool IsOverview{get;private set;}
    public FrameworkElement? SurfaceContent{get=>surface;set{surface=value;if(value is not null)value.SetValue(OwnerProperty,this);surfaceHost.Child=value;front.Visual=surfaceHost;InvalidateMeasure();}}
    public SpatialWorkspace()
    {
        SpatialCoordinates.Initialize();
        var material=new DiffuseMaterial(Brushes.White);Viewport2DVisual3D.SetIsVisualHostMaterial(material,true);
        pose.Children.Add(new RotateTransform3D(yawRotation));pose.Children.Add(new RotateTransform3D(pitchRotation));
        front=new Viewport2DVisual3D{Geometry=mesh,Material=material,Transform=pose,CacheMode=new BitmapCache(1.5){SnapsToDevicePixels=true}};
        var light=new ModelVisual3D{Content=new AmbientLight(Colors.White)};viewport.Children.Add(light);
        depthVisual.Content=depthModels;depthVisual.Transform=pose;viewport.Children.Add(depthVisual);
        viewport.Children.Add(front);viewport.Camera=camera;Child=viewport;
        InitializeSpatialControls();
        PreviewMouseDown+=(_,e)=>{if(e.ChangedButton==MouseButton.Right&&Keyboard.Modifiers.HasFlag(ModifierKeys.Alt)){motion?.Cancel(this);orbiting=true;IsOverview=true;orbitDown=e.GetPosition(this);orbitYaw=yaw;orbitPitch=pitch;CaptureMouse();e.Handled=true;}};
        PreviewMouseMove+=(_,e)=>{if(!orbiting)return;var p=e.GetPosition(this);yaw=Math.Clamp(orbitYaw+(p.X-orbitDown.X)*.08,-35,35);pitch=Math.Clamp(orbitPitch-(p.Y-orbitDown.Y)*.08,-25,25);UpdatePose();e.Handled=true;};
        PreviewMouseUp+=(_,e)=>{if(orbiting&&e.ChangedButton==MouseButton.Right){orbiting=false;ReleaseMouseCapture();e.Handled=true;}};
        LostMouseCapture+=(_,_)=>orbiting=false;
        PreviewMouseWheel+=(_,e)=>{if(!Keyboard.Modifiers.HasFlag(ModifierKeys.Alt))return;motion?.Cancel(this,"zoom");zoom=Math.Clamp(zoom*(e.Delta>0?.94:1.06),.85,1.8);UpdatePose();e.Handled=true;};
        PreviewKeyDown+=(_,e)=>{if(e.Key==Key.F6){ToggleOverview();e.Handled=true;}else if(e.Key==Key.F7){SetView(false);e.Handled=true;}};
    }
    public void AttachMotion(MotionEngine animations)=>motion=animations;
    protected override void OnRender(DrawingContext dc){base.OnRender(dc);dc.DrawRectangle(backdrop,null,new Rect(RenderSize));}
    public void ToggleOverview()=>SetView(!IsOverview);
    internal void SetView(bool overview,bool animate=true)
    {
        if(!animate)motion?.Cancel(this);
        if(!overview)ResetCamera();
        IsOverview=overview;
        void Animate(string channel,double from,double to,Action<double> set){if(animate&&motion is not null)motion.Animate(this,channel,from,to,.25,set);else set(to);}
        Animate("yaw",yaw,overview?-12:0,v=>{yaw=v;UpdatePose();});Animate("pitch",pitch,overview?7:0,v=>{pitch=v;UpdatePose();});Animate("zoom",zoom,overview?1.16:1,v=>{zoom=v;UpdatePose();});
    }
    protected override Size MeasureOverride(Size available)
    {
        double w=double.IsFinite(available.Width)?available.Width:1280,h=double.IsFinite(available.Height)?available.Height:720;
        surfaceHost.Width=w;surfaceHost.Height=h;
        if(surface is not null){surface.Width=w;surface.Height=h;}
        surfaceHost.Measure(new Size(w,h));
        viewport.Measure(new Size(w,h));return new Size(w,h);
    }
    protected override Size ArrangeOverride(Size final)
    {
        surfaceHost.Arrange(new Rect(final));viewport.Arrange(new Rect(final));
        surfaceHost.Clip=new RectangleGeometry(new Rect(final));
        double w=final.Width/2,h=final.Height/2;
        mesh.Positions=new Point3DCollection{new(-w,-h,0),new(w,-h,0),new(w,h,0),new(-w,h,0)};
        BuildDepth(w,h);
        if(front.CacheMode is BitmapCache cache)cache.RenderAtScale=Math.Clamp(2048/Math.Max(1,Math.Max(final.Width,final.Height)),1,1.5);
        distance=Math.Max(1,w/Math.Tan(camera.FieldOfView*Math.PI/360));foreach(var layer in layers.ToArray())UpdateLayerDepth(layer);UpdatePose();return final;
    }
    private void UpdatePose(){yawRotation.Angle=yaw;pitchRotation.Angle=pitch;ApplyCamera();}
    private void BuildDepth(double w,double h)
    {
        var size=new Size(w,h);if(size==depthSize&&builtDepth==spatial.Depth)return;depthSize=size;builtDepth=spatial.Depth;
        depthModels.Children.Clear();
        void Quad(Point3D a,Point3D b,Point3D c,Point3D d,Brush brush){
            var geometry=new MeshGeometry3D{Positions=new Point3DCollection{a,b,c,d},TriangleIndices=new Int32Collection{0,1,2,0,2,3},TextureCoordinates=new PointCollection{new(0,1),new(1,1),new(1,0),new(0,0)}};
            geometry.Freeze();var material=new DiffuseMaterial(brush);material.Freeze();
            var model=new GeometryModel3D(geometry,material){BackMaterial=material};model.Freeze();depthModels.Children.Add(model);
        }
        void Plane(double x,double y,double z,Brush brush)=>Quad(new(-x,-y,z),new(x,-y,z),new(x,y,z),new(-x,y,z),brush);
        // Soft cast shadow is behind the entire interface, never over its text or canvas.
        var shadow=new RadialGradientBrush();shadow.GradientStops.Add(new GradientStop(Color.FromArgb(180,0,0,0),.65));shadow.GradientStops.Add(new GradientStop(Color.FromArgb(0,0,0,0),1));shadow.RadiusX=.5;shadow.RadiusY=.5;shadow.Freeze();
        Plane(w+100,h+100,-42,shadow);
        double thickness=spatial.Depth;
        Plane(w+1,h+1,-thickness,new SolidColorBrush(Color.FromRgb(11,23,35)));
        Quad(new(-w,-h,0),new(-w,-h,-thickness),new(-w,h,-thickness),new(-w,h,0),new SolidColorBrush(Color.FromRgb(30,59,77)));
        Quad(new(w,-h,0),new(w,h,0),new(w,h,-thickness),new(w,-h,-thickness),new SolidColorBrush(Color.FromRgb(13,31,47)));
        Quad(new(-w,h,0),new(-w,h,-thickness),new(w,h,-thickness),new(w,h,0),new SolidColorBrush(Color.FromRgb(53,83,101)));
        Quad(new(-w,-h,0),new(w,-h,0),new(w,-h,-thickness),new(-w,-h,-thickness),new SolidColorBrush(Color.FromRgb(9,21,34)));
        // A second, recessed plane supplies real perspective/parallax cues in overview.
        var grid=new SolidColorBrush(Color.FromArgb(35,86,142,166));grid.Freeze();
        for(double x=-w-160;x<=w+160;x+=64)Quad(new(x-.35,-h-160,-115),new(x+.35,-h-160,-115),new(x+.35,h+160,-115),new(x-.35,h+160,-115),grid);
        for(double y=-h-160;y<=h+160;y+=64)Quad(new(-w-160,y-.35,-115),new(w+160,y-.35,-115),new(w+160,y+.35,-115),new(-w-160,y+.35,-115),grid);
    }
    internal Point ProjectSurface(Point local)
    {
        return ProjectPoint(local,0);
    }
    internal Point? SurfacePoint(Point projected)
    {
        Point? result=null;
        VisualTreeHelper.HitTest(viewport,null,r=>{
            if(r is RayMeshGeometry3DHitTestResult hit&&hit.VisualHit==front){var uv=mesh.TextureCoordinates;var a=uv[hit.VertexIndex1];var b=uv[hit.VertexIndex2];var c=uv[hit.VertexIndex3];result=new Point((a.X*hit.VertexWeight1+b.X*hit.VertexWeight2+c.X*hit.VertexWeight3)*ActualWidth,(a.Y*hit.VertexWeight1+b.Y*hit.VertexWeight2+c.Y*hit.VertexWeight3)*ActualHeight);return HitTestResultBehavior.Stop;}
            return HitTestResultBehavior.Continue;
        },new PointHitTestParameters(projected));
        return result;
    }
}
