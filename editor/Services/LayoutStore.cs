using System.IO;
using System.Text.Json;

namespace MyCut.Editor.Services;
public record EditorLayout(int Version = 1, double Width = 1440, double Height = 900, double Left = 280, double Right = 300, bool ScenePinned = false);
public sealed class LayoutStore(string path)
{
    public EditorLayout Load()
    {
        if (!File.Exists(path)) return new EditorLayout();
        try
        {
            var layout = JsonSerializer.Deserialize<EditorLayout>(File.ReadAllText(path));
            if (layout is not null && layout.Version == 1 && double.IsFinite(layout.Width) && double.IsFinite(layout.Height) &&
                double.IsFinite(layout.Left) && double.IsFinite(layout.Right))
                return layout with { Width = Math.Clamp(layout.Width, 1080, 3000), Height = Math.Clamp(layout.Height, 700, 2000),
                    Left = Math.Clamp(layout.Left, 200, 400), Right = Math.Clamp(layout.Right, 260, 420) };
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException) { App.Log(ex); }
        return new EditorLayout();
    }
    public void Save(EditorLayout layout)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + ".writing";
        File.WriteAllText(temp, JsonSerializer.Serialize(layout, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temp, path, true);
    }
}
