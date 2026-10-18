using System.ComponentModel;
using System.Windows;
using System.Windows.Media;
using MyCut.Editor.Services;

namespace MyCut.Editor.ViewModels;
public enum PhotoTool{Move=0,Text=1,Fill=2,LinearGradient=3,RadialGradient=4,Rectangle=5,Ellipse=6,Pattern=7,Picker=20}
public sealed class PhotoToolItem(EditorViewModel owner,PhotoTool tool,string name,Geometry icon):INotifyPropertyChanged
{
    public PhotoTool Tool=>tool;public string Name=>name;public Geometry Icon=>icon;public bool IsActive=>owner.ActivePhotoTool==tool;
    public RelayCommand Command{get;}=new(()=>owner.SetPhotoTool(tool));
    public event PropertyChangedEventHandler? PropertyChanged;
    public void Refresh()=>PropertyChanged?.Invoke(this,new PropertyChangedEventArgs(nameof(IsActive)));
}
public sealed partial class EditorViewModel
{
    private PhotoTool photoTool;
    private string toolColor="#FF46A7CB",textColor="#FFFFFFFF",toolSecond="#FF872FC5",toolText="Text",toolFont="Segoe UI";
    private double toolFontSize=64,toolWidth=512,toolHeight=150,toolStroke=3,toolAngle;
    private double shapeWidth=160,shapeHeight=100;
    private bool toolBold,toolItalic;
    private ulong toolInstance,priorToolSelection;
    private Point toolDown;
    private bool toolMoved;
    public IReadOnlyList<PhotoToolItem> PhotoTools{get;private set;}=[];
    public PhotoTool ActivePhotoTool=>photoTool;
    public bool PhotoMode=>workspace==WorkspaceKind.Photo;
    public bool ColorMode{get=>workspace==WorkspaceKind.Color;set{if(value)ActivateWorkspace(WorkspaceKind.Color);else if(ColorMode)ActivatePhoto();}}
    public void ActivatePhoto()=>ActivateWorkspace(WorkspaceKind.Photo);
    public bool PhotoPointerActive=>toolInstance!=0;
    public event EventHandler? PhotoToolPlaced;
    private void InitializePhotoTools()
    {
        Geometry Icon(string path){var g=Geometry.Parse(path);g.Freeze();return g;}
        PhotoTools=[new(this,PhotoTool.Move,"Move / transform · V",Icon("M12,2 L12,22 M2,12 L22,12 M8,6 L12,2 16,6 M8,18 L12,22 16,18 M6,8 L2,12 6,16 M18,8 L22,12 18,16")),
            new(this,PhotoTool.Text,"Text · T",Icon("M3,5 L21,5 M12,5 L12,21 M8,21 L16,21 M3,5 L3,8 M21,5 L21,8")),
            new(this,PhotoTool.Rectangle,"Rectangle · U",Icon("M3,4 L21,4 21,20 3,20 Z")),new(this,PhotoTool.Ellipse,"Ellipse",Icon("M12,3 A9,9 0 1 0 12,21 A9,9 0 1 0 12,3")),
            new(this,PhotoTool.Fill,"Solid fill layer",Icon("M4,10 L12,2 21,11 13,19 Z M2,22 L22,22 M18,16 Q24,21 19,21 Q15,20 18,16")),
            new(this,PhotoTool.LinearGradient,"Linear gradient · G",Icon("M3,4 L21,4 21,20 3,20 Z M7,4 L7,20 M10,4 L10,20 M14,4 L14,20 M19,4 L19,20")),
            new(this,PhotoTool.RadialGradient,"Radial gradient",Icon("M12,3 A9,9 0 1 0 12,21 A9,9 0 1 0 12,3 M12,7 A5,5 0 1 0 12,17 A5,5 0 1 0 12,7 M12,10 A2,2 0 1 0 12,14 A2,2 0 1 0 12,10")),
            new(this,PhotoTool.Pattern,"Pattern fill",Icon("M3,3 L21,3 21,21 3,21 Z M9,3 L9,21 M15,3 L15,21 M3,9 L21,9 M3,15 L21,15")),
            new(this,PhotoTool.Picker,"Color picker · I",Icon("M15,3 L21,9 M13,7 L17,11 7,21 3,21 3,17 Z M14,6 L18,2 22,6 18,10"))];
    }
    public void SetPhotoTool(PhotoTool tool){FinishPhotoPointer(true);photoTool=tool;foreach(var item in PhotoTools)item.Refresh();NotifyProperties();Status=tool==PhotoTool.Move?"Move / transform · choose an object, drag its body or handles.":$"{PhotoTools.First(i=>i.Tool==tool).Name} · click or drag on the canvas, edit options above.";}
    public string ToolName=>PhotoTools.FirstOrDefault(t=>t.Tool==ActivePhotoTool)?.Name??"Move";
    public bool ToolIsText=>ActivePhotoTool==PhotoTool.Text;
    public bool ToolIsShape=>ActivePhotoTool is PhotoTool.Rectangle or PhotoTool.Ellipse;
    public bool ToolIsGradient=>ActivePhotoTool is PhotoTool.LinearGradient or PhotoTool.RadialGradient or PhotoTool.Pattern;
    public bool ToolHasColor=>ActivePhotoTool is not PhotoTool.Move;
    private bool ToolMatches=>CanEdit&&Selected?.Content.Kind==(int)ActivePhotoTool;
    public string ToolText{get=>ToolMatches?ContentText:toolText;set{toolText=value;if(ToolMatches)ContentText=value;Notify();}}
    public string ToolFont{get=>ToolMatches?FontFamily:toolFont;set{toolFont=value;if(ToolMatches)FontFamily=value;Notify();}}
    public double ToolFontSize{get=>ToolMatches?FontSize:toolFontSize;set{toolFontSize=value;if(ToolMatches)FontSize=value;Notify();}}
    public bool ToolBold{get=>ToolMatches?FontBold:toolBold;set{toolBold=value;if(ToolMatches)FontBold=value;Notify();}}
    public bool ToolItalic{get=>ToolMatches?FontItalic:toolItalic;set{toolItalic=value;if(ToolMatches)FontItalic=value;Notify();}}
    public string ToolColor{get=>ToolMatches?FillColor:ToolIsText?textColor:toolColor;set{_=(Color)ColorConverter.ConvertFromString(value);if(ToolIsText)textColor=value;else toolColor=value;if(ToolMatches)FillColor=value;Notify();}}
    public string ToolSecondColor{get=>ToolMatches?SecondColor:toolSecond;set{_=(Color)ColorConverter.ConvertFromString(value);toolSecond=value;if(ToolMatches)SecondColor=value;Notify();}}
    public double ToolWidth{get=>ToolMatches?ContentWidth:ToolIsShape?shapeWidth:toolWidth;set{if(ToolIsShape)shapeWidth=value;else toolWidth=value;if(ToolMatches)ContentWidth=value;Notify();}}
    public double ToolHeight{get=>ToolMatches?ContentHeight:ToolIsShape?shapeHeight:toolHeight;set{if(ToolIsShape)shapeHeight=value;else toolHeight=value;if(ToolMatches)ContentHeight=value;Notify();}}
    public string ViewportHint=>GraphMode?$"Live graph preview{(PreviewTimeline?$" · timeline {Timecode}":"")} · outliner selects the item · right-click graph adds nodes":ItemMode?"Item editor · position, geometry and shared definition · animation keyframes are not implemented yet":ColorMode?"Select a layer to grade · primaries below · scopes and correction on the right":VideoMode?"Program preview · select / transform a clip layer · edit time on the timeline":ActivePhotoTool==PhotoTool.Move?"Drag to move · corners: proportional · edges: width/height · ring: rotate · Shift: snap · Esc: cancel":$"{ToolName} · click / drag on the canvas · options above · V: move · Esc: cancel";
    public double ToolStrokeWidth{get=>ToolMatches?StrokeWidth:toolStroke;set{toolStroke=value;if(ToolMatches)StrokeWidth=value;Notify();}}
    public double ToolGradientAngle{get=>ToolMatches?GradientAngle:toolAngle;set{toolAngle=value;if(ToolMatches)GradientAngle=value;Notify();}}
    public void BeginPhotoPointer(float x,float y,float density)
    {
        if(!PhotoMode||ActivePhotoTool==PhotoTool.Move||x<0||y<0||x>=1280||y>=720)return;
        if(ActivePhotoTool==PhotoTool.Picker){toolColor=textColor=Engine.SampleColor(x,y);NotifyProperties();Status=$"Picked {toolColor} from the clean full-resolution composition.";return;}
        if(ActivePhotoTool==PhotoTool.Text){var hit=Engine.Hit(0,x,y,density);var existing=Items.FirstOrDefault(i=>i.Id==hit.Id&&i.Content.Kind==1);if(existing is not null){Selected=existing;PhotoToolPlaced?.Invoke(this,EventArgs.Empty);return;}}
        priorToolSelection=Selected?.Id??0;BeginGesture();try
        {
            toolDown=new Point(x,y);toolMoved=false;toolInstance=Engine.Add((int)ActivePhotoTool);var item=Engine.Items().First(i=>i.Id==toolInstance);
            bool full=ActivePhotoTool is PhotoTool.Fill or PhotoTool.LinearGradient or PhotoTool.RadialGradient or PhotoTool.Pattern;
            item.Content.Width=full?1280:ToolIsText?(float)toolWidth:(float)shapeWidth;item.Content.Height=full?720:ToolIsText?(float)toolHeight:(float)shapeHeight;
            if(ToolIsText){item.Text=toolText;item.Font=toolFont;item.Content.FontSize=(float)toolFontSize;item.Content.FontWeight=toolBold?700:400;item.Content.Italic=toolItalic?1:0;}
            var color=(Color)ColorConverter.ConvertFromString(ToolIsText?textColor:toolColor);var second=(Color)ColorConverter.ConvertFromString(toolSecond);
            item.Content.FillRed=color.R/255f;item.Content.FillGreen=color.G/255f;item.Content.FillBlue=color.B/255f;item.Content.FillAlpha=color.A/255f;item.Content.SecondRed=second.R/255f;item.Content.SecondGreen=second.G/255f;item.Content.SecondBlue=second.B/255f;item.Content.SecondAlpha=second.A/255f;
            item.Content.StrokeWidth=ToolIsShape?(float)toolStroke:0;item.Content.GradientAngle=(float)toolAngle;item.X=full?640:x+item.Content.Width/2;item.Y=full?360:y+item.Content.Height/2;
            Engine.Content(item);Engine.Transform(item);Changed();Reload(toolInstance);
        }catch{FinishPhotoPointer(true);throw;}
    }
    public void MovePhotoPointer(float x,float y,float density,bool shift)
    {
        if(toolInstance==0)return;var delta=new Vector(x-toolDown.X,y-toolDown.Y);if(!toolMoved&&delta.Length*density<5)return;toolMoved=true;
        var item=Engine.Items().First(i=>i.Id==toolInstance);
        if(ActivePhotoTool==PhotoTool.LinearGradient){item.Content.GradientAngle=(float)(Math.Atan2(delta.Y,delta.X)*180/Math.PI);Engine.Content(item);}
        else if(ActivePhotoTool is PhotoTool.Text or PhotoTool.Rectangle or PhotoTool.Ellipse)
        {
            double w=Math.Clamp(Math.Abs(delta.X),1,4096),h=Math.Clamp(Math.Abs(delta.Y),1,4096);if(shift&&!ToolIsText)w=h=Math.Max(w,h);
            item.Content.Width=(float)w;item.Content.Height=(float)h;item.X=(float)(toolDown.X+(delta.X<0?-w:w)/2);item.Y=(float)(toolDown.Y+(delta.Y<0?-h:h)/2);Engine.Content(item);Engine.Transform(item);
        }
        Changed();Reload(toolInstance);
    }
    public void FinishPhotoPointer(bool cancel)
    {
        if(toolInstance==0)return;ulong id=toolInstance;toolInstance=0;
        if(cancel){CancelGesture();Select(priorToolSelection);}else{EndGesture();Reload(id);PhotoToolPlaced?.Invoke(this,EventArgs.Empty);Status="Layer placed. Change its options above; V returns to move / transform.";}
    }
}
