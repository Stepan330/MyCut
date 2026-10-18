namespace MyCut.Editor.Services;
public static class NodeSchema
{
    public static readonly string[] Names=["Image source","Scalar","Color","Add","Multiply","Mix","Ellipse mask","Apply mask","Grayscale","Invert","Exposure","Output"];
    public static readonly string[] Types=["Scalar","Color","Image","Mask"];
    public static int InputCount(int kind)=>kind switch{3 or 4 or 7 or 10=>2,5=>3,8 or 9 or 11=>1,_=>0};
    public static int InputType(NativeNode n,int port)=>n.Kind==5&&port==2||n.Kind==7&&port==1?3:n.Kind==10&&port==1?0:n.Type;
    public static bool Compatible(int source,int target)=>source==target||target==2||source==0&&(target==1||target==3);
    public static string InputName(int kind,int port)=>kind switch{3 or 4=>port==0?"A":"B",5=>port switch{0=>"A",1=>"B",_=>"Factor"},7=>port==0?"Image":"Mask",10=>port==0?"Image":"Stops",_=>"Image"};
    public static string[] Parameters(int kind)=>kind switch{1=>["Value"],2=>["Red / linear","Green / linear","Blue / linear","Alpha"],3 or 4=>["A default","B default"],5=>["Factor default","A scalar default","B scalar default"],6=>["Center X / UV","Center Y / UV","Radius X / UV","Radius Y / UV","Feather","Invert mask"],7=>["Mask default"],10=>["Stops default"],_=>[]};
    public static (double Min,double Max,double Step) Bounds(int kind,int index)=>kind switch
    {
        2 when index==3=>(0,1,.01),2=>(0,16,.01),6 when index is 2 or 3=>(.001,10,.005),6 when index is 4 or 5=>(0,1,.01),6=>(-4,4,.01),5 when index==0=>(0,1,.01),7=>(0,1,.01),10=>(-20,20,.05),_=>(-100000,100000,.01)
    };
}
