using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

// Tree entries are views of existing stable IDs, never a second document model.
public sealed class OutlinerControl:UserControl
{
    private readonly EditorViewModel vm;
    private readonly TreeView tree=new(){BorderThickness=new Thickness(0)};
    private readonly TextBox search=new(){MinHeight=24,ToolTip="Search objects and their contents"};
    private readonly TextBlock path=new(){FontSize=10,Margin=new Thickness(6,3,6,3),TextTrimming=TextTrimming.CharacterEllipsis};
    private bool local,rebuilding;
    private string signature="";
    public OutlinerControl(EditorViewModel model,bool localByDefault=false)
    {
        vm=model;local=localByDefault;var root=new DockPanel();
        var header=new StackPanel();var modes=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(3)};
        foreach(var mode in new[]{"Global","Local"}){var button=new Button{Content=mode,MinHeight=24,Padding=new Thickness(6,2,6,2)};button.Click+=(_,_)=>{local=mode=="Local";Refresh(true);};modes.Children.Add(button);}
        header.Children.Add(modes);header.Children.Add(search);header.Children.Add(path);DockPanel.SetDock(header,Dock.Top);root.Children.Add(header);root.Children.Add(tree);Content=root;
        tree.SetResourceReference(BackgroundProperty,"PanelBrush");tree.SetResourceReference(ForegroundProperty,"TextBrush");
        search.TextChanged+=(_,_)=>Refresh(true);
        tree.SelectedItemChanged+=(_,_)=>{if(rebuilding||tree.SelectedItem is not TreeViewItem{Tag:Entry entry})return;
            if(vm.Selected?.Id!=entry.Owner)vm.Selected=vm.Items.FirstOrDefault(i=>i.Id==entry.Owner);
            vm.SelectNode(entry.Node);};
        Loaded+=(_,_)=>{vm.PropertyChanged+=Changed;Refresh(true);};Unloaded+=(_,_)=>vm.PropertyChanged-=Changed;Refresh(true);
    }
    private sealed record Entry(ulong Owner,ulong Node);
    private void Changed(object? sender,PropertyChangedEventArgs e){if(e.PropertyName is not "Metrics" and not "Status")Refresh();}
    private void Refresh(bool force=false)
    {
        var expanded=tree.Items.OfType<TreeViewItem>().Where(i=>i.IsExpanded).Select(i=>((Entry)i.Tag).Owner).ToHashSet();
        // Notifications can precede Reload after deletion/Undo; never query stale UI IDs.
        var current=vm.Engine.Items().AsEnumerable().Reverse();
        var data=(local?current.Where(i=>i.Id==vm.Selected?.Id):current).Select(i=>(Item:i,Nodes:vm.Engine.Nodes(i.Id))).ToArray();
        string next=$"{local}/{search.Text}/"+string.Join(";",data.Select(d=>$"{d.Item.Id}:{d.Item.Name}:{d.Item.Visible}:{d.Item.Locked}:"+string.Join(",",d.Nodes.Select(n=>$"{n.Id}:{n.Kind}"))));
        path.Text=local?$"Composition › {vm.SelectionName}":"Composition · Global";
        if(!force&&next==signature){SelectCurrent();return;}signature=next;rebuilding=true;
        try
        {
            tree.Items.Clear();
            foreach(var dataItem in data)
            {
                var item=dataItem.Item;var nodes=dataItem.Nodes;
                bool Matches(string name)=>name.Contains(search.Text,StringComparison.OrdinalIgnoreCase);
                bool rootMatches=Matches(item.Name);
                if(!rootMatches&&!nodes.Any(n=>Matches(NodeSchema.Names[n.Kind])))continue;
                string kind=item.Content.Kind switch{1=>"Text",5 or 6=>"Shape",8=>"Video",_=>"Image"};
                var parent=Row($"{item.Name}  · {(nodes.Count>0?"Item / ":"")}{kind}{(item.Locked?" · locked":"")}{(!item.Visible?" · hidden":"")}",new(item.Id,0));
                parent.IsExpanded=local||expanded.Contains(item.Id)||search.Text.Length>0;
                foreach(var node in nodes)
                {
                    if(!rootMatches&&!Matches(NodeSchema.Names[node.Kind]))continue;
                    var child=Row($"{NodeSchema.Names[node.Kind]}  #{node.Id}",new(item.Id,node.Id));
                    child.ToolTip=node.Kind==6?"Mask object · select to edit on canvas or in Parameters":"Shared graph element · select to inspect";
                    parent.Items.Add(child);
                }
                tree.Items.Add(parent);
            }
            SelectCurrent();
        }
        finally{rebuilding=false;}
    }
    private TreeViewItem Row(string name,Entry entry)
    {
        var text=new TextBlock{Text=name,FontSize=11.5,TextTrimming=TextTrimming.CharacterEllipsis};
        return new TreeViewItem{Header=text,Tag=entry,MinHeight=24,Padding=new Thickness(2,2,0,2),ToolTip=name};
    }
    private void SelectCurrent()
    {
        bool previous=rebuilding;rebuilding=true;
        try{foreach(var parent in tree.Items.OfType<TreeViewItem>())foreach(var row in new[]{parent}.Concat(parent.Items.OfType<TreeViewItem>()))
            if(row.Tag is Entry e)row.IsSelected=e.Owner==vm.Selected?.Id&&e.Node==vm.SelectedNodeId;}
        finally{rebuilding=previous;}
    }
}
