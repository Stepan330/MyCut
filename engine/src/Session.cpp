#include "mycut/Session.h"
#include <algorithm>
#include <limits>
#include <stdexcept>

namespace mycut {
void Session::remember(Project p) {
    if (undo_.size() == 100) undo_.erase(undo_.begin());
    undo_.push_back(std::move(p)); redo_.clear();
}
void Session::edit(const std::function<void(Project&)>& fn) {
    Project candidate = project_;
    fn(candidate); candidate.validate();
    if (candidate == project_) return;
    if (!editing_) remember(project_);
    project_ = std::move(candidate);
}
void Session::replace(Project p) {
    p.validate(); project_ = std::move(p); undo_.clear(); redo_.clear(); editing_ = false;
}
void Session::beginEdit() {
    if (!editing_) { beforeEdit_ = project_; editing_ = true; }
}
void Session::endEdit() {
    if (editing_ && beforeEdit_ != project_) remember(std::move(beforeEdit_));
    editing_ = false;
}
bool Session::undo() {
    endEdit(); if (undo_.empty()) return false;
    redo_.push_back(std::move(project_)); project_ = std::move(undo_.back()); undo_.pop_back(); return true;
}
void Session::cancelEdit() {
    if(editing_)project_=std::move(beforeEdit_);
    editing_=false;
}
bool Session::redo() {
    endEdit(); if (redo_.empty()) return false;
    undo_.push_back(std::move(project_)); project_ = std::move(redo_.back()); redo_.pop_back(); return true;
}
Id Session::duplicate(Id source) {
    Id result = 0;
    edit([&](Project& p) {
        if (p.nextId == std::numeric_limits<Id>::max()) throw std::runtime_error("Stable ID space exhausted");
        auto copy = p.instance(source);
        result = copy.id = p.nextId++;
        copyGraph(p,copy.graph);
        copy.name += " / copy"; copy.transform.x += 40; copy.transform.y += 40;
        p.instances.push_back(std::move(copy));
    });
    return result;
}
void Session::remove(Id source) {
    edit([&](Project& p) { (void)p.instance(source);std::erase_if(p.timeline.clips,[&](const Clip& c){return c.instance==source;}); std::erase_if(p.instances,[&](const Instance& i){return i.id==source;}); });
}
}
