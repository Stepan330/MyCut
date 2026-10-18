#pragma once
#include "mycut/Project.h"
#include "mycut/Interaction.h"
#include <memory>
#include <span>
#include <windows.h>

namespace mycut {
struct Image { unsigned width=0,height=0; std::vector<std::uint8_t> pixels; };
Image readImage(const std::filesystem::path&);
Image generateImage(const Definition&);
void fitText(Definition&);
std::string textureKey(const Definition&);
void writePng(const Image&, const std::filesystem::path&);
struct RenderStats { double cpuMilliseconds=0; unsigned textureCount=0; std::uint64_t textureBytes=0; bool software=false; unsigned pending=0,presentationPending=0; };
struct InputAppearance {
    InteractionOptions options;
    Point pointer{-10000,-10000};IntentHint intent;
    float speed=0,magnet=.65f,horizon=1;
    float red=.06f,green=.78f,blue=.85f;
    int debugFlags=0;
    Id settleId=0;Point settleOffset;
    bool timeline=false;Frame frame=0;bool synchronousMedia=false;
    Id maskNode=0;
    Id editingText=0; // Presentation only: WPF owns the live caret/selection overlay.
};
class Renderer {
public:
    virtual ~Renderer() = default;
    virtual void resize(unsigned width,unsigned height) = 0;
    virtual void draw(const Project&, Id selected=0, Id hovered=0,float selectionProgress=1,float hoverProgress=0,int hoveredHandle=-1,const InputAppearance& appearance={}) = 0;
    virtual Image capture() = 0; // BGRA8 sRGB; synchronous, explicit readback path.
    virtual void* sharedSurface() = 0; // Borrowed IDirect3DSurface9 for WPF presentation; null = readback fallback.
    virtual RenderStats stats() const = 0;
};
std::unique_ptr<Renderer> createD3D11Renderer(HWND, bool software=false);
}
