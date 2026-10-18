using System.Globalization;
using System.Windows;

namespace MyCut.Editor.Controls;
// Relative movement in DIPs, independent of control width or label text.
internal sealed class NumericDrag(double initial, Point start, double step, double minimum, double maximum, bool clamp)
{
    private readonly Point startPoint = start;
    private readonly double initialValue = initial;
    private Point previous = start;
    public double Value { get; private set; } = initial;
    public bool Started { get; private set; }
    public bool Move(Point point, bool fine, bool coarse)
    {
        if (!Started && (point - startPoint).Length < 5) return false;
        Started = true;
        double sensitivity = Math.Max(.000001, step) * (fine ? .1 : coarse ? 10 : 1);
        Value += (point.X - previous.X) * sensitivity;
        previous = point;
        if (clamp) Value = Math.Clamp(Value, Math.Min(minimum, initialValue), Math.Max(maximum, initialValue));
        return true;
    }
    public static bool TryNumber(string text, out double value)
    {
        bool parsed = double.TryParse(text, NumberStyles.Float, CultureInfo.CurrentCulture, out value) ||
            double.TryParse(text.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        return parsed && double.IsFinite(value);
    }
}
