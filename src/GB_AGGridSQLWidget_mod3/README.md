# GB_AGGridSQLWidget_mod3

Development candidate with optimized selection and English visual popup diagnostics. Internal identity: GB_AGGridSQLWidget_mod3. The manifest retains the same 27 native properties; MOD2 is not modified.

## Optimizations

- Idempotent selection; update only nodes whose selection changes.
- Coalesced selection and sizing requests instead of repeated 100/300 ms passes.
- Fewer explicit redraws in the standard update path.
- Row-class highlighting rather than repeated DOM color rewriting.
- Selector caching, row WeakMap and bounded normalized-name cache.
- Cache invalidation on data, column and cell changes.
- Debug output published only when changed.

SQL acquisition belongs to the wrapper and is not made asynchronous by this widget. Full rowData updates remain.

## Using diagnostics

Click the grid and press Ctrl+Alt+D. Allow popups. The button is hidden so it does not overlap grid data. Esc, Close or the window X closes the popup. Summary is the initial mode; Trace records detailed events; Off disables diagnostic collection.

See DIAGNOSTICA.md for controls and limitations. The repository guides are in docs/mod3. Preserve all input/output bindings when replacing an embedded widget; the IDE may not transfer them automatically.

## Acceptance

Test clock responsiveness, selectors and manual selection, styles, editing, dropdowns, wrapping, empty/changed data and repeated page reopening. Compare the same data and refresh interval. Browser results do not prove AVEVA import/bridge compatibility or guaranteed latency. Keep the previous symbol and CWP for rollback.
