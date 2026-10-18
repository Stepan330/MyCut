#pragma once
#include "Project.h"
#include "Session.h"
#include <array>
#include <limits>
#include <unordered_map>

namespace mycut {
struct Point { float x=0,y=0; };
struct Gizmo { std::array<Point,4> corners; std::array<Point,4> edges; Point top,rotation; std::array<Point,4> rotationZones; Point center;float rotationRadius=0; };
enum class Tool { None=0,Move=1,Scale=2,Rotate=3 };
// All dimensions are screen DIPs, shared by input and renderer.
struct InteractionStyle {
    static constexpr float HandleDiameter=16,HandleHitRadius=24;
    static constexpr float EdgeHandleDiameter=13;
    static constexpr float RotationDistance=48,OuterRotationDistance=40,OuterRotationHitRadius=24;
    static constexpr float ObjectHitMargin=16,FrameWidth=2.4f;
};
struct IntentHint { Point direction{}; float expansion=0; };
struct InteractionOptions {
    float handleRadius=24,objectMargin=16,handleDiameter=16,frameWidth=2.4f;
    std::array<float,13> retainedHandles{};
    float zoneSpeed=-1,speedCoefficient=.04f,influenceDistance=160,shrinkSpeed=88,speedThreshold=260,maximumExpansion=44;
};
class ZoneMemory {
    struct State{float from=0,to=0;double start=0,seen=-100,duration=0;float rate=-1;float sample(double now)const;};
    std::unordered_map<Id,std::array<State,16>> states_;
public:
    float update(Id,int index,float desired,double now);
    float updateRate(Id,int index,float desired,double now,float rate);
    float sample(Id,int index,double now)const;
    void clear(){states_.clear();}
};
float intentExpansion(Point from,Point target,const IntentHint&);
float zoneExpansion(float distance,const IntentHint&,const InteractionOptions&);
std::vector<Id> hitStack(const Project&,Point);
struct HandleHit { Tool tool=Tool::None; int corner=-1; float distance=std::numeric_limits<float>::infinity(); };
struct HitTarget { Id instance=0; Tool tool=Tool::None; int handle=-1; float distance=std::numeric_limits<float>::infinity(); };
Gizmo gizmo(const Definition&,const Transform&,float pixelsPerUnit);
Point rotationRingPoint(const Gizmo&,Point);
// Shared angular cut-outs: drawing and picking must agree near scale corners.
bool rotationRingAvailable(const Gizmo&,Point ringPoint,float dipsPerUnit,const InteractionOptions&);
HandleHit hitGizmo(const Gizmo&,Point,float pixelsPerUnit,IntentHint intent={},InteractionOptions options={},ZoneMemory* memory=nullptr,Id owner=0,double now=0);
HitTarget resolveHit(const Project&,Id selected,Point,float dipsPerUnit,IntentHint intent={},InteractionOptions options={},ZoneMemory* memory=nullptr,double now=0);
class Manipulator {
public:
    Tool hover(const Project&,Id selected,Point,float pixelsPerUnit) const;
    Id begin(Session&,Id selected,Point,float pixelsPerUnit,IntentHint intent={},InteractionOptions options={});
    Id beginResolved(Session&,HitTarget,Point,float pixelsPerUnit);
    bool update(Session&,Point,bool shift);
    void end(Session&);
    void cancel(Session&);
    bool active() const { return tool_!=Tool::None; }
    Tool tool() const { return tool_; }
    Id id() const { return id_; }
    int handle() const { return handle_; }
private:
    Id id_=0;
    Tool tool_=Tool::None;
    int handle_=-1;
    Transform original_;
    Point start_,anchor_,diagonal_;
    float previousAngle_=0,angleDelta_=0;
    float density_=1;
    bool moved_=false;
};
}
