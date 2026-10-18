#include "mycut/Renderer.h"
#include <d2d1.h>
#include <dwrite.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <numbers>
#include <sstream>
#include <stdexcept>

namespace mycut {
using Microsoft::WRL::ComPtr;
namespace {
void check(HRESULT hr,const char* message){if(FAILED(hr))throw std::runtime_error(message);}
std::wstring wide(const std::string& text) {
    if(text.empty())return {};
    int length=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),nullptr,0);
    if(length<=0)throw std::runtime_error("Invalid UTF-8 text");
    std::wstring result(length,0);MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),result.data(),length);return result;
}
std::uint8_t byte(float value){return static_cast<std::uint8_t>(std::round(std::clamp(value,0.f,1.f)*255));}
float linear(float value){return value<=.04045f?value/12.92f:std::pow((value+.055f)/1.055f,2.4f);}
float srgb(float value){return value<=.0031308f?value*12.92f:1.055f*std::pow(value,1/2.4f)-.055f;}
}
std::string textureKey(const Definition& d) {
    std::ostringstream key;key<<std::setprecision(std::numeric_limits<float>::max_digits10)<<std::quoted(d.source)<<' '<<static_cast<int>(d.kind);
    if(d.kind==DefinitionKind::Image)return key.str();
    key<<' '<<d.width<<' '<<d.height<<' '<<std::quoted(d.text)<<' '<<std::quoted(d.font)<<' '<<d.fontSize<<' '<<d.lineHeight<<' '<<d.fontWeight<<' '<<d.alignment<<' '<<d.italic<<' '<<d.underline;
    for(const auto& c:{d.fill,d.second,d.stroke})key<<' '<<c.red<<' '<<c.green<<' '<<c.blue<<' '<<c.alpha;
    key<<' '<<d.gradientAngle<<' '<<d.strokeWidth;return key.str();
}
void fitText(Definition& d) {
    if(d.kind!=DefinitionKind::Text||d.fontSize<6||d.fontSize>1024||!std::isfinite(d.fontSize))return;
    ComPtr<IDWriteFactory> fonts;check(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,__uuidof(IDWriteFactory),reinterpret_cast<IUnknown**>(fonts.GetAddressOf())),"Cannot measure text");
    auto family=wide(d.font),text=wide(d.text);ComPtr<IDWriteTextFormat> format;
    check(fonts->CreateTextFormat(family.c_str(),nullptr,static_cast<DWRITE_FONT_WEIGHT>(d.fontWeight),d.italic?DWRITE_FONT_STYLE_ITALIC:DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,d.fontSize,L"en-us",&format),"Cannot measure font");
    check(format->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP),"Cannot set text wrapping");
    check(format->SetLineSpacing(DWRITE_LINE_SPACING_METHOD_UNIFORM,d.fontSize*d.lineHeight,d.fontSize*.9f),"Cannot measure line spacing");
    ComPtr<IDWriteTextLayout> layout;check(fonts->CreateTextLayout(text.c_str(),static_cast<UINT32>(text.size()),format.Get(),16384,16384,&layout),"Cannot measure text layout");
    DWRITE_TEXT_METRICS metrics{};DWRITE_OVERHANG_METRICS overhang{};check(layout->GetMetrics(&metrics),"Cannot read text metrics");check(layout->GetOverhangMetrics(&overhang),"Cannot read glyph overhang");
    d.width=std::max(d.width,std::ceil(metrics.widthIncludingTrailingWhitespace+std::max(0.f,overhang.left)+std::max(0.f,overhang.right)+4));
    d.height=std::max(d.height,std::ceil(metrics.height+std::max(0.f,overhang.top)+std::max(0.f,overhang.bottom)+4));
}
Image generateImage(const Definition& d) {
    unsigned width=static_cast<unsigned>(std::ceil(d.width)),height=static_cast<unsigned>(std::ceil(d.height));
    if(static_cast<std::uint64_t>(width)*height>16ull*1024*1024)throw std::runtime_error("Generated layer exceeds 16 megapixels");
    Image image{width,height,{}};image.pixels.resize(static_cast<std::size_t>(width)*height*4);
    if(d.kind==DefinitionKind::Text) {
        ComPtr<IWICImagingFactory> wic;check(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&wic)),"Cannot create text bitmap factory");
        ComPtr<IWICBitmap> bitmap;check(wic->CreateBitmap(width,height,GUID_WICPixelFormat32bppPBGRA,WICBitmapCacheOnLoad,&bitmap),"Cannot create text bitmap");
        ComPtr<ID2D1Factory> drawing;check(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED,drawing.GetAddressOf()),"Cannot create text drawing factory");
        ComPtr<ID2D1RenderTarget> target;auto props=D2D1::RenderTargetProperties(D2D1_RENDER_TARGET_TYPE_SOFTWARE,D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM,D2D1_ALPHA_MODE_PREMULTIPLIED),96,96);
        check(drawing->CreateWicBitmapRenderTarget(bitmap.Get(),props,&target),"Cannot attach text bitmap");
        ComPtr<IDWriteFactory> fonts;check(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,__uuidof(IDWriteFactory),reinterpret_cast<IUnknown**>(fonts.GetAddressOf())),"Cannot create Windows font factory");
        auto family=wide(d.font),text=wide(d.text);ComPtr<IDWriteTextFormat> format;
        check(fonts->CreateTextFormat(family.c_str(),nullptr,static_cast<DWRITE_FONT_WEIGHT>(d.fontWeight),d.italic?DWRITE_FONT_STYLE_ITALIC:DWRITE_FONT_STYLE_NORMAL,DWRITE_FONT_STRETCH_NORMAL,d.fontSize,L"en-us",&format),"Cannot create Windows text format");
        auto alignment=d.alignment==1?DWRITE_TEXT_ALIGNMENT_CENTER:d.alignment==2?DWRITE_TEXT_ALIGNMENT_TRAILING:DWRITE_TEXT_ALIGNMENT_LEADING;
        check(format->SetTextAlignment(alignment),"Cannot align text");
        check(format->SetLineSpacing(DWRITE_LINE_SPACING_METHOD_UNIFORM,d.fontSize*d.lineHeight,d.fontSize*.9f),"Cannot set line spacing");
        ComPtr<IDWriteTextLayout> layout;check(fonts->CreateTextLayout(text.c_str(),static_cast<UINT32>(text.size()),format.Get(),d.width,d.height,&layout),"Cannot shape text");
        if(d.underline)check(layout->SetUnderline(TRUE,DWRITE_TEXT_RANGE{0,static_cast<UINT32>(text.size())}),"Cannot underline text");
        ComPtr<ID2D1SolidColorBrush> brush;check(target->CreateSolidColorBrush(D2D1::ColorF(d.fill.red,d.fill.green,d.fill.blue,d.fill.alpha),&brush),"Cannot create text brush");
        target->SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE);target->BeginDraw();target->Clear(D2D1::ColorF(0,0,0,0));
        target->DrawTextLayout(D2D1::Point2F(0,0),layout.Get(),brush.Get(),D2D1_DRAW_TEXT_OPTIONS_CLIP);check(target->EndDraw(),"Cannot draw text");
        check(bitmap->CopyPixels(nullptr,width*4,static_cast<UINT>(image.pixels.size()),image.pixels.data()),"Cannot read text bitmap");
        // D2D uses premultiplied alpha; our source textures store straight sRGB alpha.
        for(std::size_t i=0;i<image.pixels.size();i+=4)if(auto alpha=image.pixels[i+3])for(int c=0;c<3;++c)image.pixels[i+c]=static_cast<std::uint8_t>(std::min(255,(image.pixels[i+c]*255+alpha/2)/alpha));
        return image;
    }
    float angle=d.gradientAngle*std::numbers::pi_v<float>/180;
    for(unsigned y=0;y<height;++y)for(unsigned x=0;x<width;++x) {
        float u=(x+.5f)/width,v=(y+.5f)/height,mix=0;Color color=d.fill;
        if(d.kind==DefinitionKind::LinearGradient)mix=std::clamp(.5f+(u-.5f)*std::cos(angle)+(v-.5f)*std::sin(angle),0.f,1.f);
        if(d.kind==DefinitionKind::RadialGradient)mix=std::clamp(std::hypot((u-.5f)*2,(v-.5f)*2),0.f,1.f);
        if(d.kind==DefinitionKind::Checker)mix=((x/24+y/24)%2)?1.f:0;
        if(mix>0)color={srgb(linear(d.fill.red)*(1-mix)+linear(d.second.red)*mix),srgb(linear(d.fill.green)*(1-mix)+linear(d.second.green)*mix),srgb(linear(d.fill.blue)*(1-mix)+linear(d.second.blue)*mix),d.fill.alpha*(1-mix)+d.second.alpha*mix};
        if(d.kind==DefinitionKind::Rectangle&&d.strokeWidth>0&&(x<d.strokeWidth||y<d.strokeWidth||x>=d.width-d.strokeWidth||y>=d.height-d.strokeWidth))color=d.stroke;
        if(d.kind==DefinitionKind::Ellipse) {
            float radius=std::hypot((u-.5f)*2,(v-.5f)*2);float edgeWidth=2/std::min(d.width,d.height);
            if(d.strokeWidth>0&&radius>1-d.strokeWidth*2/std::min(d.width,d.height))color=d.stroke;
            color.alpha*=std::clamp((1-radius)/edgeWidth+.5f,0.f,1.f);
        }
        auto i=(static_cast<std::size_t>(y)*width+x)*4;image.pixels[i]=byte(color.blue);image.pixels[i+1]=byte(color.green);image.pixels[i+2]=byte(color.red);image.pixels[i+3]=byte(color.alpha);
    }
    return image;
}
}
