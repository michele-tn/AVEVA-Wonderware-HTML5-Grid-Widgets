# MOD3 — technical reference, performance and diagnostics

## 1. Scope and versions

MOD3 has a separate widget identity from MOD2. The optimized selection implementation originated in MOD2 Lean; the current package adds visual popup diagnostics. Keep MOD2 as a comparison and rollback option. Do not install two loaders that write to the same state.

This guide describes the current popup, not the earlier visible-button overlay. Browser tests use a mocked cwidget bridge and synthetic data. AVEVA import, bridge behavior and SQL acquisition must be validated independently.

## 2. Wrapper bindings

| Widget property | Typical wrapper reference | Verification |
|---|---|---|
| Columns | GridColumns | Valid JSON array; not a literal property name |
| Data | GridData | Complete JSON row array |
| ColumnsProperties | ColumnsProperties | Array positions match the column list |
| ColumnsOptions | ColumnsOptions | Dropdown arrays, not generic column settings |
| ColumnsWidths | ColumnsWidths | Same order as Columns |
| ConditionalCellStyles | ConditionalCellStyles | Valid rules for the actual field names |
| RowsToSelect | RowsToSelect / OrdiniCorrenti | Correct field=value selector |
| Selected… outputs | Matching wrapper output CPs | Bind outputs instead of constant strings |
| IsEditable / IsFilterable | Global permission flags | Check both wrapper and native values |

Check fonts, row/header heights and colors at both levels. Different wrapper/native values can make changes appear ineffective. A constant true in a String debugging property is not an output binding. Making an internal CP private is safe only after checking all external references; privacy alone is not a demonstrated performance fix.

## 3. Native properties

Types and defaults below come from the included widget.wjson. This contract is unchanged.

| Property | Type | Default | Purpose |
|---|---|---|---|
| `Columns` | String | `[]` | JSON column definitions |
| `Data` | String | `[]` | JSON row array |
| `FontSize` | Integer | `12` | Body font size |
| `HeaderHeight` | Integer | `30` | Header height |
| `HeaderFontSize` | Integer | `12` | Header font size |
| `RowHeight` | Integer | `27` | Base row height |
| `IsDirty` | Boolean | `False` | Dataset modification state |
| `IsEditable` | Boolean | `True` | Global editing permission |
| `IsDebugMode` | Boolean | `False` | Existing console debug flag |
| `ColumnsProperties` | String | `[]` | Per-column JSON options |
| `ColumnsOptions` | String | `[]` | Dropdown options |
| `HeaderBackgroundColor` | String | `#840000` | Header background |
| `HeaderTextColor` | String | `#ffffff` | Header foreground |
| `OddRowBackgroundColor` | String | `#ffffff` | Odd-row background |
| `EvenRowBackgroundColor` | String | `#f8f6fb` | Even-row background |
| `SelectedRowBackgroundColor` | String | `#fef2c6` | RowsToSelect highlight |
| `RowTextColor` | String | `#222222` | Body text color |
| `BorderColor` | String | `#dddddd` | Grid border color |
| `IsFilterable` | Boolean | `True` | Global filtering permission |
| `ConditionalCellStyles` | String | `[]` | Conditional cell style rules |
| `ColumnsWidths` | String | `(empty)` | Explicit pipe-separated widths |
| `SelectedRowIndex` | Integer | `-1` | Selected row index |
| `SelectedColumnField` | String | `(empty)` | Selected column field |
| `SelectedCellValue` | String | `(empty)` | Selected cell value |
| `SelectedRowData` | String | `(empty)` | Selected row JSON |
| `RowsToSelect` | String | `None` | Programmatic row selector |
| `RowsToSelectDebug` | String | `(empty)` | Selector diagnostic output |

## 4. Columns and rows

```json
[{"field":"Order","headerName":"Order","width":200},{"field":"Quantity","headerName":"Quantity","width":120},{"field":"Note","headerName":"Note","width":420}]
```

```json
[{"Order":"OPR26-37894","Quantity":1029,"Note":"Quality check completed"}]
```

The legacy prop/name/size aliases are supported by the grid adapter. Use actual field names from the incoming JSON, not translated display labels.

### Editing, sorting and wrapping

Set IsEditable=False to prevent editing globally. A readOnly/readOnly-style column flag cannot grant permission denied globally. To disable manual sorting and filtering per column:

