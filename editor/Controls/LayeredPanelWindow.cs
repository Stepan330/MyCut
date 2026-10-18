using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shell;
using MyCut.Editor.Motion;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public class LayeredPanelWindow:Window
{
    private sealed record Placement(double Left,double Top,double Width,double Height);
    private readonly ProximityInput zones;
    public Grid Foundation {get;}=new();
    public Canvas Overlay {get;}=new(){IsHitTestVisible=false,ClipToBounds=false};
    public Border Head {get;}=new(){MinHeight=42};
    public ScrollViewer Body {get;}=new(){VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled,CanContentScroll=false,Padding=new Thickness(22)};
    public WrapPanel Footer {get;}=new(){Margin=new Thickness(16,10,16,14)};
    public LayeredPanelWindow(string title,MotionEngine motion,PointerIntentTracker tracker)
    {
        var options=PanelLayoutOptions.Shared;
        Title=title;Width=options.Width;Height=options.Height;MinWidth=options.MinimumWidth;MinHeight=options.MinimumHeight;Head.MinHeight=options.HeadHeight;Body.Padding=options.Padding;ShowInTaskbar=false;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        WindowStyle=WindowStyle.None;ResizeMode=ResizeMode.CanResize;FontFamily=new FontFamily("Segoe UI");FontSize=12;
        SetResourceReference(BackgroundProperty,"PanelBrush");SetResourceReference(ForegroundProperty,"TextBrush");
        WindowChrome.SetWindowChrome(this,new WindowChrome{CaptionHeight=0,ResizeBorderThickness=new Thickness(6),GlassFrameThickness=new Thickness(0),CornerRadius=new CornerRadius(options.CornerRadius),UseAeroCaptionButtons=false});
        MotionBehavior.SetEngine(this,motion);
        Foundation.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});Foundation.RowDefinitions.Add(new RowDefinition());Foundation.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});
        var baseLayer=new Border{BorderThickness=new Thickness(1),CornerRadius=new CornerRadius(options.CornerRadius)};baseLayer.SetResourceReference(Border.BackgroundProperty,"PanelBrush");baseLayer.SetResourceReference(Border.BorderBrushProperty,"BorderBrush");Grid.SetRowSpan(baseLayer,3);Foundation.Children.Add(baseLayer);
        var headContent=new DockPanel{Margin=new Thickness(14,4,8,4)};
        var close=new Button{Content="×",Width=36,Padding=new Thickness(8,4,8,4),Margin=new Thickness(0),ToolTip="Close"};close.Click+=(_,_)=>Close();DockPanel.SetDock(close,Dock.Right);headContent.Children.Add(close);
        var titleText=new TextBlock{FontSize=14,FontWeight=FontWeights.SemiBold,VerticalAlignment=VerticalAlignment.Center,TextTrimming=TextTrimming.CharacterEllipsis};titleText.SetBinding(TextBlock.TextProperty,new Binding(nameof(Title)){Source=this});headContent.Children.Add(titleText);
        Head.Child=headContent;Head.SetResourceReference(BackgroundProperty,"RaisedBrush");Head.PreviewMouseLeftButtonDown+=DragHead;Foundation.Children.Add(Head);
        Grid.SetRow(Body,1);Foundation.Children.Add(Body);Grid.SetRow(Footer,2);Foundation.Children.Add(Footer);Grid.SetRowSpan(Overlay,3);Foundation.Children.Add(Overlay);
        var space=new SpatialWorkspace{SurfaceContent=Foundation};space.AttachMotion(motion);Foundation.SetBinding(DataContextProperty,new Binding(nameof(DataContext)){Source=this});MotionBehavior.SetEngine(Foundation,motion);Content=new AdornerDecorator{Child=space};InertialScrollBehavior.SetEnabled(Body,true);zones=new ProximityInput(this,tracker);
        Loaded+=(_,_)=>LoadPlacement();Closed+=(_,_)=>zones.Dispose();Closing+=(_,_)=>SavePlacement();
    }
    private void DragHead(object sender,MouseButtonEventArgs e)
    {
        for(DependencyObject? node=e.OriginalSource as DependencyObject;node is not null&&node!=Head;node=node is Visual?VisualTreeHelper.GetParent(node):null)if(node is Button)return;
        if(e.ClickCount==2)WindowState=WindowState==WindowState.Maximized?WindowState.Normal:WindowState.Maximized;
        else if(Mouse.LeftButton==MouseButtonState.Pressed)DragMove();
    }
    private string? PlacementPath=>InterfaceSettings.Current.StoragePath is {} p?Path.Combine(Path.GetDirectoryName(p)!,"panels.json"):null;
    private Dictionary<string,Placement> ReadPlacements()
    {
        try{return PlacementPath is {} path&&File.Exists(path)?JsonSerializer.Deserialize<Dictionary<string,Placement>>(File.ReadAllText(path))??[]:[];}
        catch(Exception ex) when(ex is IOException or JsonException or UnauthorizedAccessException){App.Log(ex);return [];}
    }
    private void LoadPlacement()
    {
        if(!ReadPlacements().TryGetValue(Title,out var p)||!double.IsFinite(p.Left)||!double.IsFinite(p.Top)||!double.IsFinite(p.Width)||!double.IsFinite(p.Height))return;
        Width=Math.Clamp(p.Width,MinWidth,Math.Max(MinWidth,SystemParameters.VirtualScreenWidth));Height=Math.Clamp(p.Height,MinHeight,Math.Max(MinHeight,SystemParameters.VirtualScreenHeight));
        Left=Math.Clamp(p.Left,SystemParameters.VirtualScreenLeft,SystemParameters.VirtualScreenLeft+Math.Max(0,SystemParameters.VirtualScreenWidth-Width));Top=Math.Clamp(p.Top,SystemParameters.VirtualScreenTop,SystemParameters.VirtualScreenTop+Math.Max(0,SystemParameters.VirtualScreenHeight-Height));
    }
    private void SavePlacement()
    {
        if(PlacementPath is not {} path)return;
        try{var entries=ReadPlacements();var bounds=RestoreBounds;entries[Title]=new Placement(bounds.Left,bounds.Top,bounds.Width,bounds.Height);Directory.CreateDirectory(Path.GetDirectoryName(path)!);File.WriteAllText(path+".writing",JsonSerializer.Serialize(entries));File.Move(path+".writing",path,true);}
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException){App.Log(ex);}
    }
}
