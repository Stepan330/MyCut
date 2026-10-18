#include "mycut/Nodes.h"
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <new>

namespace {bool countAllocations=false;std::size_t allocations=0;}
void* operator new(std::size_t bytes){if(countAllocations)++allocations;if(void* p=std::malloc(bytes?bytes:1))return p;throw std::bad_alloc();}
void operator delete(void* p)noexcept{std::free(p);}
void operator delete(void* p,std::size_t)noexcept{std::free(p);}
void* operator new[](std::size_t bytes){return ::operator new(bytes);}
void operator delete[](void* p)noexcept{::operator delete(p);}
void operator delete[](void* p,std::size_t)noexcept{::operator delete(p);}

int main(){try{
    using namespace mycut;
    auto node=defaultNode(NodeKind::Exposure);node.id=1;node.values[0]=1.25f;(void)nodeParameterValues(node);
    float checksum=0;constexpr int samples=200000;
    auto start=std::chrono::steady_clock::now();countAllocations=true;
    for(int i=0;i<samples;++i)checksum+=nodeParameterValues(node)[0];
    countAllocations=false;auto end=std::chrono::steady_clock::now();
    std::cout<<"Exposure resolve: "<<std::chrono::duration<double,std::nano>(end-start).count()/samples<<" ns/node; allocations="<<allocations<<'\n';
    if(allocations||checksum!=samples*1.25f)throw std::runtime_error("Exposure preparation allocated or returned inconsistent values");
    // Match the real per-draw topology traversal / packed constant-buffer preparation.
    // This intentionally retains the existing executionOrder algorithm on both paths.
    NodeGraph graph;for(std::uint64_t id=1;id<=128;++id){auto n=defaultNode(id==128?NodeKind::Output:NodeKind::Exposure);n.id=id;n.inputs[0]=id-1;n.values[0]=.01f;graph.nodes.push_back(n);}graph.output=128;graph.validate();
    auto measure=[&](bool universal){float result=0;auto begin=std::chrono::steady_clock::now();
        for(int batch=0;batch<1000;++batch){auto order=executionOrder(graph);for(auto id:order){const auto& n=graph.node(id);const auto values=universal?nodeParameterValues(n):n.values;result+=values[0];}}
        auto elapsed=std::chrono::duration<double,std::micro>(std::chrono::steady_clock::now()-begin).count()/1000;
        if(result<=0)throw std::runtime_error("Benchmark was not evaluated");return elapsed;};
    (void)measure(false);(void)measure(true);
    double legacy=measure(false),universal=measure(true);
    std::cout<<"128-node constant preparation, 1000 draws: legacy="<<legacy<<" us/draw; universal="<<universal<<" us/draw; delta="<<universal-legacy<<" us/draw (diagnostic, not a hardware-specific timing assertion)\n";
    return 0;
}catch(const std::exception& e){countAllocations=false;std::cerr<<"FAIL: "<<e.what()<<'\n';return 1;}}