```json
[{"sortable":false,"filter":false,"editable":false,"readOnly":true},{"sortable":false,"filter":false,"editable":false,"readOnly":true},{"sortable":false,"filter":false,"editable":false,"readOnly":true,"wrapText":true,"autoHeight":true,"cellStyle":{"whiteSpace":"normal","lineHeight":"16px"}}]
```

In an AVEVA expression string, double internal quotation marks:

```text
"[{""sortable"":false,""filter"":false,""editable"":false,""readOnly"":true}]"
```

For vertical alignment, test a cellStyle using display:flex and alignItems:center against wrapping and auto-height. Do not assume the legacy style-string option and the AG Grid cellStyle object are interchangeable.

ColumnsWidths can force width/min/max values and override flex sizing. ColumnsOptions supplies dropdown choices. ConditionalCellStyles is a separate rule list. Preserve schema names and validate JSON before changing runtime bindings.

### Programmatic selection

Use a selector such as Order=OPR26-37894|OPR26-37895. None disables the selector. The client performs selection/highlighting; the SQL cssClass field is not required by MOD3. Manual selection and the configured current-order highlight serve different purposes.

## 5. Optimizations

| Previous behavior | Current behavior | Intended effect |
|---|---|---|
| General deselect/reselect | Change selection only when needed | Fewer generated events |
| Repeated immediate/100/300 ms passes | One pending selection/sizing request | Less duplicated timer work |
| Deferred selection events requeue work | Stable, idempotent selection | Stop the growing feedback loop |
| Multiple redrawRows calls | Reduced explicit redraws in the standard path | Fewer API calls |
| Repeated DOM color rewrites | Row classes and CSS | Less direct DOM manipulation |
| Repeated selector normalization | Selector cache, row WeakMap, bounded name cache | Fewer repeated comparisons |
| Extra Data parsing | Infer columns only when required | Fewer conversions |
| Repeated debug output writes | Publish only changed text | Fewer property notifications |
| Repeated scroll-to-first-match | Scroll when that index changes | Less navigation disruption |

Caches invalidate when relevant data, columns or edits change. The normalized name cache is bounded at 1,024 entries. A full rowData replacement still occurs when the application supplies a changed dataset; this is not a delta-update architecture.

Local regression results are evidence for the tested scenario, not guaranteed latency or a statistically isolated overhead percentage.

## 6. Popup lifecycle and modes

Click inside the widget, then press Ctrl+Alt+D. The shortcut acts in the focused widget document, not globally across Windows or the outer AVEVA page. Esc or Close exits; the window X also restores the hidden panel to the source document.

Popup permission and iframe sandbox restrictions can prevent opening. The widget displays an English warning rather than falling back to a clipped overlay. Closing the source page terminates the popup and timers.

Summary is the initial collection mode. Trace records detailed instrumented events and costs more. Off disables collection and timer/long-task monitors, but does not disable independent IsDebugMode console logging or wrapper logs.

## 7. Controls and views

Activity shows all retained events. Performance focuses on synchronous function/API times and timer delays. Properties shows notification counts, including repeated identical values. Rendering shows instrumented function/API activity. Errors shows captured JSON/JavaScript errors.

Search matches event names/metadata. Refresh ID filters correlation. Level filters INFO/WARN/ERROR. The four cards show retained buffer counts, not filtered counts or all-time totals; clicking a card changes level and resets the view to Activity while keeping text filters.

Click an event name to inspect JSON. The detail stays available while events arrive, but its row can move out of the last 200 entries. Reset filters does not erase captured data. Pause scrolling freezes list updates; an explicit filter change can still redraw it. Stop capture does not stop grid refresh. Clear resets retained events and counters, not sequence identifiers.

## 8. Event fields and correlation

| Field | Meaning |
|---|---|
| instanceId | Current widget instance |
| sequence | Increasing event sequence |
| timestamp | UTC ISO timestamp |
| monotonicMs | Local performance clock |
| eventId | Event identity |
| parentEventId | Instrumented parent, when known |
| refreshId | Data notification/refresh scope, when known |
| level | INFO, WARN or ERROR |
| event | Instrumented activity name |
| detail | Safe metadata, not Data/cell contents |

A Data notification can receive a refresh ID even if identical data does not cause an actual refresh. Timer instrumentation carries the originating context. Deferred native AG Grid callbacks or unrelated interactions can have null IDs: correlation is not fabricated.

### Event families

