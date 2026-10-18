using System.Runtime.InteropServices;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;

internal static class Program
{
    [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr pointer,int mode);
    [DllImport("ole32.dll")] private static extern void CoUninitialize();
    private static void Check(bool value,string message){if(!value)throw new InvalidOperationException(message);}
    [STAThread] private static int Main()
    {
        CoInitializeEx(IntPtr.Zero,2);
        try
        {
            using var engine=new NativeSession();var vm=new EditorViewModel(engine,true);engine.New();vm.Reload();vm.SetPhotoTool(PhotoTool.Text);
            vm.BeginPhotoPointer(120,90,1);vm.FinishPhotoPointer(false);Check(vm.Items.Count==1&&vm.Selected!.Content.Kind==1&&vm.Selected.X==376&&vm.Selected.Y==165,"Text click did not anchor its editable layer at the canvas point");
            vm.BeginGesture();vm.ToolText="Привет MyCut";vm.ToolFontSize=42;vm.ToolBold=true;vm.EndGesture();var text=vm.Selected!;
            Check(engine.Items()[0].Text=="Привет MyCut"&&engine.Items()[0].Content.FontSize==42&&engine.Items()[0].Content.FontWeight==700,"Top tool parameters did not update retained Windows text");
            vm.UndoCommand.Execute(null);Check(vm.Selected!.Text=="Text"&&vm.Selected.Content.FontSize==64,"A text parameter gesture was not one Undo step");
            vm.SetPhotoTool(PhotoTool.Rectangle);vm.BeginPhotoPointer(300,280,1);vm.MovePhotoPointer(500,360,1,false);vm.FinishPhotoPointer(false);
            Check(vm.Items.Count==2&&vm.Selected!.Content.Width==200&&vm.Selected.Content.Height==80&&vm.Selected.X==400&&vm.Selected.Y==320,"Shape tool drag did not create the expected rectangle");
            vm.UndoCommand.Execute(null);Check(vm.Items.Count==1,"Shape placement was not a single Undo transaction");
            vm.SetPhotoTool(PhotoTool.Ellipse);vm.BeginPhotoPointer(400,300,1);vm.MovePhotoPointer(600,350,1,true);vm.FinishPhotoPointer(false);Check(vm.Selected!.Content.Width==200&&vm.Selected.Content.Height==200,"Shift did not constrain ellipse creation to a circle");
            vm.UndoCommand.Execute(null);vm.SetPhotoTool(PhotoTool.Text);vm.BeginPhotoPointer(1000,600,1);vm.FinishPhotoPointer(true);Check(vm.Items.Count==1,"Cancel did not remove the in-progress tool layer");
            engine.New();vm.Reload();vm.SetPhotoTool(PhotoTool.Fill);vm.ToolColor="#FFFF0000";vm.BeginPhotoPointer(10,10,1);vm.FinishPhotoPointer(false);Check(vm.Selected!.Content.Width==1280&&vm.Selected.Content.Height==720,"Fill tool did not cover the composition");
            var before=engine.ProjectText;vm.SetPhotoTool(PhotoTool.Picker);vm.BeginPhotoPointer(600,300,1);Check(vm.ToolColor=="#FFFF0000"&&engine.ProjectText==before,"Color picker changed the document or sampled editor overlays");
            vm.SetPhotoTool(PhotoTool.LinearGradient);vm.BeginPhotoPointer(100,100,1);vm.MovePhotoPointer(100,250,1,false);vm.FinishPhotoPointer(false);Check(Math.Abs(vm.Selected!.Content.GradientAngle-90)<.001,"Gradient drag did not set its direction");
            vm.ColorMode=true;Check(vm.ColorMode&&!vm.PhotoMode&&!vm.VideoMode,"Color is not an exclusive workspace");vm.VideoMode=true;Check(vm.VideoMode&&!vm.ColorMode&&!vm.PhotoMode,"Video did not leave Color workspace");vm.ActivatePhoto();Check(vm.PhotoMode&&!vm.VideoMode&&!vm.ColorMode,"Photo did not restore its workspace");
            TestTextBounds(vm,engine);TestGraphAndWorkspaces(vm,engine);TestMask(vm,engine);TestPhotoProcessing();TestAttraction();TestButtonZones();TestPaneLayout(vm);
            Console.WriteLine("PASS: windowless tools; exclusive shared-document workspaces; real effect chain and grouped Undo; atomic typed node drop; duplicate / locked nodes; zero-room attraction regression; animation strength; measured / rendered Photo and Graph panes (no app window launched)");return 0;
        }
        catch(Exception ex){Console.Error.WriteLine(ex);return 1;}
        finally{CoUninitialize();}
    }
    private static void TestGraphAndWorkspaces(EditorViewModel vm,NativeSession engine)
    {
        engine.New();vm.Reload();vm.AddShapeCommand.Execute(null);var owner=vm.Selected!.Id;string document=engine.ProjectText;
        foreach(var workspace in Enum.GetValues<WorkspaceKind>()){vm.ActivateWorkspace(workspace);Check(engine.ProjectText==document&&vm.Selected?.Id==owner,"Workspace switch changed the shared document or selection");Check(new[]{vm.PhotoMode,vm.VideoMode,vm.ColorMode,vm.ItemMode,vm.GraphMode}.Count(v=>v)==1,"Workspaces are not exclusive");}
        vm.ActivatePhoto();vm.AppendImageEffect(10);Check(vm.GraphNodes.Count==3&&vm.SelectedNode is {Kind:10},"Effect list did not create and select a real exposure node");vm.NodeValue0=1.5;Check(engine.Nodes(owner).Single(n=>n.Kind==10).V0==1.5f,"Effect parameters did not update the node graph");
        string withExposure=engine.ProjectText;vm.AppendImageEffect(7);Check(vm.GraphNodes.Count==5&&vm.SelectedNode is {Kind:7},"Ellipse-mask effect did not wire a mask into the image chain");vm.UndoCommand.Execute(null);Check(engine.ProjectText==withExposure,"Mask plus effect plus wiring is not one Undo step");
        vm.ActivateGraph();vm.RefreshGraph();var exposure=vm.GraphNodes.Single(n=>n.Kind==10);ulong scalar=vm.AddLinkedGraphNode(1,20,280,exposure.Id,1);Check(vm.GraphNodes.First(n=>n.Id==exposure.Id).Input1==scalar,"Typed palette creation failed to connect a scalar into Exposure / Stops");
        string beforeFailure=engine.ProjectText;bool rejected=false;try{vm.AddLinkedGraphNode(2,0,0,exposure.Id,1);}catch(InvalidOperationException){rejected=true;}Check(rejected&&engine.ProjectText==beforeFailure,"An invalid palette connection left an orphan node / changed the document");
        vm.SelectNode(scalar);vm.DuplicateGraphNode();Check(vm.SelectedNode is {Kind:1} copy&&copy.Id!=scalar&&copy.X==52&&copy.Y==312,"Node duplicate did not preserve data and offset its position");vm.UndoCommand.Execute(null);Check(engine.ProjectText==beforeFailure,"Node duplicate was not one Undo step");
        vm.Locked=true;string locked=engine.ProjectText;vm.GraphEnabled=false;Check(engine.ProjectText==locked,"Locked item graph was changed by bypass control");vm.Locked=false;vm.RefreshGraph();vm.SelectNode(0);
        vm.VideoMode=true;vm.InsertMedia();ulong clipItem=vm.Selected!.Id;vm.ActivateGraph();Check(vm.PreviewTimeline&&vm.LayerItems.Any(i=>i.Id==clipItem)&&vm.Selected?.Id==clipItem,"Video → Graph lost its clip preview / outliner context");vm.ToggleTrack(vm.SelectedTrackId,true);Check(!vm.CanEdit,"Graph context bypassed the timeline track lock");vm.ToggleTrack(vm.SelectedTrackId,true);vm.ColorMode=true;Check(vm.PreviewTimeline,"Video color workspace lost the program context");vm.ActivatePhoto();Check(!vm.PreviewTimeline,"Photo retained an unintended timeline context");vm.Selected=vm.LayerItems.First();vm.RefreshGraph();vm.SelectNode(0);
    }
    private static void TestTextBounds(EditorViewModel vm,NativeSession engine)
    {
        engine.New();vm.Reload();vm.SetPhotoTool(PhotoTool.Text);vm.BeginPhotoPointer(100,100,1);vm.FinishPhotoPointer(false);
        vm.ToolText=new string('W',30);var initial=vm.Selected!.Content;vm.ToolFontSize=150;
        Check(vm.Selected!.Content.Width>initial.Width&&vm.Selected.Content.Height>=150,"Font change did not expand text bounds");
        Check(vm.Selected.ScaleX==1&&vm.Selected.ScaleY==1,"Font change incorrectly changed external object scale");
    }
    private static void TestMask(EditorViewModel vm,NativeSession engine)
    {
        engine.New();vm.Reload();vm.ActivatePhoto();vm.AddShapeCommand.Execute(null);vm.AppendImageEffect(7);
        var mask=vm.GraphNodes.Single(n=>n.Kind==6);vm.SelectNode(mask.Id);var item=vm.Selected!;
        string before=engine.ProjectText;
        Check(vm.BeginMask(item.X,item.Y,1,default),"Mask center was not hittable");vm.MoveMask(item.X+10,item.Y+5);vm.EndMask(false);
        var changed=engine.Nodes(item.Id).Single(n=>n.Id==mask.Id);
        Check(Math.Abs(changed.V0-mask.V0-10/(item.Content.Width*item.ScaleX))<.0001,"Canvas mask edit did not update the same node");
        vm.UndoCommand.Execute(null);Check(engine.ProjectText==before,"Mask drag was not a single undoable change");
        vm.SelectNode(mask.Id);Check(vm.BeginMask(item.X,item.Y,1,default),"Mask could not be dragged after Undo");vm.MoveMask(item.X+12,item.Y);vm.EndMask(true);Check(engine.ProjectText==before,"Mask cancellation changed the document");
    }
    private static void TestPhotoProcessing()
    {
        string path=System.IO.Path.Combine(System.IO.Path.GetTempPath(),$"mycut-photo-test-{Guid.NewGuid():N}.png");
        try
        {
            byte[] pixels={0,0,255,255,255,0,0,255};var bitmap=BitmapSource.Create(2,1,96,96,PixelFormats.Bgra32,null,pixels,8);
            var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using(var file=System.IO.File.Create(path))encoder.Save(file);
            var original=System.IO.File.ReadAllBytes(path);
            var processed=PhotoProcessor.ProcessAsync(path,PhotoOperation.FlipHorizontal,100).GetAwaiter().GetResult();
            using var stream=new System.IO.MemoryStream(processed);var decoded=BitmapFrame.Create(stream,BitmapCreateOptions.None,BitmapCacheOption.OnLoad);var converted=new FormatConvertedBitmap(decoded,PixelFormats.Bgra32,null,0);var output=new byte[8];converted.CopyPixels(output,8,0);
            Check(output[0]==255&&output[2]==0&&output[4]==0&&output[6]==255,"Photo library did not flip real pixels");
            Check(original.SequenceEqual(System.IO.File.ReadAllBytes(path)),"Photo processing overwrote the original");
            foreach(var operation in Enum.GetValues<PhotoOperation>())Check(PhotoProcessor.ProcessAsync(path,operation,100).GetAwaiter().GetResult().Length>0,$"Photo operation failed: {operation}");
        }
        finally{if(System.IO.File.Exists(path))System.IO.File.Delete(path);}
    }
    private static void TestAttraction()
    {
        for(int i=1;i<500;++i)
        {
            var box=new Rect(i*.013,i*.071,263+i*.271,34+i*.117);foreach(double scale in new[]{.95,1,1.12}){var fit=AttractionGeometry.Fit(box,box,scale,new Vector(12,-12));Check(fit.Pull==default(Vector)&&fit.Scale<=1,"A control filling its clip must not attract outside it");}
        }
        var fitted=AttractionGeometry.Fit(new Rect(40,40,100,40),new Rect(0,0,220,120),1.2,new Vector(1000,-1000));Check(double.IsFinite(fitted.Pull.X)&&double.IsFinite(fitted.Pull.Y),"Available attraction bounds are invalid");
        var normal=new MotionCurve(0,1,0,1,true,0,1);var strong=new MotionCurve(0,1,0,1,true,0,2);Check(strong.Sample(.35)>normal.Sample(.35),"Animation strength does not increase spring rebound");
        var settings=InterfaceSettings.Current;double previous=settings.MotionStrength;settings.MotionStrength=0;double applied=-1;using(var motion=new MotionEngine(false,()=>0,false)){motion.Spring(new object(),"test",0,1,1,v=>applied=v);Check(applied==1&&motion.ActiveCount==0,"Zero animation strength did not disable transitions");}settings.MotionStrength=previous;
    }
    private static void TestPaneLayout(EditorViewModel vm)
    {
        // Exercise real WPF controls without Show(), app launch, native viewport or cursor actions.
        var app=new Application{ShutdownMode=ShutdownMode.OnExplicitShutdown};app.Resources.MergedDictionaries.Add(new ResourceDictionary{Source=new Uri("/MyCut;component/Themes/Tokens.xaml",UriKind.Relative)});app.Resources.MergedDictionaries.Add(new ResourceDictionary{Source=new Uri("/MyCut;component/Themes/Controls.xaml",UriKind.Relative)});
        using var motion=new MotionEngine(true);var graph=new GraphWorkspace(vm,motion,new PointerIntentTracker());
        using var paneEngine=new NativeSession();paneEngine.New();var paneVm=new EditorViewModel(paneEngine,true);paneVm.Reload();paneVm.AddShapeCommand.Execute(null);
        var photo=new PhotoSidebar(paneVm);photo.RaiseEvent(new RoutedEventArgs(FrameworkElement.LoadedEvent));
        void Measure(FrameworkElement pane,double width,double height){pane.Measure(new Size(width,height));pane.Arrange(new Rect(0,0,width,height));pane.UpdateLayout();Check(pane.ActualWidth==width&&pane.ActualHeight==height,"Workspace pane failed its measured bounds");}
        Measure(photo,300,590);Measure(graph,460,640);graph.Canvas.Fit();Measure(graph,460,640);
        var pickerResources=new ResourceDictionary{Source=new Uri("pack://application:,,,/ColorPicker;component/Styles/DefaultColorPickerStyle.xaml")};
        var picker=new ColorPicker.StandardColorPicker{Width=260,Height=400,Style=(Style)pickerResources["DefaultColorPickerStyle"]};Measure(picker,260,400);
        var grid=(Grid)photo.Content;
        Check(grid.RowDefinitions[0].ActualHeight<360,"Compact inspector wastes vertical space");
        Check(grid.RowDefinitions[2].ActualHeight<=30,"Empty effects must occupy only their header");
        IEnumerable<T> Descendants<T>(DependencyObject parent) where T:DependencyObject
        {
            for(int i=0;i<VisualTreeHelper.GetChildrenCount(parent);++i){var child=VisualTreeHelper.GetChild(parent,i);if(child is T match)yield return match;foreach(var nested in Descendants<T>(child))yield return nested;}
        }
        var fields=Descendants<ParameterRow>(photo).ToArray();
        var x=fields.Single(r=>r.Label=="Position X / px");var y=fields.Single(r=>r.Label=="Position Y / px");
        Check(x.ActualHeight==28&&y.ActualHeight==28,"Numeric fields must be compact 26-DIP surfaces plus 2-DIP spacing");
        Check(Math.Abs(x.TranslatePoint(new Point(),photo).Y-y.TranslatePoint(new Point(),photo).Y)<.01,"Position X/Y must share a row");
        var layerList=Descendants<TreeView>(photo).Single();
        Check(layerList.Items.Count==1&&layerList.Items[0] is TreeViewItem layer&&layer.MinHeight==24,"Outliner must use dense hierarchical rows");
        paneVm.AppendImageEffect(10);Measure(photo,300,590);
        Check(grid.RowDefinitions[2].ActualHeight>30&&grid.RowDefinitions[2].ActualHeight<=60,"A single effect must not reserve a large empty panel");
        paneVm.SelectNode(0);Measure(photo,300,590);
        var section=Descendants<Expander>(photo).First(e=>Equals(e.Header,"Transform"));double expandedHeight=grid.RowDefinitions[0].ActualHeight;
        section.IsExpanded=false;Measure(photo,300,590);Check(grid.RowDefinitions[0].ActualHeight<expandedHeight-100,"Collapsing Transform must release its actual panel height");
        section.IsExpanded=true;Measure(photo,300,590);
        photo.RaiseEvent(new RoutedEventArgs(FrameworkElement.UnloadedEvent));
        var directory=Environment.GetEnvironmentVariable("MYCUT_PANE_TEST_OUTPUT");if(string.IsNullOrEmpty(directory))return;System.IO.Directory.CreateDirectory(directory);
        void Render(FrameworkElement pane,string name){var bitmap=new RenderTargetBitmap((int)pane.ActualWidth,(int)pane.ActualHeight,96,96,PixelFormats.Pbgra32);bitmap.Render(pane);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using var file=System.IO.File.Create(System.IO.Path.Combine(directory,name));encoder.Save(file);}
        Render(photo,"photo-sidebar.png");Render(graph,"graph-sidebar.png");
    }
    private static void TestButtonZones()
    {
        InterfaceSettings.Current.Reset();var point=new Point(50,10);var farther=new Rect(0,0,20,20);var closer=new Rect(42,0,20,20);
        var fast=new PointerIntent(new Vector(1,0),44,3000);var reversed=new PointerIntent(new Vector(-1,0),44,3000);
        double farScore=InputDebugAdorner.Score(point,farther,fast,out var radius);Check(double.IsFinite(farScore)&&radius>30,"Fast nearby button was not eligible for an expanded click");Check(InputDebugAdorner.Score(point,closer,default,out _,44)<farScore,"Retained larger zone stole a click from a closer eligible button");
        Check(InputDebugAdorner.Score(point,farther,reversed,out var reverseRadius)==farScore&&radius==reverseRadius,"Button law still depends on direction instead of speed and distance");
        double clock=0;var tracker=new PointerIntentTracker(()=>clock);tracker.Observe(new Point(0,0));clock=.01;var moving=tracker.Observe(new Point(30,0));Check(moving.ButtonSpeed>1000,"Current mouse speed was not measured");clock=.10;Check(tracker.Snapshot().ButtonSpeed==0&&tracker.Snapshot().Expansion>0,"Button measurement reused forecast retention after stopping");
    }
}
