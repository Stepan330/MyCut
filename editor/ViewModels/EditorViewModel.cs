using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Input;
using Microsoft.Win32;
using System.Windows.Media;
using MyCut.Editor.Services;

namespace MyCut.Editor.ViewModels;
public sealed partial class EditorViewModel : INotifyPropertyChanged,IEditGesture
{
    public NativeSession Engine { get; }
    public bool Smoke { get; }
    public bool ForceSoftware { get; }
    public ObservableCollection<SceneItem> Items { get; } = [];
    public ObservableCollection<SceneItem> LayerItems {get;}=[];
    public IReadOnlyList<string> WindowsFonts {get;}=Fonts.SystemFontFamilies.Select(f=>f.Source).Distinct().OrderBy(f=>f).ToArray();
    private SceneItem? selected;
    private bool dirty;
    private bool gestureWasDirty;
    private string? projectPath;
    private string status = "Ready. Select a card, drag it, or import a photo.";
    private string metrics = "Initializing viewport…";
    public EditorViewModel(NativeSession engine, bool smoke, bool hardware = false)
    {
        Engine = engine; Smoke = smoke; ForceSoftware = smoke && !hardware;
        ImportCommand = new RelayCommand(Import);
        SaveCommand = new RelayCommand(() => Save());
        OpenCommand = new RelayCommand(Open);
        ExportCommand = new RelayCommand(Export);
        NewCommand = new RelayCommand(() => { if (ConfirmDiscard()) Execute(() => { Engine.New(); projectPath = null; dirty = false; Reload(); Status = "New project. Import a photo to begin."; }); });
        DemoCommand = new RelayCommand(() => { if (ConfirmDiscard()) { Engine.Reset(); projectPath = null; dirty = false; Reload(); Status = "Demo scene restored."; } });
        DuplicateCommand = new RelayCommand(CopySelection, () => HasSelection&&(!PreviewTimeline||CanEdit));
        DeleteCommand = new RelayCommand(RemoveSelection, () => HasSelection&&(!PreviewTimeline||CanEdit));
        UndoCommand = new RelayCommand(() => Execute(() => { Engine.Undo(); Changed(); Reload(Selected?.Id); }), () => Engine.CanUndo);
        RedoCommand = new RelayCommand(() => Execute(() => { Engine.Undo(true); Changed(); Reload(Selected?.Id); }), () => Engine.CanRedo);
        ResetTransformCommand = new RelayCommand(() => Execute(() => {
            var i = Selected!; i.X = 640; i.Y = 360; i.ScaleX = 1; i.ScaleY = 1; i.Rotation = 0; i.Opacity = 1; i.Visible = true;
            Engine.Transform(i); Changed(); NotifyProperties();
        }), () => HasSelection);
        AddTextCommand=new RelayCommand(()=>Add(1));AddFillCommand=new RelayCommand(()=>Add(2));AddShapeCommand=new RelayCommand(()=>Add(5));
        LayerUpCommand=new RelayCommand(()=>Layer(3),()=>HasSelection&&!PreviewTimeline);LayerDownCommand=new RelayCommand(()=>Layer(4),()=>HasSelection&&!PreviewTimeline);
        MakeUniqueCommand=new RelayCommand(()=>Layer(6),()=>HasSelection);
        WorkbenchCommand=new RelayCommand(()=>{if(ConfirmDiscard())Execute(()=>{Engine.Workbench();projectPath=null;dirty=false;Reload(4);Status="Workbench example · editable Windows text, gradient, image and shape.";});});
        ResetColorCommand=new RelayCommand(()=>ChangeGrade(i=>i.Grade=NativeGrade.Identity),()=>CanEdit);
        InitializeTimeline();InitializePhotoTools();
        Reload();
    }
    public RelayCommand ImportCommand { get; }
    public RelayCommand NewCommand { get; }
    public RelayCommand SaveCommand { get; }
    public RelayCommand OpenCommand { get; }
    public RelayCommand ExportCommand { get; }
    public RelayCommand DemoCommand { get; }
    public RelayCommand DuplicateCommand { get; }
    public RelayCommand DeleteCommand { get; }
    public RelayCommand UndoCommand { get; }
    public RelayCommand RedoCommand { get; }
    public RelayCommand ResetTransformCommand { get; }
    public RelayCommand AddTextCommand {get;}
    public RelayCommand AddFillCommand {get;}
    public RelayCommand AddShapeCommand {get;}
    public RelayCommand LayerUpCommand {get;}
    public RelayCommand LayerDownCommand {get;}
    public RelayCommand MakeUniqueCommand {get;}
    public RelayCommand ResetColorCommand {get;}
    public RelayCommand WorkbenchCommand {get;}
    public SceneItem? Selected { get => selected; set { selected = value; RefreshGraph(); NotifyProperties(); RefreshCommands(); } }
    public bool HasSelection => Selected is not null;
    public bool CanEdit=>Selected is {Locked:false}&&(!PreviewTimeline||!TimelineClips.Any(c=>c.Value.Instance==Selected.Id&&TimelineTracks.Any(t=>t.Id==c.Value.Track&&t.Locked)));
    public bool HasGenerated=>Selected is not null&&Selected.Content.Kind is >0 and <8;
    public bool IsText=>Selected?.Content.Kind==1;
    public bool HasSecondColor=>Selected?.Content.Kind is 3 or 4 or 7;
    public bool HasGradientAngle=>Selected?.Content.Kind==3;
    public bool HasOutline=>Selected?.Content.Kind is 5 or 6;
    public bool Locked {get=>Selected?.Locked??false;set{if(Selected is not null&&value!=Selected.Locked)Layer(5);}}
    public string LayerName {get=>Selected?.Name??"";set{if(Selected is not null&&value!=Selected.Name)Execute(()=>{var id=Selected.Id;Engine.Layer(id,0,value);Changed();Reload(id);});}}
    private void Add(int kind)=>Execute(()=>{var id=Engine.Add(kind);Changed();Reload(id);SelectedMedia=MediaBin.FirstOrDefault(i=>i.Id==id);Status="Layer created. Edit content and style in the content panel.";});
    private void CopySelection()
    {
        if(PreviewTimeline&&TimelineClips.FirstOrDefault(c=>c.Value.Instance==Selected?.Id) is {} clip){SelectClip(clip.Id);DuplicateClip();return;}
        Execute(()=>{var id=Engine.Duplicate(Selected!.Id);Changed();Reload(id);});
    }
    private void RemoveSelection()
    {
        if(PreviewTimeline&&TimelineClips.FirstOrDefault(c=>c.Value.Instance==Selected?.Id) is {} clip){SelectClip(clip.Id);DeleteClip(false);return;}
        Execute(()=>{Engine.Remove(Selected!.Id);Changed();Reload();});
    }
    private void Layer(int operation)=>Execute(()=>{var id=Selected!.Id;Engine.Layer(id,operation);Changed();Reload(id);});
    private void ChangeContent(Action<SceneItem> change)
    {
        if(Selected is null)return;
        Execute(()=>{change(Selected);Engine.Content(Selected);Changed();
            var values=Engine.Items();foreach(var item in Items){var next=values.First(v=>v.Id==item.Id);item.Content=next.Content;item.Text=next.Text;item.Font=next.Font;}NotifyProperties();});
    }
    public int ContentKind {get=>Selected?.Content.Kind??0;set{if(value<0||value>7||Selected?.Content.Kind==8)return;ChangeContent(i=>i.Content.Kind=value);}}
    public string ContentText {get=>Selected?.Text??"";set=>ChangeContent(i=>i.Text=value);}
    public string FontFamily {get=>Selected?.Font??"Segoe UI";set=>ChangeContent(i=>i.Font=value);}
    public double FontSize {get=>Selected?.Content.FontSize??64;set=>ChangeContent(i=>i.Content.FontSize=(float)value);}
    public double LineHeight {get=>Selected?.Content.LineHeight??1.2;set=>ChangeContent(i=>i.Content.LineHeight=(float)value);}
    public bool FontBold {get=>Selected is {} i&&i.Content.FontWeight>=600;set=>ChangeContent(i=>i.Content.FontWeight=value?700:400);}
    public bool FontItalic {get=>Selected is {} i&&i.Content.Italic!=0;set=>ChangeContent(i=>i.Content.Italic=value?1:0);}
    public bool FontUnderline {get=>Selected is {} i&&i.Content.Underline!=0;set=>ChangeContent(i=>i.Content.Underline=value?1:0);}
    public int TextAlignment {get=>Selected?.Content.Alignment??0;set=>ChangeContent(i=>i.Content.Alignment=value);}
    public double ContentWidth {get=>Selected?.Content.Width??640;set=>ChangeContent(i=>i.Content.Width=(float)value);}
    public double ContentHeight {get=>Selected?.Content.Height??360;set=>ChangeContent(i=>i.Content.Height=(float)value);}
    public double GradientAngle {get=>Selected?.Content.GradientAngle??0;set=>ChangeContent(i=>i.Content.GradientAngle=(float)value);}
    public double StrokeWidth {get=>Selected?.Content.StrokeWidth??0;set=>ChangeContent(i=>i.Content.StrokeWidth=(float)value);}
    private static string Hex(float r,float g,float b,float a)=>Color.FromArgb((byte)Math.Round(a*255),(byte)Math.Round(r*255),(byte)Math.Round(g*255),(byte)Math.Round(b*255)).ToString();
    public string FillColor {get=>Selected is {} i?Hex(i.Content.FillRed,i.Content.FillGreen,i.Content.FillBlue,i.Content.FillAlpha):"#FFFFFFFF";set=>ChangeContent(i=>{var c=(Color)ColorConverter.ConvertFromString(value);i.Content.FillRed=c.R/255f;i.Content.FillGreen=c.G/255f;i.Content.FillBlue=c.B/255f;i.Content.FillAlpha=c.A/255f;});}
    public string SecondColor {get=>Selected is {} i?Hex(i.Content.SecondRed,i.Content.SecondGreen,i.Content.SecondBlue,i.Content.SecondAlpha):"#FF3060A0";set=>ChangeContent(i=>{var c=(Color)ColorConverter.ConvertFromString(value);i.Content.SecondRed=c.R/255f;i.Content.SecondGreen=c.G/255f;i.Content.SecondBlue=c.B/255f;i.Content.SecondAlpha=c.A/255f;});}
    public string StrokeColor {get=>Selected is {} i?Hex(i.Content.StrokeRed,i.Content.StrokeGreen,i.Content.StrokeBlue,i.Content.StrokeAlpha):"#FF000000";set=>ChangeContent(i=>{var c=(Color)ColorConverter.ConvertFromString(value);i.Content.StrokeRed=c.R/255f;i.Content.StrokeGreen=c.G/255f;i.Content.StrokeBlue=c.B/255f;i.Content.StrokeAlpha=c.A/255f;});}
    public string Title => $"MyCut — {Path.GetFileName(projectPath) ?? "Untitled"}{(dirty ? " •" : "")}";
    public string DocumentName => Path.GetFileNameWithoutExtension(projectPath) ?? "Untitled composition";
    public string SelectionName => Selected?.Name ?? "No selection";
    public string DefinitionName => Selected?.DefinitionName ?? "—";
    public string DefinitionSummary => Selected is null ? "" : $"DEFINITION {Selected.Definition:000} · {Items.Count(i => i.Definition == Selected.Definition)} linked instances";
    public string InstanceSummary => Selected?.Identity ?? "Select an Item to edit its properties.";
    public string SceneSummary => PreviewTimeline?$"{TimelineClips.Count} clips · {TimelineTracks.Count} tracks":$"{LayerItems.Count} instances · {Items.Select(i => i.Definition).Distinct().Count()} definitions";
    public string LayerListTitle=>PreviewTimeline?"Timeline clip layers":"Scene items";
    public string Status { get => status; set { status = value; Notify(); } }
    public string Metrics { get => metrics; set { metrics = value; Notify(); } }
    public double X { get => Selected?.X ?? 0; set => ChangeTransform(i => i.X = (float)value); }
    public double Y { get => Selected?.Y ?? 0; set => ChangeTransform(i => i.Y = (float)value); }
    public double ScaleX { get => Selected?.ScaleX ?? 1; set => ChangeTransform(i => i.ScaleX = (float)value); }
    public double ScaleY { get => Selected?.ScaleY ?? 1; set => ChangeTransform(i => i.ScaleY = (float)value); }
    public double Rotation { get => Selected?.Rotation ?? 0; set => ChangeTransform(i => i.Rotation = (float)value); }
    public double Opacity { get => Selected?.Opacity ?? 1; set => ChangeTransform(i => i.Opacity = (float)value); }
    public bool Visible { get => Selected?.Visible ?? false; set => ChangeTransform(i => i.Visible = value); }
    public double Red { get => Selected?.Red ?? 1; set => ChangeTint(i => i.Red = (float)value); }
    public double Green { get => Selected?.Green ?? 1; set => ChangeTint(i => i.Green = (float)value); }
    public double Blue { get => Selected?.Blue ?? 1; set => ChangeTint(i => i.Blue = (float)value); }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void Notify([CallerMemberName] string? property = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
    private void NotifyProperties() => Notify(null);
    private void RefreshCommands()
    {
        DuplicateCommand.Refresh(); DeleteCommand.Refresh(); UndoCommand.Refresh(); RedoCommand.Refresh(); ResetTransformCommand.Refresh();
        LayerUpCommand?.Refresh();LayerDownCommand?.Refresh();MakeUniqueCommand?.Refresh();
        ResetColorCommand?.Refresh();
        RefreshTimelineCommands();
    }
    private void Changed() { dirty = true; Notify(nameof(Title)); RefreshCommands(); }
    public void Reload(ulong? select = null)
    {
        var list = Engine.Items(); Items.Clear();LayerItems.Clear(); foreach (var item in list) Items.Add(item);foreach(var item in list.AsEnumerable().Reverse())LayerItems.Add(item);
        Selected = Items.FirstOrDefault(i => i.Id == select) ?? Items.FirstOrDefault();
        ReloadTimeline();
        NotifyProperties();
    }
    private void ChangeTransform(Action<SceneItem> edit)
    {
        if (Selected is null) return;
        Execute(() => { edit(Selected); Engine.Transform(Selected); Changed(); NotifyProperties(); });
    }
    private void ChangeTint(Action<SceneItem> edit)
    {
        if (Selected is null) return;
        Execute(() => { var id = Selected.Id; edit(Selected); Engine.Tint(Selected); Changed();
            // Keep the selected object/list stable while a slider captures the mouse.
            var updated = Engine.Items();
            foreach (var item in Items) { var value = updated.First(i => i.Id == item.Id); item.Red = value.Red; item.Green = value.Green; item.Blue = value.Blue; }
            NotifyProperties();
        });
    }
    public void BeginGesture() { gestureWasDirty = dirty; Engine.Gesture(true); }
    public void EndGesture() { Engine.Gesture(false); RefreshCommands(); }
    public void CancelGesture() { Engine.CancelGesture(); dirty = gestureWasDirty; Reload(Selected?.Id); }
    public void Pick(float x, float y) { ulong id = Engine.Pick(x, y); Selected = Items.FirstOrDefault(i => i.Id == id); }
    public void MoveSelection(float x, float y) => ChangeTransform(i => { i.X = x; i.Y = y; });
    public void Select(ulong id) => Selected = Items.FirstOrDefault(i => i.Id == id);
    public void RefreshInteraction(bool changed)
    {
        var values = Engine.Items();
        foreach (var i in Items)
        {
            var value = values.First(v => v.Id == i.Id);
            i.X = value.X; i.Y = value.Y; i.ScaleX = value.ScaleX; i.ScaleY = value.ScaleY; i.Rotation = value.Rotation; i.Opacity = value.Opacity;
        }
        if (changed) Changed();
        NotifyProperties(); RefreshCommands();
    }
    public bool HandleShortcut(Key key, ModifierKeys modifiers)
    {
        if(modifiers==ModifierKeys.None&&PhotoMode&&key is Key.V or Key.T or Key.U or Key.G or Key.I){SetPhotoTool(key switch{Key.T=>PhotoTool.Text,Key.U=>PhotoTool.Rectangle,Key.G=>PhotoTool.LinearGradient,Key.I=>PhotoTool.Picker,_=>PhotoTool.Move});return true;}
        RelayCommand? command = modifiers == ModifierKeys.Control ? key switch
        {
            Key.N => NewCommand, Key.S => SaveCommand, Key.O => OpenCommand, Key.I => ImportCommand,
            Key.D => DuplicateCommand, Key.Z => UndoCommand, Key.Y => RedoCommand, _ => null
        } : modifiers == ModifierKeys.None && key == Key.Delete ? DeleteCommand : null;
        if (command is null || !command.CanExecute(null)) return false;
        command.Execute(null); return true;
    }
    public void ImportPath(string path) => Execute(() => { bool video=Path.GetExtension(path).ToLowerInvariant() is ".mp4" or ".mov" or ".m4v" or ".avi" or ".wmv" or ".mkv";ulong id = video?Engine.ImportVideo(path):Engine.Import(path); Changed(); Reload(id);SelectedMedia=MediaBin.FirstOrDefault(i=>i.Id==id);Status = $"Imported {Path.GetFileName(path)}."; });
    private void Import()
    {
        var dialog = new OpenFileDialog { Title = "Import photo", Filter = "Images|*.png;*.jpg;*.jpeg;*.bmp;*.tif;*.tiff", Multiselect = true };
        if (dialog.ShowDialog() == true) foreach (var path in dialog.FileNames) ImportPath(path);
    }
    public bool Save()
    {
        var path = projectPath;
        if (path is null) { var dialog = new SaveFileDialog { Filter = "MyCut project|*.mycut", DefaultExt = ".mycut", FileName = "Untitled.mycut" }; if (dialog.ShowDialog() != true) return false; path = dialog.FileName; }
        bool result = false;
        Execute(() => { Engine.Save(path); projectPath = path; dirty = false; NotifyProperties(); Status = "Project saved."; result = true; });
        return result;
    }
    public bool ConfirmDiscard()
    {
        if (!dirty || Smoke) return true;
        var answer = MessageBox.Show("Save changes to this MyCut project?", "MyCut", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        return answer == MessageBoxResult.No || answer == MessageBoxResult.Yes && Save();
    }
    private void Open()
    {
        var dialog = new OpenFileDialog { Filter = "MyCut project|*.mycut" };
        if (dialog.ShowDialog() != true || !ConfirmDiscard()) return;
        Execute(() => { Engine.Load(dialog.FileName); projectPath = dialog.FileName; dirty = false; Reload(); Status = "Project opened."; });
    }
    private void Export()
    {
        var dialog = new SaveFileDialog { Filter = "PNG image|*.png", DefaultExt = ".png", FileName = "MyCut.png" };
        if (dialog.ShowDialog() == true) Execute(() => { Engine.Export(dialog.FileName); Status = "Exported PNG · 1280 × 720 · opaque sRGB."; });
    }
    public void Execute(Action action)
    {
        try { action(); }
        catch (Exception ex) { App.Log(ex); Status = ex.Message; if (Smoke) throw; Reload(Selected?.Id); }
    }
}
