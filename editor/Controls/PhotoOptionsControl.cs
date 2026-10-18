using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;
public sealed class PhotoOptionsControl:UserControl
{
    private readonly EditorViewModel vm;
    private readonly WrapPanel wrap=new(){Margin=new Thickness(8,3,8,3)};
    private PhotoTool? displayed;
    private readonly System.Windows.Threading.DispatcherTimer timer=new(){Interval=TimeSpan.FromMilliseconds(30)};
    public TextBox? TextEditor{get;private set;}
    public PhotoOptionsControl(EditorViewModel model)
    {
        vm=model;DataContext=vm;Content=wrap;Loaded+=(_,_)=>{vm.PropertyChanged+=Changed;timer.Start();Rebuild();};Unloaded+=(_,_)=>{timer.Stop();vm.PropertyChanged-=Changed;};timer.Tick+=(_,_)=>{if(displayed!=vm.ActivePhotoTool)Rebuild();};
    }
    private void Changed(object? sender,PropertyChangedEventArgs e){if(displayed!=vm.ActivePhotoTool&&IsLoaded)Rebuild();}
    private void Rebuild()
    {
        displayed=vm.ActivePhotoTool;wrap.Children.Clear();TextEditor=null;
        var label=new TextBlock{Text=vm.ToolName,Margin=new Thickness(6,0,14,0),FontSize=11};label.SetResourceReference(ForegroundProperty,"MutedBrush");wrap.Children.Add(label);
        void Number(string caption,string property,double min,double max,double step){var row=new ParameterRow{Label=caption,Minimum=min,Maximum=max,Step=step,MinWidth=140,MaxWidth=190,Margin=new Thickness(0,0,6,0)};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});wrap.Children.Add(row);}
        TextBox Entry(string property,double width,string hint)
        {
            var box=new TextBox{Width=width,ToolTip=hint,Margin=new Thickness(0,3,6,3)};box.SetBinding(TextBox.TextProperty,new Binding(property){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus,ValidatesOnExceptions=true});wrap.Children.Add(box);return box;
        }
        if(vm.ToolIsText)
        {
            var fonts=new ComboBox{ItemsSource=vm.WindowsFonts,Width=155,Margin=new Thickness(0,3,6,3),ToolTip="Windows font"};fonts.SetBinding(System.Windows.Controls.Primitives.Selector.SelectedItemProperty,new Binding(nameof(vm.ToolFont)){Mode=BindingMode.TwoWay});wrap.Children.Add(fonts);
            Number("Size",nameof(vm.ToolFontSize),6,1024,1);var styles=new ElasticControlPanel{Margin=new Thickness(0,3,6,3)};
            foreach(var (caption,property) in new[]{("B",nameof(vm.ToolBold)),("I",nameof(vm.ToolItalic))}){var box=new CheckBox{Content=caption,ToolTip=property,Margin=new Thickness(4),FontWeight=FontWeights.SemiBold};box.SetBinding(CheckBox.IsCheckedProperty,new Binding(property){Mode=BindingMode.TwoWay});styles.Children.Add(box);}wrap.Children.Add(styles);
            TextEditor=Entry(nameof(vm.ToolText),210,"Text content · click on the canvas to create / edit a text layer");TextEditor.GotKeyboardFocus+=(_,_)=>vm.BeginGesture();TextEditor.LostKeyboardFocus+=(_,_)=>vm.EndGesture();
        }
        else if(vm.ActivePhotoTool==PhotoTool.Move){Number("X / px",nameof(vm.X),-100000,100000,1);Number("Y / px",nameof(vm.Y),-100000,100000,1);}
        else if(vm.ToolIsShape){Number("Width",nameof(vm.ToolWidth),1,4096,1);Number("Height",nameof(vm.ToolHeight),1,4096,1);Number("Outline",nameof(vm.ToolStrokeWidth),0,512,.5);}
        else if(vm.ActivePhotoTool==PhotoTool.LinearGradient)Number("Angle",nameof(vm.ToolGradientAngle),-360,360,1);
        void ColorEntry(string property,string hint){var field=new ColorField{Width=135,Margin=new Thickness(0,3,6,3),ToolTip=hint};field.SetBinding(ColorField.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});wrap.Children.Add(field);}
        if(vm.ToolHasColor){ColorEntry(nameof(vm.ToolColor),"Fill / text color");if(vm.ToolIsGradient)ColorEntry(nameof(vm.ToolSecondColor),"Second gradient / pattern color");}
        var photoTools=new Button{Content="Photo tools…",ToolTip="Process an imported photo into a new layer; keep the original"};
        photoTools.Click+=(_,_)=>new PhotoProcessingWindow(vm){Owner=SpatialCoordinates.WindowFor(this)}.ShowDialog();wrap.Children.Add(photoTools);
    }
    public void FocusText(){if(!vm.ToolIsText)return;Rebuild();TextEditor?.Focus();TextEditor?.SelectAll();}
}
