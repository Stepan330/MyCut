using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace MyCut.Editor.Controls;

// The same foundation / head / body / overlay contract is used in every dock.
// The body decides whether it needs its own scroll or a canvas: no nested global scroll.
public sealed class WorkspacePane:UserControl
{
    public Grid Foundation{get;}=new(){ClipToBounds=true};
    public DockPanel Head{get;}=new(){MinHeight=28,Margin=new Thickness(8,0,4,0),LastChildFill=true};
    public Border Body{get;}=new();
    public Canvas Overlay{get;}=new(){IsHitTestVisible=false};
    public ElasticControlPanel Actions{get;}=new(){VerticalAlignment=VerticalAlignment.Center,Spacing=3};
    private readonly TextBlock caption=new(){FontSize=10,FontWeight=FontWeights.SemiBold,TextTrimming=TextTrimming.CharacterEllipsis};
    public string Caption{get=>caption.Text;set=>caption.Text=value;}
    public WorkspacePane()
    {
        SetResourceReference(BackgroundProperty,"PanelBrush");SetResourceReference(ForegroundProperty,"TextBrush");Foundation.SetResourceReference(Panel.BackgroundProperty,"PanelBrush");
        Foundation.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});Foundation.RowDefinitions.Add(new RowDefinition());
        var strip=new Border{BorderThickness=new Thickness(0,0,0,1),Child=Head};strip.SetResourceReference(Border.BackgroundProperty,"RaisedBrush");strip.SetResourceReference(Border.BorderBrushProperty,"BorderBrush");
        caption.SetResourceReference(TextBlock.ForegroundProperty,"MutedBrush");DockPanel.SetDock(Actions,Dock.Right);Head.Children.Add(Actions);Head.Children.Add(caption);
        Foundation.Children.Add(strip);Grid.SetRow(Body,1);Foundation.Children.Add(Body);Grid.SetRowSpan(Overlay,2);Foundation.Children.Add(Overlay);Content=Foundation;
    }
    public Button AddAction(string icon,string hint,Action action)
    {
        var button=new Button{Content=EditorIcons.Image(icon),ToolTip=hint,Padding=new Thickness(3),Margin=new Thickness(0),MinHeight=24,MinWidth=24};
        button.Click+=(_,_)=>action();Actions.Children.Add(button);return button;
    }
}
