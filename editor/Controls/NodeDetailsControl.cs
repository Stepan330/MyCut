using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class NodeDetailsControl:UserControl
{
    private readonly EditorViewModel vm;
    private readonly StackPanel fields=new(){Margin=new Thickness(8)};
    private (ulong Owner,ulong Id,int Kind,int Type)? shown;
    public NodeDetailsControl(EditorViewModel model)
    {
        vm=model;DataContext=vm;Content=new ScrollViewer{Content=fields,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled};
        Loaded+=(_,_)=>{vm.PropertyChanged+=Changed;Refresh();};Unloaded+=(_,_)=>vm.PropertyChanged-=Changed;Refresh();
    }
    private void Changed(object? sender,PropertyChangedEventArgs e){if(e.PropertyName is not "Status" and not "Metrics")Refresh();}
    private void Refresh()
    {
        var node=vm.SelectedNode;var key=node is {} n?(vm.GraphOwner,n.Id,n.Kind,n.Type):default((ulong,ulong,int,int)?);if(shown==key&&fields.Children.Count>0)return;shown=key;fields.Children.Clear();
        var title=new TextBlock{FontSize=13,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,0,0,4)};title.SetBinding(TextBlock.TextProperty,new Binding(nameof(vm.SelectedNodeName)));fields.Children.Add(title);
        if(node is not {} value){fields.Children.Add(new TextBlock{Text="Select an effect or a node to edit its parameters.",TextWrapping=TextWrapping.Wrap});return;}
        if(value.Kind is >=3 and <=5)
        {
            var types=new ComboBox{ItemsSource=NodeSchema.Types,Margin=new Thickness(0,0,0,10),ToolTip="Signal type · changing it must keep all cables compatible"};types.SetBinding(ComboBox.SelectedIndexProperty,new Binding(nameof(vm.NodeType)){Mode=BindingMode.TwoWay});types.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEditNode)));fields.Children.Add(types);
        }
        if(value.Kind==2){var color=new ColorField{ToolTip="sRGB color; the engine converts it to linear",Margin=new Thickness(0,0,0,4)};color.SetBinding(ColorField.ValueProperty,new Binding(nameof(vm.NodeColor)){Mode=BindingMode.TwoWay,ValidatesOnExceptions=true});color.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEditNode)));fields.Children.Add(color);}
        var labels=NodeSchema.Parameters(value.Kind);for(int i=0;i<labels.Length;++i)
        {
            var bounds=NodeSchema.Bounds(value.Kind,i);var row=new ParameterRow{Label=labels[i],Minimum=bounds.Min,Maximum=bounds.Max,Step=bounds.Step};row.SetBinding(ParameterRow.ValueProperty,new Binding($"NodeValue{i}"){Mode=BindingMode.TwoWay});row.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEditNode)));fields.Children.Add(row);
        }
        if(labels.Length==0)fields.Children.Add(new TextBlock{Text="This node is controlled by its input connections.",TextWrapping=TextWrapping.Wrap});
        fields.Children.Add(new TextBlock{Text=$"#{value.Id} · {NodeSchema.Types[value.Type]}"+(value.Id==vm.GraphOutput?" · active output":""),FontSize=10,Margin=new Thickness(0,8,0,0)});
    }
}
