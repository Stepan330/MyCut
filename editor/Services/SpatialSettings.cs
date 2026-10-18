using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace MyCut.Editor.Services;
public sealed record SpatialSettingsData(double Depth=36,double PopupDepth=100,double FieldOfView=40,double CameraX=0,double CameraY=0,double CameraZ=0,double CameraYaw=0,double CameraPitch=0,double FlySpeed=600,double Sensitivity=.15);
public sealed class SpatialSettings:INotifyPropertyChanged
{
    public static SpatialSettings Current{get;}=new();
    private SpatialSettingsData data=new();
    public event PropertyChangedEventHandler? PropertyChanged;
    private void Set(SpatialSettingsData value,[CallerMemberName]string? name=null){if(value==data)return;data=value;PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(name));}
    private static double Limit(double v,double min,double max)=>double.IsFinite(v)?Math.Clamp(v,min,max):min;
    public double Depth{get=>data.Depth;set=>Set(data with{Depth=Limit(value,1,240)});}
    public double PopupDepth{get=>data.PopupDepth;set=>Set(data with{PopupDepth=Limit(value,0,300)});}
    public double FieldOfView{get=>data.FieldOfView;set=>Set(data with{FieldOfView=Limit(value,20,80)});}
    public double CameraX{get=>data.CameraX;set=>Set(data with{CameraX=Limit(value,-6000,6000)});}
    public double CameraY{get=>data.CameraY;set=>Set(data with{CameraY=Limit(value,-6000,6000)});}
    public double CameraZ{get=>data.CameraZ;set=>Set(data with{CameraZ=Limit(value,-1200,6000)});}
    public double CameraYaw{get=>data.CameraYaw;set=>Set(data with{CameraYaw=Limit(value,-80,80)});}
    public double CameraPitch{get=>data.CameraPitch;set=>Set(data with{CameraPitch=Limit(value,-80,80)});}
    public double FlySpeed{get=>data.FlySpeed;set=>Set(data with{FlySpeed=Limit(value,20,4000)});}
    public double Sensitivity{get=>data.Sensitivity;set=>Set(data with{Sensitivity=Limit(value,.02,1)});}
    public void ResetCamera(){data=data with{CameraX=0,CameraY=0,CameraZ=0,CameraYaw=0,CameraPitch=0};PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(null));}
    public void Reset(){data=new();PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(null));}
    public void Save(string path){Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);File.WriteAllText(path+".writing",JsonSerializer.Serialize(data));File.Move(path+".writing",path,true);}
    public void Load(string path){if(!File.Exists(path))return;var d=JsonSerializer.Deserialize<SpatialSettingsData>(File.ReadAllText(path))??new();Depth=d.Depth;PopupDepth=d.PopupDepth;FieldOfView=d.FieldOfView;CameraX=d.CameraX;CameraY=d.CameraY;CameraZ=d.CameraZ;CameraYaw=d.CameraYaw;CameraPitch=d.CameraPitch;FlySpeed=d.FlySpeed;Sensitivity=d.Sensitivity;}
}
