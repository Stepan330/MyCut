-- Resolve Multicam Replacer: internal Resolve script, no external Python/DLL.
local resolve = Resolve()
local fusion = resolve:Fusion()
local ui = fusion.UIManager
local dispatcher = bmd.UIDispatcher(ui)

local state = { context = nil, plan = nil }

local function isNamedObject(value)
    if type(value) ~= "table" and type(value) ~= "userdata" then return false end
    local ok, name = pcall(function() return value:GetName() end)
    return ok and type(name) == "string"
end

local function array(value)
    local result = {}
    local seen = {}
    if type(value) == "table" then
        for key, item in pairs(value) do
            local candidate = nil
            if isNamedObject(item) then candidate = item
            elseif isNamedObject(key) then candidate = key end
            if candidate and not seen[candidate] then
                seen[candidate] = true
                table.insert(result, candidate)
            elseif not candidate then
                print("Collection metadata skipped: key=" .. tostring(key) .. " value type=" .. type(item))
            end
        end
    end
    return result
end

local function integer(value, label)
    local number = tonumber(value)
    if not number then error("Не удалось прочитать " .. label .. ": " .. tostring(value)) end
    return math.floor(number + 0.5)
end

local function diagnosticCall(callback)
    local ok, value = pcall(callback)
    if not ok or value == nil then return "unavailable" end
    return tostring(value)
end

local function connect(chosenSource)
    local manager = resolve:GetProjectManager()
    local project = manager and manager:GetCurrentProject()
    if not project then error("В Resolve не открыт проект.") end
    local timeline = project:GetCurrentTimeline()
    if not timeline then error("В проекте не открыт таймлайн.") end
    local mediaPool = project:GetMediaPool()
    local source = chosenSource
    if not source then error("Выберите Multicam/Compound Clip в списке «Источник».") end
    return {project=project, timeline=timeline, mediaPool=mediaPool, multicam=source}
end

local function collectSources(folder, prefix, output)
    prefix = prefix or ""
    output = output or {}
    local seenClips = {}
    local clipCollections = {}
    local okNewClips, newClips = pcall(function() return folder:GetClipList() end)
    if okNewClips and newClips then table.insert(clipCollections, newClips) end
    local okOldClips, oldClips = pcall(function() return folder:GetClips() end)
    if okOldClips and oldClips then table.insert(clipCollections, oldClips) end
    if not okNewClips and not okOldClips then error("Resolve не дал прочитать клипы Media Pool.") end
    for _, collection in ipairs(clipCollections) do for _, clip in ipairs(array(collection)) do
        local identity = tostring(clip)
        if not seenClips[identity] then
            seenClips[identity] = true
            table.insert(output, {media=clip, label=prefix .. clip:GetName()})
        end
    end end
    local seenFolders, folderCollections = {}, {}
    local okNewFolders, newFolders = pcall(function() return folder:GetSubFolderList() end)
    if okNewFolders and newFolders then table.insert(folderCollections, newFolders) end
    local okOldFolders, oldFolders = pcall(function() return folder:GetSubFolders() end)
    if okOldFolders and oldFolders then table.insert(folderCollections, oldFolders) end
    if not okNewFolders and not okOldFolders then error("Resolve не дал прочитать папки Media Pool.") end
    for _, collection in ipairs(folderCollections) do for _, child in ipairs(array(collection)) do
        local identity = tostring(child)
        if not seenFolders[identity] then
            seenFolders[identity] = true
            collectSources(child, prefix .. child:GetName() .. " / ", output)
        end
    end end
    return output
end

local function duration(media)
    local props = media:GetClipProperty() or {}
    local frames = props["Frames"]
    if not frames or frames == "" then
        error("Resolve не вернул свойство Frames для выбранного Multicam/Compound Clip.")
    end
    return integer(frames, "длительность источника")
end

