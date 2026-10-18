using System.IO;
using System.Windows;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;

internal static class ContentSmokeTests
{
    internal static void Run(MainWindow owner,EditorViewModel vm,ViewportHost viewport,MotionEngine motion,string folder,Action<bool,string> check)
    {
        vm.NewCommand.Execute(null);vm.AddTextCommand.Execute(null);
        check(vm.IsText&&vm.Selected?.Content.Kind==1&&vm.WindowsFonts.Count>0,"Add Text creates a retained text layer and enumerates installed Windows fonts");
        var window=new LayerContentWindow(vm,motion,new PointerIntentTracker()){Owner=owner};window.Show();window.UpdateLayout();
        window.TextEditor.Text="Привет, MyCut!\nWindows · Unicode";window.TextEditor.GetBindingExpression(System.Windows.Controls.TextBox.TextProperty)!.UpdateSource();
        vm.BeginGesture();vm.FontFamily="Segoe UI";vm.FontSize=72;vm.FontBold=true;vm.FontItalic=true;vm.FontUnderline=true;vm.TextAlignment=1;vm.FillColor="#FF60DBEF";vm.EndGesture();
        check(vm.Engine.Items()[0].Text.Contains("Привет")&&vm.Engine.Items()[0].Content.FontSize==72&&vm.Engine.Items()[0].Content.Underline==1,"Text content, font size and formatting reach the C++ document from the live editor");
        viewport.RenderNow();string textPng=Path.Combine(folder,"text-layer.png");vm.Engine.Export(textPng);check(new FileInfo(textPng).Length>2000,"Windows text layer is rendered in the exported composition");
        string project=Path.Combine(folder,"text-and-fill.mycut");vm.Engine.Save(project);vm.Engine.Reset();vm.Engine.Load(project);vm.Reload();
        check(vm.ContentText.Contains("Привет")&&vm.FontFamily=="Segoe UI"&&vm.FontSize==72&&vm.FontItalic&&vm.FontUnderline,"Project roundtrip preserves Unicode text and editable font formatting");
        window.Close();vm.AddFillCommand.Execute(null);vm.ContentKind=3;vm.FillColor="#FF113050";vm.SecondColor="#FFF7BA45";vm.GradientAngle=30;
        check(vm.Selected?.Content.Kind==3&&Math.Abs(vm.Selected.Content.GradientAngle-30)<.01,"Generated fill layer supports editable colors and gradient direction");
        var textId=vm.Items[0].Id;vm.Select(textId);vm.LayerUpCommand.Execute(null);
        check(vm.Items.Last().Id==textId&&vm.LayerItems.First().Id==textId,"Layer reordering updates composition order and top-first scene list");
        vm.DuplicateCommand.Execute(null);var linked=vm.Selected!.Definition;vm.MakeUniqueCommand.Execute(null);
        check(vm.Selected!.Definition!=linked,"Make unique separates a copied layer's retained content");
        vm.Locked=true;var selected=vm.Selected!;bool refused=false;
        try{selected.X+=10;vm.Engine.Transform(selected);}catch(InvalidOperationException){refused=true;}vm.Reload(selected.Id);
        check(refused&&vm.Selected!.Locked,"Locked layers reject transform changes while remaining visible");
        vm.Engine.Reset();vm.Reload();viewport.RenderNow();
    }
}
