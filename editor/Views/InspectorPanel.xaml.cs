using System.Windows.Controls;
using System.Windows;
namespace MyCut.Editor.Views;
public partial class InspectorPanel : UserControl
{
    public InspectorPanel():this(false){}
    public InspectorPanel(bool compact)
    {
        InitializeComponent();
        if(!compact)return;
        InspectorBody.Margin=new Thickness(10);InspectorCaption.Visibility=InspectorIdentity.Visibility=TransformCaption.Visibility=InspectorHint.Visibility=Visibility.Collapsed;
    }
}
