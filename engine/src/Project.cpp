#include "mycut/Project.h"
#include <algorithm>
#include <cmath>
#include <numbers>
#include <stdexcept>
#include <unordered_set>
#include <utility>

namespace mycut {
namespace {
void validText(const std::string& text) {
    for(std::size_t n=0;n<text.size();) {
        auto first=static_cast<unsigned char>(text[n++]);if(!first)throw std::runtime_error("Embedded NUL in project text");if(first<128)continue;
        unsigned value;int continuation;
        if(first>=0xc2&&first<=0xdf){value=first&31;continuation=1;}
        else if(first>=0xe0&&first<=0xef){value=first&15;continuation=2;}
        else if(first>=0xf0&&first<=0xf4){value=first&7;continuation=3;}
        else throw std::runtime_error("Invalid UTF-8 project text");
        if(n+continuation>text.size())throw std::runtime_error("Truncated UTF-8 project text");
        for(int c=0;c<continuation;++c){auto next=static_cast<unsigned char>(text[n++]);if((next&0xc0)!=0x80)throw std::runtime_error("Invalid UTF-8 continuation");value=(value<<6)|(next&63);}
        if((continuation==2&&value<0x800)||(continuation==3&&value<0x10000)||value>0x10ffff||(value>=0xd800&&value<=0xdfff))throw std::runtime_error("Invalid Unicode code point");
    }
}
}
const Definition& Project::definition(Id id) const {
    for (const auto& d : definitions) if (d.id == id) return d;
    throw std::runtime_error("Missing Item Definition");
}
Definition& Project::definition(Id id) { return const_cast<Definition&>(std::as_const(*this).definition(id)); }
const Instance& Project::instance(Id id) const {
    for (const auto& i : instances) if (i.id == id) return i;
    throw std::runtime_error("Missing Item Instance");
}
Instance& Project::instance(Id id) { return const_cast<Instance&>(std::as_const(*this).instance(id)); }
void Project::validate() const {
    if (definitions.size() > 10000 || instances.size() > 10000) throw std::runtime_error("Project exceeds bootstrap object budget");
    std::unordered_set<Id> ids;
    auto id = [&](Id value) {
        if (!value || value >= nextId || !ids.insert(value).second) throw std::runtime_error("Invalid or duplicate stable ID");
    };
    auto finite = [](float v) { if (!std::isfinite(v)) throw std::runtime_error("Non-finite parameter"); };
    for (const auto& d : definitions) {
        for(const auto* text:{&d.name,&d.source,&d.text,&d.font})validText(*text);
        id(d.id);
        for (float v : {d.width,d.height,d.red,d.green,d.blue}) finite(v);
        if (d.width <= 0 || d.height <= 0 || d.width > 16384 || d.height > 16384 ||
            d.red < 0 || d.red > 1 || d.green < 0 || d.green > 1 || d.blue < 0 || d.blue > 1)
            throw std::runtime_error("Invalid definition dimensions or tint");
        if(static_cast<int>(d.kind)<0||static_cast<int>(d.kind)>8||d.text.size()>65536||d.font.empty()||d.font.size()>512||d.fontWeight<100||d.fontWeight>900||d.alignment<0||d.alignment>2)
            throw std::runtime_error("Invalid text or generator properties");
        for(float value:{d.fontSize,d.lineHeight,d.gradientAngle,d.strokeWidth})finite(value);
        if(d.fontSize<6||d.fontSize>1024||d.lineHeight<.5f||d.lineHeight>4||d.strokeWidth<0||d.strokeWidth>512)throw std::runtime_error("Invalid text size or stroke");
        for(const auto& color:{d.fill,d.second,d.stroke})for(float value:{color.red,color.green,color.blue,color.alpha}){finite(value);if(value<0||value>1)throw std::runtime_error("Invalid generator color");}
        if(d.kind!=DefinitionKind::Image&&d.kind!=DefinitionKind::Video&&std::ceil(d.width)*std::ceil(d.height)>16.f*1024*1024)throw std::runtime_error("Generated layer exceeds 16 megapixels");
        if(!std::isfinite(d.mediaDuration)||d.mediaDuration<0||d.mediaDuration>864000||d.mediaRateNumerator<1||d.mediaRateNumerator>240000||d.mediaRateDenominator<1||d.mediaRateDenominator>10000)throw std::runtime_error("Invalid media timing");
        if(d.kind==DefinitionKind::Video&&(d.source.empty()||d.mediaDuration<=0))throw std::runtime_error("Missing video source or duration");
    }
    if(timeline.rateNumerator<1||timeline.rateNumerator>240000||timeline.rateDenominator<1||timeline.rateDenominator>10000||static_cast<double>(timeline.rateNumerator)/timeline.rateDenominator>240||static_cast<double>(timeline.rateNumerator)/timeline.rateDenominator<1||timeline.tracks.size()>256||timeline.clips.size()>10000||timeline.rangeIn<0||timeline.rangeIn>1000000000||timeline.rangeOut>1000000001||(timeline.rangeOut!=-1&&timeline.rangeOut<=timeline.rangeIn))throw std::runtime_error("Invalid timeline settings");
    std::unordered_set<Id> tracks,owners;
    for(const auto& track:timeline.tracks){id(track.id);validText(track.name);tracks.insert(track.id);}
    for(const auto& c:timeline.clips){id(c.id);(void)instance(c.instance);if(!tracks.contains(c.track)||!owners.insert(c.instance).second||c.start<0||c.duration<1||c.sourceIn<0||c.start>1000000000||c.duration>1000000000||c.sourceIn>1000000000||c.start+c.duration>1000000001||!std::isfinite(c.speed)||c.speed<.05f||c.speed>20||c.fadeIn<0||c.fadeOut<0||c.fadeIn>c.duration||c.fadeOut>c.duration)throw std::runtime_error("Invalid timeline clip");
        const auto& d=definition(instance(c.instance).definition);double available=std::ceil(d.mediaDuration*timeline.rateNumerator/timeline.rateDenominator-1e-5);
        if(d.kind==DefinitionKind::Video&&static_cast<double>(c.sourceIn)+static_cast<double>(c.duration-1)*c.speed>=available)throw std::runtime_error("Clip trim exceeds source duration");}
    std::size_t nodeCount=0;
    for (const auto& i : instances) {
        validText(i.name);
        id(i.id); (void)definition(i.definition);
        i.graph.validate();nodeCount+=i.graph.nodes.size();for(const auto& n:i.graph.nodes)id(n.id);if(nodeCount>8192)throw std::runtime_error("Project exceeds 8192 nodes");
        const auto& t = i.transform;
        for (float v : {t.x,t.y,t.scaleX,t.scaleY,t.rotation,t.opacity}) finite(v);
        if (std::abs(t.x) > 100000 || std::abs(t.y) > 100000 || t.scaleX < .01f || t.scaleX > 100 || t.scaleY < .01f || t.scaleY > 100 || t.opacity < 0 || t.opacity > 1)
            throw std::runtime_error("Invalid instance transform");
        const auto& g=i.grade;for(float value:{g.exposure,g.contrast,g.saturation,g.temperature,g.tint,g.pivot})finite(value);
        if(std::abs(g.exposure)>10||g.contrast<0||g.contrast>4||g.saturation<0||g.saturation>4||std::abs(g.temperature)>1||std::abs(g.tint)>1||g.pivot<0||g.pivot>1)throw std::runtime_error("Invalid primary color correction");
        for(int n=0;n<3;++n){for(float value:{g.lift[n],g.gamma[n],g.gain[n],g.offset[n]})finite(value);if(std::abs(g.lift[n])>1||g.gamma[n]<.01f||g.gamma[n]>4||g.gain[n]<0||g.gain[n]>8||std::abs(g.offset[n])>1)throw std::runtime_error("Invalid color wheel value");}
    }
}
Project demoProject() {
    Project p;
    p.definitions.push_back({1,"MyCut / Studio card","",480,300,1,1,1});
    p.instances.push_back({2,1,"Studio card / A",{410,340,1,1,-12,1},true});
    p.instances.push_back({3,1,"Studio card / B",{830,295,.75f,.75f,14,.95f},true});
    p.instances.push_back({4,1,"Studio card / C",{770,525,.5f,.5f,-5,.8f},true});
    p.nextId = 5;
    return p;
}
Project workbenchProject() {
    Project p;
    Definition background;background.id=1;background.name="Background / gradient";background.kind=DefinitionKind::LinearGradient;background.width=1280;background.height=720;
    background.fill={.035f,.065f,.12f,1};background.second={.12f,.28f,.40f,1};background.gradientAngle=35;p.definitions.push_back(background);p.instances.push_back({2,1,"Background",{},true,true});
    Definition card;card.id=3;card.name="Studio image";p.definitions.push_back(card);p.instances.push_back({4,3,"Studio image",{470,450,.9f,.9f,-8,1},true});
    Definition text;text.id=5;text.name="Workbench title";text.kind=DefinitionKind::Text;text.text="MyCut\nCreate. Shape. Color.";text.fontSize=64;text.fontWeight=700;text.width=860;text.height=160;
    text.fill={.85f,.96f,1,1};p.definitions.push_back(text);p.instances.push_back({6,5,"Editable Windows text",{640,145,1,1,0,1},true});
    Definition ellipse;ellipse.id=7;ellipse.name="Shape / ellipse";ellipse.kind=DefinitionKind::Ellipse;ellipse.width=ellipse.height=190;ellipse.fill={.96f,.67f,.20f,1};ellipse.strokeWidth=5;ellipse.stroke={.30f,.20f,.12f,1};
    p.definitions.push_back(ellipse);p.instances.push_back({8,7,"Ellipse",{955,430,1,1,0,1},true});p.nextId=9;return p;
}
std::vector<Plane> evaluateScene(const Project& p) {
    std::vector<Plane> planes;
    std::unordered_set<Id> owned;for(const auto& c:p.timeline.clips)owned.insert(c.instance);
    for (const auto& i : p.instances) {
        if (!i.visible||owned.contains(i.id)) continue;
        const auto& d = p.definition(i.definition);
        planes.push_back({i.id,d.id,i.transform,d.width,d.height,d.red,d.green,d.blue,i.grade});
    }
    return planes;
}
Id hitTest(const Project& p, float x, float y) {
    for (auto it = p.instances.rbegin(); it != p.instances.rend(); ++it) {
        if (!it->visible || it->locked || it->transform.opacity <= 0) continue;
        const auto& d = p.definition(it->definition);
        const auto& t = it->transform;
        float angle = t.rotation * std::numbers::pi_v<float> / 180;
        float dx = x-t.x, dy = y-t.y;
        float lx = (dx*std::cos(angle)+dy*std::sin(angle))/t.scaleX;
        float ly = (-dx*std::sin(angle)+dy*std::cos(angle))/t.scaleY;
        if (std::abs(lx) <= d.width/2 && std::abs(ly) <= d.height/2) return it->id;
    }
    return 0;
}
}
