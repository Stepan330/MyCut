using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;
using MyCut.Editor.Views;

namespace MyCut.Editor.Controls;

public sealed class PhotoSidebar:UserControl
{
    private readonly EditorViewModel vm;
    private readonly WorkspacePane parameters=new(){Caption="PARAMETERS"};
    private readonly InspectorPanel transform=new(true);
    private readonly NodeDetailsControl details;
    private readonly ListBox effects=new(){Margin=new Thickness(0)};
    private readonly WorkspacePane effectPane=new(){Caption="EFFECTS"};
    private readonly RowDefinition parameterRow=new(){Height=GridLength.Auto,MaxHeight=420};
    private bool updating;
    public PhotoSidebar(EditorViewModel model)
    {
        vm=model;DataContext=vm;details=new NodeDetailsControl(vm);var root=new Grid();
        root.RowDefinitions.Add(parameterRow);
        root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1)});
        root.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto,MaxHeight=180});
        root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1)});
        root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1,GridUnitType.Star),MinHeight=100});
        var parameterBody=new Grid();parameterBody.Children.Add(transform);parameterBody.Children.Add(details);parameters.Body.Child=parameterBody;parameters.AddAction("transform","Item transform / definition",()=>vm.SelectNode(0));root.Children.Add(parameters);
        var enabled=new CheckBox{Content="On",ToolTip="Bypass / enable the whole graph",Margin=new Thickness(2)};enabled.SetBinding(CheckBox.IsCheckedProperty,new Binding(nameof(vm.GraphEnabled)){Mode=BindingMode.TwoWay});enabled.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));effectPane.Actions.Children.Add(enabled);
        var add=effectPane.AddAction("add","Add an image effect",()=>{});add.Click+=(_,_)=>
        {
            var menu=new ContextMenu{PlacementTarget=add};foreach(int kind in new[]{10,8,9,7}){int captured=kind;var item=new MenuItem{Header=NodeSchema.Names[kind]};item.Click+=(_,_)=>vm.AppendImageEffect(captured);menu.Items.Add(item);}menu.IsOpen=true;
        };
        add.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));effectPane.AddAction("graph","Open the node graph",vm.ActivateGraph);
        effects.DisplayMemberPath="Name";effects.SelectionChanged+=(_,_)=>{if(!updating&&effects.SelectedItem is EffectEntry item)vm.SelectNode(item.Id);};effectPane.Body.Child=effects;Grid.SetRow(effectPane,2);root.Children.Add(effectPane);
        var layers=new WorkspacePane{Caption="LAYERS / OUTLINER"};layers.AddAction("up","Move layer up",()=>{}).Command=vm.LayerUpCommand;
        layers.AddAction("down","Move layer down",()=>{}).Command=vm.LayerDownCommand;layers.AddAction("duplicate","Duplicate layer",()=>{}).Command=vm.DuplicateCommand;layers.AddAction("delete","Delete layer",()=>{}).Command=vm.DeleteCommand;
        layers.Body.Child=new OutlinerControl(vm);Grid.SetRow(layers,4);root.Children.Add(layers);
        foreach(int row in new[]{1,3}){var divider=new Border();divider.SetResourceReference(Border.BackgroundProperty,"BorderBrush");Grid.SetRow(divider,row);root.Children.Add(divider);}
        SizeChanged+=(_,_)=>parameterRow.MaxHeight=Math.Clamp(ActualHeight-160,100,420);
        Content=root;Loaded+=(_,_)=>{vm.PropertyChanged+=Changed;Refresh();};Unloaded+=(_,_)=>vm.PropertyChanged-=Changed;Refresh();
    }
    private sealed record EffectEntry(ulong Id,string Name);
    private void Changed(object? sender,PropertyChangedEventArgs e){if(e.PropertyName is not "Status" and not "Metrics")Refresh();}
    private void Refresh()
    {
        bool node=vm.SelectedNode is not null;transform.Visibility=node?Visibility.Collapsed:Visibility.Visible;details.Visibility=node?Visibility.Visible:Visibility.Collapsed;parameters.Caption=node?"EFFECT PARAMETERS":"ITEM PARAMETERS";
        var next=vm.GraphNodes.Where(n=>n.Kind is >=3 and <=10).Select(n=>new EffectEntry(n.Id,NodeSchema.Names[n.Kind]+$"  #{n.Id}")).ToArray();
        updating=true;try{if(!effects.Items.Cast<EffectEntry>().SequenceEqual(next))effects.ItemsSource=next;effects.SelectedItem=next.FirstOrDefault(n=>n.Id==vm.SelectedNodeId);}finally{updating=false;}
        effectPane.Body.Visibility=next.Length==0?Visibility.Collapsed:Visibility.Visible;
        effects.ToolTip=next.Length==0?"No effects. Use + to add a real effect, or open Graph to connect nodes.":"Select an effect to edit its parameters above. Connections are edited in Graph.";
    }
}
