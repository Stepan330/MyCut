#include "mycut/Session.h"
#include <cmath>
#include <sstream>
#include <iostream>
#include <stdexcept>
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
template<class F> void rejects(F f){bool failed=false;try{f();}catch(const std::exception&){failed=true;}check(failed,"Invalid timeline edit was accepted");}
int main(){try{
    auto p=mycut::demoProject();auto track=mycut::addTrack(p,"Video / 1");auto id=mycut::addClip(p,2,track,10,90);auto instance=p.timeline.clips[0].instance;p.validate();
    check(mycut::evaluateTimeline(p,9).empty()&&mycut::evaluateTimeline(p,100).empty(),"Clip bounds must be half-open");
    check(mycut::evaluateTimeline(p,10).size()==1&&mycut::evaluateTimeline(p,10)[0].instance==instance,"Timeline must contain only its active instances");
    p.timeline.clips[0].sourceIn=15;p.timeline.clips[0].speed=2;p.timeline.clips[0].fadeIn=10;
    auto plane=mycut::evaluateTimeline(p,25)[0];check(std::abs(plane.sourceSeconds-1.5)<1e-6,"Source time must account for source In and speed");
    check(std::abs(mycut::evaluateTimeline(p,10)[0].transform.opacity-.1)<1e-6,"Clip fade-in opacity failed");
    auto right=mycut::splitClip(p,id,40);p.validate();check(p.timeline.clips[0].duration==30&&p.timeline.clips[1].sourceIn==75,"Split must preserve source position");
    check(mycut::evaluateTimeline(p,40).size()==1&&mycut::evaluateTimeline(p,40)[0].instance==p.timeline.clips[1].instance,"Split duplicated a frame");
    auto second=mycut::addClip(p,3,track,120,30);check(mycut::snapFrame(p.timeline,98,second,500,4)==100,"Snap to another clip end failed");
    mycut::trimClip(p,right,45,55,85);check(p.timeline.clips[1].sourceIn==85,"Trim lost source offset");
    mycut::removeClip(p,id,true);p.validate();check(p.timeline.clips[0].start==15&&p.timeline.clips[1].start==90,"Ripple removal did not move subsequent clips");
    check(p.instance(2).id==2,"Clip deletion removed its bin source");
    p.timeline.rangeIn=5;p.timeline.rangeOut=200;p.timeline.rateNumerator=30000;p.timeline.rateDenominator=1001;
    check(std::abs(mycut::seconds(p.timeline,30000)-1001)<1e-8,"Rational frame rate drift");
    std::stringstream data;mycut::serialize(p,data);check(mycut::deserialize(data)==p,"Version 5 timeline roundtrip failed");
    mycut::Session s;s.replace(p);auto before=s.project();rejects([&]{s.edit([](auto& project){project.timeline.clips[0].sourceIn=-1;});});check(s.project()==before,"Invalid clip edit damaged document");
    s.beginEdit();for(int n=0;n<20;++n)s.edit([&](auto& project){project.timeline.clips[0].start=20+n;});s.endEdit();s.undo();check(s.project()==before,"Clip drag must have one undo entry");
    s.edit([](auto& project){project.timeline.tracks[0].locked=true;});auto locked=s.project();
    rejects([&]{s.edit([&](auto& project){mycut::splitClip(project,right,50);});});
    rejects([&]{s.edit([&](auto& project){mycut::removeClip(project,right,false);});});check(s.project()==locked,"Locked clip changed");
    auto video=mycut::demoProject();video.definition(1).kind=mycut::DefinitionKind::Video;video.definition(1).source="fixture.mp4";video.definition(1).mediaDuration=.2666666;
    auto videoTrack=mycut::addTrack(video,"Video");mycut::addClip(video,2,videoTrack,0,8);video.validate();mycut::Session v;v.replace(video);
    rejects([&]{v.edit([](auto& project){project.timeline.clips[0].duration=9;});});
    rejects([&]{v.edit([](auto& project){project.timeline.clips[0].sourceIn=8;project.timeline.clips[0].duration=1;});});
    check(v.project()==video,"Source duration guard changed a valid 8-frame video");
    std::cout<<"PASS: timeline intervals, rational frame rate, source mapping, fades, split, trim, ripple, snap, version 5, transactions, locks\n";return 0;
}catch(const std::exception& ex){std::cerr<<"FAIL: "<<ex.what()<<'\n';return 1;}}
