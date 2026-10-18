using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;

public sealed class ColorScopes:FrameworkElement
{
    private BitmapSource? histogram,waveform,vectorscope;
    public ColorScopes(){Height=190;MinHeight=160;}
    private static byte[] Background(int width,int height)
    {
        var pixels=new byte[width*height*4];for(int i=0;i<pixels.Length;i+=4){pixels[i]=28;pixels[i+1]=21;pixels[i+2]=14;pixels[i+3]=255;}return pixels;
    }
    private static BitmapSource Bitmap(byte[] pixels,int width,int height){var image=BitmapSource.Create(width,height,96,96,PixelFormats.Bgra32,null,pixels,width*4);image.Freeze();return image;}
    public void Update(ImageFrame frame)
    {
        const int size=256,height=140;var counts=new int[3,256];var wave=Background(size,height);var vector=Background(size,size);
        void Dot(byte[] pixels,int width,int h,int x,int y,int channel)
        {
            if(x<0||x>=width||y<0||y>=h)return;int i=(y*width+x)*4;pixels[i+channel]=(byte)Math.Min(255,pixels[i+channel]+65);
        }
        for(int y=0;y<frame.Height;y+=2)for(int x=0;x<frame.Width;x+=2)
        {
            int i=(y*frame.Width+x)*4;double b=frame.Pixels[i]/255d,g=frame.Pixels[i+1]/255d,r=frame.Pixels[i+2]/255d;
            for(int channel=0;channel<3;channel++){byte value=frame.Pixels[i+channel];counts[channel,value]++;Dot(wave,size,height,x*size/frame.Width,(int)((1-value/255d)*(height-1)),channel);}
            double luma=.2126*r+.7152*g+.0722*b,cb=(b-luma)/1.8556,cr=(r-luma)/1.5748;
            int vx=(int)(size/2+cb*size*.8),vy=(int)(size/2-cr*size*.8);Dot(vector,size,size,vx,vy,1);Dot(vector,size,size,vx,vy,2);
        }
        var hist=Background(size,height);int maximum=1;foreach(int count in counts)maximum=Math.Max(maximum,count);
        for(int channel=0;channel<3;channel++)for(int x=0;x<256;x++)
        {
            int top=height-1-(int)(Math.Log(1+counts[channel,x])/Math.Log(1+maximum)*(height-1));
            for(int y=top;y<height;y++){int i=(y*size+x)*4;hist[i+channel]=(byte)Math.Max((int)hist[i+channel],150);}
        }
        histogram=Bitmap(hist,size,height);waveform=Bitmap(wave,size,height);vectorscope=Bitmap(vector,size,size);InvalidateVisual();
    }
    protected override void OnRender(DrawingContext dc)
    {
        double pane=Math.Max(1,(ActualWidth-16)/3),h=ActualHeight-30;
        void Draw(BitmapSource? image,string label,int index)
        {
            double x=index*(pane+8);var box=new Rect(x,25,pane,h);dc.DrawRectangle((Brush)FindResource("CanvasBrush"),new Pen((Brush)FindResource("BorderBrush"),1),box);
            if(image is not null)dc.DrawImage(image,box);
            dc.DrawText(new FormattedText(label,CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),10,(Brush)FindResource("MutedBrush"),VisualTreeHelper.GetDpi(this).PixelsPerDip),new Point(x,3));
        }
        Draw(histogram,"RGB histogram (log)",0);Draw(waveform,"RGB waveform",1);Draw(vectorscope,"Vectorscope",2);
    }
}
