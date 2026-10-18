#pragma once
#include <cstdint>
#include <filesystem>
#include <iosfwd>
#include <string>
#include <string_view>
#include <vector>
#include <array>
#include "Timeline.h"
#include "Nodes.h"

namespace mycut {
using Id = std::uint64_t;
inline std::filesystem::path utf8Path(std::string_view text) {
    return std::filesystem::path(std::u8string(reinterpret_cast<const char8_t*>(text.data()),text.size()));
}
struct Transform {
    float x = 640, y = 360, scaleX = 1, scaleY = 1, rotation = 0, opacity = 1;
    bool operator==(const Transform&) const = default;
};
enum class DefinitionKind { Image=0,Text=1,Solid=2,LinearGradient=3,RadialGradient=4,Rectangle=5,Ellipse=6,Checker=7,Video=8 };
struct Color {
    float red=1,green=1,blue=1,alpha=1;
    bool operator==(const Color&)const=default;
};
struct Definition {
    Id id = 0;
    std::string name;
    std::string source; // UTF-8 path; empty = built-in procedural texture.
    float width = 480, height = 300;
    float red = 1, green = 1, blue = 1;
    DefinitionKind kind=DefinitionKind::Image;
    std::string text,font="Segoe UI";
    float fontSize=64,lineHeight=1.2f;
    int fontWeight=400,alignment=0;
    bool italic=false,underline=false;
    Color fill,second{.12f,.30f,.65f,1},stroke{0,0,0,1};
    float gradientAngle=0,strokeWidth=0;
    double mediaDuration=0;int mediaRateNumerator=30,mediaRateDenominator=1;
    bool operator==(const Definition&) const = default;
};
struct ColorGrade {
    float exposure=0,contrast=1,saturation=1,temperature=0,tint=0,pivot=.18f;
    std::array<float,3> lift{0,0,0},gamma{1,1,1},gain{1,1,1},offset{0,0,0};
    bool grayscale=false,invert=false;
    bool operator==(const ColorGrade&)const=default;
};
struct Instance {
    Id id = 0, definition = 0;
    std::string name;
    Transform transform;
    bool visible = true;
    bool locked=false;
    ColorGrade grade;
    NodeGraph graph;
    bool operator==(const Instance&) const = default;
};
struct Project {
    Id nextId = 1;
    std::vector<Definition> definitions;
    std::vector<Instance> instances; // Explicit bottom-to-top composite order.
    Timeline timeline;
    const Definition& definition(Id id) const;
    Definition& definition(Id id);
    const Instance& instance(Id id) const;
    Instance& instance(Id id);
    void validate() const;
    bool operator==(const Project&) const = default;
};
Project demoProject();
Project workbenchProject();
void serialize(const Project&, std::ostream&);
Project deserialize(std::istream&);
void saveProject(const Project&, const std::filesystem::path&);
Project loadProject(const std::filesystem::path&);
// Platform-neutral presentation snapshot. No graphics API handles in the model.
struct Plane {
    Id instance, definition;
    Transform transform;
    float width, height, red, green, blue;
    ColorGrade grade;
    double sourceSeconds=0;
};
std::vector<Plane> evaluateScene(const Project&);
std::vector<Plane> evaluateTimeline(const Project&,Frame);
Id hitTest(const Project&, float canvasX, float canvasY);
}
