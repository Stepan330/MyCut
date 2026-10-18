using System.Windows;
using System.Windows.Input;
using MyCut.Editor.Controls;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;
internal static class InlineTextSmokeTests
{
    internal static void Run(EditorViewModel vm,ViewportHost viewport,InlineTextEditor inline,Action<bool,string> check,Action capture)
    {
        vm.Engine.New();vm.Reload();vm.SetPhotoTool(PhotoTool.Text);vm.AddTextCommand.Execute(null);
        vm.ContentText="Привет, MyCut!\nВторая строка";vm.FontSize=40;vm.Rotation=17;vm.ScaleX=1.15;vm.ScaleY=.85;
        string original=vm.Engine.ProjectText;inline.Begin();inline.UpdateLayout();
        check(inline.IsEditing&&inline.Editor.IsKeyboardFocusWithin,"Canvas text editor receives keyboard focus on the text layer");
        var origin=inline.Editor.RenderTransform.Transform(new Point());
        inline.Editor.Select(8,5);check(inline.Editor.SelectedText=="MyCut","Canvas editor can select a substring, not only the whole layer");
        inline.Editor.SelectedText="редактор";
        check(vm.Engine.Items()[0].Text.Contains("Привет, редактор!"),"Replacing a selected canvas substring updates native Unicode text");
        inline.Editor.AppendText("\n"+new string('Ж',60));
        check(vm.Selected!.Content.Width>640&&(inline.Editor.RenderTransform.Transform(new Point())-origin).Length<.05,"Auto-fitting growing text preserves the rotated/scaled top-left");
        string edited=vm.ContentText;inline.Editor.Undo();check(vm.ContentText!=edited,"Canvas text input owns local Undo while editing");inline.Editor.Redo();check(vm.ContentText==edited,"Canvas text input owns local Redo while editing");
        inline.Editor.Select(8,8);capture();inline.End(false);vm.UndoCommand.Execute(null);
        check(vm.Engine.ProjectText==original,"A committed inline text session and auto-fit transforms are one document Undo step");
        inline.Begin();inline.Editor.SelectAll();inline.Editor.SelectedText="Отменённый ввод";inline.End(true);
        check(vm.Engine.ProjectText==original&&!inline.IsEditing,"Cancel restores the entire inline edit without retaining text changes");
        vm.Locked=true;inline.Begin();check(!inline.IsEditing,"Locked text cannot start inline editing");vm.Locked=false;
        vm.SetPhotoTool(PhotoTool.Move);vm.Engine.Reset();vm.Reload();viewport.RenderNow();
    }
}
