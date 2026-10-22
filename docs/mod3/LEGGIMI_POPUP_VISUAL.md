# MOD3 / Live diagnostics — visual interface

Import [GB_AGGridSQLWidget_mod3.cwp](../../GB_AGGridSQLWidget_mod3.cwp). No new native Custom Properties are required. Save the previous package for rollback.

Click the grid and press Ctrl+Alt+D. Allow popups; close with Esc, Close or the window X.

The English interface uses high-contrast text, four clickable buffer-count cards, level labels, filters, selected-row highlighting and JSON event details. Reset filters clears search, correlation, level and view without erasing captured events. The layout adapts to narrow windows and has visible keyboard focus.

Collection and rendering remain bounded: 2,000 buffered events, last 200 filtered rows, 500 ms open-panel updates. No continuous animations or additional dependency. Counting retained levels adds bounded work while the popup is open; no measured performance improvement is claimed for the visual redesign.

See the [user guide and screenshots](./GUIDA_MOD3.md) and [technical reference](./Guida_MOD3_Uso_Diagnostica_Performance.md). Browser testing is not AVEVA certification or user-validated accessibility.
