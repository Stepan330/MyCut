using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using MyCut.Editor.Controls;
using MyCut.Editor.Services;

namespace MyCut.Editor;
public partial class MainWindow
{
    // Focused UI suite: no masks, node mutations, video trimming or project edits.
    internal void RunSpatialTests()
    {
        var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(600)};
        timer.Tick+=(_,_)=>{
            timer.Stop();var checks=new List<string>();string folder=Path.Combine(AppContext.BaseDirectory,"spatial-tests");Directory.CreateDirectory(folder);
            void Check(bool value,string message){if(!value)throw new InvalidOperationException(message);checks.Add(message);}
            try{
                string before=vm.Engine.ProjectText;viewport.RenderNow();
                Check(vm.ForceSoftware||viewport.UsesSharedSurface,"Main viewport retains the shared GPU surface");
                SpaceView.SetView(true,false);SpatialSettings.Current.Depth=140;SpatialSettings.Current.PopupDepth=160;SpatialSettings.Current.CameraX=80;SpatialSettings.Current.CameraY=40;SpatialSettings.Current.CameraYaw=3;UpdateLayout();PumpFrames(40);
                var local=new Point(SpaceView.ActualWidth/2,SpaceView.ActualHeight/2);var projected=SpaceView.ProjectSurface(local);var recovered=SpaceView.SurfacePoint(projected);
                Check(recovered.HasValue&&(recovered.Value-local).Length<.1,"Camera offsets retain perspective ray picking");
                var camera=SpatialSettings.Current;double x=camera.CameraX;SpaceView.MoveCamera(1,0,0,.1);Check(camera.CameraX>x,"UE-style strafe uses the camera basis and delta time");
                projectMenu.Open();WaitForUi(()=>projectMenu.IsOpen);PumpFrames(200);
                Check(SpatialCoordinates.SurfaceFor(ProjectPopupShell)==SpaceView,"Project menu is a real 3D layer, not a Popup HWND");
                var screen=SpatialCoordinates.ToScreen(ProjectPopupShell,new Point(20,20));var localAgain=SpatialCoordinates.Translate(SpaceView,SpaceView.PointFromScreen(screen),ProjectPopupShell);
                Check((localAgain-new Point(20,20)).Length<1.5,$"Raised flyout coordinates roundtrip within screen-pixel precision ({localAgain})");
                var hit=SpaceView.InputHitTest(SpaceView.PointFromScreen(screen)) as DependencyObject;
                CaptureUi(folder,"project-menu-debug.png");
                if(hit is not null&&!ProjectPopupShell.IsAncestorOf(hit)){var parents=new List<string>();for(DependencyObject? node=ProjectPopupShell;node is not null;node=System.Windows.Media.VisualTreeHelper.GetParent(node))parents.Add(node is UIElement ui?$"{node.GetType().Name}:visible={ui.IsVisible},loaded={(node as FrameworkElement)?.IsLoaded}":node.GetType().Name);File.WriteAllText(Path.Combine(folder,"parents.txt"),string.Join("\n",parents));}
                Check(hit is not null&&(hit==ProjectPopupShell||ProjectPopupShell.IsAncestorOf(hit)),$"Raised project menu receives actual perspective input (hit={hit?.GetType().Name}, visible={ProjectPopupShell.IsVisible}/{ProjectPopupShell.IsHitTestVisible}/{ProjectPopupShell.IsEnabled}, localHit={ProjectPopupShell.InputHitTest(new Point(20,20))?.GetType().Name}, size={ProjectPopupShell.ActualWidth}/{ProjectPopupShell.ActualHeight}, point={SpaceView.PointFromScreen(screen)})");
                CaptureUi(folder,"project-menu-3d.png");projectMenu.Close(true);
                sceneFlyout.Open();PumpFrames(200);Check(SpatialCoordinates.SurfaceFor(ScenePopupShell)==SpaceView,"Scene flyout shares the 3D host");sceneFlyout.Close(true);
                OnSpatialView(SpatialViewButton,new RoutedEventArgs());PumpFrames(80);Check(spatialSettingsPopup.IsOpen,"3D settings open on an elevated live layer");CaptureUi(folder,"camera-settings-3d.png");spatialSettingsPopup.IsOpen=false;
                // A font-style dropdown exercises template-owned content on another 3D plane.
                var combo=new ComboBox{Width=210,ItemsSource=new[]{"Segoe UI","Arial","Consolas"},SelectedIndex=0};var temporary=new SpatialFlyout{Child=new Border{Width=250,Padding=new Thickness(10),Child=combo},StaysOpen=true};SpatialCoordinates.AnchorPopup(temporary,SpatialViewButton,new Point(-300,40));temporary.IsOpen=true;PumpFrames(40);combo.ApplyTemplate();combo.IsDropDownOpen=true;PumpFrames(80);
                var dropdown=combo.Template.FindName("PART_SpatialDropdown",combo) as SpatialFlyout;
                Check(dropdown?.IsOpen==true&&dropdown.Child is {} child&&SpatialCoordinates.SurfaceFor(child)==SpaceView,"Font dropdown uses a live 3D layer");
                Check(Descendants<ComboBoxItem>(dropdown!.Child!).Count()==3,"3D dropdown creates selectable item containers");
                combo.SelectedIndex=2;Check((string)combo.SelectedItem=="Consolas","Dropdown selection updates the original control");CaptureUi(folder,"dropdown-3d.png");combo.IsDropDownOpen=false;temporary.IsOpen=false;
                string path=Path.Combine(folder,"spatial-settings.json");camera.Save(path);camera.Depth=10;camera.Load(path);Check(camera.Depth==140,"Spatial settings persist independently of the document");
                SpaceView.SetView(false,false);Check(camera.CameraX==0&&camera.CameraYaw==0,"F7 reset restores a reachable editing camera");
                Check(vm.Engine.ProjectText==before,"Camera, menus and settings do not mutate the project");
                File.WriteAllText(Path.Combine(folder,"result.json"),JsonSerializer.Serialize(new{Passed=true,Checks=checks,Presentation=viewport.PresentationMode},new JsonSerializerOptions{WriteIndented=true}));
                Application.Current.Shutdown(0);
            }catch(Exception ex){App.Log(ex);File.WriteAllText(Path.Combine(folder,"result.json"),JsonSerializer.Serialize(new{Passed=false,Checks=checks,Error=ex.ToString()},new JsonSerializerOptions{WriteIndented=true}));Application.Current.Shutdown(1);}
        };timer.Start();
    }
}
