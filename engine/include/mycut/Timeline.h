#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace mycut {
using Frame=std::int64_t;
struct Track {
    std::uint64_t id=0;std::string name="Video";bool muted=false,locked=false;
    bool operator==(const Track&)const=default;
};
struct Clip {
    std::uint64_t id=0,instance=0,track=0;
    Frame start=0,duration=150,sourceIn=0,fadeIn=0,fadeOut=0;
    float speed=1;bool muted=false;
    bool operator==(const Clip&)const=default;
};
struct Timeline {
    int rateNumerator=30,rateDenominator=1;
    Frame rangeIn=0,rangeOut=-1; // -1 means no explicit out; it never constrains navigation.
    std::vector<Track> tracks;std::vector<Clip> clips;
    bool operator==(const Timeline&)const=default;
};
struct Project;
double seconds(const Timeline&,Frame);
Frame timelineEnd(const Timeline&);
float clipOpacity(const Clip&,Frame);
std::uint64_t addTrack(Project&,std::string name);
std::uint64_t addClip(Project&,std::uint64_t sourceInstance,std::uint64_t track,Frame start,Frame duration);
std::uint64_t splitClip(Project&,std::uint64_t clip,Frame at);
void removeClip(Project&,std::uint64_t clip,bool ripple=false);
void trimClip(Project&,std::uint64_t clip,Frame start,Frame duration,Frame sourceIn);
Frame snapFrame(const Timeline&,Frame proposed,std::uint64_t exclude,Frame playhead,Frame tolerance);
}
