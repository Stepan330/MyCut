using System.ComponentModel;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using MyCut.Editor.Controls;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;
using MyCut.Editor.Motion;

namespace MyCut.Editor;
public partial class MainWindow : Window
{
    private readonly EditorViewModel vm;
    private readonly LayoutStore layouts;
    private readonly ViewportHost viewport;
    private readonly InlineTextEditor inlineText;
    private readonly SpatialFlyout spatialSettingsPopup=new(){StaysOpen=false};
    private readonly MotionEngine motion = new(!SystemParameters.ClientAreaAnimation);
    private readonly SceneFlyoutController sceneFlyout;
    private readonly ProjectMenuController projectMenu;
    private readonly ProximityInput rootZones, popupZones, projectZones;
    private readonly PointerIntentTracker pointerIntent=new();
    private InterfaceSettingsWindow? settingsWindow;
    private LayerContentWindow? contentWindow;
    private ColorWindow? colorWindow;
    private TimelineWindow? timelineWindow;
    private readonly TimelineCanvas dockTimeline;
    private readonly PhotoOptionsControl photoOptions;
    private readonly GraphWorkspace graphWorkspace;
    private readonly Views.InspectorPanel TransformInspector=new(true);
    private readonly Dictionary<WorkspaceKind,double> rightWidths=new(){{WorkspaceKind.Photo,300},{WorkspaceKind.Item,340},{WorkspaceKind.Video,300},{WorkspaceKind.Color,300},{WorkspaceKind.Graph,460}};
    private readonly Dictionary<WorkspaceKind,double> dockHeights=new(){{WorkspaceKind.Video,260},{WorkspaceKind.Color,245}};
    private WorkspaceKind displayedWorkspace=WorkspaceKind.Photo;
    private bool videoInspector;
    private readonly ColorScopes colorScopes=new(){Height=160};
    private readonly DispatcherTimer colorScopeTimer=new(){Interval=TimeSpan.FromMilliseconds(250)};
    private bool colorScopeDirty=true;
    public MainWindow(EditorViewModel model, LayoutStore store)
    {
        vm = model; layouts = store;
        InitializeComponent(); DataContext = model;
        SpaceView.AttachMotion(motion);
        ScenePopupShell.SetBinding(FrameworkElement.HeightProperty,new System.Windows.Data.Binding(nameof(FrameworkElement.ActualHeight)){Source=WorkArea});
        SpaceView.SurfaceContent!.DataContext=model;MotionBehavior.SetEngine(SpaceView.SurfaceContent,motion);
        ConfigureWorkspaceTabs();
        MotionBehavior.SetEngine(this, motion);
        MotionBehavior.SetEngine(ScenePopupShell, motion);
        ScenePopupShell.DataContext = model;
        ProjectPopupShell.DataContext = model;
        MotionBehavior.SetEngine(ProjectPopupShell, motion);
        var layout = layouts.Load(); Width = layout.Width; Height = layout.Height;
        ScenePopupShell.Width = layout.Left; RightPanel.Width = new GridLength(layout.Right);
        rightWidths[WorkspaceKind.Photo]=layout.Right;
        viewport = new ViewportHost(model, motion,pointerIntent);
        inlineText=new InlineTextEditor(model,viewport);var canvasHost=new Grid();canvasHost.Children.Add(viewport);canvasHost.Children.Add(inlineText);ViewportContainer.Child=canvasHost;
        PreviewMouseDown+=(_,e)=>{if(inlineText.IsEditing&&e.OriginalSource is DependencyObject source&&source!=inlineText.Editor&&!inlineText.Editor.IsAncestorOf(source))inlineText.End(false);};
        dockTimeline=new TimelineCanvas(model,motion,pointerIntent){MinHeight=150};DockTimelineContainer.Child=dockTimeline;vm.PropertyChanged+=WorkspaceChanged;
        photoOptions=new PhotoOptionsControl(vm);PhotoOptionsHost.Child=photoOptions;UndoIconButton.Content=EditorIcons.Image("undo");RedoIconButton.Content=EditorIcons.Image("redo");ContentIconButton.Content=EditorIcons.Image("settings");vm.PhotoToolPlaced+=ToolPlaced;
        PhotoSidebarHost.Child=new PhotoSidebar(vm);graphWorkspace=new GraphWorkspace(vm,motion,pointerIntent);GraphSidebarHost.Child=graphWorkspace;
        var itemPane=new WorkspacePane{Caption="ITEM DETAILS"};itemPane.Body.Child=TransformInspector;ItemInspectorHost.Child=itemPane;
        var colorDock=new Grid();colorDock.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});colorDock.RowDefinitions.Add(new RowDefinition());var colorHead=new DockPanel{Margin=new Thickness(12,4,12,0)};
        var details=new Button{Content=EditorIcons.Image("settings"),ToolTip="Open the dedicated color editing window"};details.Click+=OnColorDetails;DockPanel.SetDock(details,Dock.Right);colorHead.Children.Add(details);colorHead.Children.Add(new TextBlock{Text="PRIMARIES · Lift / Gamma / Gain / Offset",FontSize=11});colorDock.Children.Add(colorHead);var primaries=new PrimariesPanel(vm);Grid.SetRow(primaries,1);colorDock.Children.Add(primaries);ColorDockHost.Child=colorDock;
        var colorInspector=new StackPanel();colorInspector.Children.Add(colorScopes);colorInspector.Children.Add(new PrimaryParameters(vm));ColorInspectorHost.Child=new ScrollViewer{Content=colorInspector,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};
        colorScopeTimer.Tick+=(_,_)=>{if(vm.ColorMode&&colorScopeDirty){vm.Execute(()=>colorScopes.Update(vm.Engine.ScopeFrame()));colorScopeDirty=false;}};Loaded+=(_,_)=>colorScopeTimer.Start();
        sceneFlyout = new SceneFlyoutController(this, SceneIcon, ScenePin, ScenePopup, ScenePopupShell, motion);
        projectMenu = new ProjectMenuController(this, ProjectIcon, ProjectPopup, ProjectPopupShell, motion);
        rootZones = new ProximityInput(this,pointerIntent); popupZones = new ProximityInput(ScenePopupShell,pointerIntent);
        projectZones = new ProximityInput(ProjectPopupShell,pointerIntent);
        viewport.PointerObserved += (_, _) => { rootZones.Clear(); popupZones.Clear(); projectZones.Clear(); };
        viewport.InteractionStarted += (_, _) => { projectMenu.Close(true); if (!sceneFlyout.IsPinned) sceneFlyout.Close(); };
        ScenePopupShell.PreviewMouseDown += (_, _) => projectMenu.Close(true);
        SceneIcon.Click += (_, _) => projectMenu.Close(true);
        if (layout.ScenePinned) Loaded += (_, _) => sceneFlyout.SetPinned(true);
        ApplyWorkspaceLayout();
    }
    private void OnInterfaceSettings(object sender,RoutedEventArgs e)
    {
        projectMenu.Close(true);
        if(settingsWindow is not null){settingsWindow.Activate();return;}
        settingsWindow=new InterfaceSettingsWindow(motion,pointerIntent){Owner=this};settingsWindow.Closed+=(_,_)=>settingsWindow=null;settingsWindow.Show();
    }
    private void OpenContent()
    {
        if(vm.Selected?.Content.Kind==8){OnVideoDetails(this,new RoutedEventArgs());return;}
        if(contentWindow is not null){contentWindow.Activate();return;}
        contentWindow=new LayerContentWindow(vm,motion,pointerIntent){Owner=this};contentWindow.Closed+=(_,_)=>contentWindow=null;contentWindow.Show();
    }
    private void OnAddText(object sender,RoutedEventArgs e){vm.AddTextCommand.Execute(null);OpenContent();}
    private void OnAddFill(object sender,RoutedEventArgs e){vm.AddFillCommand.Execute(null);OpenContent();}
    private void OnAddShape(object sender,RoutedEventArgs e){vm.AddShapeCommand.Execute(null);OpenContent();}
    private void OnEditContent(object sender,RoutedEventArgs e)=>OpenContent();
    private void OnColor(object sender,RoutedEventArgs e)
    {
        vm.ColorMode=true;vm.Status="Color workspace · primaries below, scopes and correction controls on the right.";
    }
    private void OnColorDetails(object sender,RoutedEventArgs e)
    {
        vm.ColorMode=true;
        if(colorWindow is not null){colorWindow.Activate();return;}
        colorWindow=new ColorWindow(vm,motion,pointerIntent){Owner=this};colorWindow.Closed+=(_,_)=>colorWindow=null;colorWindow.Show();
    }
    private void OnVideo(object sender,RoutedEventArgs e)
    {
        vm.VideoMode=true;vm.Status="Video workspace · program above, timeline below. Media / clip controls opens the bin and export panel.";
    }
    private void OnVideoDetails(object sender,RoutedEventArgs e)
    {
        vm.VideoMode=true;if(timelineWindow is not null){timelineWindow.Activate();return;}
        timelineWindow=new TimelineWindow(vm,motion,pointerIntent){Owner=this};timelineWindow.Closed+=(_,_)=>timelineWindow=null;timelineWindow.Show();
    }
    private void OnPhoto(object sender,RoutedEventArgs e)=>vm.ActivatePhoto();
    private void OnSpatialView(object sender,RoutedEventArgs e){projectMenu.Close(true);sceneFlyout.Close(true);if(spatialSettingsPopup.IsOpen){spatialSettingsPopup.IsOpen=false;return;}spatialSettingsPopup.Child=new Border{Width=370,Padding=new Thickness(14),Background=(System.Windows.Media.Brush)FindResource("PanelBrush"),BorderBrush=(System.Windows.Media.Brush)FindResource("BorderBrush"),BorderThickness=new Thickness(1),Child=new ScrollViewer{MaxHeight=600,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,Content=new SpatialSettingsPanel(SpaceView)}};SpatialCoordinates.AnchorPopup(spatialSettingsPopup,SpatialViewButton,new Point(0,SpatialViewButton.ActualHeight+4));spatialSettingsPopup.IsOpen=true;}
    private void ConfigureWorkspaceTabs()
    {
        var names=new Dictionary<string,(string Label,string State)>{{"photo",("Photo","PhotoMode")},{"item",("Item","ItemMode")},{"play",("Video","VideoMode")},{"color",("Color","ColorMode")},{"graph",("Nodes","GraphMode")},{"animation",("Animate","")},{"audio",("Audio","")}};
        foreach(var button in ModeTabs.Children.OfType<Button>())
        {
            if(button.Content is not EditorIcon icon||!names.TryGetValue(icon.Glyph,out var tab))continue;
            button.Content=null;icon.Width=icon.Height=14;var body=new StackPanel{Orientation=Orientation.Horizontal};body.Children.Add(icon);
            var label=new TextBlock{Text=tab.Label,FontSize=11,Margin=new Thickness(5,0,0,0)};label.SetBinding(TextBlock.ForegroundProperty,new System.Windows.Data.Binding(nameof(Button.Foreground)){Source=button});body.Children.Add(label);button.Content=body;button.Padding=new Thickness(8,2,8,2);
            var style=new Style(typeof(Button),button.Style);style.Setters.Add(new Setter(MinHeightProperty,24d));style.Setters.Add(new Setter(HeightProperty,26d));style.Setters.Add(new Setter(MinWidthProperty,68d));
            if(tab.State.Length>0){var selected=new DataTrigger{Binding=new System.Windows.Data.Binding(tab.State),Value=true};selected.Setters.Add(new Setter(BackgroundProperty,new SolidColorBrush(Color.FromRgb(225,242,248))));selected.Setters.Add(new Setter(ForegroundProperty,new SolidColorBrush(Color.FromRgb(8,28,42))));selected.Setters.Add(new Setter(HeightProperty,32d));style.Triggers.Add(selected);}button.Style=style;
        }
    }
    private void OnItem(object sender,RoutedEventArgs e)=>vm.ActivateItem();
    private void OnGraph(object sender,RoutedEventArgs e)=>vm.ActivateGraph();
    private void OnToggleVideoInspector(object sender,RoutedEventArgs e){videoInspector=!videoInspector;ApplyWorkspaceLayout();}
    private void OnPreviousFrame(object sender,RoutedEventArgs e){vm.StopPlayback();vm.PlayheadFrame--;}
    private void OnNextFrame(object sender,RoutedEventArgs e){vm.StopPlayback();vm.PlayheadFrame++;}
    private void ToolPlaced(object? sender,EventArgs e){if(vm.ActivePhotoTool==PhotoTool.Text)Dispatcher.BeginInvoke(()=>inlineText.Begin(vm.Selected?.Text=="Text"));}
    private void WorkspaceChanged(object? sender,PropertyChangedEventArgs e)
    {
        if(e.PropertyName is not "Metrics" and not "Status")colorScopeDirty=true;
        if(e.PropertyName is null or nameof(vm.Workspace) or nameof(vm.VideoMode) or nameof(vm.ColorMode))ApplyWorkspaceLayout();
    }
    private void ApplyWorkspaceLayout()
    {
        if(displayedWorkspace!=vm.Workspace)
        {
            if(RightPanel.ActualWidth>=260)rightWidths[displayedWorkspace]=RightPanel.ActualWidth;
            if(dockHeights.ContainsKey(displayedWorkspace)&&TimelineDockRow.ActualHeight>=180)dockHeights[displayedWorkspace]=TimelineDockRow.ActualHeight;
            displayedWorkspace=vm.Workspace;
            RightPanel.Width=new GridLength(rightWidths[vm.Workspace]);
            TimelineDockRow.Height=new GridLength(dockHeights.GetValueOrDefault(vm.Workspace));
        }
        bool side=!vm.VideoMode||videoInspector;RightPanel.MinWidth=side?260:0;
        if(!side)RightPanel.Width=new GridLength(0);else if(RightPanel.Width.Value<260)RightPanel.Width=new GridLength(rightWidths[vm.Workspace]);
        SideDivider.Width=new GridLength(side?6:0);SideSplitter.Visibility=side?Visibility.Visible:Visibility.Collapsed;
        ItemInspectorHost.Visibility=vm.InspectMode&&side?Visibility.Visible:Visibility.Collapsed;
        TopOptionsBar.Visibility=vm.VideoMode?Visibility.Collapsed:Visibility.Visible;
        bool dock=vm.VideoMode||vm.ColorMode;DockDividerRow.Height=new GridLength(dock?6:0);DockSplitter.Visibility=dock?Visibility.Visible:Visibility.Collapsed;
    }
    private void OnClosing(object? sender, CancelEventArgs e)
    {
        if(timelineWindow?.IsExporting==true){timelineWindow.CancelExport();e.Cancel=true;vm.Status="Canceling export. Close the application again after it finishes.";return;}
        if (!vm.ConfirmDiscard()) { e.Cancel = true; return; }
        try { layouts.Save(new EditorLayout(1, RestoreBounds.Width, RestoreBounds.Height, ScenePopupShell.Width, rightWidths[WorkspaceKind.Photo], sceneFlyout.IsPinned));InterfaceSettings.Current.Save();if(!vm.Smoke&&InterfaceSettings.Current.StoragePath is {} settingsPath)SpatialSettings.Current.Save(Path.Combine(Path.GetDirectoryName(settingsPath)!,"spatial.json")); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { App.Log(ex); }
    }
    private void OnDrop(object sender, DragEventArgs e)
    {
        if (e.Data.GetData(DataFormats.FileDrop) is string[] paths)
            foreach (var path in paths) vm.ImportPath(path);
    }
    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if(inlineText.IsEditing&&inlineText.Editor.IsKeyboardFocusWithin){
            if(Keyboard.Modifiers==ModifierKeys.Control&&e.Key is Key.Z or Key.Y){if(e.Key==Key.Z)inlineText.Editor.Undo();else inlineText.Editor.Redo();e.Handled=true;}
            return;
        }
        for (DependencyObject? node = e.OriginalSource as DependencyObject; node is not null; node = node is Visual ? VisualTreeHelper.GetParent(node) : LogicalTreeHelper.GetParent(node))
            if (node is ParameterRow or ComboBox or NodeCanvas or TimelineCanvas) return;
        if (e.Key == Key.Escape && sceneFlyout.IsOpen) { sceneFlyout.SetPinned(false); sceneFlyout.Close(); e.Handled = true; return; }
        if (e.Key == Key.Escape && projectMenu.IsOpen) { projectMenu.Close(true); e.Handled = true; return; }
        if (e.OriginalSource is TextBox) return;
        if(Keyboard.Modifiers==ModifierKeys.None&&e.Key is Key.V or Key.T or Key.U or Key.G or Key.I){if(vm.HandleShortcut(e.Key,ModifierKeys.None))e.Handled=true;return;}
        if (e.Key == Key.Delete && vm.DeleteCommand.CanExecute(null)) { vm.DeleteCommand.Execute(null); e.Handled = true; }
    }
    protected override void OnClosed(EventArgs e)
    {
        vm.StopPlayback();
        colorScopeTimer.Stop();vm.PhotoToolPlaced-=ToolPlaced;
        vm.PropertyChanged-=WorkspaceChanged;
        inlineText.Dispose();rootZones.Dispose(); popupZones.Dispose(); projectZones.Dispose(); projectMenu.Dispose(); sceneFlyout.Dispose(); viewport.Dispose(); motion.Dispose(); base.OnClosed(e);
    }
    internal void RunSmokeTest()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(800) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            try
            {
                string folder = Path.Combine(AppContext.BaseDirectory, "smoke"); Directory.CreateDirectory(folder);
                string project = Path.Combine(folder, "Проверка.mycut"), png = Path.Combine(folder, "export.png");
                var checks = new List<string>();
                void Check(bool condition, string description) { if (!condition) throw new InvalidOperationException(description); checks.Add(description); }
                viewport.RenderNow();Check(vm.ForceSoftware||viewport.UsesSharedSurface,"Hardware viewport uses a shared GPU surface inside WPF 3D");CaptureUi(folder,"MyCut-spatial-start.png");
                InteractionSmokeTests.Run(vm, viewport, Check);
                NumericFieldSmokeTests.Run(this, vm, Check);
                InterfaceSmokeTests.Run(this,vm,viewport,motion,folder,Check);
                ContentSmokeTests.Run(this,vm,viewport,motion,folder,Check);
                InlineTextSmokeTests.Run(vm,viewport,inlineText,Check,()=>{
                    viewport.RenderNow();vm.Engine.Capture(Path.Combine(folder,"inline-native-preview.png"));vm.Engine.Export(Path.Combine(folder,"inline-export.png"));
                    var nativePreview=new BitmapImage(new Uri(Path.Combine(folder,"inline-native-preview.png")));var exportedText=new BitmapImage(new Uri(Path.Combine(folder,"inline-export.png")));
                    bool HasBrightPixels(BitmapSource source){var converted=new FormatConvertedBitmap(source,PixelFormats.Bgra32,null,0);byte[] pixels=new byte[converted.PixelWidth*converted.PixelHeight*4];converted.CopyPixels(pixels,converted.PixelWidth*4,0);for(int i=0;i<pixels.Length;i+=4)if(pixels[i]>180&&pixels[i+1]>180&&pixels[i+2]>180)return true;return false;}
                    Check(!HasBrightPixels(nativePreview)&&HasBrightPixels(exportedText),"Inline preview hides native duplicate glyphs while export still renders the full text");
                    CaptureUi(folder,"MyCut-inline-text.png");
                    SpaceView.SetView(true,false);UpdateLayout();PumpFrames(60);
                    var local=inlineText.Editor.TransformToAncestor(SpaceView.SurfaceContent!).Transform(new Point(30,20));var hit=SpaceView.InputHitTest(SpaceView.ProjectSurface(local)) as DependencyObject;
                    Check(hit is not null&&(hit==inlineText.Editor||inlineText.Editor.IsAncestorOf(hit)),"Live text input remains hit-testable inside the perspective UI");
                    CaptureUi(folder,"MyCut-inline-text-perspective.png");SpaceView.SetView(false,false);UpdateLayout();
                });
                ColorSmokeTests.Run(this,vm,viewport,motion,folder,Check);
                TimelineSmokeTests.Run(this,vm,viewport,motion,folder,Check);
                vm.ActivatePhoto();UpdateLayout();double photoCanvasHeight=viewport.ActualHeight;vm.VideoMode=true;UpdateLayout();
                Check(TimelineDockRow.ActualHeight==260&&dockTimeline.ActualHeight>=150&&viewport.ActualHeight<photoCanvasHeight,$"Video workspace shows program and docked timeline together (dock {TimelineDockRow.ActualHeight:0.##}, canvas {viewport.ActualHeight:0.##} < photo {photoCanvasHeight:0.##})");
                vm.VideoMode=false;UpdateLayout();Check(TimelineDockRow.ActualHeight==0&&Math.Abs(viewport.ActualHeight-photoCanvasHeight)<1,"Photo restores the full canvas height after leaving the docked Video workspace");
                Check(PhotoSidebarHost.IsVisible&&MainWindow.Descendants<WorkspacePane>(PhotoSidebarHost).Count()==3,"Photo sketch exposes real parameter, effect and outliner panes");
                vm.ActivateItem();UpdateLayout();Check(ItemInspectorHost.IsVisible&&!PhotoSidebarHost.IsVisible,"Item editor reuses the common details pane without image-creation tools");
                vm.ActivateGraph();vm.CreateGraph();UpdateLayout();graphWorkspace.Canvas.Fit();
                Check(GraphSidebarHost.IsVisible&&graphWorkspace.Canvas.ActualWidth>250&&graphWorkspace.Canvas.ActualHeight>150,"Graph sketch places the node canvas beside the live viewport with Details below");
                var sourceNode=vm.GraphNodes.First(n=>n.Kind==0);var pin=graphWorkspace.Canvas.PinPointForTest(sourceNode.Id,-1);
                Check(graphWorkspace.Canvas.HitForTest(pin+new Vector(8,0))==(sourceNode.Id,-1),"Node port accepts a nearby click instead of requiring pixel hunting");
                vm.ActivatePhoto();vm.Engine.Reset();vm.Reload();UpdateLayout();
                double viewportHeight = viewport.ActualHeight;
                Check(TopBar.ActualHeight == 38 && Math.Abs(SpatialCoordinates.Translate(WorkArea,new Point(),(FrameworkElement)Content).Y-38)<1.1,
                    $"Spatial workspace has one compact 38-DIP tab header (height={TopBar.ActualHeight}, y={SpatialCoordinates.Translate(WorkArea,new Point(),(FrameworkElement)Content).Y})");
                ProjectIcon.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); PumpFrames(180);
                Check(SpatialCoordinates.SurfaceFor(ProjectPopupShell)==SpaceView,"Project menu belongs to its own 3D layer");
                var popupPoint=SpatialCoordinates.ToScreen(ProjectPopupShell,new Point(12,12));
                Check((SpatialCoordinates.Translate(SpaceView,SpaceView.PointFromScreen(popupPoint),ProjectPopupShell)-new Point(12,12)).Length<.01,"3D popup coordinates roundtrip without an ancestor exception");
                ProjectPopupShell.RaiseEvent(new MouseEventArgs(Mouse.PrimaryDevice,Environment.TickCount){RoutedEvent=Mouse.PreviewMouseMoveEvent});
                Check(projectMenu.IsOpen && viewport.ActualHeight == viewportHeight, "Logo click opens project commands without consuming workspace height");
                var restore = RestoreDemoButton;
                var restoreBounds = restore.TransformToAncestor(ProjectPopupShell).TransformBounds(new Rect(restore.RenderSize));
                var nearButton = new Point(restoreBounds.Left - 4, restoreBounds.Top + restoreBounds.Height / 2);
                Check(projectZones.TargetForTest(nearButton) == restore, "Button proximity zone accepts a click outside its visible border");
                var openButton = OpenProjectButton; var saveButton = SaveProjectButton;
                var openBounds = openButton.TransformToAncestor(ProjectPopupShell).TransformBounds(new Rect(openButton.RenderSize));
                var saveBounds = saveButton.TransformToAncestor(ProjectPopupShell).TransformBounds(new Rect(saveButton.RenderSize));
                double gap = saveBounds.Top - openBounds.Bottom, bx = openBounds.Left + openBounds.Width / 2;
                Check(projectZones.TargetForTest(new Point(bx, openBounds.Bottom + gap * .25)) == openButton,
                    "Overlapping button zones choose the nearer Open button");
                Check(projectZones.TargetForTest(new Point(bx, openBounds.Bottom + gap * .75)) == saveButton,
                    "Overlapping button zones choose the nearer Save button");
                vm.X = 500; projectZones.ActivateForTest(nearButton); PumpFrames(60);
                Check(vm.X == 410, "Expanded button zone invokes the actual bound command");
                Check(!projectMenu.IsOpen, "Executing a project-menu command closes its popup");
                ProjectIcon.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); PumpFrames(180);
                var newBounds = NewProjectButton.TransformToAncestor(ProjectPopupShell).TransformBounds(new Rect(NewProjectButton.RenderSize));
                projectZones.ActivateForTest(new Point(newBounds.Left + newBounds.Width / 2, newBounds.Top + newBounds.Height / 2)); PumpFrames(60);
                Check(!projectMenu.IsOpen && vm.Items.Count == 0 && vm.Selected is null && !vm.Engine.CanUndo,
                    "New project clears scene, selection and history through the logo menu");
                vm.DemoCommand.Execute(null); viewport.RenderNow();
                ProjectIcon.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); PumpFrames(180);
                ProjectIcon.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Check(!projectMenu.IsOpen, "Second logo click closes the project menu");
                ProjectIcon.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); PumpFrames(180);
                ProjectPopupShell.RaiseEvent(new KeyEventArgs(Keyboard.PrimaryDevice, PresentationSource.FromVisual(this), Environment.TickCount, Key.Escape) { RoutedEvent = Keyboard.PreviewKeyDownEvent });
                Check(!projectMenu.IsOpen, "Escape closes the project menu from its popup keyboard focus");
                projectMenu.Open(); PumpFrames(180);
                viewport.DispatchForTest(0x0201, 410, 340); viewport.DispatchForTest(0x0202, 410, 340);
                Check(!projectMenu.IsOpen, "Clicking the native viewport dismisses project commands");
                Check(vm.Items.Count == 3 && vm.Selected?.Id == 2, "WPF startup / native ABI / demo selection");
                var otherX = vm.Items[1].X;
                vm.X = 300;
                Check(vm.Engine.Items()[0].X == 300 && vm.Engine.Items()[1].X == otherX, "Inspector transform isolates the instance");
                vm.Red = .3;
                Check(vm.Engine.Items().All(i => Math.Abs(i.Red - .3) < .001), "Shared definition updates all three instances");
                vm.UndoCommand.Execute(null);
                Check(vm.Engine.Items().All(i => i.Red == 1), "Undo restores shared definition");
                vm.RedoCommand.Execute(null);
                Check(vm.Engine.Items().All(i => Math.Abs(i.Red - .3) < .001), "Redo reapplies definition");
                vm.BeginGesture(); vm.X = 310; vm.X = 320; vm.EndGesture(); vm.UndoCommand.Execute(null);
                Check(vm.X == 300, "One gesture is one undo step");
                vm.DuplicateCommand.Execute(null); Check(vm.Items.Count == 4, "Duplicate creates a linked instance");
                vm.DeleteCommand.Execute(null); Check(vm.Items.Count == 3, "Delete removes only the selected instance");
                vm.Engine.Save(project); vm.Engine.Reset(); vm.Engine.Load(project); vm.Reload();
                Check(vm.Items[0].X == 300 && Math.Abs(vm.Items[0].Red - .3) < .001, "Project roundtrip through Unicode path");
                string invalid = Path.Combine(folder, "invalid.mycut"); File.WriteAllText(invalid, "MYCUT 999");
                bool rejected = false; try { vm.Engine.Load(invalid); } catch (InvalidOperationException) { rejected = true; }
                Check(rejected && vm.Engine.Items()[0].X == 300, "Invalid project leaves the active document intact");
                viewport.RenderNow(); vm.Engine.Export(png);
                var image = new BitmapImage(new Uri(png));
                Check(image.PixelWidth == 1280 && image.PixelHeight == 720, "Own renderer exports fixed-size PNG");
                vm.ImportPath(png);
                Check(vm.Items.Count == 4 && vm.Selected!.Definition != 1, "PNG import creates a new Item Definition");
                viewport.RenderNow();
                vm.Engine.Reset(); vm.Reload(); vm.Status = "Ready. Select a card, drag it, or import a photo.";
                UpdateLayout(); viewport.RenderNow();
                Dispatcher.Invoke(() => { }, DispatcherPriority.Render);
                layouts.Save(new EditorLayout(1, Width, Height, 240, 310));
                var loaded = layouts.Load(); Check(loaded.Left == 240 && loaded.Right == 310, "UI layout persists separately from project");
                Check(!sceneFlyout.IsOpen && SceneRail.ActualWidth == 44, "Scene list is collapsed to an icon by default");
                double availableWidth = viewport.ActualWidth;
                SceneIcon.RaiseEvent(new MouseEventArgs(Mouse.PrimaryDevice, Environment.TickCount) { RoutedEvent = Mouse.MouseEnterEvent });
                WaitForUi(()=>sceneFlyout.IsOpen&&sceneFlyout.Progress>.99);
                Check(sceneFlyout.IsOpen && sceneFlyout.Progress > .99 && viewport.ActualWidth == availableWidth && ScenePopupShell.ActualHeight > 300, $"Hover reveals scene popup without resizing the GPU viewport (open={sceneFlyout.IsOpen}, progress={sceneFlyout.Progress}, width={viewport.ActualWidth}/{availableWidth}, height={ScenePopupShell.ActualHeight})");
                sceneFlyout.Close(); PumpFrames(50);
                if (!motion.ReducedMotion) Check(sceneFlyout.Progress > 0 && sceneFlyout.Progress < 1 && sceneFlyout.IsOpen, "Scene popup closes gradually before its HWND is hidden");
                sceneFlyout.Open(); WaitForUi(()=>sceneFlyout.IsOpen&&sceneFlyout.Progress>.99);
                Check(sceneFlyout.IsOpen && sceneFlyout.Progress > .99, "Reopening a closing popup reverses smoothly without a stale close");
                CaptureUi(folder, "MyCut-ui-scene.png");
                ScenePin.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Check(sceneFlyout.IsPinned, "Scene list pin button keeps the flyout open");
                ScenePin.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                SceneIcon.RaiseEvent(new MouseEventArgs(Mouse.PrimaryDevice, Environment.TickCount) { RoutedEvent = Mouse.MouseLeaveEvent });
                PumpFrames(460); Check(!sceneFlyout.IsOpen, "Unpinned scene list closes after the hover bridge delay");
                CaptureUi(folder);
                vm.Engine.Feedback(2, 1, 1, 0); vm.Engine.Render((int)(viewport.ActualWidth * VisualTreeHelper.GetDpi(viewport).DpiScaleX), (int)(viewport.ActualHeight * VisualTreeHelper.GetDpi(viewport).DpiScaleY), 2);
                string firstFeedback = Path.Combine(folder, "feedback-first.png"); vm.Engine.Capture(firstFeedback);
                vm.Engine.Feedback(2, 1, 1, 1); vm.Engine.Render((int)(viewport.ActualWidth * VisualTreeHelper.GetDpi(viewport).DpiScaleX), (int)(viewport.ActualHeight * VisualTreeHelper.GetDpi(viewport).DpiScaleY), 2);
                string secondFeedback = Path.Combine(folder, "feedback-second.png"); vm.Engine.Capture(secondFeedback);
                Check(!File.ReadAllBytes(firstFeedback).SequenceEqual(File.ReadAllBytes(secondFeedback)), "Managed/native feedback highlights distinct handles in GPU readback");
                var hoverCorner = vm.Engine.HandlePoint(2, 1, viewport.DipsPerUnit); var selected = vm.Selected!;
                float hx = selected.X - hoverCorner.X, hy = selected.Y - hoverCorner.Y, hl = MathF.Sqrt(hx * hx + hy * hy);
                var previewHit = vm.Engine.Hit(2, hoverCorner.X + hx / hl * 18 / viewport.DipsPerUnit, hoverCorner.Y + hy / hl * 18 / viewport.DipsPerUnit, viewport.DipsPerUnit);
                Check(previewHit.Id == 2 && previewHit.Tool == 2 && previewHit.Handle == 1, $"Final preview targets scale handle 1 (actual {previewHit.Id}/{previewHit.Tool}/{previewHit.Handle})");
                CaptureUi(folder, "MyCut-ui-target.png", (previewHit.Id, previewHit.Handle));
                projectMenu.Open(); PumpFrames(180); CaptureUi(folder, "MyCut-ui-project.png");
                projectMenu.Close(true);
                vm.WorkbenchCommand.Execute(null);PumpFrames(200);viewport.RenderNow();CaptureUi(folder,"MyCut-workbench.png");
                vm.Engine.Export(Path.Combine(folder,"workbench-example.png"));
                vm.Select(vm.Items.First(i=>i.Content.Kind==0).Id);vm.ActivateGraph();vm.CreateGraph(true);UpdateLayout();graphWorkspace.Canvas.Fit();vm.SelectNode(vm.GraphNodes.First(n=>n.Kind==2).Id);PumpFrames(150);viewport.RenderNow();CaptureUi(folder,"MyCut-graph-workspace.png");
                vm.ActivateItem();UpdateLayout();PumpFrames(100);viewport.RenderNow();CaptureUi(folder,"MyCut-item-workspace.png");
                vm.ActivatePhoto();UpdateLayout();PumpFrames(100);viewport.RenderNow();CaptureUi(folder,"MyCut-photo-workspace.png");
                string spatialDocument=vm.Engine.ProjectText;SpaceView.SetView(true,false);UpdateLayout();PumpFrames(80);
                var iconLocal=ProjectIcon.TransformToAncestor(SpaceView.SurfaceContent!).Transform(new Point(ProjectIcon.ActualWidth/2,ProjectIcon.ActualHeight/2));
                var iconHit=SpaceView.InputHitTest(SpaceView.ProjectSurface(iconLocal)) as DependencyObject;
                Check(iconHit is not null&&(iconHit==ProjectIcon||ProjectIcon.IsAncestorOf(iconHit)),"Perspective hit testing targets the actual project button, not only its mesh UV");
                foreach(var local in new[]{new Point(200,120),new Point(SpaceView.ActualWidth/2,SpaceView.ActualHeight/2),new Point(SpaceView.ActualWidth-180,SpaceView.ActualHeight-100)}){
                    var projected=SpaceView.ProjectSurface(local);var recovered=SpaceView.SurfacePoint(projected);Check(recovered.HasValue&&(recovered.Value-local).Length<.1,"3D ray picking recovers local UI coordinates through perspective");}
                Check(vm.Engine.ProjectText==spatialDocument,"Orbiting the interface does not edit document objects");CaptureUi(folder,"MyCut-spatial-overview.png");SpaceView.SetView(false,false);PumpFrames(80);
                vm.AppendImageEffect(7);vm.SelectNode(vm.GraphNodes.Last(n=>n.Kind==6).Id);PumpFrames(80);viewport.RenderNow();
                var maskBefore=vm.SelectedNode!.Value;var maskItem=vm.Selected!;string maskDocument=vm.Engine.ProjectText;
                viewport.DispatchForTest(0x0201,maskItem.X,maskItem.Y);viewport.DispatchForTest(0x0200,maskItem.X+20,maskItem.Y+10);viewport.DispatchForTest(0x0202,maskItem.X+20,maskItem.Y+10);
                Check(vm.SelectedNode!.Value.V0!=maskBefore.V0||vm.SelectedNode!.Value.V1!=maskBefore.V1,"Mask canvas drag updates the selected graph node");
                viewport.RenderNow();CaptureUi(folder,"MyCut-mask-editing.png");vm.UndoCommand.Execute(null);Check(vm.Engine.ProjectText==maskDocument,"Mask HWND drag is one Undo step");
                var laboratory=new InterfaceSettingsWindow(motion,pointerIntent){Owner=this};laboratory.Show();laboratory.Width=640;laboratory.Height=800;laboratory.UpdateLayout();PumpFrames(120);CapturePanel(laboratory,folder,"MyCut-interface-laboratory.png");laboratory.Close();
                var colorPanel=new ColorWindow(vm,motion,pointerIntent){Owner=this};colorPanel.Show();colorPanel.Width=760;colorPanel.Height=850;colorPanel.UpdateLayout();colorPanel.RefreshScopes();PumpFrames(120);CapturePanel(colorPanel,folder,"MyCut-color-panel.png");colorPanel.Close();
                vm.Engine.Load(Path.Combine(folder,"video-timeline.mycut"));vm.VideoMode=true;vm.Reload();vm.PlayheadFrame=3;vm.SelectClip(vm.TimelineClips.Last().Id);UpdateLayout();dockTimeline.FitClips();PumpFrames(150);viewport.RenderNow();CaptureUi(folder,"MyCut-video-workspace.png");vm.VideoMode=false;
                Check(vm.ForceSoftware?viewport.FrameReadbacks>0:viewport.FrameReadbacks==0,"Presentation uses readback only in the explicit software fallback");
                File.WriteAllText(Path.Combine(folder, "result.json"), JsonSerializer.Serialize(new { Passed = true, Checks = checks, Metrics = vm.Metrics,Presentation=viewport.PresentationMode,FrameReadbacks=viewport.FrameReadbacks }, new JsonSerializerOptions { WriteIndented = true }));
                Close(); Application.Current.Shutdown(0);
            }
            catch (Exception ex)
            {
                App.Log(ex);
                Directory.CreateDirectory(Path.Combine(AppContext.BaseDirectory, "smoke"));
                File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "smoke", "result.json"), JsonSerializer.Serialize(new { Passed = false, Error = ex.ToString() }));
                Application.Current.Shutdown(1);
            }
        };
        timer.Start();
    }
    internal static void PumpFrames(int milliseconds)
    {
        var frame = new DispatcherFrame(); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(milliseconds) };
        timer.Tick += (_, _) => { timer.Stop(); frame.Continue = false; };
        timer.Start(); Dispatcher.PushFrame(frame);
    }
    private static void WaitForUi(Func<bool> ready)
    {
        var elapsed=System.Diagnostics.Stopwatch.StartNew();
        while(!ready()&&elapsed.ElapsedMilliseconds<1500)PumpFrames(25);
    }
    private static void CapturePanel(Window window,string folder,string filename)
    {
        var content=(FrameworkElement)window.Content;var bitmap=new RenderTargetBitmap((int)Math.Ceiling(content.ActualWidth),(int)Math.Ceiling(content.ActualHeight),96,96,PixelFormats.Pbgra32);bitmap.Render(content);
        var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using var stream=File.Create(Path.Combine(folder,filename));encoder.Save(stream);
    }
    internal static IEnumerable<T> Descendants<T>(DependencyObject parent) where T : DependencyObject
    {
        for (int n = 0; n < VisualTreeHelper.GetChildrenCount(parent); ++n)
        {
            var child = VisualTreeHelper.GetChild(parent, n); if (child is T match) yield return match;
            foreach (var item in Descendants<T>(child)) yield return item;
        }
    }
    private void CaptureUi(string folder, string filename = "MyCut-ui.png", (ulong Id, int Handle)? previewTarget = null)
    {
        // Explicit QA readback lets WPF capture the complete projected UI, including the GPU image.
        var root = (FrameworkElement)Content;
        var snapshot = new RenderTargetBitmap((int)Math.Ceiling(root.ActualWidth), (int)Math.Ceiling(root.ActualHeight), 96, 96, PixelFormats.Pbgra32);
        // Capture a resolved QA target after WPF renders: the real cursor stays untouched,
        // so native WM_MOUSELEAVE must not erase this illustrative presentation frame.
        if (previewTarget is { } target)
        {
            var density = VisualTreeHelper.GetDpi(viewport);
            vm.Engine.Feedback(target.Id, 1, 1, target.Handle);
            vm.Engine.Render((int)(viewport.ActualWidth * density.DpiScaleX), (int)(viewport.ActualHeight * density.DpiScaleY), vm.Selected?.Id ?? 0);
        }
        string viewportPath = Path.Combine(folder, "viewport.png"); vm.Engine.Capture(viewportPath);
        var viewportImage = new BitmapImage(); viewportImage.BeginInit(); viewportImage.CacheOption = BitmapCacheOption.OnLoad;
        viewportImage.CreateOptions = BitmapCreateOptions.IgnoreImageCache;
        viewportImage.UriSource = new Uri(viewportPath); viewportImage.EndInit(); viewportImage.Freeze();
        viewport.SetCaptureSource(viewportImage);PumpFrames(40);root.UpdateLayout();
        try{snapshot.Render(root);}finally{viewport.SetCaptureSource(null);}
        var drawing = new DrawingVisual();
        using (var dc = drawing.RenderOpen())
        {
            dc.DrawImage(snapshot, new Rect(0, 0, root.ActualWidth, root.ActualHeight));
        }
        var combined = new RenderTargetBitmap(snapshot.PixelWidth, snapshot.PixelHeight, 96, 96, PixelFormats.Pbgra32); combined.Render(drawing);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(combined));
        using var output = File.Create(Path.Combine(folder, filename)); encoder.Save(output);
    }
}
