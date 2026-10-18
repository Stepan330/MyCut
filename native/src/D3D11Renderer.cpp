#include "mycut/Renderer.h"
#include "mycut/Interaction.h"
#include "mycut/Media.h"
#include "mycut/ZonePresentation.h"
#include <d3d11.h>
#include <d3d9.h>
#include <d3dcompiler.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstring>
#include <numbers>
#include <sstream>
#include <stdexcept>
#include <unordered_map>

namespace mycut {
using Microsoft::WRL::ComPtr;
namespace {
void checked(HRESULT hr,const char* operation) {
    if (FAILED(hr)) { std::ostringstream s;s<<operation<<" (HRESULT 0x"<<std::hex<<static_cast<unsigned>(hr)<<")";throw std::runtime_error(s.str()); }
}
ComPtr<IWICImagingFactory> wic() {
    ComPtr<IWICImagingFactory> factory;
    checked(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&factory)),"WIC factory");
    return factory;
}
Image studioTexture() {
    Image image{512,320,{}}; image.pixels.resize(image.width*image.height*4);
    for (unsigned y=0;y<image.height;++y) for(unsigned x=0;x<image.width;++x) {
        float u=static_cast<float>(x)/image.width,v=static_cast<float>(y)/image.height;
        float dx=u-.58f,dy=(v-.5f)*.625f, r=std::sqrt(dx*dx+dy*dy);
        bool ring=r>.15f && r<.215f;
        bool grid=(x%32==0 || y%32==0);
        bool bar=x>35 && x<140 && (y>75 && y<92 || y>105 && y<112 || y>125 && y<132);
        std::array<float,3> color{22+22*u,29+16*v,46+40*u};
        if(grid) for(auto& c:color)c+=10;
        if(ring) color={84+80*v,214-60*u,211};
        if(bar) color={192,211,223};
        if(y>280)color={43+80*u,91+90*u,112+60*u};
        auto index=(y*image.width+x)*4;
        image.pixels[index]=static_cast<std::uint8_t>(color[2]);image.pixels[index+1]=static_cast<std::uint8_t>(color[1]);
        image.pixels[index+2]=static_cast<std::uint8_t>(color[0]);image.pixels[index+3]=255;
    }
    return image;
}
struct Vertex { float x,y,u,v; };
struct alignas(16) Constants {
    float red,green,blue,alpha; float selected,pad[3];
    std::array<float,4> primary{0,1,1,0},balance{0,.18f,0,0},lift{0,0,0,0},gamma{1,1,1,0},gain{1,1,1,0},offset{0,0,0,0};
};
struct Texture { std::string source; ComPtr<ID3D11ShaderResourceView> view; std::uint64_t bytes=0; };
const char* shader=R"(
cbuffer Settings : register(b0) { float4 tint; float4 settings; float4 primary; float4 balance; float4 lift; float4 gamma; float4 gain; float4 offset; };
struct In { float2 position:POSITION; float2 uv:TEXCOORD; };
struct Out { float4 position:SV_POSITION; float2 uv:TEXCOORD; };
Out VS(In v) { Out o; o.position=float4(v.position,0,1);o.uv=v.uv;return o; }
Texture2D image:register(t0);SamplerState linearSampler:register(s0);
float4 PS(Out v):SV_TARGET {
    float4 c=image.Sample(linearSampler,v.uv)*tint;
    c.rgb*=exp2(primary.x);
    c.rgb*=float3(1+primary.w*.2,1+balance.x*.2,1-primary.w*.2);
    c.rgb=(c.rgb-balance.y)*primary.y+balance.y;
    c.rgb=pow(max(c.rgb*(1-lift.rgb)+lift.rgb,0),1/max(gamma.rgb,.01))*gain.rgb+offset.rgb;
    float luma=dot(c.rgb,float3(.2126,.7152,.0722));c.rgb=lerp(luma.xxx,c.rgb,primary.z);
    if(balance.z>0)c.rgb=luma.xxx;
    if(balance.w>0)c.rgb=1-c.rgb;
    if(settings.x>0) {
        c.rgb+=settings.x*.025;
        if(v.uv.x<settings.y || v.uv.x>1-settings.y || v.uv.y<settings.z || v.uv.y>1-settings.z)
            c=lerp(c,float4(.12,.6,.5,c.a),settings.x*.75);
    }
    return float4(c.rgb*c.a,c.a);
})";
class D3D11Renderer final: public Renderer {
public:
    explicit D3D11Renderer(HWND hwnd,bool software);
    void resize(unsigned,unsigned) override;
    void draw(const Project&,Id,Id,float,float,int,const InputAppearance&) override;
    Image capture() override;
    void* sharedSurface() override;
    RenderStats stats() const override { return stats_; }
private:
    Id zoneOwner_=0;
    std::array<ZonePresentation,13> zoneVisuals_{};
    std::chrono::steady_clock::time_point zoneFrame_=std::chrono::steady_clock::now();
    void target();
    Texture makeTexture(const Image&,std::string source);
    const Texture& texture(const Definition&,Id owner=0,double sourceSeconds=0,bool synchronous=false);
    Id textureId(const Plane& p,const Project& project)const{return project.definition(p.definition).kind==DefinitionKind::Video?p.instance:p.definition;}
    void plane(const Plane&,const Texture&,float hover,const NodeGraph& graph={});
    void submit(const std::array<Vertex,6>&,const Constants&,const Texture&,const NodeGraph* graph=nullptr);
    void graphShader(const NodeGraph*);
    void solid(const std::array<Point,4>&,float alpha);
    void line(Point,Point,float thickness,float alpha);
    void drawGizmo(const Definition&,const Transform&,float progress,int hoveredHandle,float hoverProgress,const InputAppearance&);
    float overlayRed_=.06f,overlayGreen_=.78f,overlayBlue_=.85f;
    void circle(Point,float radius,float thickness,float alpha);
    ComPtr<ID3D11Device> device_;
    ComPtr<ID3D11DeviceContext> context_;
    ComPtr<IDXGISwapChain> swap_;
    ComPtr<ID3D11Texture2D> frame_;
    ComPtr<ID3D11RenderTargetView> target_;
    ComPtr<IDirect3D9Ex> interop9_;
    ComPtr<IDirect3DDevice9Ex> interopDevice_;
    ComPtr<IDirect3DTexture9> interopTexture_;
    ComPtr<IDirect3DSurface9> interopSurface_;
    ComPtr<ID3D11Texture2D> sharedFrame_;
    ComPtr<ID3D11Query> sharedReady_;
    bool sharingUnavailable_=false;
    ComPtr<ID3D11VertexShader> vs_;
    ComPtr<ID3D11PixelShader> ps_;
    ComPtr<ID3D11InputLayout> layout_;
    ComPtr<ID3D11Buffer> vertices_,constants_,nodeConstants_;
    std::unordered_map<std::string,ComPtr<ID3D11PixelShader>> graphShaders_;
    ComPtr<ID3D11SamplerState> sampler_;
    ComPtr<ID3D11BlendState> blend_;
    ComPtr<ID3D11RasterizerState> raster_;
    std::unordered_map<Id,Texture> textures_;
    struct Decoder {std::string source;std::unique_ptr<VideoSource> video;};
    std::unordered_map<Id,Decoder> decoders_;
    Texture canvas_;
    unsigned width_=1,height_=1;
    RenderStats stats_;
    HWND window_;
};
D3D11Renderer::D3D11Renderer(HWND hwnd,bool software):window_(hwnd) {
    RECT bounds{};GetClientRect(hwnd,&bounds);
    width_=std::max(1L,bounds.right);height_=std::max(1L,bounds.bottom);
    DXGI_SWAP_CHAIN_DESC desc{};desc.BufferDesc.Width=width_;desc.BufferDesc.Height=height_;
    desc.BufferDesc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.SampleDesc.Count=1;
    desc.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;desc.BufferCount=2;desc.OutputWindow=hwnd;
    desc.Windowed=TRUE;desc.SwapEffect=DXGI_SWAP_EFFECT_DISCARD;
    const D3D_FEATURE_LEVEL levels[]{D3D_FEATURE_LEVEL_11_0};
    auto type=software?D3D_DRIVER_TYPE_WARP:D3D_DRIVER_TYPE_HARDWARE;
    auto result=D3D11CreateDeviceAndSwapChain(nullptr,type,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,levels,1,D3D11_SDK_VERSION,
        &desc,&swap_,&device_,nullptr,&context_);
    if(FAILED(result) && !software) {
        swap_.Reset();device_.Reset();context_.Reset();type=D3D_DRIVER_TYPE_WARP;
        result=D3D11CreateDeviceAndSwapChain(nullptr,type,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,levels,1,D3D11_SDK_VERSION,
            &desc,&swap_,&device_,nullptr,&context_);
    }
    checked(result,"Create Direct3D 11 device");stats_.software=type==D3D_DRIVER_TYPE_WARP;
    ComPtr<IDXGIFactory> factory;ComPtr<IDXGIDevice> dxgi;ComPtr<IDXGIAdapter> adapter;
    checked(device_.As(&dxgi),"DXGI device");checked(dxgi->GetAdapter(&adapter),"DXGI adapter");
    checked(adapter->GetParent(IID_PPV_ARGS(&factory)),"DXGI factory");
    checked(factory->MakeWindowAssociation(hwnd,DXGI_MWA_NO_ALT_ENTER),"Window association");
    ComPtr<ID3DBlob> vsCode,psCode,error;
    auto compile=[&](const char* entry,const char* profile,ComPtr<ID3DBlob>& code) {
        auto hr=D3DCompile(shader,std::strlen(shader),"MyCutPlane",nullptr,nullptr,entry,profile,D3DCOMPILE_ENABLE_STRICTNESS,0,&code,&error);
        if(FAILED(hr) && error) throw std::runtime_error(std::string(static_cast<char*>(error->GetBufferPointer()),error->GetBufferSize()));
        checked(hr,"Compile shader");
    };
    compile("VS","vs_5_0",vsCode);compile("PS","ps_5_0",psCode);
    checked(device_->CreateVertexShader(vsCode->GetBufferPointer(),vsCode->GetBufferSize(),nullptr,&vs_),"Vertex shader");
    checked(device_->CreatePixelShader(psCode->GetBufferPointer(),psCode->GetBufferSize(),nullptr,&ps_),"Pixel shader");
    D3D11_INPUT_ELEMENT_DESC elements[]={{"POSITION",0,DXGI_FORMAT_R32G32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"TEXCOORD",0,DXGI_FORMAT_R32G32_FLOAT,0,8,D3D11_INPUT_PER_VERTEX_DATA,0}};
    checked(device_->CreateInputLayout(elements,2,vsCode->GetBufferPointer(),vsCode->GetBufferSize(),&layout_),"Input layout");
    D3D11_BUFFER_DESC buffer{};buffer.ByteWidth=sizeof(Vertex)*6;buffer.Usage=D3D11_USAGE_DYNAMIC;
    buffer.BindFlags=D3D11_BIND_VERTEX_BUFFER;buffer.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
    checked(device_->CreateBuffer(&buffer,nullptr,&vertices_),"Vertex buffer");
    buffer.ByteWidth=sizeof(Constants);buffer.BindFlags=D3D11_BIND_CONSTANT_BUFFER;
    checked(device_->CreateBuffer(&buffer,nullptr,&constants_),"Constant buffer");
    buffer.ByteWidth=sizeof(float)*8*128;checked(device_->CreateBuffer(&buffer,nullptr,&nodeConstants_),"Graph parameter buffer");
    D3D11_SAMPLER_DESC sampler{};sampler.Filter=D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sampler.AddressU=sampler.AddressV=sampler.AddressW=D3D11_TEXTURE_ADDRESS_CLAMP;sampler.MaxLOD=D3D11_FLOAT32_MAX;
    checked(device_->CreateSamplerState(&sampler,&sampler_),"Sampler");
    D3D11_BLEND_DESC blend{};auto& b=blend.RenderTarget[0];b.BlendEnable=TRUE;
    b.SrcBlend=D3D11_BLEND_ONE;b.DestBlend=D3D11_BLEND_INV_SRC_ALPHA;b.BlendOp=D3D11_BLEND_OP_ADD;
    b.SrcBlendAlpha=D3D11_BLEND_ONE;b.DestBlendAlpha=D3D11_BLEND_INV_SRC_ALPHA;b.BlendOpAlpha=D3D11_BLEND_OP_ADD;
    b.RenderTargetWriteMask=D3D11_COLOR_WRITE_ENABLE_ALL;
    checked(device_->CreateBlendState(&blend,&blend_),"Blend state");
    D3D11_RASTERIZER_DESC raster{};raster.FillMode=D3D11_FILL_SOLID;raster.CullMode=D3D11_CULL_NONE;
    raster.DepthClipEnable=TRUE;checked(device_->CreateRasterizerState(&raster,&raster_),"Rasterizer");
    canvas_=makeTexture(Image{1,1,{255,255,255,255}},"");target();
}
void D3D11Renderer::target() {
    sharedFrame_.Reset();interopSurface_.Reset();interopTexture_.Reset();
    ComPtr<ID3D11Texture2D> buffer;checked(swap_->GetBuffer(0,IID_PPV_ARGS(&buffer)),"Backbuffer");
    D3D11_TEXTURE2D_DESC resource{};buffer->GetDesc(&resource);
    resource.Format=DXGI_FORMAT_B8G8R8A8_TYPELESS;
    resource.Usage=D3D11_USAGE_DEFAULT;resource.BindFlags=D3D11_BIND_RENDER_TARGET;resource.CPUAccessFlags=0;resource.MiscFlags=0;
    checked(device_->CreateTexture2D(&resource,nullptr,&frame_),"Frame target");
    D3D11_RENDER_TARGET_VIEW_DESC desc{};desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM_SRGB;desc.ViewDimension=D3D11_RTV_DIMENSION_TEXTURE2D;
    checked(device_->CreateRenderTargetView(frame_.Get(),&desc,&target_),"Render target");
}
void* D3D11Renderer::sharedSurface() {
    if(stats_.software||sharingUnavailable_)return nullptr;
    if(interopSurface_)return interopSurface_.Get();
    try {
        if(!interopDevice_){
            checked(Direct3DCreate9Ex(D3D_SDK_VERSION,&interop9_),"Create WPF surface device");
            ComPtr<IDXGIDevice> dxgi;ComPtr<IDXGIAdapter> adapter;DXGI_ADAPTER_DESC desc{};
            checked(device_.As(&dxgi),"Surface DXGI device");checked(dxgi->GetAdapter(&adapter),"Surface adapter");checked(adapter->GetDesc(&desc),"Surface adapter identity");
            UINT selected=D3DADAPTER_DEFAULT;bool found=false;
            for(UINT index=0;index<interop9_->GetAdapterCount();++index){LUID id{};if(SUCCEEDED(interop9_->GetAdapterLUID(index,&id))&&id.HighPart==desc.AdapterLuid.HighPart&&id.LowPart==desc.AdapterLuid.LowPart){selected=index;found=true;break;}}
            if(!found)throw std::runtime_error("No matching WPF GPU adapter");
            D3DPRESENT_PARAMETERS pp{};pp.Windowed=TRUE;pp.SwapEffect=D3DSWAPEFFECT_DISCARD;pp.hDeviceWindow=window_;pp.BackBufferWidth=pp.BackBufferHeight=1;pp.BackBufferFormat=D3DFMT_UNKNOWN;
            checked(interop9_->CreateDeviceEx(selected,D3DDEVTYPE_HAL,window_,D3DCREATE_HARDWARE_VERTEXPROCESSING|D3DCREATE_MULTITHREADED|D3DCREATE_FPU_PRESERVE,&pp,nullptr,&interopDevice_),"Create WPF interop device");
            D3D11_QUERY_DESC query{D3D11_QUERY_EVENT,0};checked(device_->CreateQuery(&query,&sharedReady_),"Surface completion query");
        }
        HANDLE shared=nullptr;
        checked(interopDevice_->CreateTexture(width_,height_,1,D3DUSAGE_RENDERTARGET,D3DFMT_A8R8G8B8,D3DPOOL_DEFAULT,&interopTexture_,&shared),"Create shared UI texture");
        checked(interopTexture_->GetSurfaceLevel(0,&interopSurface_),"Get WPF surface");
        checked(device_->OpenSharedResource(shared,IID_PPV_ARGS(&sharedFrame_)),"Open UI texture in D3D11");
        return interopSurface_.Get();
    }catch(const std::exception&){sharingUnavailable_=true;sharedFrame_.Reset();interopSurface_.Reset();interopTexture_.Reset();return nullptr;}
}
void D3D11Renderer::resize(unsigned width,unsigned height) {
    width=std::max(1u,width);height=std::max(1u,height);
    if(width==width_ && height==height_)return;
    context_->OMSetRenderTargets(0,nullptr,nullptr);target_.Reset();frame_.Reset();
    checked(swap_->ResizeBuffers(0,width,height,DXGI_FORMAT_UNKNOWN,0),"Resize viewport");
    width_=width;height_=height;target();
}
Texture D3D11Renderer::makeTexture(const Image& image,std::string source) {
    D3D11_TEXTURE2D_DESC desc{};desc.Width=image.width;desc.Height=image.height;desc.MipLevels=desc.ArraySize=1;
    desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM_SRGB;desc.SampleDesc.Count=1;desc.Usage=D3D11_USAGE_IMMUTABLE;desc.BindFlags=D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA data{image.pixels.data(),image.width*4,0};ComPtr<ID3D11Texture2D> resource;
    checked(device_->CreateTexture2D(&desc,&data,&resource),"Upload texture");
    Texture texture{std::move(source),{},static_cast<std::uint64_t>(image.pixels.size())};
    checked(device_->CreateShaderResourceView(resource.Get(),nullptr,&texture.view),"Texture view");return texture;
}
const Texture& D3D11Renderer::texture(const Definition& definition,Id owner,double sourceSeconds,bool synchronous) {
    auto key=textureKey(definition);
    Id cacheId=definition.kind==DefinitionKind::Video?owner:definition.id;
    std::shared_ptr<const Image> video;
    if(definition.kind==DefinitionKind::Video){auto it=decoders_.find(cacheId);if(it==decoders_.end()||it->second.source!=definition.source)it=decoders_.insert_or_assign(cacheId,Decoder{definition.source,std::make_unique<VideoSource>(utf8Path(definition.source))}).first;
        auto frame=it->second.video->frame(sourceSeconds,synchronous);if(frame.pending)++stats_.pending;video=frame.image;key+="/"+std::to_string(frame.key);}
    auto it=textures_.find(cacheId);
    if(it!=textures_.end() && it->second.source==key)return it->second;
    auto image=definition.kind==DefinitionKind::Video?(video?*video:Image{1,1,{15,10,8,255}}):definition.kind==DefinitionKind::Image?(definition.source.empty()?studioTexture():readImage(utf8Path(definition.source))):generateImage(definition);
    std::uint64_t bytes=image.pixels.size();
    for(auto& [id,t]:textures_)if(id!=cacheId)bytes+=t.bytes;
    if(bytes>256ull*1024*1024)throw std::runtime_error("Texture budget exceeded (256 MiB). Remove unused images or use smaller sources.");
    return textures_.insert_or_assign(cacheId,makeTexture(image,std::move(key))).first->second;
}
void D3D11Renderer::plane(const Plane& p,const Texture& texture,float hover,const NodeGraph& graph) {
    const auto& t=p.transform;float angle=t.rotation*std::numbers::pi_v<float>/180;
    auto point=[&](float u,float v) {
        float x=(u-.5f)*p.width*t.scaleX,y=(v-.5f)*p.height*t.scaleY;
        float px=t.x+x*std::cos(angle)-y*std::sin(angle),py=t.y+x*std::sin(angle)+y*std::cos(angle);
        return Vertex{px/640-1,1-py/360,u,v};
    };
    std::array<Vertex,6> vertices{point(0,0),point(1,0),point(1,1),point(0,0),point(1,1),point(0,1)};
    float viewScale=std::min(width_/1280.f,height_/720.f);
    Constants constants{p.red,p.green,p.blue,t.opacity,hover,{2/(p.width*t.scaleX*viewScale),2/(p.height*t.scaleY*viewScale),0}};
    const auto& g=p.grade;constants.primary={g.exposure,g.contrast,g.saturation,g.temperature};constants.balance={g.tint,g.pivot,g.grayscale?1.f:0.f,g.invert?1.f:0.f};
    constants.lift={g.lift[0],g.lift[1],g.lift[2],0};constants.gamma={g.gamma[0],g.gamma[1],g.gamma[2],0};constants.gain={g.gain[0],g.gain[1],g.gain[2],0};constants.offset={g.offset[0],g.offset[1],g.offset[2],0};
    submit(vertices,constants,texture,&graph);
}
void D3D11Renderer::graphShader(const NodeGraph* graph) {
    if(!graph||!graph->enabled||!graph->output){context_->PSSetShader(ps_.Get(),nullptr,0);return;}
    auto body=graphShaderBody(*graph);auto shaderIt=graphShaders_.find(body);
    if(shaderIt==graphShaders_.end()){
        std::string code="cbuffer NodeInputs:register(b1){float4 np[256];};\n"+std::string(shader);std::string anchor="float4 c=image.Sample(linearSampler,v.uv)*tint;";code.replace(code.find(anchor),anchor.size(),body);
        ComPtr<ID3DBlob> compiled,error;auto hr=D3DCompile(code.data(),code.size(),"MyCutGraph",nullptr,nullptr,"PS","ps_5_0",D3DCOMPILE_ENABLE_STRICTNESS,0,&compiled,&error);
        if(FAILED(hr)&&error)throw std::runtime_error(std::string(static_cast<char*>(error->GetBufferPointer()),error->GetBufferSize()));checked(hr,"Compile node graph");
        ComPtr<ID3D11PixelShader> ps;checked(device_->CreatePixelShader(compiled->GetBufferPointer(),compiled->GetBufferSize(),nullptr,&ps),"Node pixel shader");
        if(graphShaders_.size()>=64)graphShaders_.clear();shaderIt=graphShaders_.emplace(body,std::move(ps)).first;
    }
    std::array<std::array<float,8>,128> parameters{};auto order=executionOrder(*graph);for(std::size_t i=0;i<order.size();++i)parameters[i]=nodeParameterValues(graph->node(order[i]));
    D3D11_MAPPED_SUBRESOURCE map{};checked(context_->Map(nodeConstants_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map),"Map graph parameters");std::memcpy(map.pData,parameters.data(),sizeof(parameters));context_->Unmap(nodeConstants_.Get(),0);
    context_->PSSetConstantBuffers(1,1,nodeConstants_.GetAddressOf());context_->PSSetShader(shaderIt->second.Get(),nullptr,0);
}
void D3D11Renderer::submit(const std::array<Vertex,6>& vertices,const Constants& constants,const Texture& texture,const NodeGraph* graph) {
    graphShader(graph);
    D3D11_MAPPED_SUBRESOURCE map{};checked(context_->Map(vertices_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map),"Map vertices");
    std::memcpy(map.pData,vertices.data(),sizeof(vertices));context_->Unmap(vertices_.Get(),0);
    checked(context_->Map(constants_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map),"Map constants");
    std::memcpy(map.pData,&constants,sizeof(constants));context_->Unmap(constants_.Get(),0);
    context_->PSSetShaderResources(0,1,texture.view.GetAddressOf());context_->Draw(6,0);
}
void D3D11Renderer::solid(const std::array<Point,4>& points,float alpha) {
    float scale=std::min(width_/1280.f,height_/720.f);
    auto v=[&](int i){
        float x=points[i].x*scale+(width_-1280*scale)/2,y=points[i].y*scale+(height_-720*scale)/2;
        return Vertex{x*2/width_-1,1-y*2/height_,0,0};
    };
    submit({v(0),v(1),v(2),v(0),v(2),v(3)},{overlayRed_,overlayGreen_,overlayBlue_,alpha,0,{0,0,0}},canvas_);
}
void D3D11Renderer::line(Point a,Point b,float thickness,float alpha) {
    float length=std::hypot(b.x-a.x,b.y-a.y);if(length<=.001f)return;
    Point n{-(b.y-a.y)/length*thickness/2,(b.x-a.x)/length*thickness/2};
    solid({Point{a.x+n.x,a.y+n.y},Point{b.x+n.x,b.y+n.y},Point{b.x-n.x,b.y-n.y},Point{a.x-n.x,a.y-n.y}},alpha);
}
void D3D11Renderer::circle(Point center,float radius,float thickness,float alpha) {
    int segments=radius>80?96:32;
    for(int n=0;n<segments;++n) {
        float a=n*2*std::numbers::pi_v<float>/segments,b=(n+1)*2*std::numbers::pi_v<float>/segments;
        line({center.x+std::cos(a)*radius,center.y+std::sin(a)*radius},
            {center.x+std::cos(b)*radius,center.y+std::sin(b)*radius},thickness,alpha);
    }
}
void D3D11Renderer::drawGizmo(const Definition& d,const Transform& transform,float progress,int hoveredHandle,float hoverProgress,const InputAppearance& appearance) {
    D3D11_VIEWPORT overlay{0,0,static_cast<float>(width_),static_cast<float>(height_),0,1};context_->RSSetViewports(1,&overlay);
    float scale=std::min(width_/1280.f,height_/720.f);
    float density=std::max(1.f,GetDpiForWindow(window_)/96.f),unit=density/scale;
    auto g=gizmo(d,transform,scale/density);
    auto extra=[&](Point p,int index){float distance=std::hypot(appearance.pointer.x-p.x,appearance.pointer.y-p.y)/unit;return std::max(appearance.options.zoneSpeed>=0?zoneExpansion(distance,appearance.intent,appearance.options):intentExpansion(appearance.pointer,p,appearance.intent),appearance.options.retainedHandles[index]);};
    auto now=std::chrono::steady_clock::now();float seconds=std::chrono::duration<float>(now-zoneFrame_).count();zoneFrame_=now;
    std::array<Point,13> zonePoints{};for(int n=0;n<4;++n){zonePoints[n]=g.corners[n];zonePoints[n+4]=g.edges[n];zonePoints[n+9]=g.rotationZones[n];}zonePoints[8]=rotationRingPoint(g,appearance.pointer);
    for(int n=0;n<13;++n){float targetRadius=appearance.options.handleRadius+extra(zonePoints[n],n),targetOpacity=n==hoveredHandle?hoverProgress:0;zoneVisuals_[n].update(targetRadius,targetOpacity,seconds,(appearance.debugFlags&8)!=0);if(zoneVisuals_[n].pending(targetRadius,targetOpacity))stats_.presentationPending=1;}
    auto workingZone=[&](int index,float thickness,float brightness){const auto& visual=zoneVisuals_[index];if(visual.opacity>.002f)circle(zonePoints[index],visual.radius*unit,thickness*unit,visual.opacity*brightness);};
    auto magnetic=[&](Point p,int index) {
        if(index!=hoveredHandle)return p;
        float distance=std::hypot(appearance.pointer.x-p.x,appearance.pointer.y-p.y);
        if(distance<.001f || distance*scale/density>appearance.options.handleRadius+extra(p,index))return p;
        float pull=std::min(distance,20*unit)*appearance.magnet*hoverProgress;
        return Point{p.x+(appearance.pointer.x-p.x)/distance*pull,p.y+(appearance.pointer.y-p.y)/distance*pull};
    };
    auto noise=[&](Point p) {float closeness=std::clamp(1-std::hypot(p.x-appearance.pointer.x,p.y-appearance.pointer.y)*scale/density/120,0.f,1.f);return .78f+.22f*closeness;};
    float alpha=.4f+.6f*progress;
    for(int i=0;i<4;++i)line(g.corners[i],g.corners[(i+1)%4],appearance.options.frameWidth*unit,alpha);
    for(int i=0;i<4;++i) {
        auto original=g.corners[i],p=magnetic(original,i);float hover=i==hoveredHandle?hoverProgress:0;
        float radius=(appearance.options.handleDiameter/2+4*hover)*unit*(.9f+.1f*progress)*noise(original);
        workingZone(i,2.5f,.55f);
        solid({Point{p.x-radius,p.y-radius},Point{p.x+radius,p.y-radius},Point{p.x+radius,p.y+radius},Point{p.x-radius,p.y+radius}},alpha);
    }
    for(int i=0;i<4;++i) {
        auto original=g.edges[i],p=magnetic(original,i+4);float hover=i+4==hoveredHandle?hoverProgress:0;
        float radius=(appearance.options.handleDiameter*.42f+4*hover)*unit*(.9f+.1f*progress)*noise(original);
        workingZone(i+4,2.5f,.55f);
        solid({Point{p.x-radius,p.y-radius},Point{p.x+radius,p.y-radius},Point{p.x+radius,p.y+radius},Point{p.x-radius,p.y+radius}},alpha);
    }
    float rotationHover=hoveredHandle==8?hoverProgress:0;
    float savedRed=overlayRed_,savedGreen=overlayGreen_,savedBlue=overlayBlue_;
    overlayRed_=.86f;overlayGreen_=.95f;overlayBlue_=1;
    constexpr int ringSegments=192;
    for(int n=0;n<ringSegments;++n){
        float a=n*2*std::numbers::pi_v<float>/ringSegments,b=(n+1)*2*std::numbers::pi_v<float>/ringSegments;
        auto point=[&](float angle){return Point{g.center.x+std::cos(angle)*g.rotationRadius,g.center.y+std::sin(angle)*g.rotationRadius};};
        if(rotationRingAvailable(g,point(a),1/unit,appearance.options)&&rotationRingAvailable(g,point(b),1/unit,appearance.options)){
            auto middle=point((a+b)*.5f);
            float distance=std::hypot(middle.x-appearance.pointer.x,middle.y-appearance.pointer.y)/unit;
            float nearRadius=appearance.options.handleRadius+appearance.options.maximumExpansion+12;
            float proximity=std::clamp(1-(distance-nearRadius)/140.f,0.f,1.f);
            proximity=proximity*proximity*(3-2*proximity);
            line(point(a),point(b),(2.4f+rotationHover)*unit,alpha*(.14f+.86f*proximity));
        }
    }
    // Only the pointer-local circular zone is highlighted, never the entire annulus.
    if(zoneVisuals_[8].opacity>.002f)circle(appearance.pointer,zoneVisuals_[8].radius*unit,2.5f*unit,zoneVisuals_[8].opacity*.55f);
    overlayRed_=savedRed;overlayGreen_=savedGreen;overlayBlue_=savedBlue;
    if(hoveredHandle>=9 && hoveredHandle<=12 && hoverProgress>0) {
        auto p=g.rotationZones[hoveredHandle-9];
        circle(p,11*unit,2.5f*unit,hoverProgress);
        line({p.x-6*unit,p.y},{p.x+6*unit,p.y},2*unit,hoverProgress);
    }
    for(int n=9;n<13;++n)workingZone(n,2,.45f);
    if(appearance.debugFlags&1) {
        for(int n=0;n<4;++n) {
            circle(g.corners[n],(appearance.options.handleRadius+extra(g.corners[n],n))*unit,1*unit,.3f);
            circle(g.edges[n],(appearance.options.handleRadius+extra(g.edges[n],n+4))*unit,1*unit,.3f);
        }
        circle(appearance.pointer,(appearance.options.handleRadius+extra(zonePoints[8],8))*unit,1*unit,.3f);
    }
    if((appearance.debugFlags&2)&&appearance.pointer.x>-1000) {
        for(float y=-100;y<100;y+=12)for(float x=-100;x<100;x+=12) {
            Point p{appearance.pointer.x+x*unit,appearance.pointer.y+y*unit};
            auto hit=hitGizmo(g,p,scale/density,appearance.intent,appearance.options);if(hit.tool==Tool::None)continue;
            float red=overlayRed_,green=overlayGreen_,blue=overlayBlue_;
            if(hit.corner!=hoveredHandle){overlayRed_=.35f;overlayGreen_=.17f;overlayBlue_=.7f;}
            solid({Point{p.x,p.y},Point{p.x+11*unit,p.y},Point{p.x+11*unit,p.y+11*unit},Point{p.x,p.y+11*unit}},.10f);
            overlayRed_=red;overlayGreen_=green;overlayBlue_=blue;
        }
    }
}
void D3D11Renderer::draw(const Project& project,Id selected,Id hovered,float selectionProgress,float hoverProgress,int hoveredHandle,const InputAppearance& appearance) {
    auto start=std::chrono::steady_clock::now();
    stats_.pending=stats_.presentationPending=0;
    if(zoneOwner_!=selected){zoneOwner_=selected;zoneVisuals_={};zoneFrame_=start;}
    auto planes=appearance.timeline?evaluateTimeline(project,appearance.frame):evaluateScene(project);
    // Only currently visible video planes retain decoder workers and per-frame GPU caches.
    auto activeVideo=[&](Id id){return std::any_of(planes.begin(),planes.end(),[&](const auto& p){return p.instance==id&&project.definition(p.definition).kind==DefinitionKind::Video;});};
    for(auto it=decoders_.begin();it!=decoders_.end();)if(!activeVideo(it->first)){textures_.erase(it->first);it=decoders_.erase(it);}else ++it;
    std::erase_if(textures_,[&](const auto& item) {
        return std::none_of(project.instances.begin(),project.instances.end(),[&](const Instance& i){return i.definition==item.first||i.id==item.first;});
    });
    std::erase_if(decoders_,[&](const auto& item){return std::none_of(project.instances.begin(),project.instances.end(),[&](const auto& i){return i.id==item.first;});});
    // Resolve all textures before submitting a frame: a bad source cannot leave a partial frame.
    for(const auto& p:planes)(void)texture(project.definition(p.definition),p.instance,p.sourceSeconds,appearance.synchronousMedia);
    float clear[]{.005f,.007f,.012f,1};context_->ClearRenderTargetView(target_.Get(),clear);
    context_->OMSetRenderTargets(1,target_.GetAddressOf(),nullptr);
    float scale=std::min(width_/1280.f,height_/720.f);
    D3D11_VIEWPORT viewport{(width_-1280*scale)/2,(height_-720*scale)/2,1280*scale,720*scale,0,1};context_->RSSetViewports(1,&viewport);
    context_->RSSetState(raster_.Get());context_->OMSetBlendState(blend_.Get(),nullptr,0xffffffff);
    UINT stride=sizeof(Vertex),offset=0;context_->IASetVertexBuffers(0,1,vertices_.GetAddressOf(),&stride,&offset);
    context_->IASetInputLayout(layout_.Get());context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    context_->VSSetShader(vs_.Get(),nullptr,0);context_->PSSetShader(ps_.Get(),nullptr,0);
    context_->PSSetSamplers(0,1,sampler_.GetAddressOf());context_->PSSetConstantBuffers(0,1,constants_.GetAddressOf());
    plane({0,0,{640,360,1,1,0,1},1280,720,.012f,.018f,.03f},canvas_,false);
    for(auto p:planes){if(p.instance==appearance.editingText)continue;if(p.instance==appearance.settleId){p.transform.x+=appearance.settleOffset.x;p.transform.y+=appearance.settleOffset.y;}plane(p,textures_.at(textureId(p,project)),p.instance==hovered && p.transform.opacity>0?hoverProgress:0,project.instance(p.instance).graph);}
    overlayRed_=appearance.red;overlayGreen_=appearance.green;overlayBlue_=appearance.blue;
    if(selected&&std::any_of(planes.begin(),planes.end(),[&](const auto& p){return p.instance==selected;})) {
        const auto& i=project.instance(selected);
        auto transform=i.transform;if(i.id==appearance.settleId){transform.x+=appearance.settleOffset.x;transform.y+=appearance.settleOffset.y;}
        auto mask=std::find_if(i.graph.nodes.begin(),i.graph.nodes.end(),[&](const auto& n){return n.id==appearance.maskNode&&n.kind==NodeKind::EllipseMask;});
        if(i.visible && i.transform.opacity>0 && mask!=i.graph.nodes.end()) {
            D3D11_VIEWPORT overlay{0,0,static_cast<float>(width_),static_cast<float>(height_),0,1};context_->RSSetViewports(1,&overlay);
            const auto& d=project.definition(i.definition);const auto& v=mask->values;
            float unit=std::max(1.f,GetDpiForWindow(window_)/96.f)/scale;
            float angle=transform.rotation*std::numbers::pi_v<float>/180,cs=std::cos(angle),sn=std::sin(angle);
            auto point=[&](float a){float x=(v[0]+v[2]*std::cos(a)-.5f)*d.width*transform.scaleX,y=(v[1]+v[3]*std::sin(a)-.5f)*d.height*transform.scaleY;return Point{transform.x+x*cs-y*sn,transform.y+x*sn+y*cs};};
            for(int n=0;n<96;++n)line(point(n*2*std::numbers::pi_v<float>/96),point((n+1)*2*std::numbers::pi_v<float>/96),2*unit,.9f);
            for(int n=0;n<4;++n)circle(point(n*std::numbers::pi_v<float>/2),appearance.options.handleDiameter*.5f*unit,3*unit,1);
        } else if(i.visible && i.transform.opacity>0)drawGizmo(project.definition(i.definition),transform,selectionProgress,hovered==selected?hoveredHandle:-1,hoverProgress,appearance);
    }
    if(appearance.debugFlags&&appearance.pointer.x>-1000) {
        D3D11_VIEWPORT overlay{0,0,static_cast<float>(width_),static_cast<float>(height_),0,1};context_->RSSetViewports(1,&overlay);
        float unit=std::max(1.f,GetDpiForWindow(window_)/96.f)/scale;
        if(appearance.debugFlags&1)for(const auto& i:project.instances) {
            if(!i.visible||i.locked||i.transform.opacity<=0)continue;
            auto d=project.definition(i.definition);d.width+=2*appearance.options.objectMargin*unit/i.transform.scaleX;d.height+=2*appearance.options.objectMargin*unit/i.transform.scaleY;
            auto bounds=gizmo(d,i.transform,scale/std::max(1.f,GetDpiForWindow(window_)/96.f));for(int n=0;n<4;++n)line(bounds.corners[n],bounds.corners[(n+1)%4],unit,.18f);
        }
        if(appearance.debugFlags&4) {
            float travel=std::min(240.f,appearance.speed*.25f*(1-std::exp(-appearance.horizon/.25f)))*unit;
            Point end{appearance.pointer.x+appearance.intent.direction.x*travel,appearance.pointer.y+appearance.intent.direction.y*travel};
            line(appearance.pointer,end,2*unit,.8f);circle(end,(8+appearance.intent.expansion*.3f)*unit,1.5f*unit,.7f);
        }
    }
    ComPtr<ID3D11Texture2D> backbuffer;checked(swap_->GetBuffer(0,IID_PPV_ARGS(&backbuffer)),"Present backbuffer");
    context_->CopyResource(backbuffer.Get(),frame_.Get());
    if(sharedFrame_){
        context_->CopyResource(sharedFrame_.Get(),frame_.Get());context_->End(sharedReady_.Get());context_->Flush();
        auto timeout=std::chrono::steady_clock::now()+std::chrono::milliseconds(500);
        while(context_->GetData(sharedReady_.Get(),nullptr,0,0)==S_FALSE){if(std::chrono::steady_clock::now()>timeout)throw std::runtime_error("UI surface synchronization timed out");Sleep(0);}
        checked(device_->GetDeviceRemovedReason(),"Shared UI surface device");
    }
    checked(swap_->Present(0,0),"Present viewport");
    stats_.textureCount=static_cast<unsigned>(textures_.size());stats_.textureBytes=0;
    for(auto& [id,t]:textures_)stats_.textureBytes+=t.bytes;
    stats_.cpuMilliseconds=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();
}
Image D3D11Renderer::capture() {
    ComPtr<ID3D11Texture2D> staging;
    D3D11_TEXTURE2D_DESC desc{};frame_->GetDesc(&desc);desc.Usage=D3D11_USAGE_STAGING;desc.BindFlags=0;desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;desc.MiscFlags=0;
    checked(device_->CreateTexture2D(&desc,nullptr,&staging),"Readback texture");context_->CopyResource(staging.Get(),frame_.Get());
    D3D11_MAPPED_SUBRESOURCE map{};checked(context_->Map(staging.Get(),0,D3D11_MAP_READ,0,&map),"GPU readback");
    Image image{width_,height_,{}};image.pixels.resize(static_cast<size_t>(width_)*height_*4);
    for(unsigned y=0;y<height_;++y)std::memcpy(image.pixels.data()+static_cast<size_t>(y)*width_*4,static_cast<std::uint8_t*>(map.pData)+static_cast<size_t>(y)*map.RowPitch,width_*4);
    context_->Unmap(staging.Get(),0);return image;
}
}
Image readImage(const std::filesystem::path& path) {
    auto factory=wic();ComPtr<IWICBitmapDecoder> decoder;
    checked(factory->CreateDecoderFromFilename(path.c_str(),nullptr,GENERIC_READ,WICDecodeMetadataCacheOnDemand,&decoder),"Open image source");
    ComPtr<IWICBitmapFrameDecode> frame;checked(decoder->GetFrame(0,&frame),"Image frame");
    Image image;checked(frame->GetSize(&image.width,&image.height),"Image dimensions");
    if(!image.width || !image.height || image.width>8192 || image.height>8192 || static_cast<std::uint64_t>(image.width)*image.height*4>64ull*1024*1024)
        throw std::runtime_error("Image exceeds bootstrap decode budget (64 MiB / 8192 pixels per side)");
    ComPtr<IWICFormatConverter> converter;checked(factory->CreateFormatConverter(&converter),"Image converter");
    checked(converter->Initialize(frame.Get(),GUID_WICPixelFormat32bppBGRA,WICBitmapDitherTypeNone,nullptr,0,WICBitmapPaletteTypeCustom),"BGRA conversion");
    image.pixels.resize(static_cast<size_t>(image.width)*image.height*4);
    checked(converter->CopyPixels(nullptr,image.width*4,static_cast<UINT>(image.pixels.size()),image.pixels.data()),"Decode image");return image;
}
void writePng(const Image& image,const std::filesystem::path& path) {
    auto factory=wic();ComPtr<IWICStream> stream;checked(factory->CreateStream(&stream),"PNG stream");
    checked(stream->InitializeFromFilename(path.c_str(),GENERIC_WRITE),"PNG destination");
    ComPtr<IWICBitmapEncoder> encoder;checked(factory->CreateEncoder(GUID_ContainerFormatPng,nullptr,&encoder),"PNG encoder");
    checked(encoder->Initialize(stream.Get(),WICBitmapEncoderNoCache),"PNG initialize");
    ComPtr<IWICBitmapFrameEncode> frame;checked(encoder->CreateNewFrame(&frame,nullptr),"PNG frame");checked(frame->Initialize(nullptr),"PNG frame initialize");
    checked(frame->SetSize(image.width,image.height),"PNG dimensions");WICPixelFormatGUID format=GUID_WICPixelFormat32bppBGRA;
    checked(frame->SetPixelFormat(&format),"PNG pixel format");
    if(format!=GUID_WICPixelFormat32bppBGRA)throw std::runtime_error("PNG encoder did not accept BGRA8");
    checked(frame->WritePixels(image.height,image.width*4,static_cast<UINT>(image.pixels.size()),const_cast<BYTE*>(image.pixels.data())),"PNG pixels");
    checked(frame->Commit(),"PNG frame commit");checked(encoder->Commit(),"PNG commit");
}
std::unique_ptr<Renderer> createD3D11Renderer(HWND hwnd,bool software) { return std::make_unique<D3D11Renderer>(hwnd,software); }
}
