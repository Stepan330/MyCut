using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using System.Windows.Threading;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;
public sealed partial class SpatialWorkspace
{
    private readonly SpatialSettings spatial=SpatialSettings.Current;
    private double builtDepth=-1;
    internal sealed record Layer(FrameworkElement Content,AdornerDecorator Root,Viewport2DVisual3D Visual,Point Origin,double Width,double Height,double Depth);
    private readonly List<Layer> layers=[];
    private bool flying;
    private Point flyPointer;
    private readonly HashSet<Key> flyKeys=[];
    private readonly DispatcherTimer flyClock=new(){Interval=TimeSpan.FromMilliseconds(16)};
    private readonly Stopwatch flyTime=new();
    internal bool Flying=>flying;
    private void InitializeSpatialControls()
    {
        Focusable=true;Loaded+=(_,_)=>{spatial.PropertyChanged+=SpatialChanged;SpatialChanged(null,new(null));};
        Unloaded+=(_,_)=>{spatial.PropertyChanged-=SpatialChanged;StopFlying();foreach(var l in layers.ToArray())HideLayer(l);};
        PreviewMouseDown+=(_,e)=>{if(e.ChangedButton!=MouseButton.Right||!IsOverview||Keyboard.Modifiers.HasFlag(ModifierKeys.Alt))return;flying=true;flyPointer=e.GetPosition(this);Focus();CaptureMouse();flyTime.Restart();flyClock.Start();e.Handled=true;};
        PreviewMouseMove+=(_,e)=>{if(!flying)return;var p=e.GetPosition(this);spatial.CameraYaw+=(p.X-flyPointer.X)*spatial.Sensitivity;spatial.CameraPitch-=(p.Y-flyPointer.Y)*spatial.Sensitivity;flyPointer=p;e.Handled=true;};
        PreviewMouseUp+=(_,e)=>{if(flying&&e.ChangedButton==MouseButton.Right){StopFlying();ReleaseMouseCapture();e.Handled=true;}};
        LostMouseCapture+=(_,_)=>StopFlying();
        PreviewKeyDown+=(_,e)=>{if(flying&&e.Key is Key.W or Key.A or Key.S or Key.D or Key.Q or Key.E or Key.LeftShift or Key.RightShift){flyKeys.Add(e.Key);e.Handled=true;}};
        PreviewKeyUp+=(_,e)=>{if(flyKeys.Remove(e.Key))e.Handled=true;};
        PreviewMouseWheel+=(_,e)=>{if(flying){spatial.FlySpeed*=e.Delta>0?1.2:1/1.2;e.Handled=true;}};
        flyClock.Tick+=(_,_)=>{double dt=Math.Min(.05,flyTime.Elapsed.TotalSeconds);flyTime.Restart();MoveCamera((flyKeys.Contains(Key.D)?1:0)-(flyKeys.Contains(Key.A)?1:0),(flyKeys.Contains(Key.E)?1:0)-(flyKeys.Contains(Key.Q)?1:0),(flyKeys.Contains(Key.W)?1:0)-(flyKeys.Contains(Key.S)?1:0),dt,flyKeys.Contains(Key.LeftShift)||flyKeys.Contains(Key.RightShift));};
    }
    private void StopFlying(){flying=false;flyKeys.Clear();flyClock.Stop();flyTime.Stop();}
    private void SpatialChanged(object? sender,System.ComponentModel.PropertyChangedEventArgs e)
    {
        if(e.PropertyName is null or nameof(SpatialSettings.Depth)){builtDepth=-1;BuildDepth(ActualWidth/2,ActualHeight/2);}
        if(e.PropertyName is null or nameof(SpatialSettings.FieldOfView)){camera.FieldOfView=spatial.FieldOfView;distance=Math.Max(1,ActualWidth/2/Math.Tan(camera.FieldOfView*Math.PI/360));}
        if(e.PropertyName is null or nameof(SpatialSettings.PopupDepth))foreach(var l in layers.ToArray())UpdateLayerDepth(l);
        ApplyCamera();
    }
    private void Basis(out Vector3D forward,out Vector3D right,out Vector3D up){double y=spatial.CameraYaw*Math.PI/180,p=spatial.CameraPitch*Math.PI/180;forward=new Vector3D(Math.Sin(y)*Math.Cos(p),Math.Sin(p),-Math.Cos(y)*Math.Cos(p));right=Vector3D.CrossProduct(forward,new(0,1,0));right.Normalize();up=Vector3D.CrossProduct(right,forward);up.Normalize();}
    private void ApplyCamera(){Basis(out var forward,out _,out var up);camera.Position=new(spatial.CameraX,spatial.CameraY,Math.Max(400,distance*zoom+spatial.CameraZ));camera.LookDirection=forward;camera.UpDirection=up;}
    internal void MoveCamera(double x,double y,double z,double seconds,bool fast=false){Basis(out var f,out var r,out _);var delta=r*x+new Vector3D(0,1,0)*y+f*z;if(delta.LengthSquared>1)delta.Normalize();delta*=spatial.FlySpeed*seconds*(fast?3:1);spatial.CameraX+=delta.X;spatial.CameraY+=delta.Y;spatial.CameraZ+=delta.Z;}
    private void ResetCamera()=>spatial.ResetCamera();
    private Point ProjectPoint(Point local,double z){var p=pose.Transform(new Point3D(local.X-ActualWidth/2,ActualHeight/2-local.Y,z));var d=p-camera.Position;Basis(out var f,out var r,out var up);double focal=ActualWidth/2/Math.Tan(camera.FieldOfView*Math.PI/360),depth=Vector3D.DotProduct(d,f);if(depth<.01)return new Point(-100000,-100000);return new(ActualWidth/2+Vector3D.DotProduct(d,r)*focal/depth,ActualHeight/2-Vector3D.DotProduct(d,up)*focal/depth);}
    private (FrameworkElement Root,Point Origin,double Depth) Frame(DependencyObject element){foreach(var l in layers)if(l.Root==element||l.Root.IsAncestorOf(element))return(l.Root,l.Origin,l.Depth);if(surface is {} root&&(root==element||root.IsAncestorOf(element)))return(root,new(),0);throw new InvalidOperationException("Element is not on this spatial workspace");}
    internal bool OwnsElement(DependencyObject element)=>layers.Any(l=>l.Root==element||l.Root.IsAncestorOf(element))||surface is {} root&&(root==element||root.IsAncestorOf(element));
    internal Point ProjectElement(FrameworkElement element,Point point){var frame=Frame(element);var local=element==frame.Root?point:element.TransformToAncestor(frame.Root).Transform(point);return ProjectPoint(local+(Vector)frame.Origin,frame.Depth);}
    private Point UnprojectPoint(Point screen,double depth){Basis(out var f,out var r,out var u);double focal=ActualWidth/2/Math.Tan(camera.FieldOfView*Math.PI/360);var ray=f+r*((screen.X-ActualWidth/2)/focal)-u*((screen.Y-ActualHeight/2)/focal);var inverse=pose.Inverse!;var o=inverse.Transform(camera.Position);var end=inverse.Transform(camera.Position+ray);var direction=end-o;double t=(depth-o.Z)/direction.Z;var hit=o+direction*t;return new Point(hit.X+ActualWidth/2,ActualHeight/2-hit.Y);}
    internal Point UnprojectElement(FrameworkElement target,Point screen){var frame=Frame(target);var local=UnprojectPoint(screen,frame.Depth)-(Vector)frame.Origin;return target==frame.Root?local:target.TransformToAncestor(frame.Root).Inverse!.Transform(local);}
    internal Layer ShowLayer(FrameworkElement content,FrameworkElement anchor,Point offset)
    {
        var anchorFrame=Frame(anchor);var local=anchor==anchorFrame.Root?offset:anchor.TransformToAncestor(anchorFrame.Root).Transform(offset);local+=(Vector)anchorFrame.Origin;
        content.Measure(new Size(Math.Max(200,ActualWidth-24),Math.Max(100,ActualHeight-24)));double w=Math.Min(content.DesiredSize.Width,ActualWidth-24),h=Math.Min(content.DesiredSize.Height,ActualHeight-24);
        var origin=new Point(Math.Clamp(local.X,12,Math.Max(12,ActualWidth-w-12)),Math.Clamp(local.Y,12,Math.Max(12,ActualHeight-h-12)));
        var root=new AdornerDecorator{Child=content,Width=w,Height=h,ClipToBounds=true,Clip=new RectangleGeometry(new Rect(0,0,w,h))};AddLogicalChild(root);root.SetValue(OwnerProperty,this);root.Measure(new Size(w,h));root.Arrange(new Rect(0,0,w,h));
        var material=new DiffuseMaterial(Brushes.White);Viewport2DVisual3D.SetIsVisualHostMaterial(material,true);
        var visual=new Viewport2DVisual3D{Visual=root,Material=material,Transform=pose,CacheMode=new BitmapCache(1.5)};
        var layer=new Layer(content,root,visual,origin,w,h,Math.Min(600,spatial.PopupDepth*(layers.Count+1)));layers.Add(layer);UpdateLayerDepth(layer);
        // Clamp in projected screen space, not in unprojected layout coordinates.
        // Otherwise a displaced camera can put a newly opened menu off-screen.
        for(int attempt=0;attempt<3;++attempt){layer=layers[^1];var bounds=Rect.Empty;foreach(var corner in new[]{new Point(),new Point(w,0),new Point(w,h),new Point(0,h)})bounds.Union(ProjectPoint(layer.Origin+(Vector)corner,layer.Depth));double dx=bounds.Left<12?12-bounds.Left:bounds.Right>ActualWidth-12?ActualWidth-12-bounds.Right:0,dy=bounds.Top<12?12-bounds.Top:bounds.Bottom>ActualHeight-12?ActualHeight-12-bounds.Bottom:0;if(Math.Abs(dx)+Math.Abs(dy)<.1)break;var center=ProjectPoint(layer.Origin+new Vector(w/2,h/2),layer.Depth);var adjusted=UnprojectPoint(center+new Vector(dx,dy),layer.Depth)-new Vector(w/2,h/2);layer=layer with{Origin=adjusted};layers[^1]=layer;UpdateLayerDepth(layer);}
        viewport.Children.Add(visual);return layers[^1];
    }
    private void UpdateLayerDepth(Layer layer){int index=layers.IndexOf(layer);if(index<0)return;double z=Math.Min(600,spatial.PopupDepth*(index+1));var o=layer.Origin;double x=o.X-ActualWidth/2,y=ActualHeight/2-o.Y;layer.Visual.Geometry=new MeshGeometry3D{Positions=new Point3DCollection{new(x,y-layer.Height,z),new(x+layer.Width,y-layer.Height,z),new(x+layer.Width,y,z),new(x,y,z)},TextureCoordinates=new PointCollection{new(0,1),new(1,1),new(1,0),new(0,0)},TriangleIndices=new Int32Collection{0,1,2,0,2,3}};layers[index]=layer with{Depth=z};}
    internal void HideLayer(Layer layer){var current=layers.FirstOrDefault(l=>l.Visual==layer.Visual);if(current is null)return;viewport.Children.Remove(current.Visual);current.Visual.Visual=null;current.Root.Child=null;RemoveLogicalChild(current.Root);layers.Remove(current);}
}
