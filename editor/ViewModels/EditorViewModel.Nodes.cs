using System.Collections.ObjectModel;
using System.Windows.Media;
using MyCut.Editor.Services;

namespace MyCut.Editor.ViewModels;
public sealed partial class EditorViewModel
{
    public ObservableCollection<NativeNode> GraphNodes{get;}=[];
    public ulong GraphOwner{get;private set;}
    public ulong GraphOutput{get;private set;}
    private ulong selectedNode;
    private bool graphEnabled=true;
    public ulong SelectedNodeId=>selectedNode;
    public NativeNode? SelectedNode=>GraphNodes.FirstOrDefault(n=>n.Id==selectedNode) is {Id:>0} n?n:null;
    public bool CanEditNode=>CanEdit&&Selected?.Id==GraphOwner&&SelectedNode is not null;
    public bool GraphEnabled{get=>graphEnabled;set{if(!CanEdit||Selected is not {} i||value==graphEnabled)return;Execute(()=>{Engine.EnableGraph(i.Id,value);Changed();RefreshGraph();NotifyProperties();});}}
    public string SelectedNodeName=>SelectedNode is {} n?NodeSchema.Names[n.Kind]:"Select a node";
    public void RefreshGraph()
    {
        ulong owner=Selected?.Id??0;if(owner!=GraphOwner){GraphOwner=owner;selectedNode=0;}
        GraphNodes.Clear();if(owner==0){GraphOutput=0;return;}var info=Engine.GraphInfo(owner);graphEnabled=info.Enabled;GraphOutput=info.Output;
        foreach(var n in Engine.Nodes(owner))GraphNodes.Add(n);if(!GraphNodes.Any(n=>n.Id==selectedNode))selectedNode=0;
    }
    public void SelectNode(ulong id){selectedNode=id;NotifyProperties();}
    public void CreateGraph(bool example=false)
    {
        if(!CanEdit||Selected is not {} i)return;Execute(()=>{Engine.InitializeGraph(i.Id,example);Changed();RefreshGraph();SelectNode(GraphOutput);NotifyProperties();});
    }
    public ulong AddGraphNode(int kind,double x,double y)
    {
        if(!CanEdit||Selected is not {} i)return 0;ulong result=0;Execute(()=>{result=Engine.AddNode(i.Id,kind,(float)x,(float)y);Changed();RefreshGraph();SelectNode(result);NotifyProperties();});return result;
    }
    public void EditGraphNode(ulong owner,NativeNode value)
    {
        if(!CanEdit||Selected?.Id!=owner)return;
        Engine.SetNode(owner,value);Changed();RefreshGraph();NotifyProperties();
    }
    // A palette drop, including type promotion and the cable, is one atomic user action.
    public ulong AddLinkedGraphNode(int kind,double x,double y,ulong originId=0,int originPort=-1)
    {
        if(!CanEdit||Selected is not {} item)return 0;ulong result=0;
        Execute(()=>
        {
            BeginGesture();try
            {
                var origin=originId==0?default:Engine.Nodes(item.Id).First(n=>n.Id==originId);
                result=Engine.AddNode(item.Id,kind,(float)x,(float)y);
                var created=Engine.Nodes(item.Id).First(n=>n.Id==result);
                if(originId!=0)
                {
                    if(kind is >=3 and <=5){created.Type=originPort<0?origin.Type:NodeSchema.InputType(origin,originPort);Engine.SetNode(item.Id,created);}
                    if(originPort<0)
                    {
                        int input=Enumerable.Range(0,NodeSchema.InputCount(kind)).First(p=>NodeSchema.Compatible(origin.Type,NodeSchema.InputType(created,p)));
                        Engine.ConnectNode(item.Id,originId,result,input);
                    }
                    else Engine.ConnectNode(item.Id,result,originId,originPort);
                }
                EndGesture();Changed();RefreshGraph();SelectNode(result);NotifyProperties();
            }
            catch{result=0;CancelGesture();throw;}
        });return result;
    }
    public void AppendImageEffect(int kind)
    {
        if(!CanEdit||Selected is not {} item||kind is not (7 or 8 or 9 or 10))return;
        Execute(()=>
        {
            BeginGesture();try
            {
                var info=Engine.GraphInfo(item.Id);if(info.Output==0)
                {
                    var nodes=Engine.Nodes(item.Id);if(nodes.Count==0)Engine.InitializeGraph(item.Id,false);
                    else{ulong outputId=Engine.AddNode(item.Id,11,nodes.Max(n=>n.X)+260,80);Engine.ConnectNode(item.Id,nodes.FirstOrDefault(n=>n.Kind==0).Id,outputId,0);}
                    info=Engine.GraphInfo(item.Id);
                }
                var output=Engine.Nodes(item.Id).First(n=>n.Id==info.Output);
                ulong effect=Engine.AddNode(item.Id,kind,output.X,output.Y);
                Engine.ConnectNode(item.Id,output.Input0,effect,0);
                if(kind==7){ulong mask=Engine.AddNode(item.Id,6,output.X-260,output.Y+200);Engine.ConnectNode(item.Id,mask,effect,1);}
                output.X+=260;Engine.SetNode(item.Id,output);Engine.ConnectNode(item.Id,effect,output.Id,0);
                EndGesture();Changed();RefreshGraph();SelectNode(effect);NotifyProperties();
            }
            catch{CancelGesture();throw;}
        });
    }
    public void LinkGraphNode(ulong source,ulong target,int port)
    {
        if(!CanEdit||Selected?.Id!=GraphOwner)return;Execute(()=>{Engine.ConnectNode(GraphOwner,source,target,port);Changed();RefreshGraph();NotifyProperties();});
    }
    public void DeleteGraphNode()
    {
        if(!CanEditNode)return;Execute(()=>{Engine.RemoveNode(GraphOwner,selectedNode);Changed();RefreshGraph();NotifyProperties();});
    }
    public void DuplicateGraphNode()
    {
        if(!CanEditNode||SelectedNode is not {} original)return;
        Execute(()=>
        {
            BeginGesture();try
            {
                var copy=original;copy.Id=Engine.AddNode(GraphOwner,copy.Kind,copy.X+32,copy.Y+32);copy.X+=32;copy.Y+=32;Engine.SetNode(GraphOwner,copy);
                EndGesture();Changed();RefreshGraph();SelectNode(copy.Id);NotifyProperties();
            }
            catch{CancelGesture();throw;}
        });
    }
    private void GraphValue(int index,double value)
    {
        if(!CanEditNode||SelectedNode is not {} n)return;Execute(()=>{n.SetValue(index,(float)value);EditGraphNode(GraphOwner,n);});
    }
    public double NodeValue0{get=>SelectedNode?.V0??0;set=>GraphValue(0,value);}
    public double NodeValue1{get=>SelectedNode?.V1??0;set=>GraphValue(1,value);}
    public double NodeValue2{get=>SelectedNode?.V2??0;set=>GraphValue(2,value);}
    public double NodeValue3{get=>SelectedNode?.V3??0;set=>GraphValue(3,value);}
    public double NodeValue4{get=>SelectedNode?.V4??0;set=>GraphValue(4,value);}
    public double NodeValue5{get=>SelectedNode?.V5??0;set=>GraphValue(5,value);}
    public double NodeValue6{get=>SelectedNode?.V6??0;set=>GraphValue(6,value);}
    public double NodeValue7{get=>SelectedNode?.V7??0;set=>GraphValue(7,value);}
    public int NodeType{get=>SelectedNode?.Type??2;set{if(!CanEditNode||SelectedNode is not {} n||n.Kind is <3 or >5||value==n.Type)return;Execute(()=>{n.Type=value;EditGraphNode(GraphOwner,n);});}}
    private static float Linear(byte c){float v=c/255f;return v<=.04045f?v/12.92f:MathF.Pow((v+.055f)/1.055f,2.4f);}
    private static byte Encoded(float c){c=Math.Clamp(c,0,1);float v=c<=.0031308f?c*12.92f:1.055f*MathF.Pow(c,1/2.4f)-.055f;return (byte)Math.Round(v*255);}
    public string NodeColor
    {
        get=>SelectedNode is {} n?Color.FromArgb((byte)Math.Round(Math.Clamp(n.V3,0,1)*255),Encoded(n.V0),Encoded(n.V1),Encoded(n.V2)).ToString():"#FFFFFFFF";
        set{if(!CanEditNode||SelectedNode is not {Kind:2} n)return;Execute(()=>{var c=(Color)ColorConverter.ConvertFromString(value);n.V0=Linear(c.R);n.V1=Linear(c.G);n.V2=Linear(c.B);n.V3=c.A/255f;EditGraphNode(GraphOwner,n);});}
    }
}
