using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;
public sealed class PrimariesPanel:Grid
{
    public ColorWheel LiftWheel{get;}=new(){Label="Lift",Center=0,Strength=.25};
    public PrimariesPanel(EditorViewModel vm)
    {
        DataContext=vm;Margin=new Thickness(10,4,10,4);SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));
        var wheels=new[]{LiftWheel,new ColorWheel{Label="Gamma",Center=1,Strength=.5},new ColorWheel{Label="Gain",Center=1,Strength=.5},new ColorWheel{Label="Offset",Center=0,Strength=.25}};
        var names=new[]{("LiftRed","LiftGreen","LiftBlue","LiftMaster"),("GammaRed","GammaGreen","GammaBlue","GammaMaster"),("GainRed","GainGreen","GainBlue","GainMaster"),("OffsetRed","OffsetGreen","OffsetBlue","OffsetMaster")};
        for(int n=0;n<4;++n)
        {
            ColumnDefinitions.Add(new ColumnDefinition());var stack=new StackPanel{HorizontalAlignment=HorizontalAlignment.Stretch,Margin=new Thickness(4,0,4,0)};Grid.SetColumn(stack,n);Children.Add(stack);var wheel=wheels[n];wheel.HorizontalAlignment=HorizontalAlignment.Center;
            wheel.SetBinding(ColorWheel.RedProperty,new Binding(names[n].Item1){Mode=BindingMode.TwoWay});wheel.SetBinding(ColorWheel.GreenProperty,new Binding(names[n].Item2){Mode=BindingMode.TwoWay});wheel.SetBinding(ColorWheel.BlueProperty,new Binding(names[n].Item3){Mode=BindingMode.TwoWay});stack.Children.Add(wheel);
            var row=new ParameterRow{Label="Master",Minimum=n==1?.01:n==2?0:-1,Maximum=n==1?4:n==2?8:1,Step=n is 1 or 2?.01:.005};row.SetBinding(ParameterRow.ValueProperty,new Binding(names[n].Item4){Mode=BindingMode.TwoWay});stack.Children.Add(row);
        }
    }
}
public sealed class PrimaryParameters:StackPanel
{
    public PrimaryParameters(EditorViewModel vm)
    {
        DataContext=vm;Margin=new Thickness(12);SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));
        foreach(var (label,property,min,max,step) in new[]{("Exposure / stops","Exposure",-10d,10d,.05),("Contrast","Contrast",0d,4d,.01),("Saturation","Saturation",0d,4d,.01),("Temperature","Temperature",-1d,1d,.005),("Tint","ColorTint",-1d,1d,.005),("Pivot","ContrastPivot",0d,1d,.005)})
        {var row=new ParameterRow{Label=label,Minimum=min,Maximum=max,Step=step};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay});Children.Add(row);}
        foreach(var (label,property) in new[]{("Grayscale","Grayscale"),("Invert","Invert")}){var check=new CheckBox{Content=label};check.SetBinding(CheckBox.IsCheckedProperty,new Binding(property){Mode=BindingMode.TwoWay});Children.Add(check);}
        Children.Add(new Button{Content=EditorIcons.Image("undo"),Command=vm.ResetColorCommand,ToolTip="Reset layer correction"});
    }
}
