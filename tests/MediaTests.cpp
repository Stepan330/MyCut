#include "mycut/Media.h"
#include <iostream>
#include <stdexcept>
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
int wmain(int argc,wchar_t** argv){try{
    auto folder=argc>1?std::filesystem::path(argv[1]):std::filesystem::current_path();auto movie=folder/L"media-test.mp4";
    mycut::Project p;auto layer=[&](const char* name,mycut::Color color,float y){mycut::Definition d;d.id=p.nextId++;d.name=name;d.kind=mycut::DefinitionKind::Solid;d.width=1280;d.height=360;d.fill=color;p.definitions.push_back(d);auto id=p.nextId++;p.instances.push_back({id,d.id,name,{640,y,1,1,0,1}});return id;};
    auto red=layer("Top red",{1,0,0,1},180),blue=layer("Bottom blue",{0,0,1,1},540),green=layer("Top green",{0,1,0,1},180);auto track=mycut::addTrack(p,"Video");
    mycut::addClip(p,red,track,0,4);mycut::addClip(p,blue,track,0,8);mycut::addClip(p,green,track,4,4);
    int progress=0;mycut::exportMovie(p,movie,0,8,true,[&](auto done,auto total){check(total==8,"Export range changed");progress=static_cast<int>(done);return true;});
    check(progress==8&&std::filesystem::file_size(movie)>1000,"MP4 export failed");auto info=mycut::probeVideo(movie);check(info.width==1280&&info.height==720&&std::abs(info.duration-8.0/30)<.04,"Wrong exported media timing");
    mycut::VideoSource decoder(movie);auto first=decoder.frame(0,true),last=decoder.frame(5.0/30,true);check(first.image&&last.image&&!first.pending&&!last.pending,"Synchronous decode failed");
    auto channel=[](const mycut::Image& image,int x,int y,int c){return image.pixels[(static_cast<std::size_t>(y)*image.width+x)*4+c];};
    check(channel(*first.image,640,180,2)>220&&channel(*first.image,640,540,0)>220,"Encoded image flipped or channels changed");
    check(channel(*last.image,640,180,1)>220&&channel(*last.image,640,180,2)<30,"Video seek returned the wrong frame");
    check(decoder.frame(0,true).image->pixels==first.image->pixels,"Backward seek or decoded cache failed");
    auto size=std::filesystem::file_size(movie);bool canceled=false;try{mycut::exportMovie(p,movie,0,8,true,[](auto done,auto){return done<2;});}catch(const std::exception&){canceled=true;}
    check(canceled&&std::filesystem::file_size(movie)==size,"Canceled export overwrote the existing movie");
    std::cout<<"PASS: H264 encoding, frame orientation, color channels, duration, accurate forward/backward seeking, cancellation preserves original\n";return 0;
}catch(const std::exception& ex){std::cerr<<"FAIL: "<<ex.what()<<'\n';return 1;}}
