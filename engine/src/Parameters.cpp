#include "mycut/Parameters.h"
#include <cmath>
#include <utility>

namespace mycut {
ParameterType ParameterValue::type()const noexcept {
    static constexpr ParameterType types[]={ParameterType::Number,ParameterType::Integer,ParameterType::Boolean,ParameterType::Text,ParameterType::Color,ParameterType::Vector2,ParameterType::Vector3};
    return types[value_.index()];
}
namespace {
ParameterValidation shape(const ParameterDescriptor& d,const ParameterValue& value)noexcept {
    if(d.type!=value.type())return {ParameterError::TypeMismatch,"Parameter value has an incompatible type"};
    auto finite=[](double v){return std::isfinite(v);};bool valid=true;
    switch(value.type()){
        case ParameterType::Number:valid=finite(value.get<double>());break;
        case ParameterType::Color:{const auto& c=value.get<ParameterColor>();valid=finite(c.red)&&finite(c.green)&&finite(c.blue)&&finite(c.alpha);break;}
        case ParameterType::Vector2:{const auto& v=value.get<ParameterVector2>();valid=finite(v.x)&&finite(v.y);break;}
        case ParameterType::Vector3:{const auto& v=value.get<ParameterVector3>();valid=finite(v.x)&&finite(v.y)&&finite(v.z);break;}
        default:break;
    }
    return valid?ParameterValidation{}:ParameterValidation{ParameterError::NonFinite,"Parameter contains NaN or infinity"};
}
void require(ParameterValidation result){if(!result)throw ParameterException(result.error,result.message);}
bool limitsValid(const NumericLimits& r)noexcept {
    return (!r.minimum||std::isfinite(*r.minimum))&&(!r.maximum||std::isfinite(*r.maximum))&&(!r.minimum||!r.maximum||*r.minimum<=*r.maximum);
}
}
ParameterValidation validateParameterValue(const ParameterDescriptor& d,const ParameterValue& value)noexcept {
    auto result=shape(d,value);if(!result)return result;
    if(!limitsValid(d.modelLimits))return {ParameterError::InvalidDescriptor,"Invalid parameter model limits"};
    bool numeric=value.type()==ParameterType::Number||value.type()==ParameterType::Integer;
    if(!numeric&&(d.modelLimits.minimum||d.modelLimits.maximum))return {ParameterError::InvalidDescriptor,"Scalar limits require a numeric parameter"};
    if(value.type()==ParameterType::Number){double v=value.get<double>();
        if((d.modelLimits.minimum&&v<*d.modelLimits.minimum)||(d.modelLimits.maximum&&v>*d.modelLimits.maximum))return {ParameterError::ModelRange,"Parameter value exceeds model limits"};}
    if(value.type()==ParameterType::Integer){
        // Compare without rounding a 64-bit integer through double near +/- 2^63.
        const auto v=value.get<std::int64_t>();const auto& r=d.modelLimits;
        bool below=r.minimum&&(*r.minimum>=0x1p63||(*r.minimum> -0x1p63&&v<static_cast<std::int64_t>(std::ceil(*r.minimum))));
        bool above=r.maximum&&(*r.maximum< -0x1p63||(*r.maximum<0x1p63&&v>static_cast<std::int64_t>(std::floor(*r.maximum))));
        if(below||above)return {ParameterError::ModelRange,"Integer parameter value exceeds model limits"};
    }
    return {};
}
ParameterValue ParameterResolver::resolve(const ParameterDescriptor& d,const ParameterAddressView& address,const ParameterContext& context,const ParameterSources& sources)const {
    if(!d.id.value||d.semanticName.empty()||!limitsValid(d.presentation.suggestedRange)||!std::isfinite(d.presentation.step)||d.presentation.step<=0)
        throw ParameterException(ParameterError::InvalidDescriptor,"Invalid parameter descriptor");
    if(address.parameter!=d.id||!address.owner.id)throw ParameterException(ParameterError::InvalidAddress,"Parameter address does not match its descriptor");
    if(address.owner.kind!=ParameterOwnerKind::Data&&address.owner.kind!=ParameterOwnerKind::Node&&address.owner.kind!=ParameterOwnerKind::Space)
        throw ParameterException(ParameterError::InvalidAddress,"Unknown parameter owner kind");
    for(const auto& segment:address.instancePath)if(!segment.composition||!segment.item)throw ParameterException(ParameterError::InvalidAddress,"Incomplete instance path segment");
    if(context.time.denominator<=0)throw ParameterException(ParameterError::InvalidContext,"Parameter time denominator must be positive");
    require(validateParameterValue(d,d.defaultValue));
    auto value=d.defaultValue;
    auto apply=[&](const IParameterValueSource* source,bool animated){
        if(!source)return;auto sample=source->sample(address,context);if(!sample)return;
        if(animated&&!d.animatable)throw ParameterException(ParameterError::NotAnimatable,"Parameter is not animatable");
        require(shape(d,sample->value));
        switch(sample->mode){
            case ParameterApplyMode::Replace:value=std::move(sample->value);break;
            case ParameterApplyMode::Add:case ParameterApplyMode::Multiply:
                if(d.type!=ParameterType::Number)throw ParameterException(ParameterError::UnsupportedOperation,"Add and Multiply currently support Number parameters only");
                value=ParameterValue(sample->mode==ParameterApplyMode::Add?value.get<double>()+sample->value.get<double>():value.get<double>()*sample->value.get<double>());break;
            default:throw ParameterException(ParameterError::UnsupportedOperation,"Unknown parameter apply mode");
        }
        require(validateParameterValue(d,value));
    };
    apply(sources.data,false);apply(sources.itemOverride,false);apply(sources.animation,true);return value;
}
}
