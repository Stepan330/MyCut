using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;

namespace MyCut.Editor.Services;

public sealed record InterfaceSettingsData(
    int Version=1, double ControlMargin=8, double HandleRadius=24, double ObjectMargin=16,
    double HandleSize=16, double MaximumExpansion=44, double IntentLifetime=1,
    double SpeedThreshold=260, double PredictionHorizon=1, double MagnetStrength=.65,
    double HoverGrowth=.12, double MotionStrength=1, double ScrollInertia=.88,
    bool DebugZones=false, bool DebugConflicts=false, bool DebugPrediction=false,
    bool AdaptiveInput=true, bool ReducedMotion=false,
    string Accent="#46E5ED",string Canvas="#0B1018",string Panel="#141D2B",string Text="#F1F6FF",
    double MouseSpeedCoefficient=.04,double ZoneInfluenceDistance=160,double ZoneShrinkSpeed=88);

public sealed class InterfaceSettings : INotifyPropertyChanged,IEditGesture
{
    public static InterfaceSettings Current { get; } = new();
    private InterfaceSettingsData data=new();
    private InterfaceSettingsData? before;
    public void BeginGesture()=>before??=data;
    public void EndGesture()=>before=null;
    public void CancelGesture(){if(before is {} original){data=original;ApplyTheme();PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(null));}before=null;}
    public InterfaceSettingsData Data => data;
    public string? StoragePath { get; private set; }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void Update(InterfaceSettingsData value,[CallerMemberName]string? name=null)
    {
        if(value==data)return;data=value;ApplyTheme();PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(name));
    }
    private static double Bound(double value,double min,double max,double fallback) => double.IsFinite(value)?Math.Clamp(value,min,max):fallback;
    public double ControlMargin {get=>data.ControlMargin;set=>Update(data with{ControlMargin=Bound(value,0,32,8)});}
    public double HandleRadius {get=>data.HandleRadius;set=>Update(data with{HandleRadius=Bound(value,8,72,24)});}
    public double ObjectMargin {get=>data.ObjectMargin;set=>Update(data with{ObjectMargin=Bound(value,0,64,16)});}
    public double HandleSize {get=>data.HandleSize;set=>Update(data with{HandleSize=Bound(value,6,32,16)});}
    public double MaximumExpansion {get=>data.MaximumExpansion;set=>Update(data with{MaximumExpansion=Bound(value,0,96,44)});}
    public double IntentLifetime {get=>data.IntentLifetime;set=>Update(data with{IntentLifetime=Bound(value,.1,2,1)});}
    public double SpeedThreshold {get=>data.SpeedThreshold;set=>Update(data with{SpeedThreshold=Bound(value,0,1500,260)});}
    public double MouseSpeedCoefficient {get=>data.MouseSpeedCoefficient;set=>Update(data with{MouseSpeedCoefficient=Bound(value,0,.5,.04)});}
    public double ZoneInfluenceDistance {get=>data.ZoneInfluenceDistance;set=>Update(data with{ZoneInfluenceDistance=Bound(value,24,640,160)});}
    public double ZoneShrinkSpeed {get=>data.ZoneShrinkSpeed;set=>Update(data with{ZoneShrinkSpeed=Bound(value,1,1000,88)});}
    public double PredictionHorizon {get=>data.PredictionHorizon;set=>Update(data with{PredictionHorizon=Bound(value,.1,2,1)});}
    public double MagnetStrength {get=>data.MagnetStrength;set=>Update(data with{MagnetStrength=Bound(value,0,1,.65)});}
    public double HoverGrowth {get=>data.HoverGrowth;set=>Update(data with{HoverGrowth=Bound(value,0,.3,.12)});}
    public double MotionStrength {get=>data.MotionStrength;set=>Update(data with{MotionStrength=Bound(value,0,2,1)});}
    public double ScrollInertia {get=>data.ScrollInertia;set=>Update(data with{ScrollInertia=Bound(value,0,.97,.88)});}
    public bool DebugZones {get=>data.DebugZones;set=>Update(data with{DebugZones=value});}
    public bool DebugConflicts {get=>data.DebugConflicts;set=>Update(data with{DebugConflicts=value});}
    public bool DebugPrediction {get=>data.DebugPrediction;set=>Update(data with{DebugPrediction=value});}
    public bool AdaptiveInput {get=>data.AdaptiveInput;set=>Update(data with{AdaptiveInput=value});}
    public bool ReducedMotion {get=>data.ReducedMotion;set=>Update(data with{ReducedMotion=value});}
    private static bool IsColor(string value) {try{return ColorConverter.ConvertFromString(value) is Color;}catch(FormatException){return false;}}
    public string Accent {get=>data.Accent;set{if(IsColor(value))Update(data with{Accent=value});}}
    public string Canvas {get=>data.Canvas;set{if(IsColor(value))Update(data with{Canvas=value});}}
    public string Panel {get=>data.Panel;set{if(IsColor(value))Update(data with{Panel=value});}}
    public string Text {get=>data.Text;set{if(IsColor(value))Update(data with{Text=value});}}
    public void Reset() {data=new();ApplyTheme();PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(null));}
    public void ApplyTheme()
    {
        if(Application.Current is not {} app)return;
        void Brush(string key,string value)=>app.Resources[key]=new SolidColorBrush((Color)ColorConverter.ConvertFromString(value));
        Brush("AccentBrush",data.Accent);Brush("CanvasBrush",data.Canvas);Brush("PanelBrush",data.Panel);Brush("TextBrush",data.Text);
        Brush("RaisedBrush","#24344A");Brush("HoverBrush","#354C68");Brush("BorderBrush","#49607C");Brush("MutedBrush","#AFBED4");
        var accent=(Color)ColorConverter.ConvertFromString(data.Accent);
        app.Resources["AccentSurfaceBrush"]=new SolidColorBrush(Color.FromRgb((byte)(accent.R*.2),(byte)(accent.G*.2),(byte)(accent.B*.2)));
    }
    public void Initialize(string path) {StoragePath=path;if(File.Exists(path))Import(path);else ApplyTheme();}
    public void Import(string path)
    {
        var candidate=JsonSerializer.Deserialize<InterfaceSettingsData>(File.ReadAllText(path))??throw new InvalidDataException("Empty interface settings.");
        if(candidate.Version!=1)throw new InvalidDataException("Unsupported interface settings version.");
        candidate=candidate with{ControlMargin=Bound(candidate.ControlMargin,0,32,8),HandleRadius=Bound(candidate.HandleRadius,8,72,24),
            ObjectMargin=Bound(candidate.ObjectMargin,0,64,16),HandleSize=Bound(candidate.HandleSize,6,32,16),MaximumExpansion=Bound(candidate.MaximumExpansion,0,96,44),
            IntentLifetime=Bound(candidate.IntentLifetime,.1,2,1),SpeedThreshold=Bound(candidate.SpeedThreshold,0,1500,260),PredictionHorizon=Bound(candidate.PredictionHorizon,.1,2,1),
            MouseSpeedCoefficient=Bound(candidate.MouseSpeedCoefficient,0,.5,.04),ZoneInfluenceDistance=Bound(candidate.ZoneInfluenceDistance,24,640,160),ZoneShrinkSpeed=Bound(candidate.ZoneShrinkSpeed,1,1000,88),
            MagnetStrength=Bound(candidate.MagnetStrength,0,1,.65),HoverGrowth=Bound(candidate.HoverGrowth,0,.3,.12),MotionStrength=Bound(candidate.MotionStrength,0,2,1),ScrollInertia=Bound(candidate.ScrollInertia,0,.97,.88)};
        if(!IsColor(candidate.Accent)||!IsColor(candidate.Canvas)||!IsColor(candidate.Panel)||!IsColor(candidate.Text))throw new InvalidDataException("Invalid interface color.");
        data=candidate;ApplyTheme();PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(null));
    }
    public void Export(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var temp=path+".writing";File.WriteAllText(temp,JsonSerializer.Serialize(data,new JsonSerializerOptions{WriteIndented=true}));File.Move(temp,path,true);
    }
    public void Save() {if(StoragePath is {} path)Export(path);}
}
