#include "mycut/Bridge.h"
#include <iostream>
#include <stdexcept>
#include <string>
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
int main(){void* h=mc_create();try{
    static_assert(sizeof(MCTrack)==16&&sizeof(MCClip)==72);check(h!=nullptr,"Cannot initialize bridge");auto track=mc_track_add(h,L"Track / Тест");check(track!=0,"Track creation failed");
    auto before=std::wstring(mc_project_text(h));check(mc_clip_add(h,2,track,0,0)==0,"Failed clip creation returned an unusable nonzero ID");
    check(before==mc_project_text(h)&&mc_count(h)==3,"Failed creation changed the document");auto id=mc_clip_add(h,2,track,0,30);check(id!=0&&mc_clip_count(h)==1,"Clip creation failed");
    MCTrack t{};check(mc_track_get(h,0,&t)!=0,"Missing track");t.locked=1;check(mc_track_set(h,&t)!=0,"Lock failed");MCClip c{};check(mc_clip_get(h,0,&c)!=0,"Missing clip");
    c.start=5;check(mc_clip_set(h,&c)==0&&mc_clip_split(h,id,15)==0&&mc_clip_remove(h,id,0)==0,"Locked track admitted a mutation");
    check(mc_timeline_range(h,10,5)==0,"Invalid export range accepted");t.locked=0;check(mc_track_set(h,&t)!=0,"Unlock failed");check(mc_clip_set(h,&c)!=0,"Unlocked clip edit failed");
    MCClip changed{};mc_clip_get(h,0,&changed);check(changed.start==5,"Clip edit did not persist");
    check(mc_graph_init(h,2,0)!=0,"Exposure bridge graph failed");auto exposure=mc_node_add(h,2,10,0,0);check(exposure!=0,"Exposure creation failed");
    MCNode node{};check(mc_node_get(h,2,2,&node)!=0&&node.id==exposure,"Exposure bridge read failed");
    node.v0=25;check(mc_node_set(h,2,&node)!=0,"Typed bridge rejected valid legacy value outside UI range");
    check(mc_node_get(h,2,2,&node)!=0&&node.v0==25,"Typed bridge clamped stored Exposure");
    before=mc_project_text(h);node.v0=100001;check(mc_node_set(h,2,&node)==0&&before==mc_project_text(h),"Invalid typed bridge write was not atomic");
    check(mc_undo(h,0)!=0&&mc_node_get(h,2,2,&node)!=0&&node.v0==0,"Exposure bridge Undo failed");
    mc_destroy(h);std::cout<<"PASS: C ABI layout, failed creation returns zero, atomicity, track locks, clip edits, range validation, typed Exposure legacy range and Undo\n";return 0;
}catch(const std::exception& ex){if(h)mc_destroy(h);std::cerr<<"FAIL: "<<ex.what()<<'\n';return 1;}}
