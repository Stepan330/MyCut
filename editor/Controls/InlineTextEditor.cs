using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Controls;

// A real text input surface in document-local coordinates. The containing 3D
// workspace projects it together with the canvas, including selection and caret.
public sealed class InlineTextEditor:Canvas,IDisposable
{
    private readonly EditorViewModel vm;
    private readonly ViewportHost viewport;
    internal TextBox Editor{get;}=new(){Style=new Style(typeof(TextBox)),AcceptsReturn=true,AcceptsTab=true,TextWrapping=TextWrapping.NoWrap,
        Padding=new Thickness(0),BorderThickness=new Thickness(0),Background=Brushes.Transparent,MaxLength=65536,
        HorizontalScrollBarVisibility=ScrollBarVisibility.Hidden,VerticalScrollBarVisibility=ScrollBarVisibility.Hidden,
        SelectionBrush=new SolidColorBrush(Color.FromRgb(30,132,185)),SelectionOpacity=.65,CaretBrush=Brushes.White,
        IsUndoEnabled=true,VerticalContentAlignment=VerticalAlignment.Top};
    private ulong owner;
    private bool syncing,ending;
    public bool IsEditing=>owner!=0;
    public InlineTextEditor(EditorViewModel model,ViewportHost view)
    {
        vm=model;viewport=view;ClipToBounds=true;Visibility=Visibility.Collapsed;Children.Add(Editor);
        ProximityInput.SetOwnInput(this,true);
        Editor.TextChanged+=TextChanged;Editor.PreviewKeyDown+=KeyDownInEditor;Editor.LostKeyboardFocus+=FocusLost;
        vm.PropertyChanged+=Changed;SizeChanged+=(_,_)=>Position();
    }
    public void Begin(bool selectAll=false)
    {
        if(vm.Selected is not {Content.Kind:1,Locked:false,Visible:true} item||!vm.PhotoMode)return;
        if(owner==item.Id){Editor.Focus();return;}End(false);
        vm.BeginGesture();owner=item.Id;syncing=true;
        try{Editor.IsUndoEnabled=false;Editor.Text=item.Text;Editor.IsUndoEnabled=true;Visibility=Visibility.Visible;Position();viewport.EditingText(owner);}
        finally{syncing=false;}
        UpdateLayout();Editor.Focus();Keyboard.Focus(Editor);
        if(selectAll)Editor.SelectAll();else{int index=Editor.GetCharacterIndexFromPoint(Mouse.GetPosition(Editor),true);Editor.CaretIndex=index<0?Editor.Text.Length:index;}
        vm.Status="Edit text on canvas · drag to select · Enter: new line · Ctrl+Enter: apply · Esc: cancel";
    }
    public void End(bool cancel)
    {
        if(!IsEditing||ending)return;ending=true;owner=0;Visibility=Visibility.Collapsed;
        try{viewport.EditingText(0);if(cancel)vm.CancelGesture();else vm.EndGesture();}
        finally{ending=false;}
    }
    private void TextChanged(object sender,TextChangedEventArgs e)
    {
        if(syncing||!IsEditing||vm.Selected is not {} item)return;syncing=true;
        try{
            double w=item.Content.Width,h=item.Content.Height;
            vm.ContentText=Editor.Text;
            // Auto-fit must preserve the edited instance's top-left, including
            // rotated/non-uniformly-scaled layers, rather than sliding the caret.
            double dx=(item.Content.Width-w)*item.ScaleX/2,dy=(item.Content.Height-h)*item.ScaleY/2,a=item.Rotation*Math.PI/180;
            if(dx!=0||dy!=0){vm.X=item.X+dx*Math.Cos(a)-dy*Math.Sin(a);vm.Y=item.Y+dx*Math.Sin(a)+dy*Math.Cos(a);}
            Position();
        }finally{syncing=false;}
    }
    private void Changed(object? sender,PropertyChangedEventArgs e)
    {
        if(!IsEditing||syncing||ending)return;
        if(vm.Selected?.Id!=owner||vm.Selected.Content.Kind!=1||!vm.PhotoMode||!vm.ToolIsText||vm.Selected.Locked||!vm.Selected.Visible){End(false);return;}
        syncing=true;try{if(Editor.Text!=vm.ContentText){int caret=Editor.CaretIndex;Editor.Text=vm.ContentText;Editor.CaretIndex=Math.Min(caret,Editor.Text.Length);}Position();}finally{syncing=false;}
    }
    private void Position()
    {
        if(!IsEditing||vm.Selected is not {} item)return;
        var c=item.Content;Editor.Width=Math.Max(1,c.Width);Editor.Height=Math.Max(1,c.Height);
        Editor.FontFamily=new FontFamily(item.Font);Editor.FontSize=c.FontSize;
        Editor.FontWeight=FontWeight.FromOpenTypeWeight(c.FontWeight);Editor.FontStyle=c.Italic!=0?FontStyles.Italic:FontStyles.Normal;
        Editor.TextAlignment=c.Alignment==1?TextAlignment.Center:c.Alignment==2?TextAlignment.Right:TextAlignment.Left;
        TextBlock.SetLineHeight(Editor,c.FontSize*c.LineHeight);
        TextBlock.SetLineStackingStrategy(Editor,LineStackingStrategy.BlockLineHeight);
        Editor.SetValue(TextBlock.TextDecorationsProperty,c.Underline!=0?TextDecorations.Underline:null);
        Editor.Foreground=new SolidColorBrush(Color.FromArgb((byte)Math.Clamp(Math.Round(c.FillAlpha*item.Opacity*255),0,255),(byte)Math.Clamp(Math.Round(c.FillRed*255),0,255),(byte)Math.Clamp(Math.Round(c.FillGreen*255),0,255),(byte)Math.Clamp(Math.Round(c.FillBlue*255),0,255)));
        double scale=Math.Min(viewport.ActualWidth/1280,viewport.ActualHeight/720),a=item.Rotation*Math.PI/180;
        var matrix=new Matrix(item.ScaleX*Math.Cos(a)*scale,item.ScaleX*Math.Sin(a)*scale,-item.ScaleY*Math.Sin(a)*scale,item.ScaleY*Math.Cos(a)*scale,0,0);
        matrix.OffsetX=(viewport.ActualWidth-1280*scale)/2+item.X*scale-matrix.M11*c.Width/2-matrix.M21*c.Height/2;
        matrix.OffsetY=(viewport.ActualHeight-720*scale)/2+item.Y*scale-matrix.M12*c.Width/2-matrix.M22*c.Height/2;
        Editor.RenderTransform=new MatrixTransform(matrix);
    }
    private void KeyDownInEditor(object sender,KeyEventArgs e)
    {
        if(e.Key==Key.Escape){End(true);viewport.Focus();e.Handled=true;}
        else if(e.Key==Key.Enter&&Keyboard.Modifiers.HasFlag(ModifierKeys.Control)){End(false);viewport.Focus();e.Handled=true;}
    }
    private void FocusLost(object sender,KeyboardFocusChangedEventArgs e)=>Dispatcher.BeginInvoke(DispatcherPriority.Background,()=>{if(IsEditing&&!Editor.IsKeyboardFocusWithin)End(false);});
    public void Dispose(){End(false);vm.PropertyChanged-=Changed;Editor.TextChanged-=TextChanged;Editor.PreviewKeyDown-=KeyDownInEditor;Editor.LostKeyboardFocus-=FocusLost;}
}
