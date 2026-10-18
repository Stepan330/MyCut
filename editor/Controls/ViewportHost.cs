using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using System.Windows.Media.Imaging;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;
using MyCut.Editor.Services;

namespace MyCut.Editor.Controls;
public sealed class ViewportHost : FrameworkElement,IDisposable
{
    private const string WindowClass = "MyCut.GpuViewport";
    private HwndSource? source;
    private readonly D3DImage image=new();
    private WriteableBitmap? fallback;
    private byte[] fallbackPixels=[];
    private ImageSource? captureSource;
    private IntPtr boundSurface;
    private bool disposed;
    private bool syntheticDispatch;
    public bool UsesSharedSurface=>boundSurface!=IntPtr.Zero;
    public string PresentationMode=>UsesSharedSurface?"GPU shared surface":"readback fallback";
    internal int FrameReadbacks{get;private set;}
    private bool editingText;
    internal void EditingText(ulong id){vm.Engine.EditingText(id);editingText=id!=0;renderNeeded=true;RenderNow();}
    private readonly EditorViewModel vm;
    private readonly MotionEngine motion;
    private readonly PointerIntentTracker intent;
    private float pointerX,pointerY;
    private bool pointerInside;
    private double lastExpansion;
    private ulong settleId;
    private double settleX,settleY;
    private int dragTool;
    private readonly DispatcherTimer timer;
    private IntPtr hwnd, cursor;
    private bool renderNeeded = true, dragging, dragChanged;
    private bool toolPointer;
    private int lastWidth, lastHeight;
    private ulong lastSelected, pointerHover, renderHover;
    private double selectionProgress = 1, hoverProgress;
    private int hoveredHandle = -1;
    public event EventHandler? InteractionStarted;
    public event EventHandler? PointerObserved;
    internal Exception? InputFailure { get; private set; }
    public ViewportHost(EditorViewModel model, MotionEngine animations,PointerIntentTracker? sharedIntent=null)
    {
        vm = model; motion = animations;intent=sharedIntent??new(); lastSelected = model.Selected?.Id ?? 0;
        InterfaceSettings.Current.PropertyChanged+=StyleChanged;
        vm.PropertyChanged += Changed;
        timer = new DispatcherTimer(DispatcherPriority.Render) { Interval = TimeSpan.FromMilliseconds(16) };
        timer.Tick += (_, _) => RenderNow();
        cursor = LoadCursor(IntPtr.Zero, (IntPtr)32512);
        Focusable=true;Loaded+=(_,_)=>AttachViewport();Unloaded+=(_,_)=>DetachViewport();
        image.IsFrontBufferAvailableChanged+=(_,_)=>renderNeeded=true;
    }
    private void StyleChanged(object? sender,PropertyChangedEventArgs e)=>renderNeeded=true;
    private void AttachViewport()
    {
        if(disposed||source is not null)return;
        source=new HwndSource(new HwndSourceParameters(WindowClass){WindowStyle=unchecked((int)0x80000000),Width=1,Height=1});
        hwnd=source.Handle;source.AddHook(WndProc);
        try{vm.Engine.Attach(hwnd,vm.ForceSoftware);renderNeeded=true;timer.Start();RenderNow();}
        catch{source.Dispose();source=null;hwnd=IntPtr.Zero;throw;}
    }
    protected override void OnRender(DrawingContext dc){base.OnRender(dc);dc.DrawRectangle(Brushes.Black,null,new System.Windows.Rect(RenderSize));var picture=captureSource??(UsesSharedSurface?(ImageSource)image:fallback);if(picture is not null)dc.DrawImage(picture,new System.Windows.Rect(RenderSize));}
    internal void SetCaptureSource(ImageSource? picture){captureSource=picture;InvalidateVisual();}
    private void Changed(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is "Metrics" or "Status") return;
        renderNeeded = true;
        ulong id = vm.Selected?.Id ?? 0;
        if (id != lastSelected)
        {
            lastSelected = id; motion.Cancel(this, "selection"); selectionProgress = .25;
            motion.Animate(this, "selection", selectionProgress, 1, .16, v => { selectionProgress = v; renderNeeded = true; });
        }
    }
    public void RenderNow()
    {
        if (hwnd == IntPtr.Zero || !IsVisible) return;
        var current=intent.Snapshot(InterfaceSettings.Current.MaximumExpansion);
        if(pointerInside&&!dragging)Hover(pointerX,pointerY,current);
        if(Math.Abs(lastExpansion-current.Expansion)>.05){lastExpansion=current.Expansion;renderNeeded=true;}
        var dpi=SpatialCoordinates.Dpi(this);
        int width=(int)Math.Ceiling(ActualWidth*dpi.DpiScaleX),height=(int)Math.Ceiling(ActualHeight*dpi.DpiScaleY);
        if (width <= 0 || height <= 0 || !renderNeeded && !vm.Engine.Pending && width == lastWidth && height == lastHeight) return;
        renderNeeded = false; lastWidth = width; lastHeight = height;
        try
        {
            var origin=SpatialCoordinates.WindowFor(this)?.PointToScreen(new Point())??new Point();
            SetWindowPos(hwnd,IntPtr.Zero,(int)origin.X,(int)origin.Y,width,height,0x0014);
            image.Lock();
            try{
            // Drop WPF's reference before native resize can replace the shared surface.
            if(width!=image.PixelWidth||height!=image.PixelHeight){image.SetBackBuffer(D3DResourceType.IDirect3DSurface9,IntPtr.Zero);boundSurface=IntPtr.Zero;}
            var surface=vm.Engine.Surface(width,height);
            if(surface!=boundSurface||surface!=IntPtr.Zero&&!image.IsFrontBufferAvailable){image.SetBackBuffer(D3DResourceType.IDirect3DSurface9,surface,true);boundSurface=surface;}
            vm.Engine.InputStyle(pointerX,pointerY,current,pointerInside,settleId,settleX,settleY);
            vm.Engine.Feedback(renderHover, selectionProgress, hoverProgress, hoveredHandle);
            vm.Engine.Render(width, height, vm.ColorMode||editingText?0:vm.Selected?.Id ?? 0,vm.MaskEditing?vm.SelectedNodeId:0); vm.Metrics = vm.Engine.Stats;
            if(UsesSharedSurface)image.AddDirtyRect(new Int32Rect(0,0,width,height));
            else{
                if(fallback is null||fallback.PixelWidth!=width||fallback.PixelHeight!=height){fallback=new WriteableBitmap(width,height,96,96,PixelFormats.Bgra32,null);fallbackPixels=new byte[checked(width*height*4)];}
                vm.Engine.CopyFrame(fallbackPixels);++FrameReadbacks;fallback.WritePixels(new Int32Rect(0,0,width,height),fallbackPixels,width*4,0);
            }
            }finally{image.Unlock();}
            InvalidateVisual();
        }
        catch (Exception ex) { App.Log(ex); vm.Status = ex.Message; if (vm.Smoke) throw; }
    }
    internal float PixelsPerUnit
    {
        get { GetClientRect(hwnd, out var bounds); return Math.Max(.001f, Math.Min(bounds.Right / 1280f, bounds.Bottom / 720f)); }
    }
    internal float DipsPerUnit => PixelsPerUnit / (float)SpatialCoordinates.Dpi(this).DpiScaleX;
    private (float X, float Y) CanvasPoint(IntPtr position)
    {
        int x = (short)(position.ToInt64() & 0xffff), y = (short)((position.ToInt64() >> 16) & 0xffff);
        GetClientRect(hwnd, out var bounds); float scale = PixelsPerUnit;
        return ((x - (bounds.Right - 1280 * scale) / 2) / scale, (y - (bounds.Bottom - 720 * scale) / 2) / scale);
    }
    private PointerIntent ObserveIntent(float x,float y)
    {
        GetClientRect(hwnd,out var bounds);float scale=PixelsPerUnit;var density=SpatialCoordinates.Dpi(this).DpiScaleX;
        var screen=SpatialCoordinates.ToScreen(this,new Point((x*scale+(bounds.Right-1280*scale)/2)/density,(y*scale+(bounds.Bottom-720*scale)/2)/density));
        return intent.ObserveScreen(screen,density,InterfaceSettings.Current.MaximumExpansion);
    }
    private void Hover(float x, float y, PointerIntent? observed = null)
    {
        PointerObserved?.Invoke(this, EventArgs.Empty);
        pointerInside=true;pointerX=x;pointerY=y;
        vm.Engine.InputStyle(x,y,observed??intent.Snapshot(InterfaceSettings.Current.MaximumExpansion),true,settleId,settleX,settleY);
        if(vm.MaskEditing){hoveredHandle=-1;int maskHit=vm.MaskHit(x,y,DipsPerUnit,observed??intent.Snapshot(InterfaceSettings.Current.MaximumExpansion));cursor=LoadCursor(IntPtr.Zero,(IntPtr)(maskHit==0?32646:maskHit>0?32515:32512));SetCursor(cursor);return;}
        if(vm.ColorMode){hoveredHandle=-1;SetHover(vm.Engine.Hit(0,x,y,DipsPerUnit,observed??ObserveIntent(x,y)).Id);cursor=LoadCursor(IntPtr.Zero,(IntPtr)32512);SetCursor(cursor);return;}
        if(vm.PhotoMode&&vm.ActivePhotoTool!=PhotoTool.Move)
        {
            hoveredHandle=-1;var candidate=vm.Engine.Hit(0,x,y,DipsPerUnit,observed??ObserveIntent(x,y));
            SetHover(vm.ActivePhotoTool==PhotoTool.Text&&vm.Items.Any(i=>i.Id==candidate.Id&&i.Content.Kind==1)?candidate.Id:0);
            cursor=LoadCursor(IntPtr.Zero,(IntPtr)(vm.ActivePhotoTool==PhotoTool.Text?32513:32515));SetCursor(cursor);return;
        }
        var hit = vm.Engine.Hit(vm.Selected?.Id ?? 0, x, y, DipsPerUnit, observed ?? ObserveIntent(x,y));
        if (hoveredHandle != hit.Handle) { hoveredHandle = hit.Handle; renderNeeded = true; }
        SetHover(hit.Id);
        int tool = hit.Tool;
        cursor = LoadCursor(IntPtr.Zero, (IntPtr)(tool switch { 1 => 32646, 2 when hit.Handle is 4 or 6 => 32645, 2 when hit.Handle is 5 or 7 => 32644, 2 => hit.Handle is 1 or 3 ? 32643 : 32642, 3 => 32515, _ => 32512 }));
        SetCursor(cursor);
    }
    private void SetHover(ulong id)
    {
        if (id == pointerHover) return;
        pointerHover = id;
        if (id != 0) { renderHover = id; hoverProgress = 0; motion.Cancel(this, "hover"); }
        motion.Animate(this, "hover", hoverProgress, id == 0 ? 0 : 1, .13,
            v => { hoverProgress = v; renderNeeded = true; }, () => { if (pointerHover == 0) renderHover = 0; });
    }
    private void Finish(bool cancel)
    {
        if(vm.MaskDragging){vm.EndMask(cancel);ReleaseMouseCapture();renderNeeded=true;return;}
        if(toolPointer){toolPointer=false;vm.FinishPhotoPointer(cancel);ReleaseMouseCapture();renderNeeded=true;return;}
        if (!dragging) return;
        dragging = false;
        vm.Engine.Pointer(cancel ? 3 : 2, vm.Selected?.Id ?? 0, 0, 0, DipsPerUnit, false);
        vm.RefreshInteraction(!cancel && dragChanged); ReleaseMouseCapture(); renderNeeded = true;
        if(!cancel&&dragChanged&&dragTool==1&&vm.Selected is {} item)
        {
            var velocity=intent.Snapshot(InterfaceSettings.Current.MaximumExpansion);settleId=item.Id;
            double amplitude=Math.Min(10,velocity.Speed*.005)/DipsPerUnit;
            motion.Kick(this,"settleX",velocity.Direction.X*amplitude,.32,v=>{settleX=v;renderNeeded=true;});
            motion.Kick(this,"settleY",velocity.Direction.Y*amplitude,.32,v=>{settleY=v;renderNeeded=true;});
        }
    }
    private IntPtr WndProc(IntPtr window, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        try { return DispatchWindowMessage(window, message, wParam, lParam, ref handled); }
        catch (Exception ex)
        {
            // Never propagate a managed exception through the unmanaged window procedure.
            InputFailure = ex; App.Log(ex); vm.Status = ex.Message; handled = true;
            try { Finish(true); } catch (Exception cleanupError) { App.Log(cleanupError); }
            return IntPtr.Zero;
        }
    }
    private IntPtr DispatchWindowMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        switch (message)
        {
            case 0x0084: handled = true; return (IntPtr)1; // WM_NCHITTEST: always a real client hit.
            case 0x0020: SetCursor(cursor); handled = true; return (IntPtr)1;
            case 0x000f: renderNeeded = true; break;
            case 0x0014: handled = true; return (IntPtr)1;
            case 0x0201:
                Focus(); InteractionStarted?.Invoke(this, EventArgs.Empty);
                var down = CanvasPoint(lParam);
                var downIntent=ObserveIntent(down.X,down.Y);
                if(vm.MaskEditing){if(vm.BeginMask(down.X,down.Y,DipsPerUnit,downIntent))CaptureMouse();renderNeeded=true;handled=true;break;}
                if(vm.ColorMode){var colorHit=vm.Engine.Hit(0,down.X,down.Y,DipsPerUnit,downIntent);vm.Select(colorHit.Id);renderNeeded=true;handled=true;break;}
                if(vm.PhotoMode&&vm.ActivePhotoTool!=PhotoTool.Move)
                {
                    vm.BeginPhotoPointer(down.X,down.Y,DipsPerUnit);toolPointer=vm.PhotoPointerActive;if(toolPointer)CaptureMouse();renderNeeded=true;handled=true;break;
                }
                motion.Cancel(this,"settleX");motion.Cancel(this,"settleY");settleId=0;settleX=settleY=0;
                vm.Engine.InputStyle(down.X,down.Y,downIntent);
                ulong id = vm.Engine.Pointer(0, vm.Selected?.Id ?? 0, down.X, down.Y, DipsPerUnit, false,downIntent);
                dragTool=id!=0?vm.Engine.Tool(id,down.X,down.Y,DipsPerUnit):0;
                vm.Select(id); dragging = id != 0; dragChanged = false;
                if (dragging) CaptureMouse();
                Hover(down.X, down.Y,downIntent); handled = true; break;
            case 0x0200:
                var move = CanvasPoint(lParam);
                var moveIntent=ObserveIntent(move.X,move.Y);
                if(vm.MaskDragging){vm.MoveMask(move.X,move.Y);Hover(move.X,move.Y,moveIntent);renderNeeded=true;handled=true;break;}
                if(toolPointer){vm.MovePhotoPointer(move.X,move.Y,DipsPerUnit,(GetKeyState(0x10)&0x8000)!=0);Hover(move.X,move.Y,moveIntent);handled=true;break;}
                if (dragging)
                {
                    vm.Engine.Pointer(1, vm.Selected?.Id ?? 0, move.X, move.Y, DipsPerUnit, (GetKeyState(0x10) & 0x8000) != 0);
                    dragChanged = true; vm.RefreshInteraction(false);
                }
                Hover(move.X, move.Y,moveIntent); handled = true; break;
            case 0x0202: Finish(false); handled = true; break;
            case 0x0215: Finish(false); break;
            case 0x001f: Finish(true); break;
            case 0x02a3: pointerInside=false;renderNeeded=true; hoveredHandle = -1; SetHover(0); break;
            case 0x0100:
                if (wParam.ToInt32() == 0x1b && (dragging||toolPointer||vm.MaskDragging)) { Finish(true); handled = true; }
                break;
        }
        return IntPtr.Zero;
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if(e.Key==Key.Escape&&(dragging||toolPointer||vm.MaskDragging)){Finish(true);e.Handled=true;return;}
        if(!dragging&&!toolPointer&&!vm.MaskDragging&&vm.HandleShortcut(e.Key,Keyboard.Modifiers)){e.Handled=true;return;}
        base.OnKeyDown(e);
    }
    private void ForwardMouse(int message,MouseEventArgs e)
    {
        if(hwnd==IntPtr.Zero||syntheticDispatch)return;var p=e.GetPosition(this);var dpi=SpatialCoordinates.Dpi(this);int x=(int)Math.Round(p.X*dpi.DpiScaleX),y=(int)Math.Round(p.Y*dpi.DpiScaleY);bool handled=false;
        WndProc(hwnd,message,IntPtr.Zero,(IntPtr)((y&0xffff)<<16|x&0xffff),ref handled);e.Handled=handled;
    }
    protected override void OnMouseDown(MouseButtonEventArgs e){
        if(e.ChangedButton==MouseButton.Left&&e.ClickCount==2&&vm.PhotoMode&&vm.ActivePhotoTool==PhotoTool.Move){
            var p=e.GetPosition(this);float scale=PixelsPerUnit;var dpi=SpatialCoordinates.Dpi(this);GetClientRect(hwnd,out var bounds);
            float x=((float)(p.X*dpi.DpiScaleX)-(bounds.Right-1280*scale)/2)/scale,y=((float)(p.Y*dpi.DpiScaleY)-(bounds.Bottom-720*scale)/2)/scale;
            var hit=vm.Engine.Hit(0,x,y,DipsPerUnit);
            if(vm.Items.Any(i=>i.Id==hit.Id&&i.Content.Kind==1&&!i.Locked)){
                vm.SetPhotoTool(PhotoTool.Text);vm.BeginPhotoPointer(x,y,DipsPerUnit);e.Handled=true;return;
            }
        }
        if(e.ChangedButton==MouseButton.Left)ForwardMouse(0x0201,e);else base.OnMouseDown(e);
    }
    protected override void OnMouseMove(MouseEventArgs e){ForwardMouse(0x0200,e);base.OnMouseMove(e);}
    protected override void OnMouseUp(MouseButtonEventArgs e){if(e.ChangedButton==MouseButton.Left)ForwardMouse(0x0202,e);else base.OnMouseUp(e);}
    protected override void OnMouseLeave(MouseEventArgs e){ForwardMouse(0x02a3,e);base.OnMouseLeave(e);}
    protected override void OnLostMouseCapture(MouseEventArgs e){Finish(false);base.OnLostMouseCapture(e);}
    private void DetachViewport()
    {
        if(source is null)return;timer.Stop();Finish(true);image.Lock();try{image.SetBackBuffer(D3DResourceType.IDirect3DSurface9,IntPtr.Zero);boundSurface=IntPtr.Zero;}finally{image.Unlock();}
        vm.Engine.Detach();source.Dispose();source=null;hwnd=IntPtr.Zero;
    }
    public void Dispose()
    {
        if(disposed)return;disposed=true;DetachViewport();vm.PropertyChanged -= Changed; motion.Cancel(this);
        InterfaceSettings.Current.PropertyChanged-=StyleChanged;
    }
    // Integration tests use actual HWND message dispatch, not direct ViewModel transforms.
    internal void DispatchForTest(int message, float canvasX, float canvasY)
    {
        GetClientRect(hwnd, out var b); float s = PixelsPerUnit;
        int x = (int)Math.Round(canvasX * s + (b.Right - 1280 * s) / 2), y = (int)Math.Round(canvasY * s + (b.Bottom - 720 * s) / 2);
        syntheticDispatch=true;try{SendMessage(hwnd, message, message == 0x0200 ? (IntPtr)1 : IntPtr.Zero, (IntPtr)((y & 0xffff) << 16 | x & 0xffff));}finally{syntheticDispatch=false;}
    }
    internal bool ClientHitForTest() => SendMessage(hwnd, 0x0084, IntPtr.Zero, IntPtr.Zero) == (IntPtr)1;
    internal void EscapeForTest() => SendMessage(hwnd, 0x0100, (IntPtr)0x1b, IntPtr.Zero);
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hwnd, out Rect bounds);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,int flags);
    [DllImport("user32.dll")] private static extern short GetKeyState(int key);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr LoadCursor(IntPtr instance, IntPtr cursor);
    private void SetCursor(IntPtr value)
    {
        NativeSetCursor(value);
        Cursor=value==LoadCursor(IntPtr.Zero,(IntPtr)32513)?Cursors.IBeam:value==LoadCursor(IntPtr.Zero,(IntPtr)32515)?Cursors.Cross:value==LoadCursor(IntPtr.Zero,(IntPtr)32646)?Cursors.SizeAll:value==LoadCursor(IntPtr.Zero,(IntPtr)32645)?Cursors.SizeNS:value==LoadCursor(IntPtr.Zero,(IntPtr)32644)?Cursors.SizeWE:value==LoadCursor(IntPtr.Zero,(IntPtr)32643)?Cursors.SizeNESW:value==LoadCursor(IntPtr.Zero,(IntPtr)32642)?Cursors.SizeNWSE:Cursors.Arrow;
    }
    [DllImport("user32.dll",EntryPoint="SetCursor")] private static extern IntPtr NativeSetCursor(IntPtr cursor);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr SendMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam);
}
