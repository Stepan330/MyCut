#define MYCUT_BRIDGE_IMPLEMENTATION
#include "mycut/Bridge.h"
#include "mycut/Renderer.h"
#include "mycut/Session.h"
#include "mycut/Interaction.h"
#include "mycut/Media.h"
#include <fstream>
#include <iomanip>
#include <sstream>
#include <cmath>

namespace {
std::wstring wide(const std::string& s) {
    if(s.empty())return {};
    int n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,s.data(),static_cast<int>(s.size()),nullptr,0);
    if(n<=0)throw std::runtime_error("Invalid UTF-8 text");
    std::wstring result(n,0);MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,s.data(),static_cast<int>(s.size()),result.data(),n);return result;
}
std::string utf8(const std::filesystem::path& path) {auto text=path.u8string();return std::string(reinterpret_cast<const char*>(text.data()),text.size());}
std::string narrow(const wchar_t* text) {
    if(!text)throw std::runtime_error("Missing text");int length=static_cast<int>(wcslen(text));if(!length)return {};
    int count=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text,length,nullptr,0,nullptr,nullptr);
    if(!count)throw std::runtime_error("Invalid Unicode text");std::string result(count,0);WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text,length,result.data(),count,nullptr,nullptr);return result;
}
struct Context {
    mycut::Session session;
    mycut::Manipulator manipulator;
    mycut::ZoneMemory zoneMemory;
    mycut::Id hovered=0;
    float selectionProgress=1,hoverProgress=0;
    int hoveredHandle=-1;
    mycut::InputAppearance appearance;
    mycut::Id editingText=0;
    mycut::InteractionOptions zonePolicy;
    mycut::Point clickPoint;ULONGLONG clickTime=0;bool cycleEligible=false;
    std::unique_ptr<mycut::Renderer> renderer;
    std::unique_ptr<mycut::Renderer> scopeRenderer;
    HWND scopeWindow=nullptr;
    std::unique_ptr<mycut::Renderer> sampleRenderer;HWND sampleWindow=nullptr;
    HWND window=nullptr;
    int width=1,height=1;
    bool timelineEnabled=false;mycut::Frame timelineFrame=0;
    std::wstring error,text;
    ~Context(){scopeRenderer.reset();sampleRenderer.reset();if(scopeWindow)DestroyWindow(scopeWindow);if(sampleWindow)DestroyWindow(sampleWindow);}
};
mycut::HitTarget resolve(Context& c,mycut::Id selected,mycut::Point point,float density,mycut::IntentHint intent) {
    c.appearance.options.zoneSpeed=c.zonePolicy.zoneSpeed;c.appearance.options.speedCoefficient=c.zonePolicy.speedCoefficient;c.appearance.options.influenceDistance=c.zonePolicy.influenceDistance;c.appearance.options.shrinkSpeed=c.zonePolicy.shrinkSpeed;c.appearance.options.speedThreshold=c.zonePolicy.speedThreshold;c.appearance.options.maximumExpansion=c.zonePolicy.maximumExpansion;
    bool settling=c.appearance.settleId&&(std::abs(c.appearance.settleOffset.x)+std::abs(c.appearance.settleOffset.y)>.001f);
    mycut::Project visual;
    bool filtered=!c.session.project().timeline.clips.empty();
    if(settling||c.timelineEnabled||filtered){visual=c.session.project();
        if(c.timelineEnabled){auto planes=mycut::evaluateTimeline(visual,c.timelineFrame);std::vector<mycut::Instance> active;
            for(const auto& plane:planes){auto i=visual.instance(plane.instance);i.transform=plane.transform;for(const auto& clip:visual.timeline.clips)if(clip.instance==i.id)for(const auto& track:visual.timeline.tracks)if(track.id==clip.track&&track.locked)i.locked=true;active.push_back(i);}visual.instances=std::move(active);}
        else if(filtered){std::erase_if(visual.instances,[&](const auto& i){return std::any_of(visual.timeline.clips.begin(),visual.timeline.clips.end(),[&](const auto& clip){return clip.instance==i.id;});});}
        if(settling)for(auto& i:visual.instances)if(i.id==c.appearance.settleId){i.transform.x+=c.appearance.settleOffset.x;i.transform.y+=c.appearance.settleOffset.y;break;}}
    const auto& view=settling||c.timelineEnabled||filtered?visual:c.session.project();
    if(selected&&std::none_of(view.instances.begin(),view.instances.end(),[&](const auto& i){return i.id==selected;}))selected=0;
    auto hit=mycut::resolveHit(view,selected,point,density,intent,c.appearance.options,&c.zoneMemory,GetTickCount64()/1000.0);
    auto stack=mycut::hitStack(view,point);
    if(hit.tool==mycut::Tool::Move&&c.cycleEligible&&GetTickCount64()-c.clickTime<1200&&std::hypot(point.x-c.clickPoint.x,point.y-c.clickPoint.y)*density<6&&stack.size()>1) {
        auto previous=std::find(stack.begin(),stack.end(),selected);
        if(previous!=stack.end())hit={stack[(static_cast<std::size_t>(previous-stack.begin())+1)%stack.size()],mycut::Tool::Move,-1,0};
    }
    return hit;
}
Context& ctx(void* handle) {if(!handle)throw std::runtime_error("Invalid MyCut session");return *static_cast<Context*>(handle);}
template<class F> int run(void* handle,F f) noexcept {
    if(!handle)return 0;
    auto& c=*static_cast<Context*>(handle);
    try {f(c);c.error.clear();return 1;} catch(const std::exception& e){try{c.error=wide(e.what());}catch(...){c.error=L"MyCut native error";}return 0;}
    catch(...){c.error=L"Unexpected native error";return 0;}
}
}
void* mc_create() {try{return new Context;}catch(...){return nullptr;}}
void mc_destroy(void* h){delete static_cast<Context*>(h);}
const wchar_t* mc_error(void* h){return h?ctx(h).error.c_str():L"Cannot create MyCut session";}
int mc_attach(void* h,void* hwnd,int software){return run(h,[&](Context& c){c.window=static_cast<HWND>(hwnd);c.renderer=mycut::createD3D11Renderer(c.window,software!=0);});}
int mc_detach(void* h){return run(h,[](Context& c){c.renderer.reset();c.window=nullptr;});}
int mc_mask_preview(void* h,std::uint64_t node){return run(h,[&](Context& c){c.appearance.maskNode=node;});}
int mc_editing_text(void* h,std::uint64_t instance){return run(h,[&](Context& c){if(instance&&c.session.project().definition(c.session.project().instance(instance).definition).kind!=mycut::DefinitionKind::Text)throw std::runtime_error("Inline editing requires a text layer");c.editingText=instance;});}
int mc_surface(void* h,int width,int height,void** surface){return run(h,[&](Context& c){if(!surface||!c.renderer||width<1||height<1||width>8192||height>8192)throw std::runtime_error("Invalid UI surface request");c.renderer->resize(width,height);*surface=c.renderer->sharedSurface();});}
int mc_frame_pixels(void* h,std::uint8_t* pixels,int capacity){return run(h,[&](Context& c){if(!pixels||!c.renderer)throw std::runtime_error("Missing UI frame buffer");auto frame=c.renderer->capture();if(capacity<0||frame.pixels.size()>static_cast<std::size_t>(capacity))throw std::runtime_error("UI frame buffer too small");std::copy(frame.pixels.begin(),frame.pixels.end(),pixels);});}
int mc_render(void* h,int width,int height,std::uint64_t selected){return run(h,[&](Context& c){
    if(!c.renderer)throw std::runtime_error("Viewport is not attached");
    c.width=std::max(1,width);c.height=std::max(1,height);c.renderer->resize(c.width,c.height);
    auto appearance=c.appearance;appearance.timeline=c.timelineEnabled;appearance.frame=c.timelineFrame;appearance.editingText=c.editingText;
    for(int n=0;n<13;++n)appearance.options.retainedHandles[n]=c.zoneMemory.sample(selected,n,GetTickCount64()/1000.0);
    c.renderer->draw(c.session.project(),selected,c.hovered,c.selectionProgress,c.hoverProgress,c.hoveredHandle,appearance);
});}
int mc_count(void* h){return h?static_cast<int>(ctx(h).session.project().instances.size()):0;}
int mc_item(void* h,int index,MCItem* out){return run(h,[&](Context& c){
    if(!out || index<0)throw std::runtime_error("Invalid Item index");
    const auto& i=c.session.project().instances.at(index);const auto& t=i.transform;const auto& d=c.session.project().definition(i.definition);
    *out={i.id,i.definition,t.x,t.y,t.scaleX,t.scaleY,t.rotation,t.opacity,d.red,d.green,d.blue,i.visible?1:0,i.locked?1:0};
});}
const wchar_t* mc_name(void* h,std::uint64_t id,int definition){if(!run(h,[&](Context& c){c.text=wide(definition?c.session.project().definition(id).name:c.session.project().instance(id).name);} ))return L"";return ctx(h).text.c_str();}
int mc_transform(void* h,std::uint64_t id,float x,float y,float scaleX,float scaleY,float rotation,float opacity,int visible){return run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){auto& i=p.instance(id);mycut::Transform next{x,y,scaleX,scaleY,rotation,opacity};if(i.locked&&i.transform!=next)throw std::runtime_error("Layer is locked");i.transform=next;i.visible=visible!=0;});});}
int mc_tint(void* h,std::uint64_t id,float r,float g,float b){return run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){auto& d=p.definition(id);d.red=r;d.green=g;d.blue=b;});});}
std::uint64_t mc_add(void* h,int kind){std::uint64_t result=0;int success=run(h,[&](Context& c){
    c.session.edit([&](mycut::Project& p){
        if(kind<1||kind>7)throw std::runtime_error("Invalid generated layer type");
        mycut::Definition d;d.id=p.nextId++;d.kind=static_cast<mycut::DefinitionKind>(kind);d.width=640;d.height=360;
        d.fill={.18f,.75f,.90f,1};d.second={.55f,.18f,.85f,1};
        if(kind==1){d.name="Text";d.text="MyCut\nНовый текст";d.width=720;d.height=200;d.fontWeight=600;d.fill={1,1,1,1};}
        else if(kind==2)d.name="Solid fill";else if(kind==3)d.name="Linear gradient";else if(kind==4)d.name="Radial gradient";
        else if(kind==5){d.name="Rectangle";d.strokeWidth=3;}else if(kind==6){d.name="Ellipse";d.strokeWidth=3;}else d.name="Pattern fill";
        result=p.nextId++;p.instances.push_back({result,d.id,d.name,{},true});p.definitions.push_back(std::move(d));
    });
});return success?result:0;}
int mc_content_get(void* h,std::uint64_t id,MCContent* out){return run(h,[&](Context& c){
    if(!out)throw std::runtime_error("Missing content output");const auto& d=c.session.project().definition(id);
    *out={static_cast<int>(d.kind),d.fontWeight,d.alignment,d.italic?1:0,d.underline?1:0,d.width,d.height,d.fontSize,d.lineHeight,
        d.fill.red,d.fill.green,d.fill.blue,d.fill.alpha,d.second.red,d.second.green,d.second.blue,d.second.alpha,d.stroke.red,d.stroke.green,d.stroke.blue,d.stroke.alpha,d.gradientAngle,d.strokeWidth};
});}
int mc_content_set(void* h,std::uint64_t id,const MCContent* value,const wchar_t* text,const wchar_t* font){return run(h,[&](Context& c){
    if(!value)throw std::runtime_error("Missing content properties");auto contents=narrow(text),family=narrow(font);const auto& v=*value;
    c.session.edit([&](mycut::Project& p){auto& d=p.definition(id);
        bool textChanged=d.text!=contents||d.font!=family||d.fontSize!=v.fontSize||d.fontWeight!=v.fontWeight||d.italic!=(v.italic!=0)||d.lineHeight!=v.lineHeight;
        d.kind=static_cast<mycut::DefinitionKind>(v.kind);d.width=v.width;d.height=v.height;d.fontSize=v.fontSize;d.lineHeight=v.lineHeight;
        d.fontWeight=v.fontWeight;d.alignment=v.alignment;d.italic=v.italic!=0;d.underline=v.underline!=0;d.text=contents;d.font=family;
        d.fill={v.fillRed,v.fillGreen,v.fillBlue,v.fillAlpha};d.second={v.secondRed,v.secondGreen,v.secondBlue,v.secondAlpha};d.stroke={v.strokeRed,v.strokeGreen,v.strokeBlue,v.strokeAlpha};d.gradientAngle=v.gradientAngle;d.strokeWidth=v.strokeWidth;
        if(textChanged)mycut::fitText(d);});
});}
const wchar_t* mc_content_string(void* h,std::uint64_t id,int field){if(!run(h,[&](Context& c){const auto& d=c.session.project().definition(id);c.text=wide(field==0?d.text:field==1?d.font:d.source);}))return L"";return ctx(h).text.c_str();}
int mc_layer(void* h,std::uint64_t id,int operation,const wchar_t* name){return run(h,[&](Context& c){
    c.manipulator.end(c.session);c.cycleEligible=false;
    c.session.edit([&](mycut::Project& p){auto& i=p.instance(id);
        if(operation==0){i.name=narrow(name);return;}
        if(operation==5){i.locked=!i.locked;return;}
        if(operation==6){auto copy=p.definition(i.definition);copy.id=p.nextId++;i.definition=copy.id;p.definitions.push_back(std::move(copy));return;}
        auto from=std::find_if(p.instances.begin(),p.instances.end(),[&](const auto& item){return item.id==id;});
        if(operation==1)std::rotate(from,from+1,p.instances.end());
        else if(operation==2)std::rotate(p.instances.begin(),from,from+1);
        else if(operation==3&&from+1!=p.instances.end())std::iter_swap(from,from+1);
        else if(operation==4&&from!=p.instances.begin())std::iter_swap(from,from-1);
        else if(operation<1||operation>4)throw std::runtime_error("Invalid layer operation");
    });
});}
int mc_grade_get(void* h,std::uint64_t id,MCGrade* out){return run(h,[&](Context& c){if(!out)throw std::runtime_error("Missing grade output");const auto& g=c.session.project().instance(id).grade;
    *out={g.exposure,g.contrast,g.saturation,g.temperature,g.tint,g.pivot,g.lift[0],g.lift[1],g.lift[2],g.gamma[0],g.gamma[1],g.gamma[2],g.gain[0],g.gain[1],g.gain[2],g.offset[0],g.offset[1],g.offset[2],g.grayscale?1:0,g.invert?1:0};
});}
int mc_grade_set(void* h,std::uint64_t id,const MCGrade* value){return run(h,[&](Context& c){if(!value)throw std::runtime_error("Missing color correction");const auto& v=*value;
    c.session.edit([&](mycut::Project& p){auto& i=p.instance(id);if(i.locked)throw std::runtime_error("Layer is locked");i.grade={v.exposure,v.contrast,v.saturation,v.temperature,v.tint,v.pivot,{v.liftR,v.liftG,v.liftB},{v.gammaR,v.gammaG,v.gammaB},{v.gainR,v.gainG,v.gainB},{v.offsetR,v.offsetG,v.offsetB},v.grayscale!=0,v.invert!=0};});
});}
int mc_scope_frame(void* h,std::uint8_t* pixels,int capacity,int* width,int* height){return run(h,[&](Context& c){
    if(!width||!height)throw std::runtime_error("Missing scope dimensions");*width=320;*height=180;if(!pixels||capacity==0)return;
    if(capacity<320*180*4)throw std::runtime_error("Scope pixel buffer too small");
    if(!c.scopeRenderer){c.scopeWindow=CreateWindowExW(0,L"STATIC",L"MyCut scopes",WS_POPUP,0,0,320,180,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);if(!c.scopeWindow)throw std::runtime_error("Cannot create scope target");
        c.scopeRenderer=mycut::createD3D11Renderer(c.scopeWindow,c.renderer?c.renderer->stats().software:true);}
    mycut::InputAppearance appearance;appearance.timeline=c.timelineEnabled;appearance.frame=c.timelineFrame;appearance.synchronousMedia=true;c.scopeRenderer->draw(c.session.project(),0,0,1,0,-1,appearance);auto frame=c.scopeRenderer->capture();std::copy(frame.pixels.begin(),frame.pixels.end(),pixels);
});}
int mc_sample_color(void* h,float x,float y,float* red,float* green,float* blue){return run(h,[&](Context& c){if(!red||!green||!blue||!std::isfinite(x)||!std::isfinite(y)||x<0||y<0||x>=1280||y>=720)throw std::runtime_error("Sample is outside the composition");
    if(!c.sampleRenderer){c.sampleWindow=CreateWindowExW(0,L"STATIC",L"MyCut color sample",WS_POPUP,0,0,1280,720,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);if(!c.sampleWindow)throw std::runtime_error("Cannot create color sampling target");c.sampleRenderer=mycut::createD3D11Renderer(c.sampleWindow,c.renderer?c.renderer->stats().software:true);}
    mycut::InputAppearance clean;clean.timeline=c.timelineEnabled;clean.frame=c.timelineFrame;clean.synchronousMedia=true;c.sampleRenderer->draw(c.session.project(),0,0,1,0,-1,clean);auto image=c.sampleRenderer->capture();auto offset=(static_cast<std::size_t>(y)*1280+static_cast<std::size_t>(x))*4;*red=image.pixels[offset+2]/255.f;*green=image.pixels[offset+1]/255.f;*blue=image.pixels[offset]/255.f;
});}
std::uint64_t mc_import_video(void* h,const wchar_t* path){std::uint64_t result=0;int success=run(h,[&](Context& c){auto absolute=std::filesystem::absolute(path);auto info=mycut::probeVideo(absolute);
    c.session.edit([&](mycut::Project& p){mycut::Definition d;d.id=p.nextId++;d.name=utf8(absolute.filename());d.source=utf8(absolute);d.kind=mycut::DefinitionKind::Video;d.width=static_cast<float>(info.width);d.height=static_cast<float>(info.height);d.mediaDuration=info.duration;d.mediaRateNumerator=info.rateNumerator;d.mediaRateDenominator=info.rateDenominator;
        result=p.nextId++;float scale=std::min(1.f,std::min(1280.f/d.width,720.f/d.height));p.instances.push_back({result,d.id,d.name,{640,360,scale,scale,0,1},true});p.definitions.push_back(std::move(d));});
});return success?result:0;}
int mc_media_info(void* h,std::uint64_t id,double* duration,int* num,int* den){return run(h,[&](Context& c){if(!duration||!num||!den)throw std::runtime_error("Missing media info output");const auto& d=c.session.project().definition(id);*duration=d.mediaDuration;*num=d.mediaRateNumerator;*den=d.mediaRateDenominator;});}
int mc_pending(void* h){return h&&ctx(h).renderer?static_cast<int>(ctx(h).renderer->stats().pending+ctx(h).renderer->stats().presentationPending):0;}
int mc_timeline_info(void* h,int* num,int* den,std::int64_t* in,std::int64_t* out){return run(h,[&](Context& c){if(!num||!den||!in||!out)throw std::runtime_error("Missing timeline output");const auto& t=c.session.project().timeline;*num=t.rateNumerator;*den=t.rateDenominator;*in=t.rangeIn;*out=t.rangeOut;});}
int mc_track_count(void* h){return h?static_cast<int>(ctx(h).session.project().timeline.tracks.size()):0;}
int mc_clip_count(void* h){return h?static_cast<int>(ctx(h).session.project().timeline.clips.size()):0;}
int mc_track_get(void* h,int index,MCTrack* value){return run(h,[&](Context& c){if(!value||index<0)throw std::runtime_error("Invalid track index");const auto& t=c.session.project().timeline.tracks.at(index);*value={t.id,t.muted?1:0,t.locked?1:0};});}
const wchar_t* mc_track_name(void* h,std::uint64_t id){if(!run(h,[&](Context& c){for(const auto& t:c.session.project().timeline.tracks)if(t.id==id){c.text=wide(t.name);return;}throw std::runtime_error("Missing track");}))return L"";return ctx(h).text.c_str();}
int mc_clip_get(void* h,int index,MCClip* value){return run(h,[&](Context& c){if(!value||index<0)throw std::runtime_error("Invalid clip index");const auto& t=c.session.project().timeline.clips.at(index);*value={t.id,t.instance,t.track,t.start,t.duration,t.sourceIn,t.fadeIn,t.fadeOut,t.speed,t.muted?1:0};});}
std::uint64_t mc_track_add(void* h,const wchar_t* name){std::uint64_t id=0;int success=run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){id=mycut::addTrack(p,narrow(name));});});return success?id:0;}
std::uint64_t mc_clip_add(void* h,std::uint64_t instance,std::uint64_t track,std::int64_t start,std::int64_t duration){std::uint64_t id=0;int success=run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){id=mycut::addClip(p,instance,track,start,duration);});});return success?id:0;}
int mc_clip_set(void* h,const MCClip* value){return run(h,[&](Context& c){if(!value)throw std::runtime_error("Missing clip value");c.session.edit([&](mycut::Project& p){for(auto& clip:p.timeline.clips)if(clip.id==value->id){if(clip.instance!=value->instance)throw std::runtime_error("Cannot replace clip identity");for(const auto& track:p.timeline.tracks)if((track.id==clip.track||track.id==value->track)&&track.locked)throw std::runtime_error("Track is locked");clip={value->id,value->instance,value->track,value->start,value->duration,value->sourceIn,value->fadeIn,value->fadeOut,value->speed,value->muted!=0};return;}throw std::runtime_error("Missing clip");});});}
std::uint64_t mc_clip_split(void* h,std::uint64_t id,std::int64_t frame){std::uint64_t result=0;int success=run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){result=mycut::splitClip(p,id,frame);});});return success?result:0;}
int mc_clip_remove(void* h,std::uint64_t id,int ripple){return run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){mycut::removeClip(p,id,ripple!=0);});});}
int mc_track_set(void* h,const MCTrack* value){return run(h,[&](Context& c){if(!value)throw std::runtime_error("Missing track value");c.session.edit([&](mycut::Project& p){for(auto& track:p.timeline.tracks)if(track.id==value->id){track.muted=value->muted!=0;track.locked=value->locked!=0;return;}throw std::runtime_error("Missing track");});});}
int mc_timeline_range(void* h,std::int64_t in,std::int64_t out){return run(h,[&](Context& c){c.session.edit([&](mycut::Project& p){p.timeline.rangeIn=in;p.timeline.rangeOut=out;});});}
int mc_timeline_preview(void* h,int enabled,std::int64_t frame){return run(h,[&](Context& c){if(frame<0||frame>1000000000)throw std::runtime_error("Invalid playhead");c.timelineEnabled=enabled!=0;c.timelineFrame=frame;});}
const wchar_t* mc_project_text(void* h){if(!run(h,[](Context& c){std::ostringstream text;mycut::serialize(c.session.project(),text);c.text=wide(text.str());}))return L"";return ctx(h).text.c_str();}
int mc_movie_export(const wchar_t* text,const wchar_t* path,std::int64_t first,std::int64_t count,int software,MCExportProgress progress,wchar_t* error,int capacity){try{std::istringstream input(narrow(text));auto p=mycut::deserialize(input);mycut::exportMovie(p,path,first,count,software!=0,[&](auto done,auto total){return !progress||progress(done,total)!=0;});return 1;}catch(const std::exception& ex){if(error&&capacity>0){auto message=wide(ex.what());wcsncpy_s(error,capacity,message.c_str(),_TRUNCATE);}return 0;}}
int mc_graph_info(void* h,std::uint64_t owner,int* enabled,std::uint64_t* output){return run(h,[&](Context& c){if(!enabled||!output)throw std::runtime_error("Missing graph info output");const auto& g=c.session.project().instance(owner).graph;*enabled=g.enabled?1:0;*output=g.output;});}
int mc_graph_init(void* h,std::uint64_t owner,int example){return run(h,[&](Context& c){c.session.edit([&](auto& p){mycut::initializeGraph(p,owner,example!=0);});});}
int mc_graph_enabled(void* h,std::uint64_t owner,int enabled){return run(h,[&](Context& c){c.session.edit([&](auto& p){p.instance(owner).graph.enabled=enabled!=0;});});}
int mc_node_count(void* h,std::uint64_t owner){int count=0;if(!run(h,[&](Context& c){count=static_cast<int>(c.session.project().instance(owner).graph.nodes.size());}))return -1;return count;}
int mc_node_get(void* h,std::uint64_t owner,int index,MCNode* value){return run(h,[&](Context& c){if(!value||index<0)throw std::runtime_error("Invalid node index");const auto& n=c.session.project().instance(owner).graph.nodes.at(index);*value={n.id,n.inputs[0],n.inputs[1],n.inputs[2],static_cast<int>(n.kind),static_cast<int>(n.type),n.x,n.y,n.values[0],n.values[1],n.values[2],n.values[3],n.values[4],n.values[5],n.values[6],n.values[7]};});}
std::uint64_t mc_node_add(void* h,std::uint64_t owner,int kind,float x,float y){std::uint64_t result=0;int success=run(h,[&](Context& c){c.session.edit([&](auto& p){result=mycut::addNode(p,owner,static_cast<mycut::NodeKind>(kind),x,y);});});return success?result:0;}
int mc_node_set(void* h,std::uint64_t owner,const MCNode* value){return run(h,[&](Context& c){
    if(!value)throw std::runtime_error("Missing node value");
    c.session.edit([&](auto& p){
        auto& layer=p.instance(owner);if(layer.locked)throw std::runtime_error("Layer is locked");
        for(const auto& clip:p.timeline.clips)if(clip.instance==owner)for(const auto& track:p.timeline.tracks)if(track.id==clip.track&&track.locked)throw std::runtime_error("Track is locked");
        auto& n=layer.graph.node(value->id);if(static_cast<int>(n.kind)!=value->kind)throw std::runtime_error("Cannot replace node kind");
        n.type=static_cast<mycut::ValueType>(value->type);n.x=value->x;n.y=value->y;
        n.values={value->v0,value->v1,value->v2,value->v3,value->v4,value->v5,value->v6,value->v7};
        if(n.kind==mycut::NodeKind::Exposure)mycut::LegacyParameterAdapter::write(n,mycut::ExposureStopsId,mycut::ParameterValue(static_cast<double>(value->v0)));
        n.inputs={value->input0,value->input1,value->input2};
    });
});}
int mc_node_remove(void* h,std::uint64_t owner,std::uint64_t id){return run(h,[&](Context& c){c.session.edit([&](auto& p){mycut::removeNode(p,owner,id);});});}
int mc_node_connect(void* h,std::uint64_t owner,std::uint64_t source,std::uint64_t target,int port){return run(h,[&](Context& c){c.session.edit([&](auto& p){mycut::connectNodes(p,owner,source,target,port);});});}
int mc_gesture(void* h,int phase){return run(h,[&](Context& c){
    if(phase==1)c.session.beginEdit();else if(phase==0)c.session.endEdit();else if(phase==2)c.session.cancelEdit();
    else throw std::runtime_error("Invalid gesture phase");
});}
int mc_undo(void* h,int redo){return run(h,[&](Context& c){if(redo)c.session.redo();else c.session.undo();});}
int mc_history(void* h,int redo){return h && (redo?ctx(h).session.canRedo():ctx(h).session.canUndo());}
std::uint64_t mc_duplicate(void* h,std::uint64_t id){std::uint64_t result=0;run(h,[&](Context& c){result=c.session.duplicate(id);});return result;}
int mc_remove(void* h,std::uint64_t id){return run(h,[&](Context& c){c.session.remove(id);});}
int mc_reset(void* h){return run(h,[](Context& c){c.manipulator.cancel(c.session);c.zoneMemory.clear();c.cycleEligible=false;c.session.replace(mycut::demoProject());});}
int mc_new(void* h){return run(h,[](Context& c){c.manipulator.cancel(c.session);c.zoneMemory.clear();c.cycleEligible=false;c.session.replace(mycut::Project{});});}
int mc_workbench(void* h){return run(h,[](Context& c){c.manipulator.cancel(c.session);c.zoneMemory.clear();c.cycleEligible=false;c.session.replace(mycut::workbenchProject());});}
int mc_save(void* h,const wchar_t* path){return run(h,[&](Context& c){c.session.endEdit();mycut::saveProject(c.session.project(),path);});}
int mc_load(void* h,const wchar_t* path){return run(h,[&](Context& c){
    auto project=mycut::loadProject(path);
    // Preflight media before replacing the user's current document.
    for(const auto& d:project.definitions){if(d.kind==mycut::DefinitionKind::Image&&!d.source.empty())(void)mycut::readImage(mycut::utf8Path(d.source));else if(d.kind==mycut::DefinitionKind::Video)(void)mycut::probeVideo(mycut::utf8Path(d.source));}
    c.manipulator.cancel(c.session);c.zoneMemory.clear();c.cycleEligible=false;c.session.replace(std::move(project));
});}
std::uint64_t mc_import(void* h,const wchar_t* path){std::uint64_t result=0;int success=run(h,[&](Context& c){
    auto absolute=std::filesystem::absolute(path);auto image=mycut::readImage(absolute);
    c.session.edit([&](mycut::Project& p){
        auto d=p.nextId++;result=p.nextId++;
        float scale=std::min(1.f,600.f/static_cast<float>(image.width));
        scale=std::min(scale,500.f/static_cast<float>(image.height));
        p.definitions.push_back({d,utf8(absolute.filename()),utf8(absolute),static_cast<float>(image.width),static_cast<float>(image.height),1,1,1});
        p.instances.push_back({result,d,utf8(absolute.stem()),{640,360,scale,scale,0,1},true});
    });
});return success?result:0;}
int mc_export(void* h,const wchar_t* path,int viewportSize){return run(h,[&](Context& c){
    if(!c.renderer)throw std::runtime_error("Viewport is not attached");
    mycut::InputAppearance clean;clean.timeline=c.timelineEnabled;clean.frame=c.timelineFrame;clean.synchronousMedia=true;
    if(viewportSize){c.renderer->draw(c.session.project(),0,0,1,0,-1,clean);mycut::writePng(c.renderer->capture(),path);return;}
    // Independent final-size target; export never changes the editor viewport.
    HWND window=CreateWindowExW(0,L"STATIC",L"MyCut export",WS_POPUP,0,0,1280,720,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    if(!window)throw std::runtime_error("Cannot create export target");
    try {auto renderer=mycut::createD3D11Renderer(window,c.renderer->stats().software);renderer->draw(c.session.project(),0,0,1,0,-1,clean);mycut::writePng(renderer->capture(),path);renderer.reset();DestroyWindow(window);}
    catch(...){DestroyWindow(window);throw;}
});}
std::uint64_t mc_pick(void* h,float x,float y){return h?mycut::hitTest(ctx(h).session.project(),x,y):0;}
const wchar_t* mc_stats(void* h){if(!run(h,[](Context& c){
    auto stats=c.renderer?c.renderer->stats():mycut::RenderStats{};std::wostringstream text;
    text<<L"D3D11 / "<<(stats.software?L"WARP":L"GPU")<<L"  ·  "<<stats.textureCount<<L" textures  ·  "
        <<std::fixed<<std::setprecision(2)<<stats.textureBytes/(1024.0*1024.0)<<L" MiB  ·  CPU submit "<<stats.cpuMilliseconds<<L" ms";
    c.text=text.str();}))return L"";return ctx(h).text.c_str();}
int mc_feedback(void* h,std::uint64_t hovered,float selection,float hover,int hoveredHandle){return run(h,[&](Context& c){
    if(!std::isfinite(selection)||!std::isfinite(hover))throw std::runtime_error("Invalid presentation state");
    c.hovered=hovered;c.selectionProgress=std::clamp(selection,0.f,1.f);c.hoverProgress=std::clamp(hover,0.f,1.f);
    c.hoveredHandle=hoveredHandle;
});}
int mc_input_style(void* h,const MCInputStyle* style){return run(h,[&](Context& c){
    if(!style)throw std::runtime_error("Missing input style");
    const auto& s=*style;
    for(float value:{s.handleRadius,s.objectMargin,s.handleSize,s.frameWidth,s.pointerX,s.pointerY,s.directionX,s.directionY,s.expansion,s.speed,s.magnet,s.horizon,s.red,s.green,s.blue,s.settleX,s.settleY})
        if(!std::isfinite(value))throw std::runtime_error("Invalid input style");
    c.appearance={{std::clamp(s.handleRadius,8.f,72.f),std::clamp(s.objectMargin,0.f,72.f),std::clamp(s.handleSize,6.f,32.f),std::clamp(s.frameWidth,1.f,6.f)},
        {s.pointerX,s.pointerY},{{s.directionX,s.directionY},std::clamp(s.expansion,0.f,96.f)},std::max(0.f,s.speed),std::clamp(s.magnet,0.f,1.f),std::clamp(s.horizon,.1f,2.f),
        std::clamp(s.red,0.f,1.f),std::clamp(s.green,0.f,1.f),std::clamp(s.blue,0.f,1.f),s.debugFlags,s.settleId,{s.settleX,s.settleY}};
    c.appearance.options.zoneSpeed=c.zonePolicy.zoneSpeed;c.appearance.options.speedCoefficient=c.zonePolicy.speedCoefficient;c.appearance.options.influenceDistance=c.zonePolicy.influenceDistance;c.appearance.options.shrinkSpeed=c.zonePolicy.shrinkSpeed;c.appearance.options.speedThreshold=c.zonePolicy.speedThreshold;c.appearance.options.maximumExpansion=c.zonePolicy.maximumExpansion;
});}
int mc_zone_config(void* h,float speed,float coefficient,float influence,float shrink,float threshold,float maximum){return run(h,[&](Context& c){for(float v:{speed,coefficient,influence,shrink,threshold,maximum})if(!std::isfinite(v))throw std::runtime_error("Invalid zone policy");c.zonePolicy.zoneSpeed=std::max(0.f,speed);c.zonePolicy.speedCoefficient=std::clamp(coefficient,0.f,.5f);c.zonePolicy.influenceDistance=std::clamp(influence,24.f,640.f);c.zonePolicy.shrinkSpeed=std::clamp(shrink,1.f,1000.f);c.zonePolicy.speedThreshold=std::clamp(threshold,0.f,1500.f);c.zonePolicy.maximumExpansion=std::clamp(maximum,0.f,96.f);});}
int mc_hit(void* h,std::uint64_t selected,float x,float y,float dipsPerUnit,float intentX,float intentY,float expansion,MCHit* result){return run(h,[&](Context& c){
    if(!result||!std::isfinite(x)||!std::isfinite(y)||!std::isfinite(dipsPerUnit)||!std::isfinite(intentX)||!std::isfinite(intentY)||!std::isfinite(expansion)||dipsPerUnit<=0||expansion<0)throw std::runtime_error("Invalid hit request");
    auto hit=resolve(c,selected,{x,y},dipsPerUnit,{{intentX,intentY},expansion});
    if(c.manipulator.active())hit={c.manipulator.id(),c.manipulator.tool(),c.manipulator.handle(),0};
    *result={hit.instance,static_cast<int>(hit.tool),hit.handle,hit.distance};
});}
int mc_pointer(void* h,int phase,std::uint64_t selected,float x,float y,float pixelsPerUnit,float intentX,float intentY,float expansion,int shift,std::uint64_t* result){return run(h,[&](Context& c){
    if(!result||!std::isfinite(x)||!std::isfinite(y)||!std::isfinite(pixelsPerUnit)||!std::isfinite(intentX)||!std::isfinite(intentY)||!std::isfinite(expansion)||pixelsPerUnit<=0||expansion<0)throw std::runtime_error("Invalid pointer event");
    *result=selected;
    switch(phase) {
        case 0: {
            auto hit=resolve(c,selected,{x,y},pixelsPerUnit,{{intentX,intentY},expansion});ULONGLONG now=GetTickCount64();
            c.clickPoint={x,y};c.clickTime=now;c.cycleEligible=hit.tool==mycut::Tool::Move;
            *result=c.manipulator.beginResolved(c.session,hit,{x,y},pixelsPerUnit);break;
        }
        case 1:if(std::hypot(x-c.clickPoint.x,y-c.clickPoint.y)*pixelsPerUnit>5)c.cycleEligible=false;c.manipulator.update(c.session,{x,y},shift!=0);break;
        case 2:c.manipulator.end(c.session);break;
        case 3:c.manipulator.cancel(c.session);break;
        default:throw std::runtime_error("Invalid pointer phase");
    }
});}
int mc_tool(void* h,std::uint64_t selected,float x,float y,float pixelsPerUnit){int tool=0;run(h,[&](Context& c){
    tool=static_cast<int>(c.manipulator.active()?c.manipulator.tool():c.manipulator.hover(c.session.project(),selected,{x,y},pixelsPerUnit));
});return tool;}
int mc_capture(void* h,const wchar_t* path){return run(h,[&](Context& c){
    if(!c.renderer)throw std::runtime_error("Viewport is not attached");
    mycut::writePng(c.renderer->capture(),path);
});}
int mc_handle(void* h,std::uint64_t selected,int index,float pixelsPerUnit,float* x,float* y){return run(h,[&](Context& c){
    if(!x||!y||index<0||index>12||pixelsPerUnit<=0)throw std::runtime_error("Invalid handle request");
    const auto& i=c.session.project().instance(selected);
    auto g=mycut::gizmo(c.session.project().definition(i.definition),i.transform,pixelsPerUnit);
    auto point=index<4?g.corners[index]:index<8?g.edges[index-4]:index==8?g.rotation:g.rotationZones[index-9];*x=point.x;*y=point.y;
});}
