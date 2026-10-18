#include "mycut/Interaction.h"
#include <algorithm>
#include <cmath>
#include <numbers>

namespace mycut {
float ZoneMemory::State::sample(double now)const{if(rate>=0)return std::max(0.f,to-rate*static_cast<float>(std::max(0.0,now-seen)));if(now-seen>1)return 0;double t=std::clamp((now-start)/std::max(.001,duration),0.0,1.0);return from+(to-from)*static_cast<float>(t*t*(3-2*t));}
float ZoneMemory::updateRate(Id id,int index,float desired,double now,float rate){auto& s=states_[id].at(index);float current=s.sample(now);s.to=std::max(desired,current);s.seen=now;s.rate=std::max(1.f,rate);return s.to;}
float ZoneMemory::sample(Id id,int index,double now)const{auto found=states_.find(id);return found==states_.end()?0:found->second.at(index).sample(now);}
float ZoneMemory::update(Id id,int index,float desired,double now){auto& s=states_[id].at(index);if(now-s.seen>1){s={desired,desired,now,now,0};return desired;}float current=s.sample(now);s.seen=now;if(desired>=current){s={desired,desired,now,now,0};return desired;}if(std::abs(desired-s.to)>.001f){s.from=current;s.to=desired;s.start=now;s.duration=.5;}return s.sample(now);}
namespace {
float distance(Point a,Point b) {return std::hypot(a.x-b.x,a.y-b.y);}
float angle(Point p,const Transform& t) {return std::atan2(p.y-t.y,p.x-t.x);}
}
float intentExpansion(Point from,Point target,const IntentHint& intent) {
    float length=distance(from,target),directionLength=std::hypot(intent.direction.x,intent.direction.y);
    if(length<.001f||directionLength<.001f||intent.expansion<=0)return 0;
    float alignment=((target.x-from.x)*intent.direction.x+(target.y-from.y)*intent.direction.y)/(length*directionLength);
    // A narrow forward probability lobe: targets beside or behind the motion do not grow.
    return intent.expansion*std::pow(std::max(0.f,alignment),3.f);
}
float zoneExpansion(float distance,const IntentHint&,const InteractionOptions& options){float proximity=std::clamp(1-std::max(0.f,distance)/std::max(1.f,options.influenceDistance),0.f,1.f);return std::clamp(std::max(0.f,options.zoneSpeed-options.speedThreshold)*options.speedCoefficient*proximity*proximity,0.f,options.maximumExpansion);}
Gizmo gizmo(const Definition& d,const Transform& t,float pixelsPerUnit) {
    pixelsPerUnit=std::max(.001f,pixelsPerUnit);
    float rad=t.rotation*std::numbers::pi_v<float>/180;
    auto point=[&](float x,float y) {return Point{t.x+x*std::cos(rad)-y*std::sin(rad),t.y+x*std::sin(rad)+y*std::cos(rad)};};
    float w=d.width*t.scaleX/2,h=d.height*t.scaleY/2;
    Gizmo result{{point(-w,-h),point(w,-h),point(w,h),point(-w,h)},
        {point(0,-h),point(w,0),point(0,h),point(-w,0)},point(0,-h),point(0,-h-InteractionStyle::RotationDistance/pixelsPerUnit),{}};
    result.center={t.x,t.y};result.rotationRadius=std::max(72.f/pixelsPerUnit,std::hypot(w,h)+28.f/pixelsPerUnit);
    result.rotation={t.x,t.y-result.rotationRadius};
    for(int n=0;n<4;++n) {
        auto c=result.corners[n];float length=std::max(.001f,std::hypot(c.x-t.x,c.y-t.y));
        result.rotationZones[n]={t.x+(c.x-t.x)/length*result.rotationRadius,t.y+(c.y-t.y)/length*result.rotationRadius};
    }
    return result;
}
Point rotationRingPoint(const Gizmo& g,Point p) {
    float radius=distance(g.center,p);
    return radius>.001f?Point{g.center.x+(p.x-g.center.x)*g.rotationRadius/radius,g.center.y+(p.y-g.center.y)*g.rotationRadius/radius}:g.rotation;
}
bool rotationRingAvailable(const Gizmo& g,Point ringPoint,float dipsPerUnit,const InteractionOptions& options) {
    float density=std::max(.001f,dipsPerUnit);
    // Reserve the configured maximum footprint, independent of pointer speed/decay.
    float gap=std::max(22.f,options.handleRadius+8.f)+std::max(0.f,options.maximumExpansion);
    for(int n=0;n<4;++n){
        if(distance(ringPoint,g.rotationZones[n])*density<=gap)return false;
    }
    return true;
}
HandleHit hitGizmo(const Gizmo& g,Point p,float pixelsPerUnit,IntentHint intent,InteractionOptions options,ZoneMemory* memory,Id owner,double now) {
    float density=std::max(.001f,pixelsPerUnit);
    HandleHit best;float bestScore=std::numeric_limits<float>::infinity();
    auto candidate=[&](Point center,Tool tool,int index,float radius) {
        float d=distance(center,p)*density;
        float expansion=options.zoneSpeed>=0?zoneExpansion(d,intent,options):intentExpansion(p,center,intent);
        if(memory)expansion=options.zoneSpeed>=0?memory->updateRate(owner,index,expansion,now,options.shrinkSpeed):memory->update(owner,index,expansion,now);else expansion=std::max(expansion,options.retainedHandles.at(index));
        float score=d;
        if(d<=radius+expansion && score<bestScore){best={tool,index,d};bestScore=score;}
    };
    for(int n=0;n<4;++n) {
        candidate(g.corners[n],Tool::Scale,n,options.handleRadius);
        candidate(g.edges[n],Tool::Scale,4+n,options.handleRadius);
    }
    if(best.tool!=Tool::None)return best; // Scale handles always win an overlap with the ring.
    float radius=distance(g.center,p);Point nearest=rotationRingPoint(g,p);
    if(!rotationRingAvailable(g,nearest,density,options))return best;
    float d=std::abs(radius-g.rotationRadius)*density;
    float expansion=options.zoneSpeed>=0?zoneExpansion(d,intent,options):intentExpansion(p,nearest,intent);
    if(memory)expansion=options.zoneSpeed>=0?memory->updateRate(owner,8,expansion,now,options.shrinkSpeed):memory->update(owner,8,expansion,now);else expansion=std::max(expansion,options.retainedHandles[8]);
    if(d<=options.handleRadius+expansion)best={Tool::Rotate,8,d};
    return best;
}
std::vector<Id> hitStack(const Project& p,Point point) {
    std::vector<Id> result;
    for(auto it=p.instances.rbegin();it!=p.instances.rend();++it) {
        if(!it->visible||it->locked||it->transform.opacity<=0)continue;
        const auto& t=it->transform;const auto& d=p.definition(it->definition);
        float a=t.rotation*std::numbers::pi_v<float>/180,dx=point.x-t.x,dy=point.y-t.y;
        float x=dx*std::cos(a)+dy*std::sin(a),y=-dx*std::sin(a)+dy*std::cos(a);
        if(std::abs(x)<=d.width*t.scaleX/2 && std::abs(y)<=d.height*t.scaleY/2)result.push_back(it->id);
    }
    return result;
}
HitTarget resolveHit(const Project& p,Id selected,Point point,float dipsPerUnit,IntentHint intent,InteractionOptions options,ZoneMemory* memory,double now) {
    dipsPerUnit=std::max(.001f,dipsPerUnit);
    if(selected) {
        const auto& i=p.instance(selected);
        if(i.visible && !i.locked && i.transform.opacity>0) {
            auto hit=hitGizmo(gizmo(p.definition(i.definition),i.transform,dipsPerUnit),point,dipsPerUnit,intent,options,memory,selected,now);
            // Handles form the foreground interaction layer; closest handle wins within that layer.
            if(hit.tool!=Tool::None)return {selected,hit.tool,hit.corner,hit.distance};
        }
    }
    auto stack=hitStack(p,point);if(!stack.empty())return {stack.front(),Tool::Move,-1,0};
    HitTarget best;float centerDistance=std::numeric_limits<float>::infinity(),bestScore=std::numeric_limits<float>::infinity();
    for(auto it=p.instances.rbegin();it!=p.instances.rend();++it) {
        if(!it->visible||it->locked||it->transform.opacity<=0)continue;
        const auto& d=p.definition(it->definition);const auto& t=it->transform;
        float a=t.rotation*std::numbers::pi_v<float>/180,dx=point.x-t.x,dy=point.y-t.y;
        float lx=dx*std::cos(a)+dy*std::sin(a),ly=-dx*std::sin(a)+dy*std::cos(a);
        float halfWidth=d.width*t.scaleX/2,halfHeight=d.height*t.scaleY/2;
        float ex=std::max(0.f,std::abs(lx)-halfWidth),ey=std::max(0.f,std::abs(ly)-halfHeight);
        float edge=std::hypot(ex,ey)*dipsPerUnit,center=std::hypot(dx,dy)*dipsPerUnit;
        Point nearestLocal{std::clamp(lx,-halfWidth,halfWidth),std::clamp(ly,-halfHeight,halfHeight)};
        Point nearest{t.x+nearestLocal.x*std::cos(a)-nearestLocal.y*std::sin(a),t.y+nearestLocal.x*std::sin(a)+nearestLocal.y*std::cos(a)};
        float expansion=options.zoneSpeed>=0?zoneExpansion(edge,intent,options):intentExpansion(point,nearest,intent);if(memory)expansion=options.zoneSpeed>=0?memory->updateRate(it->id,15,expansion,now,options.shrinkSpeed):memory->update(it->id,15,expansion,now);float score=edge;
        if(edge>options.objectMargin+expansion)continue;
        if(score<bestScore-.001f || (std::abs(score-bestScore)<=.001f && center<centerDistance-.001f)) {
            best={it->id,Tool::Move,-1,edge};centerDistance=center;bestScore=score;
        }
    }
    return best;
}
Tool Manipulator::hover(const Project& p,Id selected,Point point,float pixelsPerUnit) const {
    return resolveHit(p,selected,point,pixelsPerUnit).tool;
}
Id Manipulator::begin(Session& session,Id selected,Point point,float pixelsPerUnit,IntentHint intent,InteractionOptions options) {
    return beginResolved(session,resolveHit(session.project(),selected,point,pixelsPerUnit,intent,options),point,pixelsPerUnit);
}
Id Manipulator::beginResolved(Session& session,HitTarget hit,Point point,float pixelsPerUnit) {
    if(active())end(session);
    const auto& p=session.project();
    id_=hit.instance;tool_=hit.tool;handle_=hit.handle;
    if(!id_)return 0;
    const auto& i=p.instance(id_);original_=i.transform;start_=point;density_=std::max(.001f,pixelsPerUnit);moved_=false;
    previousAngle_=angle(point,original_);angleDelta_=0;
    if(tool_==Tool::Scale) {
        auto g=gizmo(p.definition(i.definition),original_,pixelsPerUnit);
        Point dragged;
        if(handle_<4) {anchor_=g.corners[(handle_+2)%4];dragged=g.corners[handle_];}
        else {anchor_=g.edges[(handle_-4+2)%4];dragged=g.edges[handle_-4];}
        diagonal_={dragged.x-anchor_.x,dragged.y-anchor_.y};
    }
    session.beginEdit();return id_;
}
bool Manipulator::update(Session& session,Point point,bool shift) {
    if(!active())return false;
    Transform t=original_;
    float dx=point.x-start_.x,dy=point.y-start_.y;
    if(!moved_&&std::hypot(dx,dy)*density_<4)return false;moved_=true;
    if(tool_==Tool::Move) {
        if(shift) {if(std::abs(dx)>=std::abs(dy))dy=0;else dx=0;}
        t.x=std::clamp(t.x+dx,-100000.f,100000.f);t.y=std::clamp(t.y+dy,-100000.f,100000.f);
    } else if(tool_==Tool::Scale) {
        float divisor=diagonal_.x*diagonal_.x+diagonal_.y*diagonal_.y;
        float ratio=1+(dx*diagonal_.x+dy*diagonal_.y)/std::max(divisor,.0001f);
        if(handle_<4) {
            float lower=std::max(.01f/original_.scaleX,.01f/original_.scaleY),upper=std::min(100.f/original_.scaleX,100.f/original_.scaleY);
            if(shift)ratio=std::round(original_.scaleX*ratio*10)/10/original_.scaleX;
            ratio=std::clamp(ratio,lower,upper);t.scaleX=original_.scaleX*ratio;t.scaleY=original_.scaleY*ratio;
        } else if(handle_==4||handle_==6) {
            t.scaleY=std::clamp(original_.scaleY*ratio,.01f,100.f);
            if(shift)t.scaleY=std::clamp(std::round(t.scaleY*10)/10,.01f,100.f);
            ratio=t.scaleY/original_.scaleY;
        } else {
            t.scaleX=std::clamp(original_.scaleX*ratio,.01f,100.f);
            if(shift)t.scaleX=std::clamp(std::round(t.scaleX*10)/10,.01f,100.f);
            ratio=t.scaleX/original_.scaleX;
        }
        // Keep the opposite corner/edge fixed while the center follows halfway.
        t.x=anchor_.x+diagonal_.x*ratio/2;t.y=anchor_.y+diagonal_.y*ratio/2;
    } else if(tool_==Tool::Rotate) {
        float current=angle(point,original_);
        angleDelta_+=std::remainder(current-previousAngle_,2*std::numbers::pi_v<float>);previousAngle_=current;
        t.rotation+=angleDelta_*180/std::numbers::pi_v<float>;
        if(shift)t.rotation=std::round(t.rotation/15)*15;
    }
    session.edit([&](Project& p){p.instance(id_).transform=t;});return true;
}
void Manipulator::end(Session& session) {if(active())session.endEdit();tool_=Tool::None;id_=0;}
void Manipulator::cancel(Session& session) {if(active())session.cancelEdit();tool_=Tool::None;id_=0;}
}
