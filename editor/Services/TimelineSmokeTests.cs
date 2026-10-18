using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using MyCut.Editor.Controls;
using MyCut.Editor.Motion;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor.Services;

internal static class TimelineSmokeTests
{
    internal static void Run(MainWindow owner,EditorViewModel vm,ViewportHost viewport,MotionEngine motion,string folder,Action<bool,string> check)
    {
        vm.Engine.New();vm.Reload();vm.VideoMode=true;vm.AddFillCommand.Execute(null);vm.FillColor="#FF16475A";vm.ContentWidth=1280;vm.ContentHeight=720;vm.Reload(vm.Selected?.Id);vm.SelectedMedia=vm.MediaBin.First();vm.InsertMedia();
        check(vm.TimelineTracks.Count==1&&vm.TimelineClips.Count==1&&vm.MediaBin.Count==1&&vm.Items.Count==2,"Inserting media creates a clip instance without consuming or duplicating the bin source");
        check(vm.LayerItems.Count==1&&vm.LayerItems[0].Id==vm.SelectedClip!.Value.Instance,"Video layer flyout lists clip instances rather than bin sources");
        var clip=vm.TimelineClips[0];var panel=new TimelineWindow(vm,motion,new PointerIntentTracker()){Owner=owner};panel.Show();panel.Width=1100;panel.Height=800;panel.UpdateLayout();panel.Timeline.FitClips();
        var edge=panel.Timeline.ClipPointForTest(clip.Id,2);check(panel.Timeline.HitForTest(new Point(edge.X+12,edge.Y))==(clip.Id,2),"Timeline edge accepts a nearby click outside its visible trim handle");
        panel.Timeline.DragForTest(clip.Id,0,20);check(vm.SelectedClip!.Value.Start==20,"Timeline body drag moves a real native clip in frames");vm.UndoCommand.Execute(null);check(vm.TimelineClips[0].Value.Start==0,"Timeline body drag is one Undo step");vm.SelectClip(clip.Id);
        panel.Timeline.DragForTest(clip.Id,2,-30);check(vm.SelectedClip!.Value.Duration==120&&vm.SelectedClip.Value.Start==0,"Right edge trim preserves the opposite edge");vm.UndoCommand.Execute(null);vm.SelectClip(clip.Id);
        panel.Timeline.DragForTest(clip.Id,1,12);check(vm.SelectedClip!.Value.Start==12&&vm.SelectedClip.Value.Duration==138&&vm.SelectedClip.Value.SourceIn==12,"Left edge trim preserves the end and advances source In");vm.UndoCommand.Execute(null);vm.SelectClip(clip.Id);
        panel.Timeline.DragForTest(clip.Id,0,30,true);check(vm.SelectedClip!.Value.Start==0,"Escape/cancel rolls back the whole timeline drag");
        vm.PlayheadFrame=16;vm.MarkInCommand.Execute(null);vm.PlayheadFrame=60;vm.MarkOutCommand.Execute(null);vm.SelectClip(clip.Id);
        check(vm.RangeIn==16&&vm.RangeOut==61,"In/Out is manual and does not follow clip selection");
        vm.PlayheadFrame=75;vm.SplitClipCommand.Execute(null);check(vm.TimelineClips.Count==2&&vm.SelectedClip!.Value.SourceIn==75,"Split at playhead creates the correct source offset");vm.UndoCommand.Execute(null);vm.SelectClip(clip.Id);
        vm.ToggleTrack(vm.TimelineTracks[0].Id,true);bool rejected=false;try{var value=vm.SelectedClip!.Value;value.Start=40;vm.Engine.SetClip(value);}catch(InvalidOperationException){rejected=true;}
        check(rejected&&!vm.CanEditClip&&!vm.CanEdit&&vm.Engine.Clips()[0].Start==0,"Track lock protects both clip edits and transform inspector");vm.ToggleTrack(vm.TimelineTracks[0].Id,true);
        string fixture=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../build/native/media-test.mp4"));check(File.Exists(fixture),"Native encoder generated a real video fixture");
        vm.ImportPath(fixture);vm.AddTrackCommand.Execute(null);vm.PlayheadFrame=0;vm.InsertMedia();var video=vm.SelectedClip!;
        check(vm.Selected!.Content.Kind==8&&video.Value.Duration==8&&vm.MediaBin.Count==2,"Windows video import reports duration and inserts a correctly sized clip");
        panel.Timeline.FitClips();panel.Timeline.DragForTest(video.Id,2,10);check(vm.SelectedClip!.Value.Duration==8,"Extending a video trim handle stops at the source end without losing its final frame");
        var first=vm.Engine.ScopeFrame();vm.PlayheadFrame=5;var later=vm.Engine.ScopeFrame();int sample=(45*first.Width+160)*4;
        check(first.Pixels[sample+2]>210&&later.Pixels[sample+1]>210&&later.Pixels[sample+2]<40,"Timeline program preview decodes the selected source frame, not a static thumbnail");
        vm.PlayheadFrame=0;vm.TogglePlayback();MainWindow.PumpFrames(180);check(vm.Playing&&vm.PlayheadFrame>0,"Transport advances document frames from a monotonic playback clock");vm.StopPlayback();
        vm.PlayheadFrame=1_000_000;panel.Timeline.RevealPlayhead();check(panel.Timeline.ViewStart>999_000&&vm.RangeOut==61,"Timeline navigation extends far beyond the last clip without changing export range");
        var outside=vm.Engine.Hit(video.Value.Instance,640,360,1);check(outside.Id==0,"Inactive timeline clips cannot be transformed from the program preview");
        vm.PlayheadFrame=3;vm.ClearRangeCommand.Execute(null);vm.SelectClip(video.Id);panel.Timeline.FitClips();
        string project=Path.Combine(folder,"video-timeline.mycut");vm.Engine.Save(project);vm.Engine.New();vm.Engine.Load(project);vm.Reload();vm.SelectClip(video.Id);
        check(vm.TimelineTracks.Count==2&&vm.TimelineClips.Count==2&&vm.SelectedClip!.Value.Duration==8&&vm.RangeOut==-1,"Timeline tracks, clips, source references and explicit range survive project roundtrip");
        vm.Engine.Export(Path.Combine(folder,"video-program-frame.png"));check(new BitmapImage(new Uri(Path.Combine(folder,"video-program-frame.png"))).PixelWidth==1280,"Timeline PNG export uses the clean full-size program frame");
        string snapshot=vm.Engine.ProjectText,movie=Path.Combine(folder,"video-snapshot-export.mp4");var export=NativeSession.ExportMovieAsync(snapshot,movie,0,8,vm.ForceSoftware,null,CancellationToken.None);
        var moved=vm.SelectedClip!.Value;moved.Start=40;vm.BeginGesture();vm.EditClip(moved);vm.EndGesture();export.GetAwaiter().GetResult();
        check(File.Exists(movie)&&new FileInfo(movie).Length>1000&&vm.SelectedClip!.Value.Start==40,"Worker MP4 export completes from its immutable snapshot while the UI document is edited");
        vm.UndoCommand.Execute(null);vm.SelectClip(video.Id);
        vm.DuplicateCommand.Execute(null);check(vm.TimelineClips.Count==3&&vm.SelectedClip!.Value.Start==8&&vm.SelectedClip.Value.Duration==8,"Duplicate in Video creates a timeline clip with the original timing rather than an unused bin copy");vm.UndoCommand.Execute(null);vm.SelectClip(video.Id);
        viewport.RenderNow();panel.UpdateLayout();var content=(FrameworkElement)panel.Content;var bitmap=new RenderTargetBitmap((int)Math.Ceiling(content.ActualWidth),(int)Math.Ceiling(content.ActualHeight),96,96,PixelFormats.Pbgra32);bitmap.Render(content);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using(var stream=File.Create(Path.Combine(folder,"MyCut-video-timeline.png")))encoder.Save(stream);
        panel.Close();vm.VideoMode=false;vm.Engine.Reset();vm.Reload();viewport.RenderNow();
    }
}
