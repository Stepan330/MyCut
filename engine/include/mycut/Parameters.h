#pragma once
#include <cstdint>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <variant>
#include <vector>
#include <utility>
#include <algorithm>

namespace mycut {
// Explicit published IDs, independent of labels, storage slots and enum ordinals.
// A semantic name may change; a published ID must never be reassigned.
struct ParameterId {
    std::uint64_t value=0;
    explicit constexpr ParameterId(std::uint64_t id=0):value(id){}
    bool operator==(const ParameterId&)const=default;
};
struct ParameterColor {double red=0,green=0,blue=0,alpha=1;bool operator==(const ParameterColor&)const=default;};
struct ParameterVector2 {double x=0,y=0;bool operator==(const ParameterVector2&)const=default;};
struct ParameterVector3 {double x=0,y=0,z=0;bool operator==(const ParameterVector3&)const=default;};
enum class ParameterType {Number,Integer,Boolean,Text,Color,Vector2,Vector3};
class ParameterValue {
public:
    using Storage=std::variant<double,std::int64_t,bool,std::string,ParameterColor,ParameterVector2,ParameterVector3>;
    explicit ParameterValue(double v):value_(v){}
    explicit ParameterValue(std::int64_t v):value_(v){}
    explicit ParameterValue(bool v):value_(v){}
    explicit ParameterValue(std::string v):value_(std::move(v)){}
    explicit ParameterValue(ParameterColor v):value_(v){}
    explicit ParameterValue(ParameterVector2 v):value_(v){}
    explicit ParameterValue(ParameterVector3 v):value_(v){}
    ParameterValue(const char*)=delete; // Prevent accidental pointer -> bool.
    ParameterType type()const noexcept;
    template<class T>const T& get()const{return std::get<T>(value_);}
    bool operator==(const ParameterValue&)const=default;
private:
    Storage value_;
};
struct NumericLimits {std::optional<double> minimum,maximum;};
struct ParameterPresentation {
    NumericLimits suggestedRange; // UI hints only. Never applied by the resolver.
    double step=1;
    std::string_view unit;
};
struct ParameterDescriptor {
    ParameterId id;
    std::string_view semanticName,label;
    ParameterType type=ParameterType::Number;
    ParameterValue defaultValue{0.0};
    NumericLimits modelLimits;
    ParameterPresentation presentation;
    bool animatable=false,exposable=false;
};
enum class ParameterOwnerKind {Data,Node,Space};
struct ParameterOwner {ParameterOwnerKind kind=ParameterOwnerKind::Node;std::uint64_t id=0;bool operator==(const ParameterOwner&)const=default;};
// Ordered root -> leaf occurrences, not merely the reusable prefab definition ID.
struct InstancePathElement {std::uint64_t composition=0,item=0;bool operator==(const InstancePathElement&)const=default;};
struct ParameterAddressView {
    // Borrowed for a synchronous evaluation; persistent addresses own their path below.
    std::span<const InstancePathElement> instancePath;
    ParameterOwner owner;
    ParameterId parameter;
    bool operator==(const ParameterAddressView& other)const {
        return owner==other.owner&&parameter==other.parameter&&std::equal(instancePath.begin(),instancePath.end(),other.instancePath.begin(),other.instancePath.end());
    }
};
struct ParameterAddress {
    std::vector<InstancePathElement> instancePath;
    ParameterOwner owner;
    ParameterId parameter;
    bool operator==(const ParameterAddress&)const=default;
    operator ParameterAddressView()const & noexcept{return {instancePath,owner,parameter};}
    operator ParameterAddressView()const &&=delete;
};
struct ParameterTime {std::int64_t numerator=0,denominator=1;};
struct ParameterContext {ParameterTime time;};
enum class ParameterApplyMode {Replace,Add,Multiply};
struct ParameterContribution {
    ParameterValue value;
    ParameterApplyMode mode=ParameterApplyMode::Replace;
};
class IParameterValueSource {
public:
    virtual ~IParameterValueSource()=default;
    // Missing is distinct from invalid: malformed samples produce validation errors.
    virtual std::optional<ParameterContribution> sample(const ParameterAddressView&,const ParameterContext&)const=0;
};
struct ParameterSources {
    const IParameterValueSource* data=nullptr;
    const IParameterValueSource* itemOverride=nullptr;
    const IParameterValueSource* animation=nullptr;
};
enum class ParameterError {None,InvalidDescriptor,InvalidAddress,InvalidContext,TypeMismatch,NonFinite,ModelRange,UnsupportedOperation,NotAnimatable};
struct ParameterValidation {
    ParameterError error=ParameterError::None;
    const char* message="";
    explicit operator bool()const noexcept{return error==ParameterError::None;}
};
class ParameterException:public std::runtime_error {
public:
    ParameterException(ParameterError code,const char* message):std::runtime_error(message),code_(code){}
    ParameterError code()const noexcept{return code_;}
private:ParameterError code_;
};
ParameterValidation validateParameterValue(const ParameterDescriptor&,const ParameterValue&)noexcept;
class ParameterResolver {
public:
    // Default -> Data -> Item Override -> Animation. Each sample carries its apply mode.
    // Graph connections are deliberately NOT one of these layers.
    ParameterValue resolve(const ParameterDescriptor&,const ParameterAddressView&,const ParameterContext& context={},const ParameterSources& sources={})const;
};
}
