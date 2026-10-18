#pragma once
#include "Renderer.h"
#include <functional>

namespace mycut {
struct MediaInfo {unsigned width=0,height=0;double duration=0;int rateNumerator=30,rateDenominator=1;};
MediaInfo probeVideo(const std::filesystem::path&);
struct VideoFrame {std::shared_ptr<const Image> image;std::int64_t key=-1;bool pending=true;};
class VideoSource {
public:
    explicit VideoSource(std::filesystem::path);
    ~VideoSource();
    VideoFrame frame(double seconds,bool wait=false);
private:
    struct Impl;std::unique_ptr<Impl> impl_;
};
using ExportProgress=std::function<bool(Frame done,Frame total)>;
void exportMovie(const Project&,const std::filesystem::path&,Frame first,Frame count,bool software,const ExportProgress& progress={});
}
