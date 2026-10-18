#include "mycut/Renderer.h"
#include <objbase.h>
#include <iostream>
#include <stdexcept>

void check(bool v,const char* why){if(!v)throw std::runtime_error(why);}
int wmain(int argc,wchar_t** argv) {
    HRESULT init=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    if(FAILED(init))return 1;
    HWND window=CreateWindowExW(0,L"STATIC",L"MyCut render tests",WS_POPUP,0,0,1280,720,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    try {
        check(window!=nullptr,"No test window");
        bool software=!(argc>2 && std::wstring_view(argv[2])==L"--hardware");
        auto renderer=mycut::createD3D11Renderer(window,software);
        auto project=mycut::demoProject();renderer->draw(project);auto baseline=renderer->capture();
        check(baseline.width==1280 && baseline.height==720,"Wrong render dimensions");
        auto pixel=[&](unsigned x,unsigned y){auto i=(y*baseline.width+x)*4;return baseline.pixels[i]+baseline.pixels[i+1]+baseline.pixels[i+2];};
        check(pixel(410,340)>pixel(5,5)+30,"Textured plane did not render");
        mycut::Definition text;text.kind=mycut::DefinitionKind::Text;text.text="MyCut Привет\nWindows fonts";text.width=480;text.height=180;text.fontSize=48;
        auto glyphs=mycut::generateImage(text);unsigned ink=0,clear=0;
        for(std::size_t n=3;n<glyphs.pixels.size();n+=4){if(glyphs.pixels[n])++ink;else ++clear;}
        check(ink>100&&clear>100,"Windows text generator must render Unicode ink on a transparent bitmap");
        auto gradient=text;gradient.kind=mycut::DefinitionKind::LinearGradient;gradient.width=101;gradient.height=1;gradient.fill={0,0,0,1};gradient.second={1,1,1,1};
        auto ramp=mycut::generateImage(gradient);check(ramp.pixels[50*4]>=187&&ramp.pixels[50*4]<=189,"Gradient must interpolate in linear light");
        auto ellipse=text;ellipse.kind=mycut::DefinitionKind::Ellipse;ellipse.width=ellipse.height=100;
        auto shape=mycut::generateImage(ellipse);check(shape.pixels[3]==0&&shape.pixels[(50*100+50)*4+3]==255,"Ellipse generator must keep its corners transparent");
        check(renderer->stats().textureCount==1,"Instances must share one GPU texture");
        renderer->draw(project,2,0,1,0);auto selectedFrame=renderer->capture();
        check(selectedFrame.pixels!=baseline.pixels,"Selection gizmo did not render");
        renderer->draw(project,2,0,.1f,0);check(renderer->capture().pixels!=selectedFrame.pixels,"Selection feedback animation did not change pixels");
        renderer->draw(project,0,2,1,1);check(renderer->capture().pixels!=baseline.pixels,"Hover feedback did not render");
        renderer->draw(project,2,2,1,1,0);auto firstHandle=renderer->capture();
        renderer->draw(project,2,2,1,1,1);check(renderer->capture().pixels!=firstHandle.pixels,"Closest hovered handle must have distinct visual feedback");
        renderer->draw(project);check(renderer->capture().pixels==baseline.pixels,"Editor handles or hover feedback leaked into clean export");
        project.instance(2).grade.exposure=1;renderer->draw(project);check(renderer->capture().pixels!=baseline.pixels,"Primary exposure must affect native rendered pixels");
        project.instance(2).grade={};renderer->draw(project);check(renderer->capture().pixels==baseline.pixels,"Identity correction must restore the original pixels");
        project.instance(2).transform.x=250;renderer->draw(project);auto moved=renderer->capture();
        check(moved.pixels!=baseline.pixels,"Transform did not affect pixels");
        project.definition(1).red=.1f;renderer->draw(project);auto tinted=renderer->capture();
        check(tinted.pixels!=moved.pixels,"Definition tint did not affect GPU output");
        project=mycut::demoProject();renderer->draw(project);
        auto path=std::filesystem::path(argc>1?argv[1]:L"render-test.png");mycut::writePng(renderer->capture(),path);
        auto decoded=mycut::readImage(path);check(decoded.pixels==baseline.pixels,"PNG pixel roundtrip mismatch");
        // Import the exported source as another definition and ensure one upload per source definition.
        auto u8=path.u8string();project.definitions.push_back({5,"PNG roundtrip",std::string(reinterpret_cast<const char*>(u8.data()),u8.size()),480,270,1,1,1});
        project.instances.push_back({6,5,"Imported PNG",{640,360,1,1,0,1},true});project.nextId=7;
        renderer->draw(project);check(renderer->stats().textureCount==2,"WIC source was not uploaded");
        renderer->resize(640,360);renderer->draw(project);auto resizedImage=renderer->capture();
        check(resizedImage.width==640 && resizedImage.height==360,"Resize failed");
        // A half-transparent sRGB red source must blend in linear light over the canvas.
        auto alphaPath=path.parent_path()/L"alpha-test.png";
        mycut::writePng(mycut::Image{1,1,{0,0,255,128}},alphaPath);
        auto alphaSource=alphaPath.u8string();
        mycut::Project alpha;
        alpha.definitions.push_back({1,"Alpha",std::string(reinterpret_cast<const char*>(alphaSource.data()),alphaSource.size()),200,200,1,1,1});
        alpha.instances.push_back({2,1,"Alpha",{640,360,1,1,0,1},true});alpha.nextId=3;
        renderer->draw(alpha);auto alphaImage=renderer->capture();
        auto center=(180*alphaImage.width+320)*4;
        check(alphaImage.pixels[center+2]>=187 && alphaImage.pixels[center+2]<=190,"Alpha blend must be premultiplied and linear");
        check(alphaImage.pixels[center+3]==255,"Opaque canvas alpha must remain opaque");
        alpha.instance(2).visible=false;renderer->draw(alpha);auto hidden=renderer->capture();
        check(hidden.pixels[center+2]<50,"Invisible instance rendered");
        mycut::Project graphProject;mycut::Definition gd;gd.id=1;gd.kind=mycut::DefinitionKind::Solid;gd.width=1280;gd.height=720;graphProject.definitions.push_back(gd);graphProject.instances.push_back({2,1,"Graph pixels",{},true});graphProject.nextId=3;
        renderer->draw(graphProject);auto plainGraphImage=renderer->capture();mycut::initializeGraph(graphProject,2);graphProject.validate();renderer->draw(graphProject);
        check(renderer->capture().pixels==plainGraphImage.pixels,"Image -> Output graph changed identity pixels");
        auto out=graphProject.instance(2).graph.output;
        for(int kind=0;kind<=10;++kind){auto test=graphProject;auto id=mycut::addNode(test,2,static_cast<mycut::NodeKind>(kind),0,0);mycut::connectNodes(test,2,id,out,0);test.validate();renderer->draw(test);(void)renderer->capture();}
        auto colorNode=mycut::addNode(graphProject,2,mycut::NodeKind::Color,0,0);graphProject.instance(2).graph.node(colorNode).values={.5f,.25f,.125f,1,0,0,0,0};mycut::connectNodes(graphProject,2,colorNode,out,0);renderer->draw(graphProject);auto graphPixels=renderer->capture();
        check(graphPixels.pixels[center+2]>=187&&graphPixels.pixels[center+2]<=189&&graphPixels.pixels[center+1]>=136&&graphPixels.pixels[center+1]<=138,"Graph Color parameters did not run in linear GPU processing");
        graphProject.instance(2).graph.node(colorNode).values[0]=.25f;renderer->draw(graphProject);auto graphChanged=renderer->capture();check(graphChanged.pixels[center+2]<graphPixels.pixels[center+2],"Graph parameter update reused stale constants");
        mycut::initializeGraph(graphProject,2,true);graphProject.validate();renderer->draw(graphProject);auto maskedGraph=renderer->capture();check(maskedGraph.pixels[center+2]>245&&maskedGraph.pixels[0]<60,"GPU graph mask did not clip the source");
        // Pilot Exposure: resolve once into the existing shader constants, no extra texture/pass.
        mycut::initializeGraph(graphProject,2);auto& eg=graphProject.instance(2).graph;
        auto ec=mycut::addNode(graphProject,2,mycut::NodeKind::Color,0,0);
        eg.node(ec).values={.0625f,.03125f,.015625f,1,0,0,0,0};
        auto exposure=mycut::addNode(graphProject,2,mycut::NodeKind::Exposure,0,0);
        mycut::connectNodes(graphProject,2,ec,exposure,0);mycut::connectNodes(graphProject,2,exposure,eg.output,0);
        mycut::LegacyParameterAdapter::write(eg.node(exposure),mycut::ExposureStopsId,mycut::ParameterValue(2.0));
        renderer->draw(graphProject);auto exposed=renderer->capture();
        check(exposed.pixels[center+2]>=136&&exposed.pixels[center+2]<=138,"Universal Exposure constant did not reach GPU");
        auto stops=mycut::addNode(graphProject,2,mycut::NodeKind::Scalar,0,0);eg.node(stops).values[0]=2;
        eg.node(exposure).values[0]=25;mycut::connectNodes(graphProject,2,stops,exposure,1);renderer->draw(graphProject);
        check(renderer->capture().pixels==exposed.pixels,"GPU connected Stops did not override legacy fallback");
        mycut::connectNodes(graphProject,2,0,exposure,1);eg.node(ec).values={.0000001f,.0000002f,.0000003f,1,0,0,0,0};
        renderer->draw(graphProject);auto legacy25=renderer->capture();eg.node(exposure).values[0]=20;renderer->draw(graphProject);
        check(renderer->capture().pixels==legacy25.pixels,"GPU changed the legacy render-time Exposure clamp");
        check(legacy25.pixels[center+2]>60&&legacy25.pixels[center+2]<180,"Legacy GPU exposure comparison saturated and is inconclusive");
        check(renderer->stats().textureCount==1,"Exposure created an extra source texture");
        // Rotation hover is a pointer-local circle, not a highlighted full annulus.
        renderer->resize(1280,720);mycut::Project ringProject;
        mycut::Definition ringDefinition;ringDefinition.id=1;ringDefinition.kind=mycut::DefinitionKind::Solid;ringDefinition.width=200;ringDefinition.height=120;
        ringProject.definitions.push_back(ringDefinition);ringProject.instances.push_back({2,1,"Rotation",{640,360,1,1,0,1},true});ringProject.nextId=3;
        auto ring=mycut::gizmo(ringDefinition,ringProject.instance(2).transform,1);
        mycut::InputAppearance ringStyle;ringStyle.debugFlags=8;ringStyle.pointer=ring.rotation;
        renderer->draw(ringProject,2,0,1,0,-1,ringStyle);auto idleRing=renderer->capture();
        renderer->draw(ringProject,2,2,1,1,8,ringStyle);auto hoverRing=renderer->capture();
        auto difference=[&](int x,int y){int total=0;for(int dy=-2;dy<=2;++dy)for(int dx=-2;dx<=2;++dx){auto index=((y+dy)*hoverRing.width+x+dx)*4;for(int c=0;c<3;++c)total+=std::abs(int(hoverRing.pixels[index+c])-int(idleRing.pixels[index+c]));}return total;};
        check(difference(657,static_cast<int>(ring.rotation.y)+17)>100,"Pointer-local rotation circle was not drawn");
        check(difference(640,static_cast<int>(360+ring.rotationRadius)+12)==0,"Rotation hover must not highlight the distant ring band");
        auto farStyle=ringStyle;farStyle.pointer={-10000,-10000};renderer->draw(ringProject,2,0,1,0,-1,farStyle);auto farRing=renderer->capture();
        int fadeDifference=0;for(int dy=-2;dy<=2;++dy)for(int dx=-2;dx<=2;++dx){auto index=((static_cast<int>(ring.rotation.y)+dy)*idleRing.width+640+dx)*4;for(int c=0;c<3;++c)fadeDifference+=int(idleRing.pixels[index+c])-int(farRing.pixels[index+c]);}
        check(fadeDifference>100,"Rotation ring must become brighter near the pointer than far away");
        auto cornerGap=ring.rotationZones[0];renderer->draw(ringProject,2,0,1,0,-1,ringStyle);auto withGizmo=renderer->capture();renderer->draw(ringProject);auto withoutGizmo=renderer->capture();
        auto gapIndex=(static_cast<int>(cornerGap.y)*withGizmo.width+static_cast<int>(cornerGap.x))*4;
        check(withGizmo.pixels[gapIndex]==withoutGizmo.pixels[gapIndex]&&withGizmo.pixels[gapIndex+2]==withoutGizmo.pixels[gapIndex+2],"Scale corner cut-out still draws the rotation ring");
        std::cout<<"Backend: "<<(renderer->stats().software?"WARP":"hardware GPU")<<'\n';
        renderer.reset();DestroyWindow(window);CoUninitialize();
        std::cout<<"PASS: render, textured pixels, shared GPU texture, transform, tint, PNG readback/roundtrip, image import, resize, linear alpha, visibility\n";return 0;
    }catch(const std::exception& e){std::cerr<<"FAIL: "<<e.what()<<'\n';if(window)DestroyWindow(window);CoUninitialize();return 1;}
}
