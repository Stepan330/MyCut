#pragma once
#include "Project.h"
#include <functional>

namespace mycut {
class Session {
public:
    const Project& project() const { return project_; }
    void edit(const std::function<void(Project&)>&);
    void replace(Project);
    void beginEdit();
    void endEdit();
    void cancelEdit();
    bool undo();
    bool redo();
    bool canUndo() const { return !undo_.empty(); }
    bool canRedo() const { return !redo_.empty(); }
    Id duplicate(Id);
    void remove(Id);
private:
    void remember(Project);
    Project project_ = demoProject();
    std::vector<Project> undo_, redo_;
    bool editing_ = false;
    Project beforeEdit_;
};
}
