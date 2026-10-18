#pragma once
#include <algorithm>
#include <cmath>

namespace mycut {
// Presentation only. Never used by the resolver or debug zones.
struct ZonePresentation {
    float radius=0,opacity=0;
    bool initialized=false;
    void update(float targetRadius,float targetOpacity,float seconds,bool reduced=false){
        targetOpacity=std::clamp(targetOpacity,0.f,1.f);
        if(!initialized){radius=targetRadius;initialized=true;}
        if(reduced){radius=targetRadius;opacity=targetOpacity;return;}
        float dt=std::clamp(seconds,0.f,.1f);
        radius+=(targetRadius-radius)*(1-std::exp(-dt/.12f));
        opacity+=(targetOpacity-opacity)*(1-std::exp(-dt/.085f));
        if(std::abs(radius-targetRadius)<.05f)radius=targetRadius;
        if(std::abs(opacity-targetOpacity)<.002f)opacity=targetOpacity;
    }
    bool pending(float targetRadius,float targetOpacity)const{return std::abs(radius-targetRadius)>=.05f||std::abs(opacity-targetOpacity)>=.002f;}
};
}
