using System.IO;
using ImageMagick;

namespace MyCut.Editor.Services;

public enum PhotoOperation { AutoLevels, Blur, Sharpen, Denoise, Grayscale, Invert, Brightness, Saturation, FlipHorizontal, FlipVertical, Rotate90 }

// The project/UI API has no ImageMagick types; results are new PNG assets, never source overwrites.
public static class PhotoProcessor
{
    private static readonly SemaphoreSlim Gate=new(1);
    static PhotoProcessor()
    {
        ResourceLimits.Memory=256UL*1024*1024;
        ResourceLimits.Disk=512UL*1024*1024;
        ResourceLimits.Thread=2;
        ResourceLimits.Width=8192;ResourceLimits.Height=8192;
    }
    public static async Task<byte[]> ProcessAsync(string path,PhotoOperation operation,double amount,CancellationToken cancellation=default)
    {
        if(!double.IsFinite(amount)||amount<0||amount>200)throw new ArgumentOutOfRangeException(nameof(amount));
        await Gate.WaitAsync(cancellation);
        try{return await Task.Run(()=>
        {
            cancellation.ThrowIfCancellationRequested();
            var info=new FileInfo(path);if(info.Length>64*1024*1024)throw new InvalidOperationException("Photo tools accept files up to 64 MiB.");
            var format=info.Extension.ToLowerInvariant() switch{ ".png"=>MagickFormat.Png,".jpg" or ".jpeg"=>MagickFormat.Jpeg,".bmp"=>MagickFormat.Bmp,".tif" or ".tiff"=>MagickFormat.Tiff,_=>throw new InvalidOperationException("Import a PNG, JPEG, BMP or TIFF photo first.")};
            byte[] source=File.ReadAllBytes(path);var settings=new MagickReadSettings{Format=format,FrameIndex=0,FrameCount=1};
            using var image=new MagickImage();image.Ping(source,settings);
            if(image.Width>8192||image.Height>8192||(ulong)image.Width*image.Height>16*1024*1024)throw new InvalidOperationException("Photo tools currently support up to 16 megapixels and 8192 pixels per side.");
            cancellation.ThrowIfCancellationRequested();image.Read(source,settings);
            switch(operation)
            {
                case PhotoOperation.AutoLevels:image.AutoLevel();break;
                case PhotoOperation.Blur:image.Blur(0,amount/20);break;
                case PhotoOperation.Sharpen:image.Sharpen(0,amount/40);break;
                case PhotoOperation.Denoise:image.MedianFilter((uint)Math.Clamp(Math.Round(amount/20),1,10));break;
                case PhotoOperation.Grayscale:image.Grayscale();break;
                case PhotoOperation.Invert:image.Negate();break;
                case PhotoOperation.Brightness:image.Modulate(new Percentage(amount),new Percentage(100),new Percentage(100));break;
                case PhotoOperation.Saturation:image.Modulate(new Percentage(100),new Percentage(amount),new Percentage(100));break;
                case PhotoOperation.FlipHorizontal:image.Flop();break;
                case PhotoOperation.FlipVertical:image.Flip();break;
                case PhotoOperation.Rotate90:image.Rotate(90);break;
                default:throw new ArgumentOutOfRangeException(nameof(operation));
            }
            cancellation.ThrowIfCancellationRequested();return image.ToByteArray(MagickFormat.Png);
        },cancellation);}
        finally{Gate.Release();}
    }
}
