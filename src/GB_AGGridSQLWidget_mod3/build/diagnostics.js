(function () {
    'use strict';
    var capacity = 2000, buffer = new Array(capacity), head = 0, size = 0, discarded = 0;
    var sequence = 0, refreshSequence = 0, context = null, scopeEvent = null;
    var mode = 'Summary', capturing = true, open = false, paused = false;
    var instanceId = 'MOD3-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    var counters = Object.create(null), propertyCounters = Object.create(null);
    var uiTimer = null, healthTimer = null, observer = null, lastTick = 0, dirty = true;
    var ui, dead = false, installed = false;
    var functionNames = ['RefreshData','RefreshColumns','ApplyRowsToSelect','RefreshCells','ApplyColumnSizing','SetDirtyAndPublishData'];
    var supportedLongTasks = false;
    var stats = {maxRefreshDispatchMs:0,maxTimerIntervalMs:0,maxLongTaskMs:0};

    function active() { return capturing && mode !== 'Off' && !dead; }
    function now() { return performance.now(); }
    function round(n) { return Math.round(n * 100) / 100; }
    function count(name) { if (active()) counters[name] = (counters[name] || 0) + 1; }
    function metadata(value) {
        if (typeof value === 'string') return {type:'string',characters:value.length};
        if (value === null || value === undefined) return {type:String(value)};
        return {type:typeof value};
    }
    function entries() {
        var out = [];
        for (var i = 0; i < size; i++) out.push(buffer[(head + i) % capacity]);
        return out;
    }
    function record(event, detail, level, force) {
        if (!active() || (mode !== 'Trace' && !force && level !== 'WARN' && level !== 'ERROR')) return null;
        var item = {sequence:++sequence,timestamp:new Date().toISOString(),monotonicMs:round(now()),instanceId:instanceId,refreshId:context,eventId:'event-'+sequence,parentEventId:scopeEvent,event:event,level:level || 'INFO',detail:detail || {}};
        if (size < capacity) { buffer[(head + size) % capacity] = item; size++; }
        else { buffer[head] = item; head = (head + 1) % capacity; discarded++; }
        dirty = true;
        return item.eventId;
    }
    function plainError(error) { return {name:error && error.name || 'Error'}; }
    function setMode(value) {
        if (['Off','Summary','Trace'].indexOf(value) < 0) return;
        mode = value;
        refreshMonitors();
        record('capture.mode',{mode:mode},'INFO',true);
        dirty = true;
        render(true);
    }
    function setCapture(value) {
        capturing = !!value;
        refreshMonitors();
        record('capture.started',{mode:mode},'INFO',true);
        dirty = true;
        render(true);
    }
    function clear() {
        buffer = new Array(capacity); head = 0; size = 0; discarded = 0;
        counters = Object.create(null); propertyCounters = Object.create(null);
        stats = {maxRefreshDispatchMs:0,maxTimerIntervalMs:0,maxLongTaskMs:0};
        dirty = true;
        if (ui) ui.detail.textContent = 'Select an event to inspect its metadata.';
        render(true);
    }
    function refreshMonitors() {
        if (healthTimer !== null) clearInterval(healthTimer);
        healthTimer = null;
        if (observer) observer.disconnect();
        observer = null;
        if (!active()) return;
        lastTick = now();
        healthTimer = setInterval(function () {
            var elapsed = now() - lastTick;
            lastTick = now();
            stats.maxTimerIntervalMs = Math.max(stats.maxTimerIntervalMs, elapsed);
            if (elapsed > 450) record('health.timer.delay',{requestedMs:250,intervalMs:round(elapsed)},'WARN');
        }, 250);
        try {
            supportedLongTasks = !!(window.PerformanceObserver && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('longtask') >= 0);
            if (supportedLongTasks) {
                observer = new PerformanceObserver(function (list) {
                    list.getEntries().forEach(function (entry) {
                        count('longTask');
                        stats.maxLongTaskMs = Math.max(stats.maxLongTaskMs, entry.duration);
                        record('health.longtask',{startMs:round(entry.startTime),durationMs:round(entry.duration)},entry.duration >= 200 ? 'WARN' : 'INFO');
                    });
                });
                observer.observe({type:'longtask',buffered:false});
            }
        } catch (e) { observer = null; supportedLongTasks = false; }
    }
    function wrapFunction(name) {
        var original = window[name];
        if (typeof original !== 'function') return;
        window[name] = function () {
            if (!active()) return original.apply(this, arguments);
            var previousContext = context;
            if (name === 'RefreshData' && !context) context = 'refresh-'+(++refreshSequence);
            var started = now(), parent = scopeEvent;
            count(name);
            var id = record('function.begin',{name:name});
            if (id) scopeEvent = id;
            try { return original.apply(this, arguments); }
            catch (error) { record('function.error',{name:name,error:plainError(error)},'ERROR'); throw error; }
            finally {
                var duration = round(now() - started);
                if (name === 'RefreshData') stats.maxRefreshDispatchMs = Math.max(stats.maxRefreshDispatchMs, duration);
                record(name === 'RefreshData' ? 'refresh.dispatch.summary' : 'function.end',{name:name,durationMs:duration,rows:name === 'RefreshData' && window.GridApi ? GridApi.getDisplayedRowCount() : undefined},duration >= 100 ? 'WARN' : 'INFO',name === 'RefreshData' || name === 'RefreshColumns');
                scopeEvent = parent;
                context = previousContext;
            }
        };
    }
    function installRuntime() {
        if (installed) return;
        installed = true;
        functionNames.forEach(wrapFunction);
        record('widget.initializing',{instanceId:instanceId},'INFO',true);
    }
    function attachGrid(api) {
        ['setGridOption','refreshCells','redrawRows','ensureIndexVisible'].forEach(function (name) {
            var original = api[name];
            if (typeof original !== 'function') return;
            api[name] = function () {
                if (!active()) return original.apply(api,arguments);
                var started = now();
                count('api.'+name);
                record('grid.api.begin',{method:name,option:name === 'setGridOption' ? arguments[0] : undefined});
                try { return original.apply(api,arguments); }
                finally { record('grid.api.end',{method:name,durationMs:round(now()-started)}); }
            };
        });
        record('widget.ready',{apiAttached:true},'INFO',true);
    }
    function property(name, value, callback, receiver, args) {
        if (!active()) return callback.apply(receiver,args);
        var previous = context, parent = scopeEvent;
        if (name === 'Data') context = 'refresh-'+(++refreshSequence);
        else context = null;
        var started = now();
        count('property.'+name);
        propertyCounters[name] = (propertyCounters[name] || 0) + 1;
        scopeEvent = record('property.received',{name:name,value:metadata(value)}) || null;
        try { return callback.apply(receiver,args); }
        catch (error) { record('property.error',{name:name,error:plainError(error)},'ERROR'); throw error; }
        finally {
            record('property.completed',{name:name,durationMs:round(now()-started)});
            scopeEvent = parent; context = previous;
        }
    }
    function timer(callback, label, delay) {
        if (!active()) return callback;
        var scheduled = now(), timerContext = context, parent = scopeEvent;
        count('timer.scheduled.'+label);
        var eventId = record('timer.scheduled',{label:label,requestedMs:delay});
        return function () {
            var previous = context, previousEvent = scopeEvent;
            context = timerContext; scopeEvent = eventId || parent;
            if (active()) {
                count('timer.executed.'+label);
                var elapsed = now() - scheduled;
                record('timer.executed',{label:label,requestedMs:delay,elapsedMs:round(elapsed),lateMs:round(Math.max(0,elapsed-delay))},elapsed-delay >= 100 ? 'WARN' : 'INFO');
            }
            try { return callback.apply(this,arguments); }
            finally { context = previous; scopeEvent = previousEvent; }
        };
    }
    function event(name, detail) { count(name); record(name,detail); }
    function parseResult(success, duration, characters) {
        count(success ? 'json.parse.ok' : 'json.parse.error');
        record(success?'json.parse.ok':'json.parse.error',{durationMs:round(duration),characters:characters},success?'INFO':'ERROR');
    }
    function filters() {
        return {query:ui.search.value.toLowerCase(),level:ui.level.value,refresh:ui.refresh.value.trim().toLowerCase(),view:ui.view.value};
    }
    function filtered() {
        var f = filters();
        return entries().filter(function (e) {
            if (f.view === 'properties' && e.event.indexOf('property.') !== 0) return false;
            if (f.view === 'performance' && !/^(health\.|timer\.|function.end|refresh.dispatch|grid.api.end)/.test(e.event)) return false;
            if (f.view === 'rendering' && !/^(grid.api|refresh.dispatch|function.)/.test(e.event)) return false;
            if (f.view === 'errors' && e.level !== 'ERROR') return false;
            return (!f.level || e.level === f.level) && (!f.refresh || String(e.refreshId || '').toLowerCase().indexOf(f.refresh) >= 0) && (!f.query || (e.event+' '+JSON.stringify(e.detail)).toLowerCase().indexOf(f.query) >= 0);
        });
    }
    function render(force) {
        if (!ui || !open) return;
        ui.capture.textContent = capturing ? 'Stop capture' : 'Start capture';
        ui.mode.value = mode;
        var levelCounts={INFO:0,WARN:0,ERROR:0};
        entries().forEach(function(entry){levelCounts[entry.level]=(levelCounts[entry.level]||0)+1});
        ui.cards.all.value.textContent=size.toString();
        ['INFO','WARN','ERROR'].forEach(function(level){ui.cards[level].value.textContent=levelCounts[level].toString();ui.cards[level].button.setAttribute('aria-pressed',String(ui.level.value===level))});
        ui.cards.all.button.setAttribute('aria-pressed',String(!ui.level.value));
        ui.live.textContent=mode==='Off'?'COLLECTION OFF':capturing?'CAPTURE RUNNING':'CAPTURE STOPPED';
        ui.live.dataset.active=String(mode!=='Off'&&capturing);
        ui.status.textContent = instanceId+' · '+mode+(capturing?' · capture running':' · capture stopped')+' · buffer '+size+'/'+capacity+' · overwritten '+discarded+' · refresh '+(counters.RefreshData||0)+' · selection runs '+(counters.ApplyRowsToSelect||0)+' · redraw '+(counters['api.redrawRows']||0)+' · long task '+(supportedLongTasks?'supported':'unavailable');
        ui.metrics.hidden = ui.view.value !== 'properties' && ui.view.value !== 'performance';
        if (ui.view.value === 'properties') ui.metrics.textContent = 'Property notifications received (including identical values):\n'+(Object.keys(propertyCounters).map(function(name){return name+': '+propertyCounters[name]}).join(' · ') || 'No property notifications received during capture.');
        if (ui.view.value === 'performance') ui.metrics.textContent = 'Capture maxima · synchronous RefreshData: '+round(stats.maxRefreshDispatchMs)+' ms · requested timer interval 250 ms: '+round(stats.maxTimerIntervalMs)+' ms · long task: '+round(stats.maxLongTaskMs)+' ms';
        if ((!dirty && !force) || (paused && !force)) return;
        dirty = false;
        var list = filtered(), visible = list.slice(-200);
        ui.rows.textContent = '';
        visible.forEach(function (entry) {
            var tr = document.createElement('tr');tr.dataset.level=entry.level;
            tr.dataset.selected=String(selectedSequence===entry.sequence);
            [String(entry.sequence),entry.timestamp.slice(11,23),entry.refreshId||'—',entry.level].forEach(function(text){var td=document.createElement('td');td.textContent=text;tr.appendChild(td)});
            var td=document.createElement('td'), button=document.createElement('button');button.type='button';button.className='d-event';button.textContent=entry.event;button.onclick=function(){selectedSequence=entry.sequence;ui.detail.textContent=JSON.stringify(entry,null,2);ui.detailTitle.textContent='EVENT #'+entry.sequence+' / '+entry.level;ui.rows.querySelectorAll('tr').forEach(function(row){row.dataset.selected=String(row===tr)})};td.appendChild(button);tr.appendChild(td);
            td=document.createElement('td');td.textContent=JSON.stringify(entry.detail);tr.appendChild(td);ui.rows.appendChild(tr);
        });
        ui.visible.textContent = visible.length+' visible events / '+list.length+' filtered. Metadata only; synchronous API timings, not confirmed paint durations.';
        if (!paused) ui.body.scrollTop=ui.body.scrollHeight;
    }
    function download() {
        var meta={event:'capture.metadata',instanceId:instanceId,mode:mode,capturing:capturing,capacity:capacity,discarded:discarded,exportedAt:new Date().toISOString(),counters:counters,propertyCounters:propertyCounters,stats:stats,scope:'Widget JavaScript only; wrapper SQL and network are not measured. Data payloads and cell values are not exported.'};
        var text=[JSON.stringify(meta)].concat(entries().map(function(e){return JSON.stringify(e)})).join('\n')+'\n';
        var exportDocument=ui.panel.ownerDocument;
        var url=URL.createObjectURL(new Blob([text],{type:'application/x-ndjson;charset=utf-8'}));var a=exportDocument.createElement('a');a.href=url;a.download=instanceId+'-trace.jsonl';exportDocument.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
    }
    function setOpen(value) {
        if(value && (!popupWindow || popupWindow.closed)) {
            try {
                popupWindow=window.open('','_blank','popup=yes,width=1100,height=760,resizable=yes,scrollbars=yes');
                if(!popupWindow) throw new Error('Popup blocked');
                var doc=popupWindow.document;
                doc.title='MOD3 - Diagnostics';
                doc.documentElement.lang='en';
                document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link){var copy=doc.createElement('link');copy.rel='stylesheet';copy.href=link.href;doc.head.appendChild(copy)});
                var style=doc.createElement('style');
                style.textContent='html,body{margin:0;height:100%;background:#172a26}#mod3-diagnostics{position:fixed;inset:0;height:100%;min-height:0;border:0}';
                doc.head.appendChild(style);
                doc.body.appendChild(ui.panel);
                doc.addEventListener('keydown',toggleShortcut);
                popupWindow.addEventListener('pagehide',function(){
                    document.body.appendChild(ui.panel);
                    open=false;ui.panel.hidden=true;ui.button.setAttribute('aria-expanded','false');
                    if(uiTimer!==null)clearInterval(uiTimer);uiTimer=null;
                    popupWindow=null;
                });
            } catch(error) {
                if(popupWindow && !popupWindow.closed)popupWindow.close();
                popupWindow=null;
                window.alert('Unable to open diagnostics: allow popups for this page and try Ctrl+Alt+D again.');
                return;
            }
        }
        open=!!value;ui.panel.hidden=!open;ui.button.setAttribute('aria-expanded',String(open));
        if(uiTimer!==null)clearInterval(uiTimer);uiTimer=null;
        if(open){render(true);uiTimer=setInterval(function(){render(false)},500);popupWindow.focus();ui.close.focus()}
        else {
            document.body.appendChild(ui.panel);
            if(popupWindow && !popupWindow.closed)popupWindow.close();
            popupWindow=null;
            if(returnFocus && returnFocus.isConnected)returnFocus.focus();
        }
    }
    function initializeUI() {
        var button=document.createElement('button');button.id='mod3-diagnostics-button';button.type='button';button.textContent='Diagnostics';button.setAttribute('aria-controls','mod3-diagnostics');button.setAttribute('aria-expanded','false');
        var panel=document.createElement('section');panel.id='mod3-diagnostics';panel.hidden=true;panel.setAttribute('aria-label','Diagnostics MOD3');
        panel.innerHTML='<header><h2>MOD3 · Diagnostics</h2><button type="button" data-id="close" aria-label="Close diagnostics">Close ×</button></header><div class="d-controls"><select data-id="mode" aria-label="Diagnostic mode"><option>Off</option><option selected>Summary</option><option>Trace</option></select><button type="button" data-id="capture">Stop capture</button><button type="button" data-id="pause" aria-pressed="false">Pause scrolling</button><button type="button" data-id="export">Export JSONL</button><button type="button" data-id="clear">Clear</button></div><div class="d-controls"><input type="search" data-id="search" aria-label="Search events" placeholder="Search events or metadata"><input type="text" data-id="refresh" aria-label="Filter refresh" placeholder="refresh-142"><select data-id="level" aria-label="Filter level"><option value="">All levels</option><option>INFO</option><option>WARN</option><option>ERROR</option></select></div><div class="d-status" data-id="status"></div><div class="d-body" data-id="body"><table><thead><tr><th>#</th><th>UTC</th><th>Refresh</th><th>Level</th><th>Event</th><th>Metadata</th></tr></thead><tbody data-id="rows"></tbody></table></div><pre class="d-detail" data-id="detail">Select an event to inspect its metadata.</pre><div class="d-foot" data-id="visible"></div><div class="d-foot">Summary aggregates counters; Trace records detailed events. The panel does not read SQL queries, passwords, Data payloads or network traffic. Detailed capture adds overhead.</div>';
        button.hidden=true;
        button.style.setProperty('display','none','important');
        document.body.appendChild(button);document.body.appendChild(panel);
        ui={panel:panel,button:button};['close','mode','capture','pause','export','clear','search','refresh','level','status','body','rows','detail','visible'].forEach(function(id){ui[id]=panel.querySelector('[data-id="'+id+'"]')});
        var view=document.createElement('select');view.setAttribute('aria-label','Diagnostic view');
        [['all','Activity'],['performance','Performance'],['properties','Properties'],['rendering','Rendering'],['errors','Errors']].forEach(function(pair){var option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];view.appendChild(option)});
        ui.view=view;ui.search.parentNode.insertBefore(view,ui.search);
        ui.metrics=document.createElement('pre');ui.metrics.className='d-detail';ui.metrics.hidden=true;ui.status.parentNode.insertBefore(ui.metrics,ui.body);
        var heading=panel.querySelector('h2');heading.textContent='MOD3 / Live diagnostics';
        ui.live=document.createElement('span');ui.live.className='d-live';heading.parentNode.insertBefore(ui.live,ui.close);
        var dashboard=document.createElement('div');dashboard.className='d-dashboard';ui.cards={};
        [['all','BUFFERED EVENTS'],['INFO','INFORMATION'],['WARN','WARNINGS'],['ERROR','ERRORS']].forEach(function(pair){
            var card=document.createElement('button');card.type='button';card.className='d-card';card.dataset.level=pair[0];card.setAttribute('aria-label','Filter: '+pair[1]);
            var label=document.createElement('span');label.textContent=pair[1];var value=document.createElement('strong');value.textContent='0';card.appendChild(label);card.appendChild(value);
            card.onclick=function(){ui.view.value='all';ui.level.value=pair[0]==='all'?'':pair[0];dirty=true;render(true)};
            dashboard.appendChild(card);ui.cards[pair[0]]={button:card,value:value};
        });
        panel.insertBefore(dashboard,panel.querySelector('.d-controls'));
        var reset=document.createElement('button');reset.type='button';reset.textContent='Reset filters';reset.className='d-reset';reset.onclick=function(){ui.search.value='';ui.refresh.value='';ui.level.value='';ui.view.value='all';render(true)};ui.search.parentNode.appendChild(reset);
        ui.detailTitle=document.createElement('div');ui.detailTitle.className='d-detail-title';ui.detailTitle.textContent='DETAIL / select an event name';ui.detail.parentNode.insertBefore(ui.detailTitle,ui.detail);
        ui.detail.setAttribute('tabindex','0');ui.detail.setAttribute('aria-label','Selected event metadata');
        ui.search.placeholder='Search event names or metadata…';ui.refresh.placeholder='Correlation ID, e.g. refresh-3';
        button.onclick=function(){setOpen(!open)};ui.close.onclick=function(){setOpen(false)};
        document.addEventListener('keydown',toggleShortcut);
        ui.mode.onchange=function(){setMode(ui.mode.value)};ui.capture.onclick=function(){setCapture(!capturing)};ui.clear.onclick=clear;ui.export.onclick=download;
        ui.pause.onclick=function(){paused=!paused;ui.pause.setAttribute('aria-pressed',String(paused));ui.pause.textContent=paused?'Resume scrolling':'Pause scrolling';if(!paused)render(true)};
        [ui.search,ui.refresh,ui.level,ui.view].forEach(function(el){el.addEventListener('input',function(){dirty=true;render(true)})});
        panel.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false)});
    }
    var returnFocus=null, popupWindow=null, selectedSequence=null;
    function toggleShortcut(e) {
        if(e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && !e.repeat && !e.isComposing && e.key.toLowerCase()==='d') {
            e.preventDefault();
            if(!open) returnFocus=document.activeElement;
            setOpen(!open);
        }
    }
    function snapshot() { return {instanceId:instanceId,mode:mode,capturing:capturing,size:size,discarded:discarded,capacity:capacity,counters:Object.assign({},counters),propertyCounters:Object.assign({},propertyCounters),stats:Object.assign({},stats),events:entries(),open:open,uiTimerActive:uiTimer!==null,healthTimerActive:healthTimer!==null}; }
    function dispose() { dead=true;setOpen(false);document.removeEventListener('keydown',toggleShortcut);if(uiTimer!==null)clearInterval(uiTimer);if(healthTimer!==null)clearInterval(healthTimer);uiTimer=null;healthTimer=null;if(observer)observer.disconnect(); }
    window.Mod3Diagnostics={installRuntime:installRuntime,attachGrid:attachGrid,property:property,timer:timer,event:event,parseResult:parseResult,isActive:active,snapshot:snapshot,setMode:setMode,setCapture:setCapture,clear:clear,open:function(){setOpen(true)},close:function(){setOpen(false)}};
    window.addEventListener('error',function(e){record('javascript.error',{name:e.error && e.error.name || 'Error',line:e.lineno || 0},'ERROR')});
    window.addEventListener('unhandledrejection',function(e){record('javascript.unhandledrejection',plainError(e.reason),'ERROR')});
    initializeUI();refreshMonitors();window.addEventListener('pagehide',dispose);
})();
