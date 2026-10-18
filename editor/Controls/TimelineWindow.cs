using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;
using Microsoft.Win32;

namespace MyCut.Editor.Controls;

public sealed class TimelineWindow:LayeredPanelWindow
{
    private readonly EditorViewModel vm;
    private readonly Button exportButton=new(){Content=EditorIcons.Image("export"),ToolTip="Export MP4 (video only)"};
    private readonly Button cancelButton=new(){Content=EditorIcons.Image("close"),ToolTip="Cancel export",IsEnabled=false};
    private CancellationTokenSource? exportCancel;
    private bool exporting;
    public bool IsExporting=>exporting;
    public void CancelExport()=>exportCancel?.Cancel();
    public TimelineCanvas Timeline{get;}
    public ListBox Bin{get;}=new(){DisplayMemberPath="Name",MinHeight=110,MaxHeight=150};
    public TimelineWindow(EditorViewModel model,MotionEngine motion,PointerIntentTracker pointer):base("Video / Timeline",motion,pointer)
    {
        vm=model;DataContext=vm;Width=1100;Height=680;MinWidth=680;Body.Padding=new Thickness(16);var content=new StackPanel();Body.Content=content;
        var top=new Grid();top.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(220)});top.ColumnDefinitions.Add(new ColumnDefinition());content.Children.Add(top);
        var media=new StackPanel{Margin=new Thickness(0,0,16,12)};media.Children.Add(new TextBlock{Text="MEDIA BIN",Margin=new Thickness(0,0,0,8)});media.Children.Add(Bin);top.Children.Add(media);
        Bin.SetBinding(ItemsControl.ItemsSourceProperty,new Binding(nameof(vm.MediaBin)));Bin.SetBinding(System.Windows.Controls.Primitives.Selector.SelectedItemProperty,new Binding(nameof(vm.SelectedMedia)){Mode=BindingMode.TwoWay});
        Point mediaDown=default;Bin.PreviewMouseLeftButtonDown+=(_,e)=>mediaDown=e.GetPosition(Bin);Bin.PreviewMouseMove+=(_,e)=>{if(e.LeftButton==MouseButtonState.Pressed&&(e.GetPosition(Bin)-mediaDown).Length>8&&vm.SelectedMedia is {} i)DragDrop.DoDragDrop(Bin,new DataObject("MyCut.Media",i.Id),DragDropEffects.Copy);};
        Bin.MouseDoubleClick+=(_,_)=>vm.InsertMedia();
        var clipPanel=new Grid();Grid.SetColumn(clipPanel,1);top.Children.Add(clipPanel);clipPanel.ColumnDefinitions.Add(new ColumnDefinition());clipPanel.ColumnDefinitions.Add(new ColumnDefinition());
        var left=new StackPanel{Margin=new Thickness(0,0,12,0)};var right=new StackPanel();clipPanel.Children.Add(left);Grid.SetColumn(right,1);clipPanel.Children.Add(right);
        var name=new TextBlock{FontSize=16,TextTrimming=TextTrimming.CharacterEllipsis,Margin=new Thickness(0,0,0,6)};name.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.ClipName)));left.Children.Add(name);
        void Number(Panel panel,string label,string property,double min,double max,double step){var row=new ParameterRow{Label=label,Minimum=min,Maximum=max,Step=step};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});row.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEditClip)));panel.Children.Add(row);}
        Number(left,"Start / frames",nameof(vm.ClipStart),0,1_000_000_000,1);Number(left,"Duration / frames",nameof(vm.ClipDuration),1,1_000_000_000,1);Number(left,"Source In / frames",nameof(vm.ClipSourceIn),0,1_000_000_000,1);
        Number(right,"Speed",nameof(vm.ClipSpeed),.05,20,.01);Number(right,"Fade In / frames",nameof(vm.ClipFadeIn),0,1_000_000_000,1);Number(right,"Fade Out / frames",nameof(vm.ClipFadeOut),0,1_000_000_000,1);
        var toolbar=new WrapPanel{Margin=new Thickness(0,4,0,10)};content.Children.Add(toolbar);
        void Button(string label,RelayCommand command){string icon=label switch{"Import media"=>"import","+ Track"=>"add","Insert at playhead"=>"insert","Split · S"=>"split","Ripple delete"=>"ripple",_=>"delete"};toolbar.Children.Add(new Button{Content=EditorIcons.Image(icon),Command=command,ToolTip=label});}
        Button("Import media",vm.ImportMediaCommand);Button("+ Track",vm.AddTrackCommand);Button("Insert at playhead",vm.InsertClipCommand);Button("Split · S",vm.SplitClipCommand);Button("Delete",vm.DeleteClipCommand);Button("Ripple delete",vm.RippleDeleteCommand);
        var fit=new Button{Content=EditorIcons.Image("fit"),ToolTip="Fit clips"};toolbar.Children.Add(fit);Timeline=new TimelineCanvas(vm,motion,pointer){Height=268};fit.Click+=(_,_)=>Timeline.FitClips();content.Children.Add(Timeline);
        var transport=new WrapPanel{Margin=new Thickness(0,10,0,4)};content.Children.Add(transport);var playIcon=new EditorIcon();playIcon.SetBinding(EditorIcon.GlyphProperty,new Binding(nameof(vm.PlayIcon)));var play=new Button{Command=vm.PlayCommand,Content=playIcon,ToolTip="Play / pause · Space"};transport.Children.Add(play);
        var previous=new Button{Content=EditorIcons.Image("previous"),ToolTip="Previous frame"};previous.Click+=(_,_)=>{vm.StopPlayback();--vm.PlayheadFrame;};transport.Children.Add(previous);var next=new Button{Content=EditorIcons.Image("next"),ToolTip="Next frame"};next.Click+=(_,_)=>{vm.StopPlayback();++vm.PlayheadFrame;};transport.Children.Add(next);
        var seek=new ParameterRow{Label="Playhead / frame",Width=265,Minimum=0,Maximum=1_000_000_000,Step=1,Margin=new Thickness(8,0,8,0)};seek.SetBinding(ParameterRow.ValueProperty,new Binding(nameof(vm.PlayheadValue)){Mode=BindingMode.TwoWay});transport.Children.Add(seek);
        var time=new TextBlock{VerticalAlignment=VerticalAlignment.Center,FontSize=15,Margin=new Thickness(8)};time.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.Timecode)));transport.Children.Add(time);
        foreach(var (label,command,icon) in new[]{("Set In · I",vm.MarkInCommand,"range-in"),("Set Out · O",vm.MarkOutCommand,"range-out"),("Clear range",vm.ClearRangeCommand,"close")})transport.Children.Add(new Button{Content=EditorIcons.Image(icon),Command=command,ToolTip=label});
        var range=new TextBlock{Margin=new Thickness(0,4,0,4)};range.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.RangeText)));content.Children.Add(range);
        content.Children.Add(new TextBlock{Text="Main canvas = program preview. Middle-drag / wheel to pan · Ctrl+wheel to zoom · Shift+wheel to scroll tracks · Alt disables snapping. In/Out never follows clip selection. Video only: audio is not yet included.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,6,0,0),Opacity=.7});
        exportButton.Click+=async(_,_)=>await Export();cancelButton.Click+=(_,_)=>exportCancel?.Cancel();Footer.Children.Add(exportButton);Footer.Children.Add(cancelButton);Footer.Children.Add(new Button{Content=EditorIcons.Image("undo"),Command=vm.UndoCommand,ToolTip="Undo"});Footer.Children.Add(new Button{Content=EditorIcons.Image("redo"),Command=vm.RedoCommand,ToolTip="Redo"});
        PreviewKeyDown+=(_,e)=>{if(e.OriginalSource is TextBox or ParameterRow)return;if(e.Key==Key.Space){vm.TogglePlayback();e.Handled=true;}};
        Closing+=(_,e)=>{if(exporting){e.Cancel=true;vm.Status="Export is running. Cancel it before closing the video panel.";}};Closed+=(_,_)=>vm.StopPlayback();
    }
    private async Task Export()
    {
        long end=vm.RangeOut>=0?vm.RangeOut:vm.TimelineEnd,count=end-vm.RangeIn;if(count<1){vm.Status="Add clips or set a finite In/Out range before exporting.";return;}
        var dialog=new SaveFileDialog{Title="Export video (no audio yet)",Filter="H.264 MP4|*.mp4",DefaultExt=".mp4",FileName="MyCut.mp4"};if(dialog.ShowDialog()!=true)return;
        string snapshot=vm.Engine.ProjectText;vm.StopPlayback();exporting=true;exportCancel=new();exportButton.IsEnabled=false;cancelButton.IsEnabled=true;
        try{await NativeSession.ExportMovieAsync(snapshot,dialog.FileName,vm.RangeIn,count,vm.ForceSoftware,new Progress<double>(value=>vm.Status=$"Export MP4 · {value:P0}"),exportCancel.Token);vm.Status="MP4 exported · 1280 × 720 · H.264 · video only.";}
        catch(OperationCanceledException){vm.Status="Export canceled. Existing destination file was preserved.";}
        catch(Exception ex){App.Log(ex);vm.Status=ex.Message;}
        finally{exporting=false;exportButton.IsEnabled=true;cancelButton.IsEnabled=false;exportCancel.Dispose();exportCancel=null;}
    }
}
