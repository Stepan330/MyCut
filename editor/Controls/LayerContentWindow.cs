using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class LayerContentWindow:LayeredPanelWindow
{
    public TextBox TextEditor {get;}=new(){AcceptsReturn=true,TextWrapping=TextWrapping.Wrap,MinHeight=120,MaxHeight=200,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,MaxLength=65536};
    public ComboBox FontPicker {get;}=new(){IsEditable=true,MinHeight=34,Margin=new Thickness(0,0,0,12)};
    public LayerContentWindow(EditorViewModel vm,MotionEngine motion,PointerIntentTracker tracker):base("Layer content",motion,tracker)
    {
        DataContext=vm;Width=570;Height=800;
        var stack=new StackPanel();stack.SetBinding(IsEnabledProperty,new Binding(nameof(vm.HasSelection)));Body.Content=stack;
        var name=new TextBlock{FontSize=18,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,0,0,14),TextTrimming=TextTrimming.CharacterEllipsis};name.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.SelectionName)));stack.Children.Add(name);
        var kinds=new ComboBox{ItemsSource=new[]{"Image","Text","Solid fill","Linear gradient","Radial gradient","Rectangle","Ellipse","Pattern"},MinHeight=34,Margin=new Thickness(0,0,0,14)};
        kinds.SetBinding(ComboBox.SelectedIndexProperty,new Binding(nameof(vm.ContentKind)){Mode=BindingMode.TwoWay});kinds.SetBinding(IsEnabledProperty,new Binding(nameof(vm.HasGenerated)));stack.Children.Add(kinds);
        void Number(Panel parent,string label,string property,double min,double max,double step)
        {
            var row=new ParameterRow{Label=label,Minimum=min,Maximum=max,Step=step};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});parent.Children.Add(row);
        }
        void Entry(string label,string property,Panel? parent=null)
        {
            var target=parent??stack;target.Children.Add(new TextBlock{Text=label,Margin=new Thickness(0,0,0,5)});var text=new TextBox{Margin=new Thickness(0,0,0,12)};text.SetBinding(TextBox.TextProperty,new Binding(property){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus});target.Children.Add(text);
        }
        Entry("Layer name",nameof(vm.LayerName));
        Number(stack,"Content width / px",nameof(vm.ContentWidth),1,4096,1);Number(stack,"Content height / px",nameof(vm.ContentHeight),1,4096,1);
        var textOptions=new StackPanel();textOptions.SetBinding(VisibilityProperty,new Binding(nameof(vm.IsText)){Converter=new BooleanToVisibilityConverter()});stack.Children.Add(textOptions);
        textOptions.Children.Add(new TextBlock{Text="Text and Windows font",FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,10,0,10)});
        TextEditor.SetBinding(TextBox.TextProperty,new Binding(nameof(vm.ContentText)){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus});textOptions.Children.Add(TextEditor);
        FontPicker.ItemsSource=vm.WindowsFonts;FontPicker.SetBinding(ComboBox.TextProperty,new Binding(nameof(vm.FontFamily)){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.LostFocus});textOptions.Children.Add(FontPicker);
        Number(textOptions,"Font size / px",nameof(vm.FontSize),6,1024,1);Number(textOptions,"Line height",nameof(vm.LineHeight),.5,4,.01);
        var flags=new WrapPanel();textOptions.Children.Add(flags);
        foreach(var option in new[]{("Bold",nameof(vm.FontBold)),("Italic",nameof(vm.FontItalic)),("Underline",nameof(vm.FontUnderline))})
        {
            var box=new CheckBox{Content=option.Item1,Margin=new Thickness(0,6,18,12)};box.SetBinding(CheckBox.IsCheckedProperty,new Binding(option.Item2){Mode=BindingMode.TwoWay});flags.Children.Add(box);
        }
        var align=new ComboBox{ItemsSource=new[]{"Align left","Align center","Align right"},MinHeight=34,Margin=new Thickness(0,0,0,12)};align.SetBinding(ComboBox.SelectedIndexProperty,new Binding(nameof(vm.TextAlignment)){Mode=BindingMode.TwoWay});textOptions.Children.Add(align);
        StackPanel Options(string property){var panel=new StackPanel();panel.SetBinding(VisibilityProperty,new Binding(property){Converter=new BooleanToVisibilityConverter()});stack.Children.Add(panel);return panel;}
        Entry("Fill / text color · #AARRGGBB",nameof(vm.FillColor),Options(nameof(vm.HasGenerated)));
        Entry("Gradient end / pattern color",nameof(vm.SecondColor),Options(nameof(vm.HasSecondColor)));
        Number(Options(nameof(vm.HasGradientAngle)),"Gradient angle / deg",nameof(vm.GradientAngle),-360,360,1);
        var outline=Options(nameof(vm.HasOutline));Number(outline,"Outline width / px",nameof(vm.StrokeWidth),0,128,.5);Entry("Outline color",nameof(vm.StrokeColor),outline);
        var info=new TextBlock{Text="Content is shared by linked copies. Make the layer unique to edit its text, shape or source independently. Transform, opacity and visibility belong to each layer.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,10,0,0)};info.SetResourceReference(TextBlock.ForegroundProperty,"MutedBrush");stack.Children.Add(info);
        var unique=new Button{Content=EditorIcons.Image("duplicate"),ToolTip="Make layer unique",Command=vm.MakeUniqueCommand};Footer.Children.Add(unique);
        Footer.Children.Add(new Button{Content=EditorIcons.Image("undo"),ToolTip="Undo",Command=vm.UndoCommand});Footer.Children.Add(new Button{Content=EditorIcons.Image("redo"),ToolTip="Redo",Command=vm.RedoCommand});
        var close=new Button{Content=EditorIcons.Image("close"),ToolTip="Close",Margin=new Thickness(0,0,0,6)};close.Click+=(_,_)=>Close();Footer.Children.Add(close);
        PreviewKeyDown+=(_,e)=>
        {
            if(Keyboard.Modifiers==ModifierKeys.Control&&e.Key==Key.S)
            {
                if(Keyboard.FocusedElement is TextBox text)text.GetBindingExpression(TextBox.TextProperty)?.UpdateSource();vm.SaveCommand.Execute(null);e.Handled=true;
            }
        };
    }
}
