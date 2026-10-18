#include "mycut/LegacyParameterAdapter.h"
#include "mycut/Nodes.h"

namespace mycut {
const ParameterDescriptor& exposureStopsDescriptor(){
    static const ParameterDescriptor descriptor{ExposureStopsId,"mycut.exposure.stops","Stops default",ParameterType::Number,ParameterValue(0.0),
        {-100000.0,100000.0},{{-20.0,20.0},.05,"EV"},true,true};
    return descriptor;
}
std::optional<ParameterContribution> LegacyParameterAdapter::sample(const ParameterAddressView& address,const ParameterContext&)const {
    if(node_.kind!=NodeKind::Exposure||address.owner!=ParameterOwner{ParameterOwnerKind::Node,node_.id}||address.parameter!=ExposureStopsId)return std::nullopt;
    return ParameterContribution{ParameterValue(static_cast<double>(node_.values[0]))};
}
void LegacyParameterAdapter::write(Node& node,ParameterId id,const ParameterValue& value){
    if(node.kind!=NodeKind::Exposure||id!=ExposureStopsId)throw ParameterException(ParameterError::InvalidAddress,"Parameter is not mapped to this legacy node");
    auto result=validateParameterValue(exposureStopsDescriptor(),value);if(!result)throw ParameterException(result.error,result.message);
    node.values[0]=static_cast<float>(value.get<double>());
}
std::array<float,8> nodeParameterValues(const Node& node,const NodeParameterContext& context){
    auto values=node.values;
    if(node.kind==NodeKind::Exposure&&!node.inputs[1]){
        const LegacyParameterAdapter source(node);
        const ParameterAddressView address{context.instancePath,{ParameterOwnerKind::Node,node.id},ExposureStopsId};
        const auto resolved=ParameterResolver{}.resolve(exposureStopsDescriptor(),address,context.evaluation,{&source,context.itemOverride,context.animation});
        values[0]=static_cast<float>(resolved.get<double>());
    }
    return values;
}
}
