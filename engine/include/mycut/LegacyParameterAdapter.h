#pragma once
#include "Parameters.h"
#include <array>

namespace mycut {
struct Node;
// Published ID: semantic name is mycut.exposure.stops. Never derived from slot 0.
inline constexpr ParameterId ExposureStopsId{0x4d43555400010001ULL};
const ParameterDescriptor& exposureStopsDescriptor();
class LegacyParameterAdapter final:public IParameterValueSource {
public:
    explicit LegacyParameterAdapter(const Node& node):node_(node){}
    std::optional<ParameterContribution> sample(const ParameterAddressView&,const ParameterContext&)const override;
    static void write(Node&,ParameterId,const ParameterValue&);
private:const Node& node_;
};
struct NodeParameterContext {
    std::span<const InstancePathElement> instancePath;
    ParameterContext evaluation;
    const IParameterValueSource* itemOverride=nullptr;
    const IParameterValueSource* animation=nullptr;
};
// Single CPU/GPU preparation function; keeps the current packed GPU ABI intact.
// Connected Stops is evaluated by the graph, so the unused fallback is not resolved.
std::array<float,8> nodeParameterValues(const Node&,const NodeParameterContext& context={});
}
