using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class GraphWorkspace:UserControl
{
    public NodeCanvas Canvas{get;}
    public GraphWorkspace(EditorViewModel vm,MotionEngine motion,PointerIntentTracker tracker)
    {
        DataContext=vm;var root=new Grid();root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1.7,GridUnitType.Star),MinHeight=180});root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(5)});root.RowDefinitions.Add(new RowDefinition{Height=new GridLength(1,GridUnitType.Star),MinHeight=140});
        var graph=new WorkspacePane{Caption="GRAPH"};Canvas=new NodeCanvas(vm,motion,tracker){MinHeight=150};graph.Body.Child=Canvas;
        var bypass=new CheckBox{Content="On",Margin=new Thickness(2),ToolTip="Enable graph"};bypass.SetBinding(CheckBox.IsCheckedProperty,new Binding(nameof(vm.GraphEnabled)){Mode=BindingMode.TwoWay});bypass.SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));graph.Actions.Children.Add(bypass);
        graph.AddAction("add","Add node · Tab (creates source → output for an empty graph)",()=>{if(vm.GraphNodes.Count==0){vm.CreateGraph();Canvas.Fit();}else Canvas.OpenPalette();}).SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEdit)));
        graph.AddAction("fit","Fit nodes · F",Canvas.Fit);graph.AddAction("delete","Delete selected node",vm.DeleteGraphNode).SetBinding(IsEnabledProperty,new Binding(nameof(vm.CanEditNode)));root.Children.Add(graph);
        var divider=new GridSplitter{HorizontalAlignment=HorizontalAlignment.Stretch,VerticalAlignment=VerticalAlignment.Stretch,ResizeDirection=GridResizeDirection.Rows,ResizeBehavior=GridResizeBehavior.PreviousAndNext};Grid.SetRow(divider,1);root.Children.Add(divider);
        var details=new WorkspacePane{Caption="DETAILS"};
        var tabs=new TabControl();tabs.Items.Add(new TabItem{Header="Parameters",Content=new NodeDetailsControl(vm)});tabs.Items.Add(new TabItem{Header="Outliner",Content=new OutlinerControl(vm,true)});
        details.Body.Child=tabs;Grid.SetRow(details,2);root.Children.Add(details);Content=root;
        IsVisibleChanged+=(_,_)=>{if(IsVisible)Dispatcher.BeginInvoke(Canvas.Fit);};
    }
}
