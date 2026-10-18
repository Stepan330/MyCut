#include "mycut/Project.h"
#include <algorithm>
#include <cmath>
#include <functional>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
#include <utility>

namespace mycut {
const Node& NodeGraph::node(std::uint64_t id)const{for(const auto& n:nodes)if(n.id==id)return n;throw std::runtime_error("Missing node "+std::to_string(id));}
Node& NodeGraph::node(std::uint64_t id){return const_cast<Node&>(std::as_const(*this).node(id));}
const char* nodeName(NodeKind kind){static constexpr const char* names[]={"Image source","Scalar","Color","Add","Multiply","Mix","Ellipse mask","Apply mask","Grayscale","Invert","Exposure","Output"};int k=static_cast<int>(kind);if(k<0||k>11)throw std::runtime_error("Unknown node kind");return names[k];}
int inputCount(NodeKind kind){switch(kind){case NodeKind::Add:case NodeKind::Multiply:case NodeKind::ApplyMask:case NodeKind::Exposure:return 2;case NodeKind::Mix:return 3;case NodeKind::Grayscale:case NodeKind::Invert:case NodeKind::Output:return 1;default:(void)nodeName(kind);return 0;}}
ValueType outputType(const Node& n){switch(n.kind){case NodeKind::Scalar:return ValueType::Scalar;case NodeKind::Color:return ValueType::Color;case NodeKind::EllipseMask:return ValueType::Mask;case NodeKind::Add:case NodeKind::Multiply:case NodeKind::Mix:return n.type;default:return ValueType::Image;}}
ValueType inputType(const Node& n,int port){if(port<0||port>=inputCount(n.kind))throw std::runtime_error("Invalid input pin");if((n.kind==NodeKind::Mix&&port==2)||(n.kind==NodeKind::ApplyMask&&port==1))return ValueType::Mask;if(n.kind==NodeKind::Exposure&&port==1)return ValueType::Scalar;return outputType(n);}
bool compatible(ValueType from,ValueType to){return from==to||to==ValueType::Image||(from==ValueType::Scalar&&(to==ValueType::Color||to==ValueType::Mask));}
Node defaultNode(NodeKind kind,float x,float y){Node n;n.kind=kind;n.type=outputType(n);n.x=x;n.y=y;
    if(kind==NodeKind::Scalar)n.values[0]=1;
    if(kind==NodeKind::Color)n.values={1,.5f,.2f,1,0,0,0,0};
    if(kind==NodeKind::Multiply){n.values[0]=1;n.values[1]=1;}
    if(kind==NodeKind::Mix){n.values[0]=.5f;n.values[2]=1;}
    if(kind==NodeKind::ApplyMask)n.values[0]=1;
    if(kind==NodeKind::Exposure)LegacyParameterAdapter::write(n,ExposureStopsId,exposureStopsDescriptor().defaultValue);
    if(kind==NodeKind::EllipseMask)n.values={.5f,.5f,.35f,.35f,.05f,0,0,0};return n;
}
namespace {
std::vector<std::uint64_t> ordered(const NodeGraph& graph,bool all){
    std::vector<std::uint64_t> order,path;std::unordered_map<std::uint64_t,int> state;
    std::function<void(std::uint64_t)> visit=[&](std::uint64_t id){if(!id)return;if(state[id]==2)return;if(state[id]==1){std::ostringstream message;message<<"Node cycle: ";for(auto p:path)message<<p<<" -> ";message<<id;throw std::runtime_error(message.str());}
        const auto& n=graph.node(id);state[id]=1;path.push_back(id);for(int port=0;port<inputCount(n.kind);++port)visit(n.inputs[port]);path.pop_back();state[id]=2;order.push_back(id);};
    if(all)for(const auto& n:graph.nodes)visit(n.id);else visit(graph.output);return order;
}
void editable(const Project& p,std::uint64_t instance){if(p.instance(instance).locked)throw std::runtime_error("Layer is locked");for(const auto& c:p.timeline.clips)if(c.instance==instance)for(const auto& t:p.timeline.tracks)if(t.id==c.track&&t.locked)throw std::runtime_error("Track is locked");}
Signal repeated(float value){return {value,value,value,value};}
}
void NodeGraph::validate()const{
    if(nodes.size()>128)throw std::runtime_error("Graph exceeds 128 nodes");std::unordered_set<std::uint64_t> ids;
    for(const auto& n:nodes){(void)nodeName(n.kind);if(!n.id||!ids.insert(n.id).second||static_cast<int>(n.type)<0||static_cast<int>(n.type)>3||n.type!=outputType(n))throw std::runtime_error("Invalid node ID or declared type");
        if(!std::isfinite(n.x)||!std::isfinite(n.y)||std::abs(n.x)>100000||std::abs(n.y)>100000)throw std::runtime_error("Invalid node position");
        for(float value:n.values)if(!std::isfinite(value)||std::abs(value)>100000)throw std::runtime_error("Invalid node parameter");
        if(n.kind==NodeKind::EllipseMask&&(n.values[2]<.001f||n.values[3]<.001f||n.values[2]>10||n.values[3]>10||n.values[4]<0||n.values[4]>1))throw std::runtime_error("Invalid ellipse mask radius or feather");
        for(int port=0;port<3;++port){if(port>=inputCount(n.kind)){if(n.inputs[port])throw std::runtime_error("Link to nonexistent input pin");continue;}if(n.inputs[port]&&!compatible(outputType(node(n.inputs[port])),inputType(n,port)))throw std::runtime_error("Incompatible node pin types");}
    }
    if(output&&node(output).kind!=NodeKind::Output)throw std::runtime_error("Graph output must be an Output node");(void)ordered(*this,true);
}
std::vector<std::uint64_t> executionOrder(const NodeGraph& graph){return graph.enabled?ordered(graph,false):std::vector<std::uint64_t>{};}
void copyGraph(Project& p,NodeGraph& graph){std::unordered_map<std::uint64_t,std::uint64_t> mapping;for(auto& n:graph.nodes){auto old=n.id;n.id=p.nextId++;mapping[old]=n.id;}for(auto& n:graph.nodes)for(auto& input:n.inputs)if(input)input=mapping.at(input);if(graph.output)graph.output=mapping.at(graph.output);}
std::uint64_t addNode(Project& p,std::uint64_t owner,NodeKind kind,float x,float y){editable(p,owner);auto n=defaultNode(kind,x,y);n.id=p.nextId++;auto& graph=p.instance(owner).graph;graph.nodes.push_back(n);if(kind==NodeKind::Output)graph.output=n.id;return n.id;}
void removeNode(Project& p,std::uint64_t owner,std::uint64_t id){editable(p,owner);auto& g=p.instance(owner).graph;(void)g.node(id);std::erase_if(g.nodes,[&](const auto& n){return n.id==id;});for(auto& n:g.nodes)for(auto& input:n.inputs)if(input==id)input=0;if(g.output==id)g.output=0;}
void connectNodes(Project& p,std::uint64_t owner,std::uint64_t source,std::uint64_t target,int port){editable(p,owner);auto& g=p.instance(owner).graph;auto& n=g.node(target);if(port<0||port>=inputCount(n.kind))throw std::runtime_error("Invalid input pin");if(source)(void)g.node(source);n.inputs[port]=source;g.validate();}
void initializeGraph(Project& p,std::uint64_t owner,bool example){editable(p,owner);p.instance(owner).graph={};auto source=addNode(p,owner,NodeKind::Source,40,80),output=addNode(p,owner,NodeKind::Output,620,80);
    if(!example){connectNodes(p,owner,source,output,0);return;}auto color=addNode(p,owner,NodeKind::Color,40,230),multiply=addNode(p,owner,NodeKind::Multiply,330,80),mask=addNode(p,owner,NodeKind::EllipseMask,330,300),apply=addNode(p,owner,NodeKind::ApplyMask,620,230);
    p.instance(owner).graph.node(output).x=900;connectNodes(p,owner,source,multiply,0);connectNodes(p,owner,color,multiply,1);connectNodes(p,owner,multiply,apply,0);connectNodes(p,owner,mask,apply,1);connectNodes(p,owner,apply,output,0);
}
Signal evaluateSignal(const NodeGraph& graph,Signal source,float u,float v,const NodeParameterContext& context){
    std::unordered_map<std::uint64_t,Signal> signals;auto order=executionOrder(graph);if(order.empty())return source;
    for(auto id:order){const auto& n=graph.node(id);auto in=[&](int port,Signal fallback){return n.inputs[port]?signals.at(n.inputs[port]):fallback;};Signal value=source;
        Signal a=in(0,n.type==ValueType::Image?source:repeated(n.values[0])),b=in(1,repeated(n.values[1]));
        switch(n.kind){
            case NodeKind::Source:break;case NodeKind::Scalar:value=repeated(n.values[0]);break;case NodeKind::Color:std::copy_n(n.values.begin(),4,value.begin());break;
            case NodeKind::Add:case NodeKind::Multiply:for(int c=0;c<4;++c)value[c]=n.kind==NodeKind::Add?a[c]+b[c]:a[c]*b[c];break;
            case NodeKind::Mix:{a=in(0,n.type==ValueType::Image?source:repeated(n.values[1]));b=in(1,n.type==ValueType::Image?source:repeated(n.values[2]));float f=std::clamp(in(2,repeated(n.values[0]))[0],0.f,1.f);for(int c=0;c<4;++c)value[c]=std::lerp(a[c],b[c],f);break;}
            case NodeKind::EllipseMask:{float x=(u-n.values[0])/n.values[2],y=(v-n.values[1])/n.values[3],feather=std::max(.00001f,n.values[4]);float t=std::clamp((std::hypot(x,y)-1+feather)/(2*feather),0.f,1.f),mask=1-t*t*(3-2*t);if(n.values[5]>.5f)mask=1-mask;value=repeated(mask);break;}
            case NodeKind::ApplyMask:value=a;value[3]*=std::clamp(in(1,repeated(n.values[0]))[0],0.f,1.f);break;
            case NodeKind::Grayscale:value=a;value[0]=value[1]=value[2]=a[0]*.2126f+a[1]*.7152f+a[2]*.0722f;break;
            case NodeKind::Invert:value=a;for(int c=0;c<3;++c)value[c]=1-a[c];break;
            case NodeKind::Exposure:{const auto parameters=nodeParameterValues(n,context);value=a;for(int c=0;c<3;++c)value[c]*=std::exp2(std::clamp(in(1,repeated(parameters[0]))[0],-20.f,20.f));break;}
            case NodeKind::Output:value=a;if(n.inputs[0]&&(outputType(graph.node(n.inputs[0]))==ValueType::Scalar||outputType(graph.node(n.inputs[0]))==ValueType::Mask))value[3]=1;break;
        }
        if(n.type==ValueType::Scalar||n.type==ValueType::Mask)value=repeated(value[0]);for(float& channel:value)channel=std::clamp(channel,-65504.f,65504.f);signals[id]=value;
    }
    return signals.at(graph.output);
}
std::string graphShaderBody(const NodeGraph& graph){
    auto order=executionOrder(graph);if(order.empty())return {};std::unordered_map<std::uint64_t,int> index;for(int i=0;i<static_cast<int>(order.size());++i)index[order[i]]=i;
    std::ostringstream code;code<<"float4 src=image.Sample(linearSampler,v.uv);\n";
    for(int i=0;i<static_cast<int>(order.size());++i){const auto& n=graph.node(order[i]);std::string p="np["+std::to_string(i*2)+"]",q="np["+std::to_string(i*2+1)+"]",name="n"+std::to_string(i);
        auto input=[&](int port,const std::string& fallback){return n.inputs[port]?"n"+std::to_string(index.at(n.inputs[port])):fallback;};auto scalar=[](const std::string& value){return "("+value+").xxxx";};
        auto a=input(0,n.type==ValueType::Image?"src":scalar(p+".x")),b=input(1,scalar(p+".y"));std::string expression="src";
        switch(n.kind){
            case NodeKind::Source:break;case NodeKind::Scalar:expression=scalar(p+".x");break;case NodeKind::Color:expression=p;break;
            case NodeKind::Add:expression=a+"+"+b;break;case NodeKind::Multiply:expression=a+"*"+b;break;
            case NodeKind::Mix:expression="lerp("+input(0,n.type==ValueType::Image?"src":scalar(p+".y"))+","+input(1,n.type==ValueType::Image?"src":scalar(p+".z"))+",saturate("+input(2,scalar(p+".x"))+".r))";break;
            case NodeKind::EllipseMask:code<<"float m"<<i<<"=1-smoothstep(1-max("<<q<<".x,.00001),1+max("<<q<<".x,.00001),length((v.uv-"<<p<<".xy)/"<<p<<".zw));if("<<q<<".y>.5)m"<<i<<"=1-m"<<i<<";\n";expression="m"+std::to_string(i)+".xxxx";break;
            case NodeKind::ApplyMask:expression="float4("+a+".rgb,"+a+".a*saturate("+input(1,scalar(p+".x"))+".r))";break;
            case NodeKind::Grayscale:expression="float4(dot("+a+".rgb,float3(.2126,.7152,.0722)).xxx,"+a+".a)";break;
            case NodeKind::Invert:expression="float4(1-"+a+".rgb,"+a+".a)";break;
            case NodeKind::Exposure:expression="float4("+a+".rgb*exp2(clamp("+input(1,scalar(p+".x"))+".r,-20,20)),"+a+".a)";break;
            case NodeKind::Output:expression=a;if(n.inputs[0]&&(outputType(graph.node(n.inputs[0]))==ValueType::Scalar||outputType(graph.node(n.inputs[0]))==ValueType::Mask))expression="float4("+a+".rgb,1)";break;
        }
        code<<"float4 "<<name<<"=clamp("<<expression<<",-65504,65504);\n";if(n.type==ValueType::Scalar||n.type==ValueType::Mask)code<<name<<"="<<name<<".rrrr;\n";
    }
    code<<"float4 c=n"<<index.at(graph.output)<<"*tint;c.a=saturate(c.a);\n";return code.str();
}
}
