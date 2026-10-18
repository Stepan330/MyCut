using System.Collections.ObjectModel;
using System.IO;
using System.Windows.Threading;
using Microsoft.Win32;
using MyCut.Editor.Services;

namespace MyCut.Editor.ViewModels;

public sealed record TimelineClip(NativeClip Value,string Name,int Kind)
{
    public ulong Id=>Value.Id;
    public long End=>Value.Start+Value.Duration;
}
public sealed partial class EditorViewModel
{
    public ObservableCollection<TimelineTrack> TimelineTracks{get;}=[];
    public ObservableCollection<TimelineClip> TimelineClips{get;}=[];
    public ObservableCollection<SceneItem> MediaBin{get;}=[];
    private SceneItem? selectedMedia;
    private ulong selectedClipId,selectedTrackId;
    private long playhead,rangeIn,rangeOut=-1;
    private int rateNum=30,rateDen=1;
    private bool playing;
    private readonly DispatcherTimer playbackTimer=new(DispatcherPriority.Render){Interval=TimeSpan.FromMilliseconds(16)};
    private readonly System.Diagnostics.Stopwatch playbackClock=new();
    private long playbackStart;
    public RelayCommand ImportMediaCommand{get;private set;}=null!;
    public RelayCommand AddTrackCommand{get;private set;}=null!;
    public RelayCommand InsertClipCommand{get;private set;}=null!;
    public RelayCommand SplitClipCommand{get;private set;}=null!;
    public RelayCommand DeleteClipCommand{get;private set;}=null!;
    public RelayCommand RippleDeleteCommand{get;private set;}=null!;
    public RelayCommand PlayCommand{get;private set;}=null!;
    public RelayCommand MarkInCommand{get;private set;}=null!;
    public RelayCommand MarkOutCommand{get;private set;}=null!;
    public RelayCommand ClearRangeCommand{get;private set;}=null!;
    private void InitializeTimeline()
    {
        ImportMediaCommand=new RelayCommand(()=>{var dialog=new OpenFileDialog{Title="Import media",Filter="Images and Windows-supported video|*.png;*.jpg;*.jpeg;*.bmp;*.tif;*.tiff;*.mp4;*.mov;*.m4v;*.avi;*.wmv;*.mkv",Multiselect=true};if(dialog.ShowDialog()==true)foreach(var path in dialog.FileNames)ImportPath(path);});
        AddTrackCommand=new RelayCommand(()=>Execute(()=>{SelectedTrackId=Engine.AddTrack($"Video {TimelineTracks.Count+1}");Changed();Reload(Selected?.Id);}));
        InsertClipCommand=new RelayCommand(InsertMedia,()=>SelectedMedia is not null);
        SplitClipCommand=new RelayCommand(()=>Execute(()=>{var id=Engine.SplitClip(SelectedClipId,PlayheadFrame);Changed();Reload();SelectClip(id);}),()=>CanEditClip&&SelectedClip is {} c&&PlayheadFrame>c.Value.Start&&PlayheadFrame<c.End);
        DeleteClipCommand=new RelayCommand(()=>DeleteClip(false),()=>CanEditClip);
        RippleDeleteCommand=new RelayCommand(()=>DeleteClip(true),()=>CanEditClip);
        PlayCommand=new RelayCommand(TogglePlayback,()=>TimelineClips.Count>0);
        MarkInCommand=new RelayCommand(()=>SetTimelineRange(PlayheadFrame,RangeOut>PlayheadFrame?RangeOut:-1));
        MarkOutCommand=new RelayCommand(()=>SetTimelineRange(Math.Min(RangeIn,PlayheadFrame),PlayheadFrame+1));
        ClearRangeCommand=new RelayCommand(()=>SetTimelineRange(0,-1));
        playbackTimer.Tick+=(_,_)=>
        {
            long next=playbackStart+(long)Math.Floor(playbackClock.Elapsed.TotalSeconds*FrameRate);long end=RangeOut>=0?RangeOut:TimelineEnd;
            if(next>=end){StopPlayback();PlayheadFrame=Math.Max(RangeIn,end-1);}else PlayheadFrame=next;
        };
    }
    private void RefreshTimelineCommands()
    {
        InsertClipCommand?.Refresh();SplitClipCommand?.Refresh();DeleteClipCommand?.Refresh();RippleDeleteCommand?.Refresh();PlayCommand?.Refresh();
    }
    public bool VideoMode{get=>workspace==WorkspaceKind.Video;set{if(value)ActivateWorkspace(WorkspaceKind.Video);else if(VideoMode)ActivatePhoto();}}
    public double FrameRate=>(double)rateNum/rateDen;
    public string FrameRateText=>$"{FrameRate:0.###} fps";
    public long PlayheadFrame
    {
        get=>playhead;
        set{value=Math.Clamp(value,0,1_000_000_000);if(playhead==value)return;playhead=value;Engine.Preview(PreviewTimeline,value);Notify(nameof(PlayheadFrame));Notify(nameof(PlayheadValue));Notify(nameof(Timecode));Notify(nameof(ViewportHint));SplitClipCommand?.Refresh();}
    }
    public double PlayheadValue{get=>PlayheadFrame;set=>PlayheadFrame=(long)Math.Round(value);}
    public string Timecode{get{var elapsed=PlayheadFrame/FrameRate;return $"{(long)(elapsed/3600):00}:{(int)(elapsed/60)%60:00}:{(int)elapsed%60:00}.{(int)Math.Floor((elapsed-Math.Floor(elapsed))*1000+1e-6):000}";}}
    public long RangeIn=>rangeIn;
    public long RangeOut=>rangeOut;
    public string RangeText=>$"In {RangeIn}   ·   Out {(RangeOut<0?"unset":RangeOut.ToString())}   ·   end {TimelineEnd}";
    public long TimelineEnd=>TimelineClips.Select(c=>c.End).DefaultIfEmpty(0).Max();
    public bool Playing=>playing;
    public string PlayLabel=>Playing?"Pause":"Play";
    public string PlayIcon=>Playing?"pause":"play";
    public SceneItem? SelectedMedia{get=>selectedMedia;set{selectedMedia=value;Notify();InsertClipCommand?.Refresh();}}
    public ulong SelectedTrackId{get=>selectedTrackId;set{selectedTrackId=value;Notify();}}
    public ulong SelectedClipId=>selectedClipId;
    public TimelineClip? SelectedClip=>TimelineClips.FirstOrDefault(c=>c.Id==SelectedClipId);
    public bool CanEditClip=>SelectedClip is {} c&&TimelineTracks.Any(t=>t.Id==c.Value.Track&&!t.Locked);
    public string ClipName=>SelectedClip?.Name??"Select a clip";
    private void ReloadTimeline()
    {
        var info=Engine.TimelineInfo();rateNum=info.Num;rateDen=info.Den;rangeIn=info.In;rangeOut=info.Out;
        TimelineTracks.Clear();foreach(var track in Engine.Tracks().AsEnumerable().Reverse())TimelineTracks.Add(track);
        TimelineClips.Clear();foreach(var c in Engine.Clips()){var item=Items.First(i=>i.Id==c.Instance);TimelineClips.Add(new(c,item.Name,item.Content.Kind));}
        if(!TimelineClips.Any(c=>c.Id==selectedClipId))selectedClipId=0;
        if(!TimelineTracks.Any(t=>t.Id==selectedTrackId))selectedTrackId=TimelineTracks.FirstOrDefault()?.Id??0;
        ulong mediaId=SelectedMedia?.Id??0;var owned=TimelineClips.Select(c=>c.Value.Instance).ToHashSet();MediaBin.Clear();foreach(var i in Items.Where(i=>!owned.Contains(i.Id)))MediaBin.Add(i);
        SelectedMedia=MediaBin.FirstOrDefault(i=>i.Id==mediaId)??MediaBin.FirstOrDefault();Engine.Preview(PreviewTimeline,PlayheadFrame);RefreshTimelineCommands();
        RefreshLayerList();
    }
    private void RefreshLayerList()
    {
        var owned=TimelineClips.Select(c=>c.Value.Instance).ToHashSet();var next=Items.Reverse().Where(i=>owned.Contains(i.Id)==PreviewTimeline).ToArray();
        if(LayerItems.SequenceEqual(next))return;ulong? selectedId=Selected?.Id;LayerItems.Clear();foreach(var i in next)LayerItems.Add(i);if(selectedId is {} id)Selected=Items.FirstOrDefault(i=>i.Id==id);
    }
    public void SelectClip(ulong id)
    {
        selectedClipId=id;if(SelectedClip is {} clip){SelectedTrackId=clip.Value.Track;Select(clip.Value.Instance);}NotifyProperties();RefreshTimelineCommands();
    }
    public void InsertMedia()
    {
        if(SelectedMedia is not {} media)return;Execute(()=>
        {
            BeginGesture();try{ulong track=SelectedTrackId;if(track==0)track=Engine.AddTrack("Video 1");
                long duration=media.Content.Kind==8?Math.Max(1,(long)Math.Ceiling(media.MediaDuration*FrameRate-1e-5)):Math.Max(1,(long)Math.Round(5*FrameRate));
                ulong id=Engine.AddClip(media.Id,track,PlayheadFrame,duration);Changed();EndGesture();Reload();SelectClip(id);Status="Clip inserted at playhead. Drag to move; pull its edges to trim.";
            }catch{CancelGesture();throw;}
        });
    }
    public void EditClip(NativeClip value)
    {
        Engine.SetClip(value);Changed();Reload(value.Instance);SelectClip(value.Id);
    }
    public void DeleteClip(bool ripple)=>Execute(()=>{Engine.RemoveClip(SelectedClipId,ripple);Changed();Reload();});
    public void DuplicateClip()
    {
        if(!CanEditClip||SelectedClip is not {} source)return;Execute(()=>
        {
            BeginGesture();try{var old=source.Value;ulong id=Engine.AddClip(old.Instance,old.Track,source.End,old.Duration);var created=Engine.Clips().First(c=>c.Id==id);
                created.SourceIn=old.SourceIn;created.Speed=old.Speed;created.FadeIn=old.FadeIn;created.FadeOut=old.FadeOut;created.Muted=old.Muted;Engine.SetClip(created);
                Changed();EndGesture();Reload(created.Instance);SelectClip(id);
            }catch{CancelGesture();throw;}
        });
    }
    public void ToggleTrack(ulong id,bool locking)
    {
        Execute(()=>{var value=TimelineTracks.First(t=>t.Id==id).Value;if(locking)value.Locked=value.Locked==0?1:0;else value.Muted=value.Muted==0?1:0;Engine.SetTrack(value);Changed();Reload(Selected?.Id);});
    }
    private void SetTimelineRange(long first,long last)=>Execute(()=>{Engine.SetRange(first,last);Changed();Reload(Selected?.Id);});
    private void ChangeClip(ActionRef<NativeClip> change)
    {
        if(!CanEditClip||SelectedClip is not {} c)return;Execute(()=>{var value=c.Value;change(ref value);value.FadeIn=Math.Min(value.FadeIn,value.Duration);value.FadeOut=Math.Min(value.FadeOut,value.Duration);EditClip(value);});
    }
    private delegate void ActionRef<T>(ref T value);
    public double ClipStart{get=>SelectedClip?.Value.Start??0;set=>ChangeClip((ref NativeClip c)=>c.Start=(long)Math.Round(value));}
    public double ClipDuration{get=>SelectedClip?.Value.Duration??1;set=>ChangeClip((ref NativeClip c)=>c.Duration=(long)Math.Round(value));}
    public double ClipSourceIn{get=>SelectedClip?.Value.SourceIn??0;set=>ChangeClip((ref NativeClip c)=>c.SourceIn=(long)Math.Round(value));}
    public double ClipSpeed{get=>SelectedClip?.Value.Speed??1;set=>ChangeClip((ref NativeClip c)=>c.Speed=(float)value);}
    public double ClipFadeIn{get=>SelectedClip?.Value.FadeIn??0;set=>ChangeClip((ref NativeClip c)=>c.FadeIn=(long)Math.Round(value));}
    public double ClipFadeOut{get=>SelectedClip?.Value.FadeOut??0;set=>ChangeClip((ref NativeClip c)=>c.FadeOut=(long)Math.Round(value));}
    public void TogglePlayback()
    {
        if(Playing){StopPlayback();return;}if(!VideoMode)VideoMode=true;
        long end=RangeOut>=0?RangeOut:TimelineEnd;if(end<=RangeIn)return;if(PlayheadFrame>=end)PlayheadFrame=RangeIn;
        playbackStart=PlayheadFrame;playbackClock.Restart();playing=true;playbackTimer.Start();Notify(nameof(Playing));Notify(nameof(PlayLabel));Notify(nameof(PlayIcon));
    }
    public void StopPlayback(){playbackTimer.Stop();playbackClock.Stop();playing=false;Notify(nameof(Playing));Notify(nameof(PlayLabel));Notify(nameof(PlayIcon));}
}
