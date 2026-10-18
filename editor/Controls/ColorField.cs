using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Media;
using System.Windows.Input;
using ColorPicker;

namespace MyCut.Editor.Controls;

// The external picker is confined to this view. The document retains plain color values.
public sealed class ColorField : UserControl
{
    public static readonly DependencyProperty ValueProperty=DependencyProperty.Register(nameof(Value),typeof(string),typeof(ColorField),
        new FrameworkPropertyMetadata("#FFFFFFFF",FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,(d,_)=>((ColorField)d).Refresh()));
    public string Value{get=>(string)GetValue(ValueProperty);set=>SetValue(ValueProperty,value);}
    private readonly Border swatch=new(){Width=20,Height=16,BorderThickness=new Thickness(1),BorderBrush=Brushes.Gray};
    private readonly SpatialFlyout popup=new(){StaysOpen=false,AllowsTransparency=true,Placement=PlacementMode.Bottom};
    public ColorField()
    {
        var row=new DockPanel();var button=new Button{Content=swatch,MinWidth=30,MinHeight=26,Padding=new Thickness(4),Margin=new Thickness(0,0,3,0),ToolTip="Choose color"};
        DockPanel.SetDock(button,Dock.Left);row.Children.Add(button);
        var hex=new TextBox{MinWidth=70,MinHeight=26,FontSize=11,ToolTip="#AARRGGBB"};
        hex.SetBinding(TextBox.TextProperty,new Binding(nameof(Value)){Source=this,Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus,ValidatesOnExceptions=true});
        row.Children.Add(hex);Content=row;button.Click+=(_,_)=>Open(button);Unloaded+=(_,_)=>popup.IsOpen=false;Refresh();
    }
    private void Refresh(){try{swatch.Background=new SolidColorBrush((Color)ColorConverter.ConvertFromString(Value));}catch(FormatException){swatch.Background=Brushes.Transparent;}}
    private void Open(FrameworkElement anchor)
    {
        Color initial;try{initial=(Color)ColorConverter.ConvertFromString(Value);}catch(FormatException){initial=Colors.White;}
        var resources=new ResourceDictionary{Source=new Uri("pack://application:,,,/ColorPicker;component/Styles/DefaultColorPickerStyle.xaml")};
        var picker=new StandardColorPicker{Width=260,Height=400,SelectedColor=initial,Style=(Style)resources["DefaultColorPickerStyle"]};
        var body=new StackPanel();body.Children.Add(picker);
        var actions=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(0,8,0,0)};
        var cancel=new Button{Content="Cancel"};cancel.Click+=(_,_)=>popup.IsOpen=false;
        var apply=new Button{Content="Apply"};apply.Click+=(_,_)=>{SetCurrentValue(ValueProperty,picker.SelectedColor.ToString());popup.IsOpen=false;};
        actions.Children.Add(cancel);actions.Children.Add(apply);body.Children.Add(actions);
        var chrome=new Border{Child=body,Padding=new Thickness(10),BorderThickness=new Thickness(1)};
        chrome.SetResourceReference(Border.BackgroundProperty,"PanelBrush");chrome.SetResourceReference(Border.BorderBrushProperty,"BorderBrush");
        chrome.PreviewKeyDown+=(_,e)=>{if(e.Key==Key.Escape){popup.IsOpen=false;e.Handled=true;}};
        SpatialCoordinates.AnchorPopup(popup,anchor,new Point(0,anchor.ActualHeight));popup.Child=chrome;popup.IsOpen=true;
    }
}
