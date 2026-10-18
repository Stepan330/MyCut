using System.Runtime.InteropServices;
using System.Text;

namespace MyCut.Editor.Services;
[StructLayout(LayoutKind.Sequential)]
internal struct NativeItem
{
    public ulong Id, Definition;
    public float X, Y, ScaleX, ScaleY, Rotation, Opacity, Red, Green, Blue;
    public int Visible,Locked;
}
[StructLayout(LayoutKind.Sequential)]
public struct NativeContent
{
    public int Kind,FontWeight,Alignment,Italic,Underline;
    public float Width,Height,FontSize,LineHeight,FillRed,FillGreen,FillBlue,FillAlpha,SecondRed,SecondGreen,SecondBlue,SecondAlpha,StrokeRed,StrokeGreen,StrokeBlue,StrokeAlpha,GradientAngle,StrokeWidth;
}
[StructLayout(LayoutKind.Sequential)]
public struct NativeGrade
{
    public float Exposure,Contrast,Saturation,Temperature,Tint,Pivot,LiftR,LiftG,LiftB,GammaR,GammaG,GammaB,GainR,GainG,GainB,OffsetR,OffsetG,OffsetB;
    public int Grayscale,Invert;
    public static NativeGrade Identity=>new(){Contrast=1,Saturation=1,Pivot=.18f,GammaR=1,GammaG=1,GammaB=1,GainR=1,GainG=1,GainB=1};
}
[StructLayout(LayoutKind.Sequential)]
internal struct NativeHit { public ulong Id; public int Tool, Handle; public float Distance; }
[StructLayout(LayoutKind.Sequential)]
public struct NativeTrack {public ulong Id;public int Muted,Locked;}
[StructLayout(LayoutKind.Sequential)]
public struct NativeClip
{
    public ulong Id,Instance,Track;
    public long Start,Duration,SourceIn,FadeIn,FadeOut;
    public float Speed;
    public int Muted;
}
[StructLayout(LayoutKind.Sequential)]
public struct NativeNode
{
    public ulong Id,Input0,Input1,Input2;public int Kind,Type;public float X,Y,V0,V1,V2,V3,V4,V5,V6,V7;
    public readonly ulong Input(int port)=>port switch{0=>Input0,1=>Input1,2=>Input2,_=>0};
    public readonly float Value(int index)=>index switch{0=>V0,1=>V1,2=>V2,3=>V3,4=>V4,5=>V5,6=>V6,7=>V7,_=>0};
    public void SetValue(int index,float value){switch(index){case 0:V0=value;break;case 1:V1=value;break;case 2:V2=value;break;case 3:V3=value;break;case 4:V4=value;break;case 5:V5=value;break;case 6:V6=value;break;case 7:V7=value;break;}}
}
[StructLayout(LayoutKind.Sequential)]
internal struct NativeInputStyle
{
    public float HandleRadius,ObjectMargin,HandleSize,FrameWidth,PointerX,PointerY,DirectionX,DirectionY,Expansion,Speed,Magnet,Horizon,Red,Green,Blue;
    public int DebugFlags;
    public ulong SettleId;public float SettleX,SettleY;
}
internal static class NativeMethods
{
    private const string Library = "MyCutNative.dll";
    [DllImport(Library,CallingConvention=CallingConvention.Cdecl)] internal static extern int mc_zone_config(IntPtr h,float speed,float coefficient,float influence,float shrink,float threshold,float maximum);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_create();
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern void mc_destroy(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_error(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_attach(IntPtr h, IntPtr hwnd, int software);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_detach(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_render(IntPtr h, int width, int height, ulong selected);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_mask_preview(IntPtr h, ulong node);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_surface(IntPtr h,int width,int height,out IntPtr surface);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_frame_pixels(IntPtr h,[Out] byte[] pixels,int capacity);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_editing_text(IntPtr h,ulong instance);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_count(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_item(IntPtr h, int index, out NativeItem item);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_name(IntPtr h, ulong id, int definition);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_transform(IntPtr h, ulong id, float x, float y, float scaleX, float scaleY, float rotation, float opacity, int visible);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_tint(IntPtr h, ulong id, float r, float g, float b);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_add(IntPtr h,int kind);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_content_get(IntPtr h,ulong definition,out NativeContent value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl,CharSet=CharSet.Unicode)] internal static extern int mc_content_set(IntPtr h,ulong definition,in NativeContent value,string text,string font);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_content_string(IntPtr h,ulong definition,int field);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl,CharSet=CharSet.Unicode)] internal static extern int mc_layer(IntPtr h,ulong instance,int operation,string name);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_grade_get(IntPtr h,ulong instance,out NativeGrade grade);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_grade_set(IntPtr h,ulong instance,in NativeGrade grade);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_scope_frame(IntPtr h,[Out] byte[]? pixels,int capacity,out int width,out int height);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_sample_color(IntPtr h,float x,float y,out float r,out float g,out float b);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_gesture(IntPtr h, int begin);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_undo(IntPtr h, int redo);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_history(IntPtr h, int redo);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_duplicate(IntPtr h, ulong id);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_remove(IntPtr h, ulong id);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_reset(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_new(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_workbench(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern int mc_save(IntPtr h, string path);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern int mc_load(IntPtr h, string path);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern ulong mc_import(IntPtr h, string path);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern int mc_export(IntPtr h, string path, int viewportSize);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_pick(IntPtr h, float x, float y);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_stats(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_feedback(IntPtr h, ulong hovered, float selectionProgress, float hoverProgress, int hoveredHandle);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_input_style(IntPtr h,in NativeInputStyle style);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_hit(IntPtr h, ulong selected, float x, float y, float dipsPerUnit, float intentX, float intentY, float expansion, out NativeHit hit);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_pointer(IntPtr h, int phase, ulong selected, float x, float y, float pixelsPerUnit, float intentX, float intentY, float expansion, int shift, out ulong result);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_tool(IntPtr h, ulong selected, float x, float y, float pixelsPerUnit);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)] internal static extern int mc_capture(IntPtr h, string path);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_handle(IntPtr h, ulong selected, int index, float pixelsPerUnit, out float x, out float y);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl,CharSet=CharSet.Unicode)] internal static extern ulong mc_import_video(IntPtr h,string path);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_media_info(IntPtr h,ulong definition,out double duration,out int num,out int den);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_pending(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_timeline_info(IntPtr h,out int num,out int den,out long rangeIn,out long rangeOut);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_track_count(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_clip_count(IntPtr h);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_track_get(IntPtr h,int index,out NativeTrack value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_track_name(IntPtr h,ulong id);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_clip_get(IntPtr h,int index,out NativeClip value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl,CharSet=CharSet.Unicode)] internal static extern ulong mc_track_add(IntPtr h,string name);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_clip_add(IntPtr h,ulong instance,ulong track,long start,long duration);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_clip_set(IntPtr h,in NativeClip value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_clip_split(IntPtr h,ulong id,long frame);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_clip_remove(IntPtr h,ulong id,int ripple);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_track_set(IntPtr h,in NativeTrack value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_timeline_range(IntPtr h,long rangeIn,long rangeOut);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_timeline_preview(IntPtr h,int enabled,long frame);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern IntPtr mc_project_text(IntPtr h);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] internal delegate int ExportProgress(long done,long total);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl,CharSet=CharSet.Unicode)] internal static extern int mc_movie_export(string projectText,string path,long first,long count,int software,ExportProgress progress,StringBuilder error,int capacity);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_graph_info(IntPtr h,ulong owner,out int enabled,out ulong output);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_graph_init(IntPtr h,ulong owner,int example);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_graph_enabled(IntPtr h,ulong owner,int enabled);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_node_count(IntPtr h,ulong owner);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_node_get(IntPtr h,ulong owner,int index,out NativeNode node);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern ulong mc_node_add(IntPtr h,ulong owner,int kind,float x,float y);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_node_set(IntPtr h,ulong owner,in NativeNode node);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_node_remove(IntPtr h,ulong owner,ulong node);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] internal static extern int mc_node_connect(IntPtr h,ulong owner,ulong source,ulong target,int port);
}
