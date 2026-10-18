using System.Runtime.InteropServices;
using System.Text;
using MyCut.Editor.Controls;

namespace MyCut.Editor.Services;
public sealed class SceneItem
{
    public ulong Id { get; init; }
    public ulong Definition { get; init; }
    public string Name { get; init; } = "";
    public string DefinitionName { get; init; } = "";
    public string Identity => $"INSTANCE {Id:000}  /  DEF {Definition:000}";
    public float X, Y, ScaleX, ScaleY, Rotation, Opacity, Red, Green, Blue;
    public bool Visible;
    public bool Locked;
    public NativeContent Content;
    public NativeGrade Grade;
    public string Text="",Font="Segoe UI",Source="";
    public double MediaDuration;
}
public sealed record TimelineTrack(NativeTrack Value,string Name){public ulong Id=>Value.Id;public bool Locked=>Value.Locked!=0;public bool Muted=>Value.Muted!=0;}
public sealed class NativeSession : IDisposable
{
    private IntPtr handle = NativeMethods.mc_create();
    public NativeSession() { if (handle == IntPtr.Zero) throw new InvalidOperationException("Cannot create MyCut engine session."); }
    private void Check(int result)
    {
        if (result == 0) throw new InvalidOperationException(Marshal.PtrToStringUni(NativeMethods.mc_error(handle)) ?? "MyCut engine error");
    }
    public List<SceneItem> Items()
    {
        var items = new List<SceneItem>();
        for (int n = 0; n < NativeMethods.mc_count(handle); ++n)
        {
            Check(NativeMethods.mc_item(handle, n, out var i));
            var name = Marshal.PtrToStringUni(NativeMethods.mc_name(handle, i.Id, 0)) ?? "";
            var definitionName = Marshal.PtrToStringUni(NativeMethods.mc_name(handle, i.Definition, 1)) ?? "";
            Check(NativeMethods.mc_content_get(handle,i.Definition,out var content));
            Check(NativeMethods.mc_grade_get(handle,i.Id,out var grade));
            string text=Marshal.PtrToStringUni(NativeMethods.mc_content_string(handle,i.Definition,0))??"";
            string font=Marshal.PtrToStringUni(NativeMethods.mc_content_string(handle,i.Definition,1))??"Segoe UI";
            string source=Marshal.PtrToStringUni(NativeMethods.mc_content_string(handle,i.Definition,2))??"";
            Check(NativeMethods.mc_media_info(handle,i.Definition,out var duration,out _,out _));
            items.Add(new SceneItem { Id = i.Id, Definition = i.Definition, Name = name, DefinitionName = definitionName,
                X = i.X, Y = i.Y, ScaleX = i.ScaleX, ScaleY = i.ScaleY, Rotation = i.Rotation, Opacity = i.Opacity,
                Red = i.Red, Green = i.Green, Blue = i.Blue, Visible = i.Visible != 0,Locked=i.Locked!=0,Content=content,Grade=grade,Text=text,Font=font,Source=source,MediaDuration=duration });
        }
        return items;
    }
    public void Attach(IntPtr hwnd, bool software) => Check(NativeMethods.mc_attach(handle, hwnd, software ? 1 : 0));
    public void Detach() { if (handle != IntPtr.Zero) Check(NativeMethods.mc_detach(handle)); }
    public IntPtr Surface(int width,int height){Check(NativeMethods.mc_surface(handle,width,height,out var surface));return surface;}
    public void CopyFrame(byte[] pixels)=>Check(NativeMethods.mc_frame_pixels(handle,pixels,pixels.Length));
    public void Render(int width, int height, ulong selected, ulong maskNode=0)
    {
        Check(NativeMethods.mc_mask_preview(handle,maskNode));
        Check(NativeMethods.mc_render(handle,width,height,selected));
    }
    public bool Pending=>NativeMethods.mc_pending(handle)>0;
    public void Transform(SceneItem i) => Check(NativeMethods.mc_transform(handle, i.Id, i.X, i.Y, i.ScaleX, i.ScaleY, i.Rotation, i.Opacity, i.Visible ? 1 : 0));
    public void Tint(SceneItem i) => Check(NativeMethods.mc_tint(handle, i.Definition, i.Red, i.Green, i.Blue));
    public ulong Add(int kind){ulong id=NativeMethods.mc_add(handle,kind);if(id==0)Check(0);return id;}
    public void Content(SceneItem item)=>Check(NativeMethods.mc_content_set(handle,item.Definition,in item.Content,item.Text,item.Font));
    public void Layer(ulong instance,int operation,string name="")=>Check(NativeMethods.mc_layer(handle,instance,operation,name));
    public void Grade(SceneItem item)=>Check(NativeMethods.mc_grade_set(handle,item.Id,in item.Grade));
    public ImageFrame ScopeFrame()
    {
        Check(NativeMethods.mc_scope_frame(handle,null,0,out var width,out var height));var pixels=new byte[width*height*4];
        Check(NativeMethods.mc_scope_frame(handle,pixels,pixels.Length,out width,out height));return new ImageFrame(width,height,pixels);
    }
    public string SampleColor(float x,float y){Check(NativeMethods.mc_sample_color(handle,x,y,out var r,out var g,out var b));return $"#FF{(byte)Math.Round(r*255):X2}{(byte)Math.Round(g*255):X2}{(byte)Math.Round(b*255):X2}";}
    public void Gesture(bool begin) => Check(NativeMethods.mc_gesture(handle, begin ? 1 : 0));
    public void Undo(bool redo = false) => Check(NativeMethods.mc_undo(handle, redo ? 1 : 0));
    public bool CanUndo => NativeMethods.mc_history(handle, 0) != 0;
    public bool CanRedo => NativeMethods.mc_history(handle, 1) != 0;
    public ulong Duplicate(ulong id) { ulong result = NativeMethods.mc_duplicate(handle, id); if (result == 0) Check(0); return result; }
    public void Remove(ulong id) => Check(NativeMethods.mc_remove(handle, id));
    public void Reset() => Check(NativeMethods.mc_reset(handle));
    public void New() => Check(NativeMethods.mc_new(handle));
    public void Workbench() => Check(NativeMethods.mc_workbench(handle));
    public void Save(string path) => Check(NativeMethods.mc_save(handle, path));
    public void Load(string path) => Check(NativeMethods.mc_load(handle, path));
    public ulong Import(string path) { ulong result = NativeMethods.mc_import(handle, path); if (result == 0) Check(0); return result; }
    public ulong ImportVideo(string path){var id=NativeMethods.mc_import_video(handle,path);if(id==0)Check(0);return id;}
    public (int Num,int Den,long In,long Out) TimelineInfo(){Check(NativeMethods.mc_timeline_info(handle,out var n,out var d,out var i,out var o));return(n,d,i,o);}
    public List<TimelineTrack> Tracks(){var result=new List<TimelineTrack>();for(int n=0;n<NativeMethods.mc_track_count(handle);++n){Check(NativeMethods.mc_track_get(handle,n,out var t));result.Add(new(t,Marshal.PtrToStringUni(NativeMethods.mc_track_name(handle,t.Id))??"Track"));}return result;}
    public List<NativeClip> Clips(){var result=new List<NativeClip>();for(int n=0;n<NativeMethods.mc_clip_count(handle);++n){Check(NativeMethods.mc_clip_get(handle,n,out var c));result.Add(c);}return result;}
    public ulong AddTrack(string name){var id=NativeMethods.mc_track_add(handle,name);if(id==0)Check(0);return id;}
    public ulong AddClip(ulong instance,ulong track,long start,long duration){var id=NativeMethods.mc_clip_add(handle,instance,track,start,duration);if(id==0)Check(0);return id;}
    public void SetClip(NativeClip value)=>Check(NativeMethods.mc_clip_set(handle,in value));
    public ulong SplitClip(ulong id,long frame){var result=NativeMethods.mc_clip_split(handle,id,frame);if(result==0)Check(0);return result;}
    public void RemoveClip(ulong id,bool ripple=false)=>Check(NativeMethods.mc_clip_remove(handle,id,ripple?1:0));
    public void SetTrack(NativeTrack value)=>Check(NativeMethods.mc_track_set(handle,in value));
    public void SetRange(long rangeIn,long rangeOut)=>Check(NativeMethods.mc_timeline_range(handle,rangeIn,rangeOut));
    public void Preview(bool enabled,long frame)=>Check(NativeMethods.mc_timeline_preview(handle,enabled?1:0,frame));
    // Snapshot on the UI thread; the encoder owns an independent session/renderer on its worker.
    public string ProjectText=>Marshal.PtrToStringUni(NativeMethods.mc_project_text(handle))??throw new InvalidOperationException("Cannot snapshot project");
    public (bool Enabled,ulong Output) GraphInfo(ulong owner){Check(NativeMethods.mc_graph_info(handle,owner,out var enabled,out var output));return(enabled!=0,output);}
    public List<NativeNode> Nodes(ulong owner){int count=NativeMethods.mc_node_count(handle,owner);if(count<0)Check(0);var nodes=new List<NativeNode>();for(int n=0;n<count;++n){Check(NativeMethods.mc_node_get(handle,owner,n,out var node));nodes.Add(node);}return nodes;}
    public void InitializeGraph(ulong owner,bool example=false)=>Check(NativeMethods.mc_graph_init(handle,owner,example?1:0));
    public void EnableGraph(ulong owner,bool enabled)=>Check(NativeMethods.mc_graph_enabled(handle,owner,enabled?1:0));
    public ulong AddNode(ulong owner,int kind,float x,float y){var id=NativeMethods.mc_node_add(handle,owner,kind,x,y);if(id==0)Check(0);return id;}
    public void SetNode(ulong owner,NativeNode node)=>Check(NativeMethods.mc_node_set(handle,owner,in node));
    public void RemoveNode(ulong owner,ulong id)=>Check(NativeMethods.mc_node_remove(handle,owner,id));
    public void ConnectNode(ulong owner,ulong source,ulong target,int port)=>Check(NativeMethods.mc_node_connect(handle,owner,source,target,port));
    public static Task ExportMovieAsync(string snapshot,string path,long first,long count,bool software,IProgress<double>? progress,CancellationToken cancel)=>Task.Run(()=>
    {
        var error=new StringBuilder(2048);NativeMethods.ExportProgress callback=(done,total)=>{progress?.Report((double)done/total);return cancel.IsCancellationRequested?0:1;};
        int result=NativeMethods.mc_movie_export(snapshot,path,first,count,software?1:0,callback,error,error.Capacity);GC.KeepAlive(callback);
        if(result==0){cancel.ThrowIfCancellationRequested();throw new InvalidOperationException(error.ToString());}
    });
    public void Export(string path, bool viewport = false) => Check(NativeMethods.mc_export(handle, path, viewport ? 1 : 0));
    public ulong Pick(float x, float y) => NativeMethods.mc_pick(handle, x, y);
    public string Stats => Marshal.PtrToStringUni(NativeMethods.mc_stats(handle)) ?? "";
    public void Feedback(ulong hovered, double selection, double hover, int hoveredHandle = -1) => Check(NativeMethods.mc_feedback(handle, hovered, (float)selection, (float)hover, hoveredHandle));
    public void EditingText(ulong instance)=>Check(NativeMethods.mc_editing_text(handle,instance));
    public void InputStyle(float x,float y,PointerIntent intent,bool inside=true,ulong settleId=0,double settleX=0,double settleY=0)
    {
        ZonePolicy(inside?intent:default);
        var s=InterfaceSettings.Current;var color=(System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(s.Accent);
        float Linear(byte c){float v=c/255f;return v<=.04045f?v/12.92f:MathF.Pow((v+.055f)/1.055f,2.4f);}
        var style=new NativeInputStyle{HandleRadius=(float)s.HandleRadius,ObjectMargin=(float)s.HandleRadius,HandleSize=(float)s.HandleSize,FrameWidth=2.4f,
            PointerX=inside?x:-10000,PointerY=inside?y:-10000,DirectionX=inside?(float)intent.Direction.X:0,DirectionY=inside?(float)intent.Direction.Y:0,Expansion=inside?(float)intent.Expansion:0,Speed=inside?(float)intent.Speed:0,
            Magnet=(float)s.MagnetStrength,Horizon=(float)s.PredictionHorizon,Red=Linear(color.R),Green=Linear(color.G),Blue=Linear(color.B),
            DebugFlags=(s.DebugZones?1:0)|(s.DebugConflicts?2:0)|(s.DebugPrediction&&inside?4:0)|(s.ReducedMotion||s.MotionStrength==0||!System.Windows.SystemParameters.ClientAreaAnimation?8:0),SettleId=settleId,SettleX=(float)settleX,SettleY=(float)settleY};
        Check(NativeMethods.mc_input_style(handle,in style));
    }
    public (ulong Id, int Tool, int Handle, float Distance) Hit(ulong selected, float x, float y, float dipsPerUnit, PointerIntent intent = default)
    {
        ZonePolicy(intent);
        Check(NativeMethods.mc_hit(handle, selected, x, y, dipsPerUnit, (float)intent.Direction.X, (float)intent.Direction.Y, (float)intent.Expansion, out var hit)); return (hit.Id, hit.Tool, hit.Handle, hit.Distance);
    }
    public void CancelGesture() => Check(NativeMethods.mc_gesture(handle, 2));
    public ulong Pointer(int phase, ulong selected, float x, float y, float pixelsPerUnit, bool shift, PointerIntent intent = default)
    {
        ZonePolicy(intent);
        Check(NativeMethods.mc_pointer(handle, phase, selected, x, y, pixelsPerUnit, (float)intent.Direction.X, (float)intent.Direction.Y, (float)intent.Expansion, shift ? 1 : 0, out var result)); return result;
    }
    public int Tool(ulong selected, float x, float y, float pixelsPerUnit) => NativeMethods.mc_tool(handle, selected, x, y, pixelsPerUnit);
    private void ZonePolicy(PointerIntent intent){var s=InterfaceSettings.Current;Check(NativeMethods.mc_zone_config(handle,(float)intent.ButtonSpeed,(float)s.MouseSpeedCoefficient,(float)s.ZoneInfluenceDistance,(float)s.ZoneShrinkSpeed,(float)s.SpeedThreshold,(float)s.MaximumExpansion));}
    public void Capture(string path) => Check(NativeMethods.mc_capture(handle, path));
    public (float X, float Y) HandlePoint(ulong selected, int index, float pixelsPerUnit)
    {
        Check(NativeMethods.mc_handle(handle, selected, index, pixelsPerUnit, out var x, out var y)); return (x, y);
    }
    public void Dispose() { if (handle != IntPtr.Zero) { NativeMethods.mc_destroy(handle); handle = IntPtr.Zero; } }
}
public sealed record ImageFrame(int Width,int Height,byte[] Pixels);
