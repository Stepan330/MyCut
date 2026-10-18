using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

public sealed class PhotoProcessingWindow:Window
{
    public PhotoProcessingWindow(EditorViewModel vm)
    {
        Title="Photo tools · processed copy";Width=720;Height=570;MinWidth=420;MinHeight=350;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        SetResourceReference(BackgroundProperty,"PanelBrush");SetResourceReference(ForegroundProperty,"TextBrush");
        string source=vm.Selected?.Source??"";var cancel=new CancellationTokenSource();Closed+=(_,_)=>cancel.Cancel();
        var root=new DockPanel{Margin=new Thickness(12)};Content=root;
        var header=new StackPanel();DockPanel.SetDock(header,Dock.Top);root.Children.Add(header);
        header.Children.Add(new TextBlock{Text="Creates a new image layer. Original source and layer are kept.",Margin=new Thickness(0,0,0,8)});
        var operation=new ComboBox{ItemsSource=Enum.GetValues<PhotoOperation>(),SelectedIndex=0};header.Children.Add(operation);
        var amount=new ParameterRow{Label="Amount / %",Minimum=0,Maximum=200,Step=1,Value=100};header.Children.Add(amount);
        var footer=new StackPanel();DockPanel.SetDock(footer,Dock.Bottom);root.Children.Add(footer);
        var status=new TextBlock{TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,8,0,8)};footer.Children.Add(status);
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};footer.Children.Add(buttons);
        var preview=new Button{Content="Preview"};var apply=new Button{Content="Import processed copy",IsEnabled=false};var close=new Button{Content="Cancel"};buttons.Children.Add(preview);buttons.Children.Add(apply);buttons.Children.Add(close);close.Click+=(_,_)=>Close();
        var image=new Image{Margin=new Thickness(0,8,0,0)};root.Children.Add(image);byte[]? result=null;
        void Invalidate(){result=null;apply.IsEnabled=false;status.Text="Preview the current settings before importing.";}
        operation.SelectionChanged+=(_,_)=>Invalidate();
        // ParameterRow exposes a dependency property rather than a RangeBase event.
        System.ComponentModel.DependencyPropertyDescriptor.FromProperty(ParameterRow.ValueProperty,typeof(ParameterRow))!.AddValueChanged(amount,AmountChanged);
        void AmountChanged(object? sender,EventArgs e)=>Invalidate();
        Closed+=(_,_)=>System.ComponentModel.DependencyPropertyDescriptor.FromProperty(ParameterRow.ValueProperty,typeof(ParameterRow))!.RemoveValueChanged(amount,AmountChanged);
        preview.Click+=async(_,_)=>
        {
            preview.IsEnabled=operation.IsEnabled=amount.IsEnabled=false;apply.IsEnabled=false;status.Text="Processing…";
            try
            {
                result=await PhotoProcessor.ProcessAsync(source,(PhotoOperation)operation.SelectedItem,amount.Value,cancel.Token);
                if(cancel.IsCancellationRequested)return;
                using var stream=new MemoryStream(result);var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.StreamSource=stream;bitmap.EndInit();bitmap.Freeze();image.Source=bitmap;apply.IsEnabled=true;status.Text=$"{bitmap.PixelWidth} × {bitmap.PixelHeight} · PNG copy ready";
            }
            catch(OperationCanceledException){}
            catch(Exception ex){status.Text=ex.Message;result=null;}
            finally{preview.IsEnabled=operation.IsEnabled=amount.IsEnabled=true;}
        };
        apply.Click+=(_,_)=>
        {
            if(result is null)return;
            try{string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MyCut","assets");Directory.CreateDirectory(directory);string path=Path.Combine(directory,$"photo-{Guid.NewGuid():N}.png");File.WriteAllBytes(path,result);vm.ImportPath(path);Close();}
            catch(Exception ex){status.Text=ex.Message;}
        };
    }
}
