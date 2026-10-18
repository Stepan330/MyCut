using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Threading;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class ColorWindow:LayeredPanelWindow
{
    private readonly EditorViewModel vm;
    private readonly DispatcherTimer timer=new(){Interval=TimeSpan.FromMilliseconds(250)};
    private bool scopeDirty=true;
    public ColorScopes Scopes{get;}=new();
    private readonly PrimariesPanel primaries;
    public ColorWheel LiftWheel=>primaries.LiftWheel;
    public ColorWindow(EditorViewModel model,MotionEngine motion,PointerIntentTracker tracker):base("Color / Primary correction",motion,tracker)
    {
        vm=model;DataContext=vm;Width=1000;Height=760;MinWidth=660;var content=new StackPanel();Body.Content=content;
        var heading=new TextBlock{FontSize=18,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,0,0,12)};heading.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.SelectionName)));content.Children.Add(heading);
        content.Children.Add(Scopes);primaries=new PrimariesPanel(vm);content.Children.Add(primaries);var controls=new WrapPanel();controls.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));content.Children.Add(controls);
        void Number(string label,string property,double min,double max,double step)
        {
            var row=new ParameterRow{Label=label,Minimum=min,Maximum=max,Step=step,Width=270,Margin=new Thickness(4)};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});controls.Children.Add(row);
        }
        Number("Exposure / stops",nameof(vm.Exposure),-10,10,.05);Number("Contrast",nameof(vm.Contrast),0,4,.01);Number("Saturation",nameof(vm.Saturation),0,4,.01);Number("Temperature",nameof(vm.Temperature),-1,1,.005);Number("Tint",nameof(vm.ColorTint),-1,1,.005);Number("Contrast pivot",nameof(vm.ContrastPivot),0,1,.005);
        foreach(var (label,property) in new[]{("Grayscale",nameof(vm.Grayscale)),("Invert",nameof(vm.Invert))}){var check=new CheckBox{Content=label};check.SetBinding(CheckBox.IsCheckedProperty,new Binding(property){Mode=BindingMode.TwoWay});controls.Children.Add(check);}
        var caption=new TextBlock{Text="Primaries: RGB balance on each wheel, luminance master below it. Scopes show the clean composition. Correction belongs to the selected layer, not to the whole project.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,8,0,8)};caption.SetResourceReference(TextBlock.ForegroundProperty,"MutedBrush");content.Children.Add(caption);
        Footer.Children.Add(new Button{Content=EditorIcons.Image("settings"),Command=vm.ResetColorCommand,ToolTip="Reset correction"});Footer.Children.Add(new Button{Content=EditorIcons.Image("undo"),Command=vm.UndoCommand,ToolTip="Undo"});Footer.Children.Add(new Button{Content=EditorIcons.Image("redo"),Command=vm.RedoCommand,ToolTip="Redo"});var close=new Button{Content=EditorIcons.Image("close"),ToolTip="Close"};close.Click+=(_,_)=>Close();Footer.Children.Add(close);
        vm.PropertyChanged+=Changed;timer.Tick+=(_,_)=>RefreshScopes();Loaded+=(_,_)=>{timer.Start();RefreshScopes();};Closed+=(_,_)=>{timer.Stop();vm.PropertyChanged-=Changed;};
    }
    private void Changed(object? sender,PropertyChangedEventArgs e){if(e.PropertyName is not "Metrics" and not "Status")scopeDirty=true;}
    public void RefreshScopes()
    {
        if(!scopeDirty)return;
        try{Scopes.Update(vm.Engine.ScopeFrame());scopeDirty=false;}catch(Exception ex){App.Log(ex);vm.Status=ex.Message;if(vm.Smoke)throw;}
    }
}
