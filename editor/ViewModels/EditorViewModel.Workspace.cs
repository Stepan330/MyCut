namespace MyCut.Editor.ViewModels;

public enum WorkspaceKind { Photo, Item, Video, Color, Graph }

public sealed partial class EditorViewModel
{
    private WorkspaceKind workspace=WorkspaceKind.Photo;
    private bool timelineContext;
    public WorkspaceKind Workspace=>workspace;
    public bool ItemMode=>workspace==WorkspaceKind.Item;
    public bool GraphMode=>workspace==WorkspaceKind.Graph;
    public bool InspectMode=>workspace is WorkspaceKind.Item or WorkspaceKind.Video;
    public bool PreviewTimeline=>VideoMode||timelineContext&&workspace is WorkspaceKind.Item or WorkspaceKind.Color or WorkspaceKind.Graph;
    public string WorkspaceName=>workspace.ToString();
    public void ActivateWorkspace(WorkspaceKind value)
    {
        if(!Enum.IsDefined(value))throw new ArgumentOutOfRangeException(nameof(value));
        if(workspace==value)return;
        FinishPhotoPointer(true);StopPlayback();
        if(value==WorkspaceKind.Photo)timelineContext=false;else if(value==WorkspaceKind.Video||workspace==WorkspaceKind.Video)timelineContext=true;
        workspace=value;Engine.Preview(PreviewTimeline,playhead);RefreshLayerList();RefreshGraph();NotifyProperties();RefreshCommands();
    }
    public void ActivateGraph()=>ActivateWorkspace(WorkspaceKind.Graph);
    public void ActivateItem()=>ActivateWorkspace(WorkspaceKind.Item);
}
