#include "mycut/Session.h"
#include <cmath>
#include <iostream>
#include <sstream>
#include <stdexcept>

void check(bool condition,const char* text) { if (!condition) throw std::runtime_error(text); }
template<class F> void rejects(F f) { bool rejected=false; try { f(); } catch(const std::exception&) { rejected=true; } check(rejected,"Expected validation failure"); }
int main() {
    try {
        mycut::Session s;
        const auto initial = s.project();
        s.edit([](auto& p){p.instance(2).transform.x=200;});
        check(s.project().instance(3)==initial.instance(3),"Instance edits leaked");
        s.edit([](auto& p){p.definition(1).red=.25f;});
        for (auto& plane:mycut::evaluateScene(s.project())) check(plane.red==.25f,"Definition did not propagate");
        check(s.undo() && s.project().definition(1).red==1,"Undo failed");
        check(s.redo() && s.project().definition(1).red==.25f,"Redo failed");
        auto before=s.project();
        s.beginEdit();
        for(int n=0;n<20;++n) s.edit([&](auto& p){p.instance(2).transform.x=static_cast<float>(n);});
        s.endEdit(); check(s.undo() && s.project()==before,"Gesture must produce one undo entry");
        auto copy=s.duplicate(2);
        check(copy==5 && s.project().instance(copy).definition==1,"Duplicate identity invalid");
        s.remove(copy); check(s.project().instances.size()==3,"Remove failed");
        s.undo(); check(s.project().instances.size()==4,"Delete undo failed");
        s.edit([](auto& p){p.definition(1).name="Фото \\\"test\\\"";p.definition(1).source="D:/Тест/фото.png";});
        std::stringstream stream; mycut::serialize(s.project(),stream);
        check(mycut::deserialize(stream)==s.project(),"Serialization roundtrip mismatch");
        before=s.project();
        rejects([&]{s.edit([](auto& p){p.instance(2).definition=999;});});
        check(s.project()==before,"Failed command changed project");
        rejects([&]{s.edit([](auto& p){p.instance(2).transform.scaleX=0;});});
        rejects([&]{s.edit([](auto& p){p.definition(1).text=std::string(1,static_cast<char>(0xff));});});
        rejects([&]{s.edit([](auto& p){p.instances[1].id=2;});});
        rejects([&]{std::stringstream bad("MYCUT 999\n");mycut::deserialize(bad);});
        rejects([&]{std::stringstream bad("MYCUT 1\n2 0 10001");mycut::deserialize(bad);});
        std::stringstream legacy("MYCUT 1\n3 1 1\n1 \"D\" \"\" 100 80 1 1 1\n2 1 \"I\" 10 20 2 30 1 1\n");
        auto migrated=mycut::deserialize(legacy);check(migrated.instance(2).transform.scaleX==2 && migrated.instance(2).transform.scaleY==2,"Version 1 scale migration failed");
        check(mycut::hitTest(initial,410,340)==2,"Transformed hit test failed");
        check(mycut::hitTest(initial,5,5)==0,"Empty hit test failed");
        s.replace(initial); check(!s.canUndo() && !s.canRedo(),"Load must clear history");
        std::cout << "PASS: instance isolation, shared definitions, undo/redo, gesture grouping, stable IDs, UTF-8 serialization, validation, hit testing\n";
        return 0;
    } catch(const std::exception& e) { std::cerr << "FAIL: " << e.what() << '\n';return 1; }
}
