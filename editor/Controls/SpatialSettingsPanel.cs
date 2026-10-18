using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;
public sealed class SpatialSettingsPanel:StackPanel
{
    public SpatialSettingsPanel(SpatialWorkspace? workspace=null)
    {
        DataContext=SpatialSettings.Current;
        Children.Add(new TextBlock{Text="3D INTERFACE / CAMERA",FontSize=14,Margin=new Thickness(0,0,0,12)});
        void Number(string label,string property,double min,double max,double step){var row=new ParameterRow{Label=label,Minimum=min,Maximum=max,Step=step};row.SetBinding(ParameterRow.ValueProperty,new Binding(property){Mode=BindingMode.TwoWay,UpdateSourceTrigger=UpdateSourceTrigger.PropertyChanged});Children.Add(row);}
        Number("Interface depth / DIP",nameof(SpatialSettings.Depth),1,240,1);Number("Popup depth / DIP",nameof(SpatialSettings.PopupDepth),0,300,1);
        Number("Camera FOV / deg",nameof(SpatialSettings.FieldOfView),20,80,.5);
        Number("Camera X",nameof(SpatialSettings.CameraX),-6000,6000,4);Number("Camera Y",nameof(SpatialSettings.CameraY),-6000,6000,4);Number("Camera Z offset",nameof(SpatialSettings.CameraZ),-1200,6000,4);
        Number("Camera yaw",nameof(SpatialSettings.CameraYaw),-80,80,.5);Number("Camera pitch",nameof(SpatialSettings.CameraPitch),-80,80,.5);
        Number("Fly speed / DIP/s",nameof(SpatialSettings.FlySpeed),20,4000,10);Number("Mouse sensitivity",nameof(SpatialSettings.Sensitivity),.02,1,.01);
        var controls=new WrapPanel();void Button(string label,Action action){var button=new Button{Content=label};button.Click+=(_,_)=>action();controls.Children.Add(button);}
        if(workspace is not null)Button("Overview · F6",workspace.ToggleOverview);
        Button("Reset camera · F7",()=>{SpatialSettings.Current.ResetCamera();workspace?.SetView(false);});Children.Add(controls);
        Children.Add(new TextBlock{Text="F6: overview. In overview hold RMB: mouse look + WASD / Q↓ E↑. Shift: faster. RMB + wheel: speed. Alt+RMB: orbit. F7: return to editing.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,10,0,0)});
    }
}
