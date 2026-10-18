using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using System.Windows.Shapes;

namespace MyCut.Editor.Controls;
public static class EditorIcons
{
    public static Geometry Geometry(string name)
    {
        string data=name switch
        {
            "photo"=>"M2,4 L22,4 22,20 2,20 Z M4,18 L10,11 14,15 17,12 21,18 M16,6 A2,2 0 1 0 16,10 A2,2 0 1 0 16,6",
            "item"=>"M12,2 L22,7 22,17 12,22 2,17 2,7 Z M2,7 L12,12 22,7 M12,12 L12,22 M12,2 L12,7",
            "color"=>"M12,6 A6,6 0 1 0 12,18 A6,6 0 1 0 12,6 M12,1 L12,4 M12,20 L12,23 M1,12 L4,12 M20,12 L23,12 M4,4 L6,6 M18,18 L20,20 M4,20 L6,18 M18,6 L20,4",
            "graph"=>"M2,3 L8,3 8,9 2,9 Z M16,15 L22,15 22,21 16,21 Z M16,3 L22,3 22,9 16,9 Z M8,6 C12,6 12,18 16,18 M8,6 L16,6",
            "animation"=>"M2,20 C6,20 6,4 12,4 C18,4 18,20 22,20 M2,18 L2,22 M22,18 L22,22 M10,2 L14,2 14,6 10,6 Z",
            "audio"=>"M3,9 L7,9 12,4 12,20 7,15 3,15 Z M16,8 Q21,12 16,16 M19,4 Q27,12 19,20",
            "layers"=>"M2,8 L12,2 22,8 12,14 Z M2,12 L12,18 22,12 M2,16 L12,22 22,16",
            "transform"=>"M12,2 L12,22 M2,12 L22,12 M8,6 L12,2 16,6 M8,18 L12,22 16,18 M6,8 L2,12 6,16 M18,8 L22,12 18,16",
            "undo"=>"M9,5 L3,11 9,17 M3,11 L15,11 Q22,11 21,20",
            "redo"=>"M15,5 L21,11 15,17 M21,11 L9,11 Q2,11 3,20",
            "import"=>"M3,5 L10,5 12,8 21,8 21,21 3,21 Z M12,1 L12,14 M8,10 L12,14 16,10",
            "export"=>"M3,15 L3,21 21,21 21,15 M12,18 L12,3 M7,8 L12,3 17,8",
            "delete"=>"M4,6 L20,6 M9,6 L9,3 15,3 15,6 M6,6 L7,21 17,21 18,6 M10,10 L10,17 M14,10 L14,17",
            "duplicate"=>"M3,3 L16,3 16,16 3,16 Z M8,16 L8,21 21,21 21,8 16,8",
            "add"=>"M12,3 L12,21 M3,12 L21,12",
            "play"=>"M6,3 L21,12 6,21 Z",
            "up"=>"M12,21 L12,3 M5,10 L12,3 19,10",
            "down"=>"M12,3 L12,21 M5,14 L12,21 19,14",
            "close"=>"M5,5 L19,19 M19,5 L5,19",
            "split"=>"M4,4 L20,20 M20,4 L4,20 M6,14 A4,4 0 1 0 6,22 A4,4 0 1 0 6,14 M18,14 A4,4 0 1 0 18,22 A4,4 0 1 0 18,14",
            "fit"=>"M3,9 L3,3 9,3 M15,3 L21,3 21,9 M21,15 L21,21 15,21 M9,21 L3,21 3,15",
            "insert"=>"M12,2 L12,16 M7,11 L12,16 17,11 M3,16 L3,22 21,22 21,16",
            "ripple"=>"M9,3 L21,3 M11,3 L12,19 18,19 19,3 M9,22 L2,16 9,10 M2,16 L14,16",
            "previous"=>"M3,3 L3,21 M20,3 L7,12 20,21 Z",
            "next"=>"M21,3 L21,21 M4,3 L17,12 4,21 Z",
            "pause"=>"M7,3 L7,21 M17,3 L17,21",
            "range-in"=>"M17,3 L7,3 7,21 17,21 M3,12 L15,12 M11,8 L15,12 11,16",
            "range-out"=>"M7,3 L17,3 17,21 7,21 M9,12 L21,12 M13,8 L9,12 13,16",
            "settings"=>"M12,7 A5,5 0 1 0 12,17 A5,5 0 1 0 12,7 M12,1 L12,5 M12,19 L12,23 M1,12 L5,12 M19,12 L23,12 M4,4 L7,7 M17,17 L20,20 M4,20 L7,17 M17,7 L20,4",
            _=>"M3,4 L21,4 21,20 3,20 Z M7,8 L17,8 M7,12 L17,12 M7,16 L13,16"
        };
        var geometry=System.Windows.Media.Geometry.Parse(data);geometry.Freeze();return geometry;
    }
    public static FrameworkElement Image(string name)
    {
        var path=new System.Windows.Shapes.Path{Data=Geometry(name),StrokeThickness=1.7,StrokeStartLineCap=PenLineCap.Round,StrokeEndLineCap=PenLineCap.Round,StrokeLineJoin=PenLineJoin.Round};path.SetBinding(Shape.StrokeProperty,new Binding("Foreground"){RelativeSource=new RelativeSource(RelativeSourceMode.FindAncestor,typeof(Button),1)});
        var grid=new Grid{Width=24,Height=24};grid.Children.Add(path);return new Viewbox{Width=18,Height=18,Child=grid};
    }
}
public sealed class EditorIcon:ContentControl
{
    public static readonly DependencyProperty GlyphProperty=DependencyProperty.Register(nameof(Glyph),typeof(string),typeof(EditorIcon),new PropertyMetadata("settings",Changed));
    public string Glyph{get=>(string)GetValue(GlyphProperty);set=>SetValue(GlyphProperty,value);}
    public EditorIcon(){Width=18;Height=18;IsHitTestVisible=false;Content=EditorIcons.Image(Glyph);}
    private static void Changed(DependencyObject d,DependencyPropertyChangedEventArgs e)=>((EditorIcon)d).Content=EditorIcons.Image((string)e.NewValue);
}