local function readTrack(timeline, kind, track)
    local count = integer(timeline:GetTrackCount(kind) or 0, "число дорожек")
    local prefix = kind == "video" and "V" or "A"
    if track < 1 or track > count then error("Дорожка " .. prefix .. track .. " не существует.") end
    local nativeItems = array(timeline:GetItemListInTrack(kind, track))
    table.sort(nativeItems, function(a,b) return a:GetStart() < b:GetStart() end)
    local spans = {}
    for index, item in ipairs(nativeItems) do
        local media = item:GetMediaPoolItem()
        if media then
            local asset = media:GetUniqueId() or media:GetMediaId() or media:GetName()
            local ts, te = integer(item:GetStart(), "Timeline Start"), integer(item:GetEnd(), "Timeline End")
            local ss, se = integer(item:GetSourceStartFrame(), "Source Start"), integer(item:GetSourceEndFrame(), "Source End")
            -- Source frame bounds can be rounded outwards by Resolve. Confirm
            -- duration using seconds before accepting the observed +2 anomaly.
            local normal = math.abs((se-ss+1)-(te-ts)) <= 1
            local startSeconds = tonumber(diagnosticCall(function() return item:GetSourceStartTime() end))
            local endSeconds = tonumber(diagnosticCall(function() return item:GetSourceEndTime() end))
            local fps = tonumber(diagnosticCall(function() return timeline:GetSetting("timelineFrameRate") end))
            local sourceFps = tonumber(diagnosticCall(function() return media:GetClipProperty("FPS") end))
            if startSeconds and endSeconds and fps and sourceFps
                and math.abs(fps-sourceFps) < 0.00001 then
                local timeDuration = (endSeconds-startSeconds)*fps
                normal = math.abs(timeDuration-(te-ts)) < 0.05
                if normal and math.abs((se-ss+1)-(te-ts)) <= 2 then
                    local left = tonumber(diagnosticCall(function() return item:GetLeftOffset() end))
                    if left and math.abs(left-ss) <= 1.01 then
                        ss = integer(left, "LeftOffset")
                        se = ss + (te-ts) - 1
                    end
                end
            end
            table.insert(spans, {
                index=index, item=item, name=item:GetName() or (prefix .. index), asset=tostring(asset),
                ts=ts, te=te, ss=ss, se=se, duration=te-ts,
                normal=normal,
                diagnostic=string.format("timeline=[%d,%d), duration=%d; source=[%d,%d], span=%d, delta=%d", ts,te,te-ts,ss,se,se-ss+1,(se-ss+1)-(te-ts))
                    .. "; GetDuration=" .. diagnosticCall(function() return item:GetDuration() end)
                    .. "; SourceStartTime=" .. diagnosticCall(function() return item:GetSourceStartTime() end)
                    .. "; SourceEndTime=" .. diagnosticCall(function() return item:GetSourceEndTime() end)
                    .. "; LeftOffset=" .. diagnosticCall(function() return item:GetLeftOffset() end)
                    .. "; source FPS=" .. diagnosticCall(function() return media:GetClipProperty("FPS") end)
                    .. "; timeline FPS=" .. diagnosticCall(function() return timeline:GetSetting("timelineFrameRate") end)
            })
        end
    end
    return spans, nativeItems
end

local function addEdge(graph, source, target, delta)
    graph[source] = graph[source] or {}
    table.insert(graph[source], {target=target, delta=delta})
end

