# MOD3 — visual popup diagnostics

The English diagnostic interface is opened by Ctrl+Alt+D after focusing the grid. No visible button covers the data. Allow popups in the browser/runtime; a blocked popup produces a warning. Closing the source page also closes the popup.

## Modes and controls

Summary is the default mode and captures aggregated counters and dispatch summaries. Trace records detailed instrumented events and adds overhead. Off disables collection and health monitors, not independent wrapper/console logs.

Stop capture pauses recording without stopping the grid. Pause scrolling freezes the displayed list while recording can continue. Filter changes may explicitly redraw the list. Clear resets retained events/counters but not sequence IDs. Export JSONL includes capture metadata and every retained event, not only filtered rows. Closing with Esc/Close/X stops the UI timer, not collection.

Cards count events still in the buffer. The views are Activity, Performance, Properties, Rendering and Errors. Combine view, search, level and refresh ID. Select an event name to inspect JSON. Reset filters preserves capture.

## Bounds and correlation

The buffer retains 2,000 events and counts overwrites. The list displays the last 200 filtered rows. UI refresh is 500 ms while open; the health timer requests 250 ms and warns beyond a 450 ms observed interval. Long-task observation requires browser support.

Events contain UTC timestamps, a local monotonic clock, instance/sequence/event IDs and refresh/parent IDs when known. A Data notification can get a refresh ID without causing a real refresh. Instrumented timers carry context; unrelated deferred native events can have null IDs.

## Instrumentation and limitations

Property notification metadata, JSON parse outcomes, instrumented refresh/selection/sizing/edit functions and selected grid API calls are recorded. Synchronous API timings are not paint completion or SQL execution times.

The diagnostic system does not inspect network packets, SQL connections/queries, Data payloads or cell values. It shares the widget runtime and also stalls during complete main-thread blockage. Capture shows delays only after execution resumes; unrecoverable stalls require external host/browser tools.

Browser tests use synthetic data and a simulated bridge. Import, focus, popup permission, JSONL downloads and real data acquisition must be checked in AVEVA. No database migration is required.