| Event | Interpretation |
|---|---|
| widget.initializing / widget.ready | Setup and API attachment |
| property.received | Property name/type/length notification |
| json.parse.ok / json.parse.error | Parsing outcome and synchronous duration |
| function.begin / function.end | Instrumented function span |
| refresh.dispatch.summary | Synchronous refresh dispatch summary |
| grid.api.begin / grid.api.end | Wrapped grid API calls |
| timer.scheduled / timer.executed | Scheduling and observed delay |
| selection.changed | Selection notification |
| health.timer.delay | Delayed health timer |
| health.longtask | Browser-supported long-task observation |
| javascript.error / javascript.unhandledrejection | Captured error category |

The health timer requests 250 ms and warns beyond 450 ms observed interval. Other instrumented timers warn when at least 100 ms late. Long-task observation depends on browser support.

Synchronous API duration is not a completed paint, completed SQL query or completed deferred selection. During a complete main-thread stall the diagnostic display also stalls and reports delays only after execution resumes.

## 9. Capture and export

1. Reproduce once with Summary.
2. Switch temporarily to Trace.
3. Trigger the relevant data/selection/configuration change.
4. Stop capture before analysis if a stable record is needed.
5. Filter by refresh ID and inspect details.
6. Export JSONL before clearing or closing the source widget.

The circular buffer holds 2,000 events; the UI renders the last 200 filtered events every 500 ms while open. Overwrites are counted. Export includes a capture.metadata record, counters/maxima and every retained event, not only visible rows.

No full Data payload, cell values, SQL text or passwords are automatically included. Error detail is reduced to category metadata. Treat exports as operational information and review before sharing.

## 10. Reading JSONL with PowerShell

```powershell
$events = Get-Content -LiteralPath '.\capture.jsonl' | ForEach-Object { $_ | ConvertFrom-Json }
$events | Where-Object level -eq 'WARN' | Select-Object timestamp,event,refreshId,detail
$events | Group-Object event | Sort-Object Count -Descending
$events | Where-Object refreshId -eq 'refresh-3'
```

The export does not reconstruct events already overwritten or an unknown parent scope. UTC timestamps and event ordering help compare independent wrapper logs, but there is no automatic shared SQL correlation ID.

## 11. Diagnosing a stalled page

- Compare with diagnostics Off, then Summary and a short Trace.
- Compare wrapper connection/execution/read times against JavaScript dispatch and timer delays.
- Check selector loops, repeated property writes, duplicate loaders and overlapping refresh triggers.
- Use stable SQL ordering: identical records in a different order create different JSON.
- Keep clock updates separate from SQL refresh logic.
- Do not increase timer rates when acquisition already takes longer than the target interval.
- If synchronous SQL dominates, use a supported asynchronous acquisition/service boundary rather than arbitrary UI-thread callbacks.

The separate [SQL loader guide](./Wrapper_SQL/LEGGIMI_Ottimizzazione_SQL.md) explains caching, lifecycle and its remaining synchronous limitation.

## 12. Verification and acceptance

Local browser tests validated selected contracts using a simulated host, not AVEVA import or SQL access. Validate in the actual runtime: empty/changed/unchanged data, permissions, editing, dropdowns, wrapping, multiple selections, None, popup blocked/allowed, focus, export and repeated open/close cycles.

Measure first-load and warmed refresh behavior separately. Compare median/max delays using the same data, query, browser, refresh interval and selector. Instrumentation adds overhead; do not infer a guaranteed speedup from a small sample.

## 13. Public/private wrapper properties

Keep inputs and outputs public when a parent symbol references them. GridColumns, GridData and internal timing/validation state can be private only after checking all external bindings/scripts. Do not make every inherited property private indiscriminately. No privacy change is required by this package.

## 14. Rollback

Restore the previously exported symbol and matching CWP. Keep MOD2 and MOD3 identities separate. The widget needs no database migration. The optional loader needs IDE validation before use.

## 15. Reference files

- [Current user guide](./GUIDA_MOD3.md)
- [SQL loader](./Wrapper_SQL/Caricamento_MOD3_Ottimizzato_QuickScript.txt)
- [SQL loader instructions](./Wrapper_SQL/LEGGIMI_Ottimizzazione_SQL.md)
- [Release information](../../RELEASE_MOD3.md)
- [Source](../../src/GB_AGGridSQLWidget_mod3/)

Property names, SQL identifiers and legacy filenames are compatibility contracts and are not translated. Historical binary archives in Backup-OLD are preserved exactly, including their original embedded language.

