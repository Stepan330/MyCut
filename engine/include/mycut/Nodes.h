#pragma once
#include <array>
#include <cstdint>
#include <string>
#include <vector>
#include "LegacyParameterAdapter.h"

namespace mycut {
enum class ValueType {Scalar=0,Color=1,Image=2,Mask=3};
enum class NodeKind {Source=0,Scalar=1,Color=2,Add=3,Multiply=4,Mix=5,EllipseMask=6,ApplyMask=7,Grayscale=8,Invert=9,Exposure=10,Output=11};
struct Node {
    std::uint64_t id=0;NodeKind kind=NodeKind::Source;ValueType type=ValueType::Image;
    float x=0,y=0;std::array<float,8> values{};std::array<std::uint64_t,3> inputs{};
    bool operator==(const Node&)const=default;
};
struct NodeGraph {
    bool enabled=true;std::uint64_t output=0;std::vector<Node> nodes;
    const Node& node(std::uint64_t)const;
    Node& node(std::uint64_t);
    void validate()const;
    bool operator==(const NodeGraph&)const=default;
};
const char* nodeName(NodeKind);
int inputCount(NodeKind);
ValueType outputType(const Node&);
ValueType inputType(const Node&,int port);
bool compatible(ValueType source,ValueType target);
Node defaultNode(NodeKind,float x=0,float y=0);
std::vector<std::uint64_t> executionOrder(const NodeGraph&);
std::string graphShaderBody(const NodeGraph&);
using Signal=std::array<float,4>;
Signal evaluateSignal(const NodeGraph&,Signal source,float u,float v,const NodeParameterContext& context={});
struct Project;
void copyGraph(Project&,NodeGraph&);
std::uint64_t addNode(Project&,std::uint64_t instance,NodeKind,float x,float y);
void removeNode(Project&,std::uint64_t instance,std::uint64_t node);
void connectNodes(Project&,std::uint64_t instance,std::uint64_t source,std::uint64_t target,int port);
void initializeGraph(Project&,std::uint64_t instance,bool example=false);
}
