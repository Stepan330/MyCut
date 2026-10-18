#include "mycut/Project.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace mycut {
namespace {
Clip& clip(Project& p,std::uint64_t id){for(auto& c:p.timeline.clips)if(c.id==id)return c;throw std::runtime_error("Missing timeline clip");}
void editable(const Project& p,std::uint64_t track){for(const auto& t:p.timeline.tracks)if(t.id==track){if(t.locked)throw std::runtime_error("Track is locked");return;}throw std::runtime_error("Missing timeline track");}
}
double seconds(const Timeline& t,Frame frame){return static_cast<double>(frame)*t.rateDenominator/t.rateNumerator;}
Frame timelineEnd(const Timeline& t){Frame end=0;for(const auto& c:t.clips)end=std::max(end,c.start+c.duration);return end;}
float clipOpacity(const Clip& c,Frame frame){
    if(frame<c.start||frame>=c.start+c.duration||c.muted)return 0;
    float alpha=1;if(c.fadeIn>0)alpha=std::min(alpha,static_cast<float>(frame-c.start+1)/static_cast<float>(c.fadeIn));
    if(c.fadeOut>0)alpha=std::min(alpha,static_cast<float>(c.start+c.duration-frame)/static_cast<float>(c.fadeOut));return std::clamp(alpha,0.f,1.f);
}
std::uint64_t addTrack(Project& p,std::string name){auto id=p.nextId++;p.timeline.tracks.push_back({id,std::move(name)});return id;}
std::uint64_t addClip(Project& p,std::uint64_t sourceInstance,std::uint64_t track,Frame start,Frame duration){
    editable(p,track);
    auto instance=p.instance(sourceInstance);instance.id=p.nextId++;copyGraph(p,instance.graph);instance.locked=false;p.instances.push_back(instance);
    auto id=p.nextId++;p.timeline.clips.push_back({id,instance.id,track,start,duration});return id;
}
std::uint64_t splitClip(Project& p,std::uint64_t id,Frame at){
    auto& original=clip(p,id);editable(p,original.track);if(at<=original.start||at>=original.start+original.duration)throw std::runtime_error("Playhead must be inside the clip");
    Clip right=original;auto instance=p.instance(original.instance);instance.id=p.nextId++;copyGraph(p,instance.graph);p.instances.push_back(instance);
    right.id=p.nextId++;right.instance=instance.id;right.start=at;right.duration=original.start+original.duration-at;
    right.sourceIn+=static_cast<Frame>(std::llround(static_cast<double>(at-original.start)*original.speed));right.fadeIn=0;
    original.duration=at-original.start;original.fadeOut=0;original.fadeIn=std::min(original.fadeIn,original.duration);right.fadeOut=std::min(right.fadeOut,right.duration);
    p.timeline.clips.push_back(right);return right.id;
}
void removeClip(Project& p,std::uint64_t id,bool ripple){
    const auto value=clip(p,id);editable(p,value.track);std::erase_if(p.timeline.clips,[&](const auto& c){return c.id==id;});std::erase_if(p.instances,[&](const auto& i){return i.id==value.instance;});
    if(ripple)for(auto& c:p.timeline.clips)if(c.track==value.track&&c.start>=value.start+value.duration)c.start-=value.duration;
}
void trimClip(Project& p,std::uint64_t id,Frame start,Frame duration,Frame sourceIn){
    auto& c=clip(p,id);editable(p,c.track);c.start=start;c.duration=duration;c.sourceIn=sourceIn;c.fadeIn=std::min(c.fadeIn,duration);c.fadeOut=std::min(c.fadeOut,duration);
}
Frame snapFrame(const Timeline& t,Frame proposed,std::uint64_t exclude,Frame playhead,Frame tolerance){
    Frame best=proposed,distance=tolerance+1;
    auto candidate=[&](Frame frame){Frame d=std::abs(proposed-frame);if(d<distance){best=frame;distance=d;}};candidate(0);candidate(playhead);
    for(const auto& c:t.clips)if(c.id!=exclude){candidate(c.start);candidate(c.start+c.duration);}return distance<=tolerance?best:proposed;
}
std::vector<Plane> evaluateTimeline(const Project& p,Frame frame){
    std::vector<Plane> result;
    for(const auto& track:p.timeline.tracks){if(track.muted)continue;
        for(const auto& c:p.timeline.clips){if(c.track!=track.id)continue;float alpha=clipOpacity(c,frame);if(alpha<=0)continue;
            const auto& i=p.instance(c.instance);if(!i.visible)continue;const auto& d=p.definition(i.definition);auto transform=i.transform;transform.opacity*=alpha;
            double source=seconds(p.timeline,c.sourceIn)+(seconds(p.timeline,frame-c.start)*c.speed);
            result.push_back({i.id,d.id,transform,d.width,d.height,d.red,d.green,d.blue,i.grade,source});
        }
    }
    return result;
}
}
