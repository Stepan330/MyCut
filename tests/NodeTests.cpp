#include "mycut/Session.h"
#include <cmath>
#include <iostream>
#include <sstream>
#include <stdexcept>
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
template<class F> void rejects(F f){bool failed=false;try{f();}catch(const std::exception&){failed=true;}check(failed,"Invalid graph edit accepted");}
int main(){try{
    mycut::Session s;mycut::Id source=0,scalar=0,multiply=0,output=0;
    s.edit([&](auto& p){mycut::initializeGraph(p,2);source=p.instance(2).graph.nodes[0].id;output=p.instance(2).graph.output;scalar=mycut::addNode(p,2,mycut::NodeKind::Scalar,0,150);multiply=mycut::addNode(p,2,mycut::NodeKind::Multiply,250,80);p.instance(2).graph.node(scalar).values[0]=.5f;mycut::connectNodes(p,2,source,multiply,0);mycut::connectNodes(p,2,scalar,multiply,1);mycut::connectNodes(p,2,multiply,output,0);});
    auto result=mycut::evaluateSignal(s.project().instance(2).graph,{.8f,.4f,.2f,1},.5f,.5f);check(std::abs(result[0]-.4f)<1e-6&&result[3]==.5f,"RGBA multiply reference failed");
    auto before=s.project();rejects([&]{s.edit([&](auto& p){mycut::connectNodes(p,2,output,multiply,0);});});check(s.project()==before,"Cycle refusal damaged the document");
    rejects([&]{s.edit([&](auto& p){mycut::connectNodes(p,2,source,scalar,0);});});
    auto shader=mycut::graphShaderBody(s.project().instance(2).graph);s.edit([&](auto& p){p.instance(2).graph.node(multiply).x=999;p.instance(2).graph.node(scalar).values[0]=.25f;});
    check(shader==mycut::graphShaderBody(s.project().instance(2).graph),"Layout or numeric values changed graph shader topology");
    auto copied=s.duplicate(2);check(s.project().instance(copied).graph.output!=output,"Copied graph reused global node IDs");check(mycut::evaluateSignal(s.project().instance(copied).graph,{1,1,1,1},.5f,.5f)[0]==.25f,"Copied graph lost remapped links");
    std::stringstream data;mycut::serialize(s.project(),data);check(mycut::deserialize(data)==s.project(),"Graph version 6 roundtrip failed");
    s.edit([&](auto& p){mycut::initializeGraph(p,2,true);});auto& g=s.project().instance(2).graph;check(mycut::evaluateSignal(g,{1,1,1,1},.5f,.5f)[3]>.99f&&mycut::evaluateSignal(g,{1,1,1,1},0,0)[3]<.01f,"Ellipse mask did not restrict alpha");
    s.edit([&](auto& p){auto track=mycut::addTrack(p,"Video");mycut::addClip(p,2,track,0,30);});s.project().validate();
    auto sample=mycut::evaluateSignal(s.project().instances.back().graph,{1,1,1,1},.5f,.5f);check(sample[1]==.5f,"Timeline clip copy lost its node graph");
    std::cout<<"PASS: types, cycle rejection, GPU topology key, RGBA reference, masks, fresh copy IDs, graph persistence, timeline ownership\n";return 0;
}catch(const std::exception& ex){std::cerr<<"FAIL: "<<ex.what()<<'\n';return 1;}}
