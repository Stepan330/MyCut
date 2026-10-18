#include "mycut/Media.h"
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <wrl/client.h>
#include <propvarutil.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstring>
#include <deque>
#include <mutex>
#include <sstream>
#include <thread>
#include <unordered_map>

namespace mycut {
using Microsoft::WRL::ComPtr;
namespace {
constexpr DWORD videoStream=static_cast<DWORD>(MF_SOURCE_READER_FIRST_VIDEO_STREAM),allStreams=static_cast<DWORD>(MF_SOURCE_READER_ALL_STREAMS),mediaSource=static_cast<DWORD>(MF_SOURCE_READER_MEDIASOURCE);
void checked(HRESULT result,const char* operation){if(FAILED(result)){std::ostringstream message;message<<operation<<" (0x"<<std::hex<<static_cast<unsigned>(result)<<")";throw std::runtime_error(message.str());}}
struct Apartment {bool own=false;explicit Apartment(DWORD type){auto hr=CoInitializeEx(nullptr,type);own=SUCCEEDED(hr);if(FAILED(hr)&&hr!=RPC_E_CHANGED_MODE)checked(hr,"COM initialization");}~Apartment(){if(own)CoUninitialize();}};
struct Platform {Platform(){checked(MFStartup(MF_VERSION),"Media Foundation initialization");}~Platform(){MFShutdown();}};
class Reader {
public:
    explicit Reader(const std::filesystem::path& path){
        ComPtr<IMFAttributes> attributes;checked(MFCreateAttributes(&attributes,2),"Media attributes");checked(attributes->SetUINT32(MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING,TRUE),"Video conversion");
        checked(MFCreateSourceReaderFromURL(path.c_str(),attributes.Get(),&reader),"Open video source");checked(reader->SetStreamSelection(allStreams,FALSE),"Select video stream");checked(reader->SetStreamSelection(videoStream,TRUE),"Enable video stream");
        ComPtr<IMFMediaType> native;checked(reader->GetNativeMediaType(videoStream,0,&native),"Video source type");
        checked(MFGetAttributeSize(native.Get(),MF_MT_FRAME_SIZE,&info.width,&info.height),"Video source dimensions");UINT32 num=30,den=1;(void)MFGetAttributeRatio(native.Get(),MF_MT_FRAME_RATE,&num,&den);info.rateNumerator=static_cast<int>(num);info.rateDenominator=static_cast<int>(den);
        PROPVARIANT duration;PropVariantInit(&duration);checked(reader->GetPresentationAttribute(mediaSource,MF_PD_DURATION,&duration),"Video duration");
        info.duration=duration.vt==VT_UI8?static_cast<double>(duration.uhVal.QuadPart)/10000000.0:0;PropVariantClear(&duration);
        if(!info.width||!info.height||info.width>8192||info.height>8192||static_cast<std::uint64_t>(info.width)*info.height*4>64ull*1024*1024||info.duration<=0||!num||!den)throw std::runtime_error("Unsupported video dimensions or duration");
        ComPtr<IMFMediaType> output;checked(MFCreateMediaType(&output),"Video output type");checked(output->SetGUID(MF_MT_MAJOR_TYPE,MFMediaType_Video),"Video major type");checked(output->SetGUID(MF_MT_SUBTYPE,MFVideoFormat_RGB32),"Video pixel format");checked(reader->SetCurrentMediaType(videoStream,nullptr,output.Get()),"Decode video as RGB32");
        checked(reader->GetCurrentMediaType(videoStream,&output),"Decoded video type");UINT32 rawStride=info.width*4;(void)output->GetUINT32(MF_MT_DEFAULT_STRIDE,&rawStride);stride=static_cast<LONG>(rawStride);
    }
    std::shared_ptr<const Image> at(double seconds){
        auto target=static_cast<LONGLONG>(std::max(0.0,seconds)*10000000.0);
        if(last&&target>=lastTime&&target<lastTime+lastDuration)return last;
        if(!last||target<lastTime||target-lastTime>5000000){PROPVARIANT position;PropVariantInit(&position);position.vt=VT_I8;position.hVal.QuadPart=target;checked(reader->SetCurrentPosition(GUID_NULL,position),"Seek video");last.reset();}
        for(int attempts=0;attempts<2000;++attempts){
            DWORD flags=0;LONGLONG timestamp=0;ComPtr<IMFSample> sample;checked(reader->ReadSample(videoStream,0,nullptr,&flags,&timestamp,&sample),"Read video frame");
            if(flags&MF_SOURCE_READERF_ENDOFSTREAM){if(last)return last;throw std::runtime_error("Video has no decoded frame");}if(!sample)continue;
            LONGLONG duration=10000000LL*info.rateDenominator/info.rateNumerator;(void)sample->GetSampleDuration(&duration);
            if(duration<=0)duration=std::max<LONGLONG>(1,10000000LL*info.rateDenominator/info.rateNumerator);
            if(timestamp+duration<=target){lastTime=timestamp;continue;}
            ComPtr<IMFMediaBuffer> buffer;checked(sample->ConvertToContiguousBuffer(&buffer),"Video frame buffer");auto image=std::make_shared<Image>(Image{info.width,info.height,{}});image->pixels.resize(static_cast<std::size_t>(info.width)*info.height*4);
            BYTE* scan=nullptr;LONG pitch=stride;ComPtr<IMF2DBuffer> twoD;
            if(SUCCEEDED(buffer.As(&twoD))){checked(twoD->Lock2D(&scan,&pitch),"Lock video frame");for(unsigned y=0;y<info.height;++y)std::memcpy(image->pixels.data()+static_cast<std::size_t>(y)*info.width*4,scan+static_cast<std::ptrdiff_t>(y)*pitch,info.width*4);twoD->Unlock2D();}
            else{DWORD length=0;checked(buffer->Lock(&scan,nullptr,&length),"Lock video bytes");if(length<static_cast<std::uint64_t>(std::abs(pitch))*info.height){buffer->Unlock();throw std::runtime_error("Truncated video buffer");}if(pitch<0)scan+=static_cast<std::size_t>(info.height-1)*static_cast<std::size_t>(-pitch);
                for(unsigned y=0;y<info.height;++y)std::memcpy(image->pixels.data()+static_cast<std::size_t>(y)*info.width*4,scan+static_cast<std::ptrdiff_t>(y)*pitch,info.width*4);buffer->Unlock();}
            for(std::size_t n=3;n<image->pixels.size();n+=4)image->pixels[n]=255;
            last=image;lastTime=timestamp;lastDuration=duration;return last;
        }
        throw std::runtime_error("Video seek exceeded decode limit");
    }
    MediaInfo info;
private:
    ComPtr<IMFSourceReader> reader;LONG stride=0;std::shared_ptr<const Image> last;LONGLONG lastTime=-1,lastDuration=0;
};
}
MediaInfo probeVideo(const std::filesystem::path& path){Apartment apartment(COINIT_APARTMENTTHREADED);Platform platform;Reader reader(path);return reader.info;}
struct VideoSource::Impl {
    std::filesystem::path path;MediaInfo info;std::mutex mutex;std::condition_variable cv;
    std::unordered_map<std::int64_t,std::shared_ptr<const Image>> cache;std::deque<std::int64_t> order;
    std::shared_ptr<const Image> ready;std::int64_t requested=-1,readyKey=-1;std::uint64_t requestEpoch=0,processedEpoch=0;std::string error;bool stopping=false;
    std::jthread worker;
    explicit Impl(std::filesystem::path source):path(std::move(source)),info(probeVideo(path)),worker([this]{work();}){}
    ~Impl(){{std::lock_guard lock(mutex);stopping=true;}cv.notify_all();if(worker.joinable())worker.join();}
    void work(){
        try{Apartment apartment(COINIT_MULTITHREADED);Platform platform;Reader reader(path);
            while(true){std::int64_t key;std::uint64_t epoch;{std::unique_lock lock(mutex);cv.wait(lock,[&]{return stopping||requestEpoch!=processedEpoch;});if(stopping)return;key=requested;epoch=requestEpoch;}
                auto frame=reader.at(static_cast<double>(key)*info.rateDenominator/info.rateNumerator);
                {std::lock_guard lock(mutex);cache[key]=frame;order.push_back(key);auto limit=std::max<std::size_t>(1,std::min<std::size_t>(8,64ull*1024*1024/frame->pixels.size()));
                    while(order.size()>limit){cache.erase(order.front());order.pop_front();}if(epoch==requestEpoch){ready=std::move(frame);readyKey=key;processedEpoch=epoch;}}
                cv.notify_all();
            }
        }catch(const std::exception& ex){std::lock_guard lock(mutex);error=ex.what();processedEpoch=requestEpoch;cv.notify_all();}
    }
    VideoFrame frame(double time,bool wait){
        auto maximum=std::max<std::int64_t>(0,static_cast<std::int64_t>(std::ceil(info.duration*info.rateNumerator/info.rateDenominator))-1);
        auto key=std::clamp<std::int64_t>(static_cast<std::int64_t>(std::floor(std::max(0.0,time)*info.rateNumerator/info.rateDenominator+1e-5)),0,maximum);
        std::unique_lock lock(mutex);if(!error.empty())throw std::runtime_error(error);
        if(key!=requested){requested=key;++requestEpoch;if(auto it=cache.find(key);it!=cache.end()){ready=it->second;readyKey=key;processedEpoch=requestEpoch;}cv.notify_all();}
        if(wait&&!cv.wait_for(lock,std::chrono::seconds(20),[&]{return !error.empty()||processedEpoch==requestEpoch;}))throw std::runtime_error("Video decode timed out");
        if(!error.empty())throw std::runtime_error(error);return {ready,readyKey,processedEpoch!=requestEpoch};
    }
};
VideoSource::VideoSource(std::filesystem::path path):impl_(std::make_unique<Impl>(std::move(path))){}
VideoSource::~VideoSource()=default;
VideoFrame VideoSource::frame(double seconds,bool wait){return impl_->frame(seconds,wait);}

void exportMovie(const Project& project,const std::filesystem::path& output,Frame first,Frame count,bool software,const ExportProgress& progress){
    if(first<0||count<1||count>10000000)throw std::runtime_error("Choose a finite valid export range");project.validate();Apartment apartment(COINIT_MULTITHREADED);Platform platform;
    GUID guid;checked(CoCreateGuid(&guid),"Export temporary ID");wchar_t id[40];StringFromGUID2(guid,id,40);auto temporary=output;temporary+=std::wstring(L".")+id+L".partial.mp4";
    HWND window=CreateWindowExW(0,L"STATIC",L"MyCut movie export",WS_POPUP,0,0,1280,720,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);if(!window)throw std::runtime_error("Cannot create movie export target");
    try{
        auto renderer=createD3D11Renderer(window,software);ComPtr<IMFSinkWriter> writer;checked(MFCreateSinkWriterFromURL(temporary.c_str(),nullptr,nullptr,&writer),"Create MP4 export");
        ComPtr<IMFMediaType> outputType;checked(MFCreateMediaType(&outputType),"Video encoder type");outputType->SetGUID(MF_MT_MAJOR_TYPE,MFMediaType_Video);outputType->SetGUID(MF_MT_SUBTYPE,MFVideoFormat_H264);outputType->SetUINT32(MF_MT_AVG_BITRATE,12000000);outputType->SetUINT32(MF_MT_INTERLACE_MODE,MFVideoInterlace_Progressive);
        MFSetAttributeSize(outputType.Get(),MF_MT_FRAME_SIZE,1280,720);MFSetAttributeRatio(outputType.Get(),MF_MT_FRAME_RATE,project.timeline.rateNumerator,project.timeline.rateDenominator);MFSetAttributeRatio(outputType.Get(),MF_MT_PIXEL_ASPECT_RATIO,1,1);
        DWORD stream;checked(writer->AddStream(outputType.Get(),&stream),"Add MP4 video stream");ComPtr<IMFMediaType> input;checked(MFCreateMediaType(&input),"Raw video type");input->SetGUID(MF_MT_MAJOR_TYPE,MFMediaType_Video);input->SetGUID(MF_MT_SUBTYPE,MFVideoFormat_RGB32);input->SetUINT32(MF_MT_INTERLACE_MODE,MFVideoInterlace_Progressive);
        MFSetAttributeSize(input.Get(),MF_MT_FRAME_SIZE,1280,720);MFSetAttributeRatio(input.Get(),MF_MT_FRAME_RATE,project.timeline.rateNumerator,project.timeline.rateDenominator);MFSetAttributeRatio(input.Get(),MF_MT_PIXEL_ASPECT_RATIO,1,1);input->SetUINT32(MF_MT_DEFAULT_STRIDE,1280*4);
        checked(writer->SetInputMediaType(stream,input.Get(),nullptr),"Set raw export format");checked(writer->BeginWriting(),"Start MP4 encoding");
        for(Frame frame=0;frame<count;++frame){if(progress&&!progress(frame,count))throw std::runtime_error("Export canceled");InputAppearance appearance;appearance.timeline=true;appearance.frame=first+frame;appearance.synchronousMedia=true;renderer->draw(project,0,0,1,0,-1,appearance);auto image=renderer->capture();
            ComPtr<IMFMediaBuffer> buffer;checked(MFCreateMemoryBuffer(static_cast<DWORD>(image.pixels.size()),&buffer),"Export frame buffer");BYTE* bytes;checked(buffer->Lock(&bytes,nullptr,nullptr),"Lock export frame");std::memcpy(bytes,image.pixels.data(),image.pixels.size());buffer->Unlock();buffer->SetCurrentLength(static_cast<DWORD>(image.pixels.size()));
            ComPtr<IMFSample> sample;checked(MFCreateSample(&sample),"Export sample");sample->AddBuffer(buffer.Get());auto start=frame*10000000LL*project.timeline.rateDenominator/project.timeline.rateNumerator,end=(frame+1)*10000000LL*project.timeline.rateDenominator/project.timeline.rateNumerator;
            sample->SetSampleTime(start);sample->SetSampleDuration(end-start);checked(writer->WriteSample(stream,sample.Get()),"Encode MP4 frame");}
        checked(writer->Finalize(),"Finalize MP4");writer.Reset();renderer.reset();DestroyWindow(window);window=nullptr;
        if(!MoveFileExW(temporary.c_str(),output.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))throw std::runtime_error("Cannot replace exported movie");if(progress)progress(count,count);
    }catch(...){if(window)DestroyWindow(window);std::error_code error;std::filesystem::remove(temporary,error);throw;}
}
}
