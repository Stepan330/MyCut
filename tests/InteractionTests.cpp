#include "mycut/Interaction.h"
#include "mycut/ZonePresentation.h"
#include <cmath>
#include <iostream>
#include <stdexcept>

void check(bool condition,const char* message) {if(!condition)throw std::runtime_error(message);}
bool near(float a,float b) {return std::abs(a-b)<.02f;}
int main() {
    try {
        mycut::Session s;mycut::Manipulator m;const auto initial=s.project();
        check(m.begin(s,0,{410,340},1)==2 && m.tool()==mycut::Tool::Move,"Body click must select object");
        m.end(s);check(!s.canUndo(),"Selection-only click must not create undo");
        m.begin(s,2,{410,340},1);m.update(s,{412,341},false);m.end(s);check(s.project()==initial&&!s.canUndo(),"Sub-threshold pointer motion must remain a selection-only click");
        m.begin(s,2,{410,340},1);m.update(s,{450,360},false);m.update(s,{470,370},false);m.end(s);
        check(near(s.project().instance(2).transform.x,470),"Move must track pointer delta");
        check(s.project().instance(3)==initial.instance(3),"Move must isolate instance");
        check(s.undo() && s.project()==initial,"Whole pointer drag must undo in one step");
        check(!s.canUndo(),"Multiple mouse moves created multiple undo entries");
        m.begin(s,2,{410,340},1);m.update(s,{460,375},true);m.end(s);
        check(near(s.project().instance(2).transform.y,340),"Shift move must lock one axis");
        s.replace(initial);
        auto g=mycut::gizmo(initial.definition(1),initial.instance(2).transform,1);
        auto corner=g.corners[2],anchor=g.corners[0];
        check(m.begin(s,2,corner,1)==2 && m.tool()==mycut::Tool::Scale,"Corner handle must resize");
        m.update(s,{corner.x+(corner.x-anchor.x)*.5f,corner.y+(corner.y-anchor.y)*.5f},false);m.end(s);
        const auto& scaled=s.project().instance(2).transform;
        check(near(scaled.scaleX,1.5f)&&near(scaled.scaleY,1.5f),"Corner resize must preserve aspect ratio");
        auto resized=mycut::gizmo(initial.definition(1),scaled,1);
        check(near(resized.corners[0].x,anchor.x) && near(resized.corners[0].y,anchor.y),"Opposite corner must stay fixed");
        s.replace(initial);auto right=g.edges[1],left=g.edges[3];
        check(m.begin(s,2,right,1)==2 && m.handle()==5,"Right edge handle must resize");
        m.update(s,{right.x+(right.x-left.x)*.5f,right.y+(right.y-left.y)*.5f},false);m.end(s);
        const auto edgeScaled=s.project().instance(2).transform;
        check(near(edgeScaled.scaleX,1.5f)&&near(edgeScaled.scaleY,1),"Edge resize must change only one axis");
        auto edgeGizmo=mycut::gizmo(initial.definition(1),edgeScaled,1);
        check(near(edgeGizmo.edges[3].x,left.x)&&near(edgeGizmo.edges[3].y,left.y),"Opposite edge must stay fixed");
        s.replace(initial);
        check(m.begin(s,2,g.rotation,1)==2 && m.tool()==mycut::Tool::Rotate,"Rotation handle must rotate");
        auto t=initial.instance(2).transform;
        m.update(s,{t.x-(g.rotation.y-t.y),t.y+(g.rotation.x-t.x)},false);m.end(s);
        check(near(s.project().instance(2).transform.rotation,t.rotation+90),"Rotation delta wrong");
        s.replace(initial);m.begin(s,2,g.rotation,1);
        m.update(s,{t.x-(g.rotation.y-t.y),t.y+(g.rotation.x-t.x)},true);m.end(s);
        check(near(std::remainder(s.project().instance(2).transform.rotation,15.f),0),"Shift rotation must snap to 15 degrees");
        s.replace(initial);m.begin(s,2,{410,340},1);m.update(s,{500,400},false);m.cancel(s);
        check(s.project()==initial && !s.canUndo(),"Escape must restore model without adding history");
        check(m.begin(s,2,{5,5},1)==0 && !m.active(),"Empty click must deselect");
        check(m.begin(s,0,{770,525},1)==4,"Hit testing must select topmost overlapping object");m.end(s);
        auto halfDpi=mycut::gizmo(initial.definition(1),t,.5f);
        auto p=halfDpi.corners[0];p.x+=14;
        check(mycut::hitGizmo(halfDpi,p,.5f).tool==mycut::Tool::Scale,"Handle tolerance must remain screen-sized");
        mycut::Point outside=g.rotationZones[0];
        check(mycut::hitGizmo(g,outside,1).tool!=mycut::Tool::Rotate,"Exterior scale corner must be excluded from rotation");
        int activeArcs=0;
        for(int n=0;n<64;++n){float a=n*6.28318530718f/64;mycut::Point ring{g.center.x+g.rotationRadius*std::cos(a),g.center.y+g.rotationRadius*std::sin(a)};bool available=mycut::rotationRingAvailable(g,ring,1,{});auto hit=mycut::hitGizmo(g,ring,1);check((hit.tool==mycut::Tool::Rotate)==available,"Visible rotation arcs and hit testing must agree");activeArcs+=available;}
        check(activeArcs>16&&activeArcs<64,"Ring must retain usable arcs and corner gaps");
        for(int n=0;n<4;++n){check(!mycut::rotationRingAvailable(g,g.rotationZones[n],1,{}),"Each scale corner must have a ring cut-out");check(mycut::hitGizmo(g,g.rotationZones[n],1).tool!=mycut::Tool::Rotate,"Removed ring arcs must not rotate");}
        mycut::InteractionOptions retainedGap;retainedGap.retainedHandles[0]=44;
        auto cornerArc=g.rotationZones[0];float a=std::atan2(cornerArc.y-g.center.y,cornerArc.x-g.center.x)+50/g.rotationRadius;
        mycut::Point gapProbe{g.center.x+std::cos(a)*g.rotationRadius,g.center.y+std::sin(a)*g.rotationRadius};
        check(!mycut::rotationRingAvailable(g,gapProbe,1,{})&&!mycut::rotationRingAvailable(g,gapProbe,1,retainedGap),"Corner cut-outs must reserve maximum expansion even while idle");
        mycut::InteractionOptions smallerGap;smallerGap.maximumExpansion=0;
        check(mycut::rotationRingAvailable(g,gapProbe,1,smallerGap),"Changing configured maximum expansion must change the cut-out");
        for(int n=0;n<64;++n){float angle=n*6.28318530718f/64;mycut::Point probe{g.center.x+g.rotationRadius*std::cos(angle),g.center.y+g.rotationRadius*std::sin(angle)};auto fast=retainedGap;fast.zoneSpeed=3000;check(mycut::rotationRingAvailable(g,probe,1,{})==mycut::rotationRingAvailable(g,probe,1,fast),"Cut-outs must not move with speed or retained zone size");}
        auto projected=mycut::rotationRingPoint(g,{g.center.x,g.center.y-g.rotationRadius-10});check(near(projected.x,g.rotation.x)&&near(projected.y,g.rotation.y),"Pointer-local rotation zone must resolve the nearest ring point");
        check(mycut::hitGizmo(g,g.corners[0],1,{},mycut::InteractionOptions{.handleRadius=80}).tool==mycut::Tool::Scale,"Scale must win overlapping adaptive ring zones");
        auto enlarged=g.corners[1];enlarged.x+=20;
        check(mycut::hitGizmo(g,enlarged,1).tool==mycut::Tool::Scale,"Enlarged handle zone must accept a 20-DIP near miss");
        auto tiny=initial.definition(1);tiny.width=tiny.height=10;
        auto clustered=mycut::gizmo(tiny,{0,0,1,1,0,1},1);
        auto closest=mycut::hitGizmo(clustered,{4,-4},1);
        check(closest.tool==mycut::Tool::Scale && closest.corner==1,"Overlapping handle zones must choose nearest center, not first handle");
        mycut::Project zones;
        zones.definitions.push_back({1,"Zone","",100,100,1,1,1});
        zones.instances.push_back({2,1,"Left",{200,200,1,1,0,1},true});
        zones.instances.push_back({3,1,"Right",{320,200,1,1,0,1},true});zones.nextId=4;
        check(mycut::resolveHit(zones,0,{258,200},1).instance==2,"Overlapping object margins must choose the nearest left surface");
        check(mycut::resolveHit(zones,0,{262,200},1).instance==3,"Overlapping object margins must choose the nearest right surface");
        s.replace(zones);check(m.begin(s,0,{258,200},1)==2,"Near-object click and hover must resolve the same target");m.cancel(s);
        check(!mycut::resolveHit(zones,0,{260,100},1).instance,"Outside all zones must remain empty");
        check(mycut::resolveHit(zones,0,{125,200},1,{{1,0},20}).instance==2,"Fast forward intent must expand the approached object zone");
        check(!mycut::resolveHit(zones,0,{125,200},1,{{-1,0},20}).instance,"Intent expansion must not grow behind the pointer direction");
        zones.instance(3).visible=false;
        check(!mycut::resolveHit(zones,0,{320,200},1).instance,"Invisible objects must not own proximity zones");
        mycut::ZoneMemory memory;check(memory.update(2,0,44,0)==44,"Native zone acquisition must be immediate");check(memory.update(2,0,0,.01)==44,"Native zone collapsed after a stop");float halfway=memory.update(2,0,0,.26);check(halfway>20&&halfway<24,"Native zone did not release gradually");check(memory.update(2,0,0,.52)==0,"Native zone did not finish its 0.5s release");
        mycut::InteractionOptions unified;unified.zoneSpeed=3000;unified.speedCoefficient=.04f;unified.shrinkSpeed=44;
        check(mycut::zoneExpansion(30,{},unified)==44,"Unified native zone law differs from buttons");mycut::ZoneMemory shared;
        check(shared.updateRate(2,8,44,0,44)==44&&near(shared.updateRate(2,8,0,.5,44),22),"Rotation zone does not obey shared shrink speed");
        auto rotatePoint=g.rotation;rotatePoint.y-=35;check(mycut::hitGizmo(g,rotatePoint,1,{},unified).tool==mycut::Tool::Rotate,"Unified speed law did not expand rotation handle");
        mycut::ZonePresentation display;display.update(24,1,.016f);check(display.opacity>0&&display.opacity<1,"Zone must fade in, not appear abruptly");display.update(80,1,.016f);check(display.radius>24&&display.radius<80,"Visual radius must smooth a large input-radius jump");float liveRadius=display.radius;display.update(12,0,.016f);check(display.radius<liveRadius&&display.radius>12&&display.opacity>0,"Zone must fade / shrink smoothly");display.update(40,1,.016f,true);check(display.radius==40&&display.opacity==1,"Reduced motion must bypass presentation only");
        std::cout<<"PASS: interactions, unified zones and independent smooth visual radius / opacity\n";
        return 0;
    } catch(const std::exception& e) {std::cerr<<"FAIL: "<<e.what()<<'\n';return 1;}
}
