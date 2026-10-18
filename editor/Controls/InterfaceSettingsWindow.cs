using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Win32;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public sealed class InterfaceSettingsWindow:LayeredPanelWindow
{
    private readonly InterfaceSettings settings=InterfaceSettings.Current;
    private readonly DispatcherTimer telemetryClock=new(){Interval=TimeSpan.FromMilliseconds(100)};
    public TextBlock Telemetry {get;}=new(){TextWrapping=TextWrapping.Wrap,FontFamily=new FontFamily("Consolas"),Margin=new Thickness(0,8,0,16)};
    public InterfaceSettingsWindow(MotionEngine motion,PointerIntentTracker tracker):base("Interface laboratory",motion,tracker)
    {
        DataContext=settings;var stack=new StackPanel();Body.Content=stack;
        void Title(string text){stack.Children.Add(new TextBlock{Text=text,FontSize=15,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,12,0,12)});}
        void Info(string text){var block=new TextBlock{Text=text,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,0,0,12)};block.SetResourceReference(TextBlock.ForegroundProperty,"MutedBrush");stack.Children.Add(block);}
        void Number(string label,string property,double minimum,double maximum,double step)
        {
            var row=new ParameterRow{Label=label,Minimum=minimum,Maximum=maximum,Step=step};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.PropertyChanged});stack.Children.Add(row);
        }
        void Toggle(string label,string property){var box=new CheckBox{Content=label};box.SetBinding(CheckBox.IsCheckedProperty,new Binding(property){Mode=BindingMode.TwoWay});stack.Children.Add(box);}
        void Color(string label,string property)
        {
            var row=new Grid{Margin=new Thickness(0,0,0,10)};row.ColumnDefinitions.Add(new ColumnDefinition());row.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(130)});
            row.Children.Add(new TextBlock{Text=label});var input=new TextBox();input.SetBinding(TextBox.TextProperty,new Binding(property){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus});Grid.SetColumn(input,1);row.Children.Add(input);stack.Children.Add(row);
        }
        Info("Move the mouse between controls and the canvas. These settings change the current interface immediately. Export the JSON when you find a comfortable preset.");
        Title("Live pointer telemetry");stack.Children.Add(Telemetry);
        Title("Interaction zones");Toggle("Predict pointer intent",nameof(settings.AdaptiveInput));
        Number("Base zone radius / DIP",nameof(settings.HandleRadius),8,72,.5);
        Number("Handle size / DIP",nameof(settings.HandleSize),6,32,.5);Number("Fast-motion expansion",nameof(settings.MaximumExpansion),0,96,.5);
        Number("Mouse speed coefficient",nameof(settings.MouseSpeedCoefficient),0,.5,.005);Number("Distance influence / DIP",nameof(settings.ZoneInfluenceDistance),24,640,4);Number("Zone shrink / DIP/s",nameof(settings.ZoneShrinkSpeed),1,1000,4);
        Info("Button extra radius = speed above threshold × speed coefficient × proximity², limited by Fast-motion expansion. Growth is immediate; shrink has a stable DIP/s rate. A smaller shrink rate keeps the zone large longer.");
        Number("Intent lifetime / s",nameof(settings.IntentLifetime),.1,2,.01);Number("Speed threshold / DIP/s",nameof(settings.SpeedThreshold),0,1500,10);Number("Prediction horizon / s",nameof(settings.PredictionHorizon),.1,2,.01);
        Title("Animation strength");Number("Animation strength · 0–2",nameof(settings.MotionStrength),0,2,.01);
        Title("3D interface");stack.Children.Add(new SpatialSettingsPanel());
        Info("0 = no animation; 1 = normal; 2 = stronger. Controls hover reflow, attraction and spring rebound. Interaction-zone inertia has its own adjustable shrink rate.");
        Title("Physical response");Number("Magnet strength",nameof(settings.MagnetStrength),0,1,.01);Number("Hover growth",nameof(settings.HoverGrowth),0,.3,.005);Number("Scroll inertia",nameof(settings.ScrollInertia),0,.97,.005);
        Toggle("Reduced motion",nameof(settings.ReducedMotion));
        Title("Debug overlays");Toggle("Show interaction zones",nameof(settings.DebugZones));Toggle("Show conflicts / Voronoi cells",nameof(settings.DebugConflicts));Toggle("Show pointer prediction",nameof(settings.DebugPrediction));
        Info("Cyan marks the selected target. Amber marks overlapping zones. The prediction shows a decelerating trajectory for the chosen horizon. The same distance rule resolves hover and click.");
        Title("Contrast and palette");Color("Accent",nameof(settings.Accent));Color("Canvas",nameof(settings.Canvas));Color("Panels",nameof(settings.Panel));Color("Text",nameof(settings.Text));
        void Button(string label,Action action){var button=new Button{Content=label,Margin=new Thickness(0,0,8,6)};button.Click+=(_,_)=>{try{action();}catch(Exception ex){App.Log(ex);MessageBox.Show(this,ex.Message,this.Title,MessageBoxButton.OK,MessageBoxImage.Error);}};Footer.Children.Add(button);}
        Button("Save settings",settings.Save);Button("Export preset",()=>{var dialog=new SaveFileDialog{Filter="Interface preset|*.json",FileName="MyCut-interface.json"};if(dialog.ShowDialog(this)==true)settings.Export(dialog.FileName);});
        Button("Import preset",()=>{var dialog=new OpenFileDialog{Filter="Interface preset|*.json"};if(dialog.ShowDialog(this)==true)settings.Import(dialog.FileName);});Button("Reset defaults",settings.Reset);
        telemetryClock.Tick+=(_,_)=>{var p=tracker.Snapshot(settings.MaximumExpansion);Telemetry.Text=$"Speed {p.Speed:0} DIP/s   Direction {p.Direction.X:0.00}, {p.Direction.Y:0.00}\nExtra radius {p.Expansion:0.0} DIP   Horizon {settings.PredictionHorizon:0.00} s\nForecast offset {p.PredictedOffset(settings.PredictionHorizon).X:0}, {p.PredictedOffset(settings.PredictionHorizon).Y:0} DIP";};
        Loaded+=(_,_)=>telemetryClock.Start();Closed+=(_,_)=>{telemetryClock.Stop();try{settings.Save();}catch(Exception ex) when(ex is System.IO.IOException or UnauthorizedAccessException){App.Log(ex);}};
    }
}
