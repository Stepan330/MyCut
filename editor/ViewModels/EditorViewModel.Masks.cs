using System.Windows;
using MyCut.Editor.Services;
namespace MyCut.Editor.ViewModels;
public sealed partial class EditorViewModel
{
    private NativeNode maskStart;
    private Point maskDown;
    private int maskHandle=-1;
    private ulong maskOwner;
    private readonly ZoneExpansionMemory maskZones=new();
    public bool MaskEditing=>SelectedNode is {Kind:6}&&CanEditNode&&!PreviewTimeline;
    public bool MaskDragging=>maskOwner!=0;
    private Point MaskPoint(double x,double y)
    {
        var item=Selected!;double angle=item.Rotation*Math.PI/180,dx=x-item.X,dy=y-item.Y;
        return new(.5+(dx*Math.Cos(angle)+dy*Math.Sin(angle))/(item.Content.Width*item.ScaleX),.5+(-dx*Math.Sin(angle)+dy*Math.Cos(angle))/(item.Content.Height*item.ScaleY));
    }
    public int MaskHit(double x,double y,double density,Controls.PointerIntent intent)
    {
        if(!MaskEditing||SelectedNode is not {} node)return -1;
        var p=MaskPoint(x,y);var item=Selected!;double sx=item.Content.Width*item.ScaleX*density,sy=item.Content.Height*item.ScaleY*density;
        var centers=new[]{new Point(node.V0,node.V1-node.V3),new Point(node.V0+node.V2,node.V1),new Point(node.V0,node.V1+node.V3),new Point(node.V0-node.V2,node.V1)};
        int best=-1;double distance=double.MaxValue;var settings=InterfaceSettings.Current;
        for(int n=0;n<4;n++){double d=Math.Sqrt(Math.Pow((p.X-centers[n].X)*sx,2)+Math.Pow((p.Y-centers[n].Y)*sy,2));
            double extra=settings.AdaptiveInput?AdaptiveZoneLaw.Expansion(intent.ButtonSpeed,d,settings.MouseSpeedCoefficient,settings.ZoneInfluenceDistance,settings.SpeedThreshold,settings.MaximumExpansion):0;
            extra=maskZones.UpdateWithRate((node.Id,n),extra,settings.ZoneShrinkSpeed);
            if(d<=settings.HandleRadius+extra&&d<distance){distance=d;best=n+1;}}
        if(best>=0)return best;
        return Math.Pow((p.X-node.V0)/node.V2,2)+Math.Pow((p.Y-node.V1)/node.V3,2)<=1?0:-1;
    }
    public bool BeginMask(double x,double y,double density,Controls.PointerIntent intent)
    {
        int hit=MaskHit(x,y,density,intent);if(hit<0||SelectedNode is not {} n)return false;
        BeginGesture();maskStart=n;maskOwner=GraphOwner;maskDown=MaskPoint(x,y);maskHandle=hit;return true;
    }
    public void MoveMask(double x,double y)
    {
        if(!MaskDragging)return;if(Selected?.Id!=maskOwner||!CanEdit){EndMask(true);return;}
        var p=MaskPoint(x,y);var n=maskStart;
        if(maskHandle==0){n.V0=(float)Math.Clamp(n.V0+p.X-maskDown.X,-4,4);n.V1=(float)Math.Clamp(n.V1+p.Y-maskDown.Y,-4,4);}
        else if(maskHandle is 1 or 3)n.V3=(float)Math.Clamp(n.V3+(p.Y-maskDown.Y)*(maskHandle==1?-1:1),.001,10);
        else n.V2=(float)Math.Clamp(n.V2+(p.X-maskDown.X)*(maskHandle==4?-1:1),.001,10);
        EditGraphNode(maskOwner,n);
    }
    public void EndMask(bool cancel)
    {
        if(!MaskDragging)return;maskOwner=0;maskHandle=-1;if(cancel)CancelGesture();else EndGesture();NotifyProperties();
    }
}
