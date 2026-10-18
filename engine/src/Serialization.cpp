#include "mycut/Project.h"
#include <fstream>
#include <iomanip>
#include <limits>
#include <stdexcept>
#include <unordered_set>
#ifdef _WIN32
#include <windows.h>
#endif

namespace mycut {
void serialize(const Project& p, std::ostream& out) {
    p.validate();
    out << "MYCUT 6\n" << p.nextId << ' ' << p.definitions.size() << ' ' << p.instances.size() << '\n';
    out << std::setprecision(std::numeric_limits<float>::max_digits10);
    auto color=[&](const Color& c){out<<c.red<<' '<<c.green<<' '<<c.blue<<' '<<c.alpha<<' ';};
    for (const auto& d : p.definitions) {
        out << d.id << ' ' << std::quoted(d.name) << ' ' << std::quoted(d.source) << ' '
            << d.width << ' ' << d.height << ' ' << d.red << ' ' << d.green << ' ' << d.blue << ' '
            <<static_cast<int>(d.kind)<<' '<<std::quoted(d.text)<<' '<<std::quoted(d.font)<<' '<<d.fontSize<<' '<<d.lineHeight<<' '<<d.fontWeight<<' '<<d.alignment<<' '<<d.italic<<' '<<d.underline<<' ';
        color(d.fill);color(d.second);color(d.stroke);out<<d.gradientAngle<<' '<<d.strokeWidth<<' '<<std::setprecision(17)<<d.mediaDuration<<' '<<d.mediaRateNumerator<<' '<<d.mediaRateDenominator<<std::setprecision(std::numeric_limits<float>::max_digits10)<<'\n';
    }
    for (const auto& i : p.instances) {
        const auto& t = i.transform;
        out << i.id << ' ' << i.definition << ' ' << std::quoted(i.name) << ' ' << t.x << ' ' << t.y << ' '
            << t.scaleX << ' ' << t.scaleY << ' ' << t.rotation << ' ' << t.opacity << ' ' << i.visible << ' ' <<i.locked<<' ';
        const auto& g=i.grade;out<<g.exposure<<' '<<g.contrast<<' '<<g.saturation<<' '<<g.temperature<<' '<<g.tint<<' '<<g.pivot<<' ';
        for(const auto& values:{g.lift,g.gamma,g.gain,g.offset})for(float value:values)out<<value<<' ';
        out<<g.grayscale<<' '<<g.invert<<'\n';
    }
    const auto& timeline=p.timeline;out<<"TIMELINE "<<timeline.rateNumerator<<' '<<timeline.rateDenominator<<' '<<timeline.rangeIn<<' '<<timeline.rangeOut<<' '<<timeline.tracks.size()<<' '<<timeline.clips.size()<<'\n';
    for(const auto& t:timeline.tracks)out<<t.id<<' '<<std::quoted(t.name)<<' '<<t.muted<<' '<<t.locked<<'\n';
    for(const auto& c:timeline.clips)out<<c.id<<' '<<c.instance<<' '<<c.track<<' '<<c.start<<' '<<c.duration<<' '<<c.sourceIn<<' '<<c.fadeIn<<' '<<c.fadeOut<<' '<<c.speed<<' '<<c.muted<<'\n';
    std::size_t graphs=0;for(const auto& i:p.instances)if(i.graph!=NodeGraph{})++graphs;out<<"GRAPHS "<<graphs<<'\n';
    for(const auto& i:p.instances){const auto& g=i.graph;if(g==NodeGraph{})continue;out<<i.id<<' '<<g.enabled<<' '<<g.output<<' '<<g.nodes.size()<<'\n';
        for(const auto& n:g.nodes){out<<n.id<<' '<<static_cast<int>(n.kind)<<' '<<static_cast<int>(n.type)<<' '<<n.x<<' '<<n.y<<' ';for(float value:n.values)out<<value<<' ';for(auto input:n.inputs)out<<input<<' ';out<<'\n';}}
    if (!out) throw std::runtime_error("Project write failed");
}
Project deserialize(std::istream& in) {
    std::string magic; unsigned version = 0; size_t definitions = 0, instances = 0;
    Project p;
    if (!(in >> magic >> version) || magic != "MYCUT" || version<1||version>6) throw std::runtime_error("Unsupported MyCut project version");
    if (!(in >> p.nextId >> definitions >> instances) || definitions > 10000 || instances > 10000)
        throw std::runtime_error("Invalid project counts");
    for (size_t n=0;n<definitions;++n) {
        Definition d;
        if (!(in >> d.id >> std::quoted(d.name) >> std::quoted(d.source) >> d.width >> d.height >> d.red >> d.green >> d.blue))
            throw std::runtime_error("Invalid Item Definition record");
        if(version>=3) {
            int kind;
            if(!(in>>kind>>std::quoted(d.text)>>std::quoted(d.font)>>d.fontSize>>d.lineHeight>>d.fontWeight>>d.alignment>>d.italic>>d.underline))throw std::runtime_error("Invalid generator record");
            d.kind=static_cast<DefinitionKind>(kind);
            for(auto color:{&d.fill,&d.second,&d.stroke})if(!(in>>color->red>>color->green>>color->blue>>color->alpha))throw std::runtime_error("Invalid generator color");
            if(!(in>>d.gradientAngle>>d.strokeWidth))throw std::runtime_error("Invalid generator properties");
            if(version>=5&&!(in>>d.mediaDuration>>d.mediaRateNumerator>>d.mediaRateDenominator))throw std::runtime_error("Invalid media properties");
        }
        p.definitions.push_back(std::move(d));
    }
    for (size_t n=0;n<instances;++n) {
        Instance i; auto& t = i.transform;
        if (!(in >> i.id >> i.definition >> std::quoted(i.name) >> t.x >> t.y >> t.scaleX)) throw std::runtime_error("Invalid Item Instance record");
        if (version==1) t.scaleY=t.scaleX;
        else if (!(in >> t.scaleY)) throw std::runtime_error("Invalid Item Instance record");
        if (!(in >> t.rotation >> t.opacity >> i.visible)) throw std::runtime_error("Invalid Item Instance record");
        if(version>=3&&!(in>>i.locked))throw std::runtime_error("Invalid layer lock state");
        if(version>=4){auto& g=i.grade;if(!(in>>g.exposure>>g.contrast>>g.saturation>>g.temperature>>g.tint>>g.pivot))throw std::runtime_error("Invalid primary color record");
            for(auto values:{&g.lift,&g.gamma,&g.gain,&g.offset})for(auto& value:*values)if(!(in>>value))throw std::runtime_error("Invalid color wheel record");
            if(!(in>>g.grayscale>>g.invert))throw std::runtime_error("Invalid color flags");}
        p.instances.push_back(std::move(i));
    }
    if(version>=5){std::string tag;std::size_t tracks=0,clips=0;auto& t=p.timeline;
        if(!(in>>tag>>t.rateNumerator>>t.rateDenominator>>t.rangeIn>>t.rangeOut>>tracks>>clips)||tag!="TIMELINE"||tracks>256||clips>10000)throw std::runtime_error("Invalid timeline record");
        for(std::size_t n=0;n<tracks;++n){Track track;if(!(in>>track.id>>std::quoted(track.name)>>track.muted>>track.locked))throw std::runtime_error("Invalid track record");t.tracks.push_back(std::move(track));}
        for(std::size_t n=0;n<clips;++n){Clip c;if(!(in>>c.id>>c.instance>>c.track>>c.start>>c.duration>>c.sourceIn>>c.fadeIn>>c.fadeOut>>c.speed>>c.muted))throw std::runtime_error("Invalid clip record");t.clips.push_back(c);}
    }
    if(version>=6){std::string tag;std::size_t count=0,total=0;std::unordered_set<Id> owners;
        if(!(in>>tag>>count)||tag!="GRAPHS"||count>instances)throw std::runtime_error("Invalid graph records");
        for(std::size_t n=0;n<count;++n){Id owner;bool enabled;Id output;std::size_t nodes;if(!(in>>owner>>enabled>>output>>nodes)||nodes>128||!owners.insert(owner).second||((total+=nodes)>8192))throw std::runtime_error("Invalid graph record");auto& g=p.instance(owner).graph;g.enabled=enabled;g.output=output;
            for(std::size_t k=0;k<nodes;++k){Node node;int kind,type;if(!(in>>node.id>>kind>>type>>node.x>>node.y))throw std::runtime_error("Invalid node record");node.kind=static_cast<NodeKind>(kind);node.type=static_cast<ValueType>(type);for(auto& value:node.values)if(!(in>>value))throw std::runtime_error("Invalid node value");for(auto& input:node.inputs)if(!(in>>input))throw std::runtime_error("Invalid node link");g.nodes.push_back(node);}}
    }
    in >> std::ws;
    if (!in.eof()) throw std::runtime_error("Unexpected project data");
    p.validate(); return p;
}
void saveProject(const Project& p, const std::filesystem::path& path) {
    auto temp = path; temp += ".writing";
    try {
        { std::ofstream out(temp, std::ios::binary | std::ios::trunc); serialize(p,out); out.flush(); if (!out) throw std::runtime_error("Project flush failed"); }
#ifdef _WIN32
        if (!MoveFileExW(temp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH))
            throw std::runtime_error("Cannot replace project file");
#else
        std::filesystem::rename(temp,path);
#endif
    } catch (...) { std::error_code error; std::filesystem::remove(temp,error); throw; }
}
Project loadProject(const std::filesystem::path& path) {
    if (std::filesystem::file_size(path) > 16 * 1024 * 1024) throw std::runtime_error("Project file exceeds 16 MiB bootstrap budget");
    std::ifstream in(path, std::ios::binary);
    if (!in) throw std::runtime_error("Cannot open project file");
    return deserialize(in);
}
}