local function buildPlan(context, videoTrack, audioTrack, anchorFrame)
    local videos = readTrack(context.timeline, "video", videoTrack)
    local audios = readTrack(context.timeline, "audio", audioTrack)
    if #videos == 0 then error("На выбранной видеодорожке нет клипов.") end
    if #audios == 0 then error("На выбранной аудиодорожке нет клипов.") end
    local anchor = videos[1]
    if not anchor.normal then error("Длительности первого видеофрагмента расходятся: " .. anchor.diagnostic) end
    local graph = {}
    for _, v in ipairs(videos) do
        if v.normal then for _, a in ipairs(audios) do
            if a.normal then
                local at = math.max(v.ts, a.ts)
                if at < math.min(v.te, a.te) then
                    local vlocal = v.ss + at - v.ts
                    local alocal = a.ss + at - a.ts
                    addEdge(graph, v.asset, a.asset, vlocal-alocal)
                    addEdge(graph, a.asset, v.asset, alocal-vlocal)
                end
            end
        end end
    end
    local bases = {[anchor.asset]=anchorFrame-anchor.ss}
    local queue, head, conflicts = {anchor.asset}, 1, {}
    while head <= #queue do
        local current = queue[head]; head = head + 1
        for _, edge in ipairs(graph[current] or {}) do
            local calculated = bases[current] + edge.delta
            if bases[edge.target] == nil then
                bases[edge.target] = calculated; table.insert(queue, edge.target)
            elseif math.abs(bases[edge.target]-calculated) > 2 then
                table.insert(conflicts, {asset=edge.target, expected=bases[edge.target], calculated=calculated})
            end
        end
    end
    local total, replacements, rejected = duration(context.multicam), {}, {}
    for _, clip in ipairs(videos) do
        local reason = nil
        if not clip.normal then reason = "расхождение длительностей (изменение скорости НЕ подтверждено): " .. clip.diagnostic
        elseif bases[clip.asset] == nil then reason = "нет цепочки синхронизации через выбранное аудио"
        else
            local first = bases[clip.asset] + clip.ss
            local last = first + clip.duration - 1
            if first < 0 then reason = "In раньше начала Multicam"
            elseif last >= total then reason = "Out позже конца Multicam"
            else table.insert(replacements, {clip=clip, first=first, last=last}) end
        end
        if reason then table.insert(rejected, {clip=clip, reason=reason}) end
    end
    return {anchor=anchor, bases=bases, replacements=replacements, rejected=rejected,
            conflicts=conflicts, videoTrack=videoTrack, audioTrack=audioTrack, audios=audios}
end

local function uniqueName(project, base)
    local existing = {}
    for i=1, project:GetTimelineCount() do existing[project:GetTimelineByIndex(i):GetName()] = true end
    local stem = base .. " [Multicam copy]"
    local name, serial = stem, 2
    while existing[name] do name = stem .. " " .. serial; serial = serial + 1 end
    return name
end

local function applyPlan(context, plan)
    local name = uniqueName(context.project, context.timeline:GetName())
    local duplicate = context.timeline:DuplicateTimeline(name)
    if not duplicate then error("Resolve не смог создать копию таймлайна. Исходник не изменён.") end
    context.project:SetCurrentTimeline(duplicate)
    local items = array(duplicate:GetItemListInTrack("video", plan.videoTrack))
    table.sort(items, function(a,b) return a:GetStart() < b:GetStart() end)
    local errors = {}
    for _, replacement in ipairs(plan.replacements) do
        local item = items[replacement.clip.index]
        if not item then table.insert(errors, replacement.clip.name .. ": не найден в копии")
        else
            local before = item:GetTakesCount() or 0
            if not item:AddTake(context.multicam, replacement.first, replacement.last) then
                table.insert(errors, replacement.clip.name .. ": Resolve отклонил AddTake")
            else
                local after = item:GetTakesCount() or 0
                if after <= before or not item:SelectTakeByIndex(after) then
                    table.insert(errors, replacement.clip.name .. ": take добавлен, но не выбран")
                end
            end
        end
    end
    if #errors > 0 then duplicate:SetName(name .. " [CHECK ERRORS]") end
    return duplicate, errors
end

local window = dispatcher:AddWindow({ID="MulticamReplacer", WindowTitle="Resolve Multicam Replacer",
    Geometry={200, 150, 900, 620}}, ui:VGroup{
    ui:HGroup{Weight=0, ui:Label{Text="Источник Multicam/Compound"},
        ui:ComboBox{ID="Source"}, ui:Button{ID="RefreshSources", Text="Обновить список"}},
    ui:HGroup{Weight=0,
        ui:Label{Text="Видеодорожка"}, ui:SpinBox{ID="VideoTrack", Minimum=1, Maximum=99, Value=1},
        ui:Label{Text="Аудиодорожка"}, ui:SpinBox{ID="AudioTrack", Minimum=1, Maximum=99, Value=1},
        ui:Label{Text="Multicam In первого клипа"}, ui:SpinBox{ID="Anchor", Minimum=0, Maximum=99999999, Value=0},
    },
    ui:Label{ID="SourceStatus", Weight=0, Text="Выберите Multicam/Compound Clip в списке выше. Сначала выполняется только проверка."},
    ui:TextEdit{ID="Output", ReadOnly=true, Font={Family="Consolas", PixelSize=13}},
    ui:HGroup{Weight=0, ui:Button{ID="Preview", Text="Проверить"},
        ui:Button{ID="Apply", Text="Создать копию и заменить", Enabled=false},
        ui:Button{ID="Close", Text="Закрыть"}}
})
local items = window:GetItems()

