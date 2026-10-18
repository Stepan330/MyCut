#pragma once
#include <cstdint>
#ifdef MYCUT_BRIDGE_IMPLEMENTATION
#define MC_API extern "C" __declspec(dllexport)
#else
#define MC_API extern "C" __declspec(dllimport)
#endif
struct MCItem {
    std::uint64_t id,definition;
    float x,y,scaleX,scaleY,rotation,opacity,red,green,blue;
    int visible,locked;
};
struct MCContent {
    int kind,fontWeight,alignment,italic,underline;
    float width,height,fontSize,lineHeight,fillRed,fillGreen,fillBlue,fillAlpha,secondRed,secondGreen,secondBlue,secondAlpha,strokeRed,strokeGreen,strokeBlue,strokeAlpha,gradientAngle,strokeWidth;
};
struct MCGrade {
    float exposure,contrast,saturation,temperature,tint,pivot,liftR,liftG,liftB,gammaR,gammaG,gammaB,gainR,gainG,gainB,offsetR,offsetG,offsetB;
    int grayscale,invert;
};
struct MCTrack {std::uint64_t id;int muted,locked;};
struct MCClip {std::uint64_t id,instance,track;std::int64_t start,duration,sourceIn,fadeIn,fadeOut;float speed;int muted;};
struct MCNode {std::uint64_t id,input0,input1,input2;int kind,type;float x,y,v0,v1,v2,v3,v4,v5,v6,v7;};
struct MCHit { std::uint64_t id; int tool,handle; float distance; };
struct MCInputStyle {
    float handleRadius,objectMargin,handleSize,frameWidth,pointerX,pointerY,directionX,directionY,expansion,speed,magnet,horizon,red,green,blue;
    int debugFlags;
    std::uint64_t settleId;float settleX,settleY;
};
// All calls use cdecl; strings are UTF-16 at the boundary. Handles belong to one UI thread.
MC_API void* mc_create();
MC_API void mc_destroy(void*);
MC_API const wchar_t* mc_error(void*);
MC_API int mc_attach(void*,void* hwnd,int software);
MC_API int mc_detach(void*);
MC_API int mc_render(void*,int width,int height,std::uint64_t selected);
MC_API int mc_mask_preview(void*,std::uint64_t node);
MC_API int mc_surface(void*,int width,int height,void** surface);
MC_API int mc_frame_pixels(void*,std::uint8_t* pixels,int capacity);
MC_API int mc_editing_text(void*,std::uint64_t instance);
MC_API int mc_count(void*);
MC_API int mc_item(void*,int index,MCItem*);
MC_API const wchar_t* mc_name(void*,std::uint64_t id,int definition);
MC_API int mc_transform(void*,std::uint64_t id,float x,float y,float scaleX,float scaleY,float rotation,float opacity,int visible);
MC_API int mc_tint(void*,std::uint64_t id,float red,float green,float blue);
MC_API std::uint64_t mc_add(void*,int kind);
MC_API int mc_content_get(void*,std::uint64_t definition,MCContent*);
MC_API int mc_content_set(void*,std::uint64_t definition,const MCContent*,const wchar_t* text,const wchar_t* font);
MC_API const wchar_t* mc_content_string(void*,std::uint64_t definition,int field);
MC_API int mc_layer(void*,std::uint64_t instance,int operation,const wchar_t* name);
MC_API int mc_grade_get(void*,std::uint64_t instance,MCGrade*);
MC_API int mc_grade_set(void*,std::uint64_t instance,const MCGrade*);
MC_API int mc_scope_frame(void*,std::uint8_t* pixels,int capacity,int* width,int* height);
MC_API int mc_sample_color(void*,float x,float y,float* red,float* green,float* blue);
MC_API std::uint64_t mc_import_video(void*,const wchar_t*);
MC_API int mc_media_info(void*,std::uint64_t definition,double* duration,int* num,int* den);
MC_API int mc_pending(void*);
MC_API int mc_timeline_info(void*,int* num,int* den,std::int64_t* rangeIn,std::int64_t* rangeOut);
MC_API int mc_track_count(void*);
MC_API int mc_clip_count(void*);
MC_API int mc_track_get(void*,int index,MCTrack*);
MC_API const wchar_t* mc_track_name(void*,std::uint64_t);
MC_API int mc_clip_get(void*,int index,MCClip*);
MC_API std::uint64_t mc_track_add(void*,const wchar_t*);
MC_API std::uint64_t mc_clip_add(void*,std::uint64_t instance,std::uint64_t track,std::int64_t start,std::int64_t duration);
MC_API int mc_clip_set(void*,const MCClip*);
MC_API std::uint64_t mc_clip_split(void*,std::uint64_t,std::int64_t frame);
MC_API int mc_clip_remove(void*,std::uint64_t,int ripple);
MC_API int mc_track_set(void*,const MCTrack*);
MC_API int mc_timeline_range(void*,std::int64_t rangeIn,std::int64_t rangeOut);
MC_API int mc_timeline_preview(void*,int enabled,std::int64_t frame);
MC_API const wchar_t* mc_project_text(void*);
typedef int (*MCExportProgress)(std::int64_t done,std::int64_t total);
MC_API int mc_movie_export(const wchar_t* projectText,const wchar_t* path,std::int64_t first,std::int64_t count,int software,MCExportProgress,wchar_t* error,int capacity);
MC_API int mc_graph_info(void*,std::uint64_t instance,int* enabled,std::uint64_t* output);
MC_API int mc_graph_init(void*,std::uint64_t instance,int example);
MC_API int mc_graph_enabled(void*,std::uint64_t instance,int enabled);
MC_API int mc_node_count(void*,std::uint64_t instance);
MC_API int mc_node_get(void*,std::uint64_t instance,int index,MCNode*);
MC_API std::uint64_t mc_node_add(void*,std::uint64_t instance,int kind,float x,float y);
MC_API int mc_node_set(void*,std::uint64_t instance,const MCNode*);
MC_API int mc_node_remove(void*,std::uint64_t instance,std::uint64_t node);
MC_API int mc_node_connect(void*,std::uint64_t instance,std::uint64_t source,std::uint64_t target,int port);
MC_API int mc_gesture(void*,int begin);
MC_API int mc_undo(void*,int redo);
MC_API int mc_history(void*,int redo);
MC_API std::uint64_t mc_duplicate(void*,std::uint64_t);
MC_API int mc_remove(void*,std::uint64_t);
MC_API int mc_reset(void*);
MC_API int mc_new(void*);
MC_API int mc_workbench(void*);
MC_API int mc_save(void*,const wchar_t*);
MC_API int mc_load(void*,const wchar_t*);
MC_API std::uint64_t mc_import(void*,const wchar_t*);
MC_API int mc_export(void*,const wchar_t*,int viewportSize);
MC_API std::uint64_t mc_pick(void*,float x,float y);
MC_API const wchar_t* mc_stats(void*);
MC_API int mc_feedback(void*,std::uint64_t hovered,float selectionProgress,float hoverProgress,int hoveredHandle);
MC_API int mc_input_style(void*,const MCInputStyle*);
MC_API int mc_zone_config(void*,float speed,float coefficient,float influence,float shrink,float threshold,float maximum);
MC_API int mc_hit(void*,std::uint64_t selected,float x,float y,float dipsPerUnit,float intentX,float intentY,float expansion,MCHit*);
// phase: 0 = down, 1 = move, 2 = up, 3 = cancel. Coordinates are canvas units.
MC_API int mc_pointer(void*,int phase,std::uint64_t selected,float x,float y,float pixelsPerUnit,float intentX,float intentY,float expansion,int shift,std::uint64_t* result);
MC_API int mc_tool(void*,std::uint64_t selected,float x,float y,float pixelsPerUnit);
MC_API int mc_capture(void*,const wchar_t*);
MC_API int mc_handle(void*,std::uint64_t selected,int index,float pixelsPerUnit,float* x,float* y);
