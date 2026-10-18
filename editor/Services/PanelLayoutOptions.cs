using System.Windows;

namespace MyCut.Editor.Services;

// Shared defaults for the whole family of floating editors / settings windows.
// Specialized windows may override their own size; chrome, layers and input stay common.
public sealed record PanelLayoutOptions(double Width=620,double Height=780,double MinimumWidth=380,double MinimumHeight=300,double HeadHeight=42,double BodyPadding=22,double CornerRadius=8)
{
    public static PanelLayoutOptions Shared{get;}=new();
    public Thickness Padding=>new(BodyPadding);
}
