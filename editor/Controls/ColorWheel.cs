using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public sealed class ColorWheel:FrameworkElement
{
    public static readonly DependencyProperty RedProperty=DependencyProperty.Register(nameof(Red),typeof(double),typeof(ColorWheel),new FrameworkPropertyMetadata(0d,FrameworkPropertyMetadataOptions.BindsTwoWayByDefault|FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty GreenProperty=DependencyProperty.Register(nameof(Green),typeof(double),typeof(ColorWheel),new FrameworkPropertyMetadata(0d,FrameworkPropertyMetadataOptions.BindsTwoWayByDefault|FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty BlueProperty=DependencyProperty.Register(nameof(Blue),typeof(double),typeof(ColorWheel),new FrameworkPropertyMetadata(0d,FrameworkPropertyMetadataOptions.BindsTwoWayByDefault|FrameworkPropertyMetadataOptions.AffectsRender));
    private static readonly BitmapSource Disk=CreateDisk();
    private IEditGesture? gesture;
    public string Label{get;set;}="Lift";
    public double Center{get;set;}
    public double Strength{get;set;}=.25;
    public double Red{get=>(double)GetValue(RedProperty);set=>SetValue(RedProperty,value);}
    public double Green{get=>(double)GetValue(GreenProperty);set=>SetValue(GreenProperty,value);}
    public double Blue{get=>(double)GetValue(BlueProperty);set=>SetValue(BlueProperty,value);}
    public ColorWheel(){Width=132;Height=153;Focusable=true;Cursor=Cursors.Hand;Unloaded+=(_,_)=>Finish(true);}
    private static Color Hue(double hue,double saturation)
    {
        double h=hue*6,x=1-Math.Abs(h%2-1);(double r,double g,double b)=h switch{<1=>(1d,x,0d),<2=>(x,1d,0d),<3=>(0d,1d,x),<4=>(0d,x,1d),<5=>(x,0d,1d),_=>(1d,0d,x)};
        return Color.FromRgb((byte)Math.Round((1-saturation+r*saturation)*255),(byte)Math.Round((1-saturation+g*saturation)*255),(byte)Math.Round((1-saturation+b*saturation)*255));
    }
    private static BitmapSource CreateDisk()
    {
        const int size=128;var bytes=new byte[size*size*4];
        for(int y=0;y<size;y++)for(int x=0;x<size;x++){double dx=(x-size/2d)/(size/2d),dy=(y-size/2d)/(size/2d),radius=Math.Sqrt(dx*dx+dy*dy);if(radius>1)continue;var c=Hue((Math.Atan2(dy,dx)/Math.Tau+1)%1,radius);int i=(y*size+x)*4;bytes[i]=c.B;bytes[i+1]=c.G;bytes[i+2]=c.R;bytes[i+3]=255;}
        var disk=BitmapSource.Create(size,size,96,96,PixelFormats.Bgra32,null,bytes,size*4);disk.Freeze();return disk;
    }
    protected override void OnRender(DrawingContext dc)
    {
        var center=new Point(ActualWidth/2,76);double radius=Math.Min(ActualWidth/2-12,55);
        dc.DrawImage(Disk,new Rect(center.X-radius,center.Y-radius,radius*2,radius*2));dc.DrawEllipse(null,new Pen(Brushes.SlateGray,1),center,radius,radius);
        double x=(Red-Center)-.5*((Green-Center)+(Blue-Center)),y=.866*(Green-Blue);var marker=new Vector(x,y);if(marker.Length>Strength)marker*=Strength/marker.Length;
        dc.DrawEllipse(Brushes.Black,new Pen(Brushes.White,2),center+marker/Strength*radius,5,5);
        dc.DrawText(new FormattedText(Label,CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),12,(Brush)FindResource("TextBrush"),VisualTreeHelper.GetDpi(this).PixelsPerDip),new Point(12,2));
        dc.DrawText(new FormattedText("drag to balance",CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),10,(Brush)FindResource("MutedBrush"),VisualTreeHelper.GetDpi(this).PixelsPerDip),new Point(22,137));
    }
    private void Update(Point point)
    {
        var delta=point-new Point(ActualWidth/2,76);double radius=Math.Min(ActualWidth/2-12,55),distance=Math.Min(1,delta.Length/radius);
        var c=Hue((Math.Atan2(delta.Y,delta.X)/Math.Tau+1)%1,1);double mean=(c.R+c.G+c.B)/3d/255;
        SetCurrentValue(RedProperty,Center+(c.R/255d-mean)*distance*Strength);SetCurrentValue(GreenProperty,Center+(c.G/255d-mean)*distance*Strength);SetCurrentValue(BlueProperty,Center+(c.B/255d-mean)*distance*Strength);
    }
    protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e){Focus();gesture=DataContext as IEditGesture;gesture?.BeginGesture();CaptureMouse();Update(e.GetPosition(this));e.Handled=true;}
    protected override void OnMouseMove(MouseEventArgs e){if(IsMouseCaptured){Update(e.GetPosition(this));e.Handled=true;}}
    protected override void OnMouseLeftButtonUp(MouseButtonEventArgs e){Finish(false);e.Handled=true;}
    protected override void OnKeyDown(KeyEventArgs e){if(e.Key==Key.Escape){Finish(true);e.Handled=true;}else base.OnKeyDown(e);}
    protected override void OnLostMouseCapture(MouseEventArgs e){if(gesture is not null){gesture.EndGesture();gesture=null;}base.OnLostMouseCapture(e);}
    private void Finish(bool cancel){var current=gesture;gesture=null;if(cancel)current?.CancelGesture();else current?.EndGesture();ReleaseMouseCapture();}
    internal void BalanceForTest(Point position){gesture=DataContext as IEditGesture;gesture?.BeginGesture();Update(position);Finish(false);}
}