local function refreshSources()
    items.Apply.Enabled = false
    state.context, state.plan = nil, nil
    items.Source:Clear()
    state.sources = {}
    local manager = resolve:GetProjectManager()
    local project = manager and manager:GetCurrentProject()
    if not project then return end
    state.sources = collectSources(project:GetMediaPool():GetRootFolder(), "", {})
    table.sort(state.sources, function(a,b) return a.label:lower() < b.label:lower() end)
    for _, source in ipairs(state.sources) do items.Source:AddItem(source.label) end
    if #state.sources > 0 then items.Source.CurrentIndex = 0 end
    items.SourceStatus.Text = "Найдено объектов Media Pool: " .. #state.sources .. ". Выберите Multicam/Compound Clip в списке выше."
    if #state.sources == 0 then
        items.Output.PlainText = "API не вернул распознаваемых клипов. Диагностика типов выведена в Workspace > Console."
    else
        items.Output.PlainText = "Список загружен. Выберите источник и нажмите Проверить."
    end
end

function window.On.RefreshSources.Clicked()
    local ok, err = pcall(refreshSources)
    if not ok then items.Output.PlainText = "Ошибка чтения Media Pool: " .. tostring(err) end
end

local function showError(message)
    items.Output.PlainText = "ОШИБКА: " .. tostring(message)
    print("Resolve Multicam Replacer: " .. tostring(message))
end

function window.On.Preview.Clicked()
    items.Apply.Enabled = false
    local ok, result = pcall(function()
        local chosen = state.sources and state.sources[(items.Source.CurrentIndex or 0) + 1]
        local context = connect(chosen and chosen.media or nil)
        local plan = buildPlan(context, items.VideoTrack.Value, items.AudioTrack.Value, items.Anchor.Value)
        state.context, state.plan = context, plan
        local lines = {"Проект: " .. context.project:GetName(), "Таймлайн: " .. context.timeline:GetName(),
            "Источник: " .. context.multicam:GetName(), "Якорный клип: " .. plan.anchor.name, "",
            "Будет заменено: " .. #plan.replacements}
        for _, r in ipairs(plan.replacements) do
            table.insert(lines, string.format("OK  [%d, %d) %s -> source [%d, %d]", r.clip.ts, r.clip.te, r.clip.name, r.first, r.last))
        end
        if #plan.rejected > 0 then table.insert(lines, "\nБудет пропущено: " .. #plan.rejected) end
        for _, r in ipairs(plan.rejected) do table.insert(lines, "SKIP  " .. r.clip.name .. ": " .. r.reason) end
        for _, a in ipairs(plan.audios) do
            if not a.normal then table.insert(lines, "AUDIO CHECK " .. a.name .. ": " .. a.diagnostic) end
        end
        if #plan.conflicts > 0 then table.insert(lines, "\nКОНФЛИКТЫ СИНХРОНИЗАЦИИ — применение заблокировано") end
        for _, c in ipairs(plan.conflicts) do table.insert(lines, c.asset .. ": " .. c.expected .. " / " .. c.calculated) end
        items.Output.PlainText = table.concat(lines, "\n")
        items.Apply.Enabled = #plan.replacements > 0 and #plan.conflicts == 0
    end)
    if not ok then showError(result) end
end

function window.On.Apply.Clicked()
    items.Apply.Enabled = false
    local ok, result = pcall(function()
        local duplicate, errors = applyPlan(state.context, state.plan)
        local text = "Создан таймлайн: " .. duplicate:GetName() .. "\nЗаменено: " .. #state.plan.replacements
        if #errors > 0 then text = text .. "\n\nОшибки:\n" .. table.concat(errors, "\n") end
        items.Output.PlainText = text
    end)
    if not ok then showError(result) end
end

function window.On.Close.Clicked() dispatcher:ExitLoop() end
function window.On.MulticamReplacer.Close() dispatcher:ExitLoop() end
window:Show()
local startupOk, startupError = pcall(refreshSources)
if not startupOk then showError(startupError) end
dispatcher:RunLoop()
window:Hide()
