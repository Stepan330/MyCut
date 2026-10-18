#include "mycut/Parameters.h"
#include "mycut/Nodes.h"
#include "mycut/Session.h"
#include <cmath>
#include <iostream>
#include <limits>
#include <sstream>
#include <type_traits>

using namespace mycut;
namespace {
void check(bool value,const char* why){if(!value)throw std::runtime_error(why);}
template<class F>void rejects(F&& f,ParameterError expected){try{f();}catch(const ParameterException& e){check(e.code()==expected,"Wrong parameter error category");return;}throw std::runtime_error("Invalid parameter accepted");}
class Source final:public IParameterValueSource {
public:
    std::optional<ParameterContribution> contribution;
    std::optional<ParameterAddress> onlyAddress;
    bool useTime=false;
    mutable int samples=0;
    std::optional<ParameterContribution> sample(const ParameterAddressView& address,const ParameterContext& context)const override {
        ++samples;if(onlyAddress&&static_cast<ParameterAddressView>(*onlyAddress)!=address)return std::nullopt;
        if(useTime)return ParameterContribution{ParameterValue(static_cast<double>(context.time.numerator)/context.time.denominator),ParameterApplyMode::Add};
        return contribution;
    }
};
void valuesAndResolution(){
    static_assert(!std::is_convertible_v<std::uint64_t,ParameterId>);
    static_assert(!std::is_constructible_v<ParameterValue,const char*>);
    const auto& d=exposureStopsDescriptor();const ParameterAddress address{{},{ParameterOwnerKind::Node,17},ExposureStopsId};
    check(d.id==ParameterId{0x4d43555400010001ULL}&&d.semanticName=="mycut.exposure.stops","Published parameter identity changed");
    check(d.animatable&&d.exposable&&d.presentation.unit=="EV","Exposure capability metadata missing");
    const ParameterResolver resolver;
    check(resolver.resolve(d,address).get<double>()==0,"Descriptor default was not used");
    Source data,overrides,animation;data.contribution=ParameterContribution{ParameterValue(2.0)};
    overrides.contribution=ParameterContribution{ParameterValue(3.0)};animation.contribution=ParameterContribution{ParameterValue(4.0)};
    check(resolver.resolve(d,address,{}, {&data,&overrides,&animation}).get<double>()==4,"Source precedence changed");
    animation.contribution.reset();check(resolver.resolve(d,address,{}, {&data,&overrides,&animation}).get<double>()==3,"Missing animation did not fall back to override");
    animation.contribution=ParameterContribution{ParameterValue(.1),ParameterApplyMode::Add};
    check(std::abs(resolver.resolve(d,address,{}, {&data,&overrides,&animation}).get<double>()-3.1)<1e-12,"Relative animation replaced override");
    animation.contribution=ParameterContribution{ParameterValue(2.0),ParameterApplyMode::Multiply};
    check(resolver.resolve(d,address,{}, {&data,&overrides,&animation}).get<double>()==6,"Multiply contribution failed");
    animation.useTime=true;check(resolver.resolve(d,address,{{1,2}}, {&data,&overrides,&animation}).get<double>()==3.5,"Rational evaluation time did not reach the source");animation.useTime=false;
    auto renamed=d;renamed.label="Localized / renamed";check(resolver.resolve(renamed,address).get<double>()==0,"Labels altered parameter identity");
    data.contribution=ParameterContribution{ParameterValue(25.0)};check(resolver.resolve(d,address,{}, {&data}).get<double>()==25,"UI hint clamped model data");
    data.contribution=ParameterContribution{ParameterValue(std::string("25"))};rejects([&]{resolver.resolve(d,address,{}, {&data});},ParameterError::TypeMismatch);
    data.contribution=ParameterContribution{ParameterValue(std::numeric_limits<double>::quiet_NaN())};rejects([&]{resolver.resolve(d,address,{}, {&data});},ParameterError::NonFinite);
    data.contribution=ParameterContribution{ParameterValue(std::numeric_limits<double>::infinity())};rejects([&]{resolver.resolve(d,address,{}, {&data});},ParameterError::NonFinite);
    data.contribution=ParameterContribution{ParameterValue(100001.0)};rejects([&]{resolver.resolve(d,address,{}, {&data});},ParameterError::ModelRange);
    auto wrongAddress=address;wrongAddress.parameter=ParameterId{999};rejects([&]{resolver.resolve(d,wrongAddress);},ParameterError::InvalidAddress);
    rejects([&]{resolver.resolve(d,address,{{0,0}});},ParameterError::InvalidContext);
    auto bad=d;bad.modelLimits={1.0,-1.0};rejects([&]{resolver.resolve(bad,address);},ParameterError::InvalidDescriptor);
    bad=d;bad.animatable=false;rejects([&]{resolver.resolve(bad,address,{}, {nullptr,nullptr,&animation});},ParameterError::NotAnimatable);
    ParameterDescriptor text{ParameterId{18},"test.text","Text",ParameterType::Text,ParameterValue(std::string("Title")),{},{{},1,""},true,true};
    const ParameterAddress textAddress{{},{ParameterOwnerKind::Data,19},text.id};
    check(resolver.resolve(text,textAddress).get<std::string>()=="Title","Typed text default failed");
    data.contribution=ParameterContribution{ParameterValue(std::string("Instance"))};check(resolver.resolve(text,textAddress,{}, {&data}).get<std::string>()=="Instance","Typed text replacement failed");
    data.contribution->mode=ParameterApplyMode::Add;rejects([&]{resolver.resolve(text,textAddress,{}, {&data});},ParameterError::UnsupportedOperation);
    ParameterValue typed[]={ParameterValue(std::int64_t{42}),ParameterValue(true),ParameterValue(ParameterColor{2,.2,.3,1}),ParameterValue(ParameterVector2{1,2}),ParameterValue(ParameterVector3{1,2,3})};
    for(const auto& v:typed){auto descriptor=d;descriptor.type=v.type();descriptor.defaultValue=v;descriptor.modelLimits={};check(validateParameterValue(descriptor,v).error==ParameterError::None,"Valid typed value rejected");}
    auto integer=d;integer.type=ParameterType::Integer;integer.modelLimits={-0x1p63,std::nextafter(0x1p63,0.0)};
    check(validateParameterValue(integer,ParameterValue(std::numeric_limits<std::int64_t>::max()-1)).error==ParameterError::ModelRange,"Integer range comparison lost 64-bit precision");
    check(static_cast<bool>(validateParameterValue(integer,ParameterValue(std::numeric_limits<std::int64_t>::min()))),"Valid minimum integer rejected");
    integer.modelLimits={1.5,2.5};check(static_cast<bool>(validateParameterValue(integer,ParameterValue(std::int64_t{2})))&&validateParameterValue(integer,ParameterValue(std::int64_t{1})).error==ParameterError::ModelRange,"Fractional integer limits failed");
    auto color=d;color.type=ParameterType::Color;color.modelLimits={};check(validateParameterValue(color,ParameterValue(ParameterColor{0,0,std::numeric_limits<double>::infinity(),1})).error==ParameterError::NonFinite,"Nonfinite color accepted");
    auto overflow=d;overflow.modelLimits={};data.contribution=ParameterContribution{ParameterValue(std::numeric_limits<double>::max())};animation.contribution=ParameterContribution{ParameterValue(2.0),ParameterApplyMode::Multiply};
    rejects([&]{resolver.resolve(overflow,address,{}, {&data,nullptr,&animation});},ParameterError::NonFinite);
}
void nestedAddresses(){
    ParameterAddress a{{{1,10},{20,30},{40,50}},{ParameterOwnerKind::Node,60},ExposureStopsId};
    auto b=a;b.instancePath[0].item=11;auto c=a;c.instancePath[1].item=31;
    Source source;source.onlyAddress=a;source.contribution=ParameterContribution{ParameterValue(7.0)};
    const auto& d=exposureStopsDescriptor();const ParameterResolver resolver;
    check(a!=b&&a!=c&&resolver.resolve(d,a,{}, {nullptr,&source}).get<double>()==7,"Nested occurrence address did not match");
    check(resolver.resolve(d,b,{}, {nullptr,&source}).get<double>()==0&&resolver.resolve(d,c,{}, {nullptr,&source}).get<double>()==0,"Nested overrides leaked into another prefab occurrence");
    auto invalid=a;invalid.instancePath[1].item=0;rejects([&]{resolver.resolve(d,invalid);},ParameterError::InvalidAddress);
}
void legacyExposure(){
    Session session;std::uint64_t exposure=0,scalar=0;
    session.edit([&](auto& p){initializeGraph(p,2);auto& g=p.instance(2).graph;exposure=addNode(p,2,NodeKind::Exposure,200,0);connectNodes(p,2,g.nodes[0].id,exposure,0);connectNodes(p,2,exposure,g.output,0);g.node(exposure).values[0]=25;});
    auto& graph=session.project().instance(2).graph;
    check(nodeParameterValues(graph.node(exposure))[0]==25,"Adapter altered legacy Exposure storage");
    auto shader=graphShaderBody(graph);Signal input{.0000001f,.0000002f,.0000003f,.75f};
    auto legacy=evaluateSignal(graph,input,.5f,.5f);
    check(std::abs(legacy[0]-input[0]*std::exp2(20.f))<1e-7&&legacy[3]==input[3],"Legacy exposure render formula changed");
    std::stringstream text;serialize(session.project(),text);const auto serialized=text.str();check(serialized.starts_with("MYCUT 6\n"),"Parameter migration changed project version");
    auto reopened=deserialize(text);std::stringstream saved;serialize(reopened,saved);
    check(serialized==saved.str()&&reopened.instance(2).graph.node(exposure).values[0]==25,"Open/save modified legacy Exposure or project bytes");
    check(evaluateSignal(reopened.instance(2).graph,input,.5f,.5f)==legacy,"Legacy reopen changed output");
    for(float stops:{-100000.f,-25.f,-20.f,-1.f,0.f,1.f,20.f,25.f,100000.f}){
        auto probe=graph;probe.node(exposure).values[0]=stops;auto actual=evaluateSignal(probe,input,.5f,.5f);
        check(actual[0]==input[0]*std::exp2(std::clamp(stops,-20.f,20.f))&&nodeParameterValues(probe.node(exposure))[0]==stops,"Legacy boundary value changed storage or pixels");
    }
    Source overrides,animation;overrides.contribution=ParameterContribution{ParameterValue(2.0)};animation.contribution=ParameterContribution{ParameterValue(.5),ParameterApplyMode::Add};
    const InstancePathElement path[]={{100,101},{102,103}};
    const NodeParameterContext context{path,{{1,30}},&overrides,&animation};
    auto overridden=evaluateSignal(graph,input,.5f,.5f,context);check(std::abs(overridden[0]-input[0]*std::exp2(2.5f))<1e-10,"Exposure did not use universal resolution");
    check(nodeParameterValues(graph.node(exposure),context)[0]==2.5f,"GPU payload disagrees with CPU resolver");
    check(graph.node(exposure).values[0]==25&&graphShaderBody(graph)==shader,"Resolution changed document or shader topology");
    session.edit([&](auto& p){scalar=addNode(p,2,NodeKind::Scalar,0,0);p.instance(2).graph.node(scalar).values[0]=-2;connectNodes(p,2,scalar,exposure,1);});
    const auto& connected=session.project().instance(2).graph;overrides.samples=animation.samples=0;
    auto connectedValue=evaluateSignal(connected,input,.5f,.5f,context);
    check(connectedValue[0]==input[0]*.25f&&overrides.samples==0&&animation.samples==0,"Connected Stops did not bypass fallback/override/animation");
    check(nodeParameterValues(connected.node(exposure),context)[0]==25,"Connected graph mutated unused legacy fallback");
    auto n=connected.node(exposure);LegacyParameterAdapter::write(n,ExposureStopsId,ParameterValue(-25.0));check(n.values[0]==-25,"Typed write clamped UI range");
    rejects([&]{LegacyParameterAdapter::write(n,ExposureStopsId,ParameterValue(true));},ParameterError::TypeMismatch);
    check(n.values[0]==-25,"Rejected typed write mutated data");
    for(int kind=0;kind<=11;++kind)if(kind!=10){auto old=defaultNode(static_cast<NodeKind>(kind));old.id=100;check(nodeParameterValues(old)==old.values,"Compatibility changed an unmigrated node");}
    const auto before=session.project();session.beginEdit();session.edit([&](auto& p){LegacyParameterAdapter::write(p.instance(2).graph.node(exposure),ExposureStopsId,ParameterValue(3.0));});session.endEdit();check(session.undo()&&session.project()==before,"Typed parameter edit lost grouped Undo");
}
}
int main(){try{valuesAndResolution();nestedAddresses();legacyExposure();std::cout<<"PASS: typed parameters, stable IDs, defaults, source modes/time, nested addresses, diagnostic categories, legacy bytes/pixels, connected Stops priority, common CPU/GPU payload, unchanged shader key and Undo\n";return 0;}catch(const std::exception& e){std::cerr<<"FAIL: "<<e.what()<<'\n';return 1;}}
