# GBDataGrid2_MOD3 — optimized SQL loader

## Scope

Replace only the wrapper loading script with [Caricamento_MOD3_Ottimizzato_QuickScript.txt](./Caricamento_MOD3_Ottimizzato_QuickScript.txt). It retains Windows authentication and SQL Server FOR JSON PATH, INCLUDE_NULL_VALUES. It does not modify the database or native widget.

**The loader remains synchronous.** Connection opening, execution and reading can still delay page updates. Compile it in the installed AVEVA IDE and test it against a development database; local static checks do not prove QuickScript runtime compatibility.

## Improvements

- Publish GridData only when its JSON changes.
- Cache column configuration and rebuild on changes to list, headers, widths or formatting.
- Split configuration strings only when rebuilding columns.
- Escape JSON quotes, backslashes and control characters.
- Skip loading while IsDirty or IsEditing.
- Release reader, command and connection independently after errors.
- Update LastRefreshTimestamp only after successful reading/publication.
- Measure configuration, connection, initial ExecuteReader and complete JSON reading separately.
- Remove the unnecessary SQL cssClass calculation by default; optional compatibility values are parameterized.

Comparing JSON is linear in its length. It avoids downstream notifications, not database execution or transfer. Stable ORDER BY is important for repeatable JSON.

## Setup

| Private wrapper CP | Type | Initial value |
|---|---|---|
| RefreshInCorso | Boolean | False |
| CacheConfigurazioneColonne | String | Empty |

1. Export the current symbol and save its script.
2. Add the two private CPs above.
3. Verify that IsEditing exists and actually tracks editing; retain IsDirty.
4. Replace the existing loader body. Do not add a second competing loader.
5. Preserve the intended RefreshDataCmd trigger. Do not trigger loading from GridData, LastRefreshTimestamp or RefreshInCorso changes.
6. Keep maintainSqlCssClass=False for MOD3 and bind RowsToSelect to the native widget.
7. Use a positive CommandTimeout; zero means unlimited command waiting and is rejected. Connection opening has a separate provider timeout.
8. Validate System.Diagnostics.Stopwatch and other .NET calls in the installed IDE.
9. Enable IsDebugMode only while measuring.

Array declarations retain the original [100] size and one-based QuickScript indexing. Keep configurations within 100 entries and validate behavior in the target runtime.

## Behavioral details

Columns without a nonempty header are omitted, as in the original loader. Widths must be positive, finite numbers using a decimal point. Invalid configuration prevents loading and sets ErrorMessage.

On failure, the previous data remains visible. Use ErrorMessage and LastRefreshTimestamp to recognize stale data. LastRefreshDuration is seconds for an attempted load, including failure; it is not browser rendering time.

A request skipped during editing/dirty state is consumed. A later periodic cycle or new command must retry. RefreshInCorso is a local guard, not an atomic cross-thread mutex or asynchronous queue. Check it after an abnormal interruption.

Connections are disposed after use and pooling is enabled. Do not keep one open for the full symbol lifetime merely to avoid connection creation.

## Optional cssClass compatibility

Set maintainSqlCssClass=True only if another consumer requires the SQL cssClass field. The limited syntax is Field=Value1|Value2. Values use NVarChar(4000) parameters; validate conversion against the actual SQL column type. Empty items are ignored; None/null/undefined/[]/- disable selection. This is not a general SQL-expression parser.

MOD3 already computes selection on the client; do not enable the compatibility option to compensate for a missing RowsToSelect binding.

## Security

ColumnsList, DBObject, DBWhere and DBOrderBy remain trusted SQL configuration fragments. Never place arbitrary operator input into them. Parameters for selection values do not secure the rest of the query. Use allow-listed identifiers and parameterized commands/stored procedures for user-supplied filters.

The loader does not normally log full JSON or SQL. Debug exception details can still contain sensitive technical information; review logs before sharing.

## Metrics

| Existing log field | Meaning |
|---|---|
| ConfigurazioneMs | Preparation before opening the connection |
| ConnessioneMs | Open duration, including pool retrieval |
| ExecuteReaderMs | Initial reader return, not the entire SQL operation |
| LetturaMs | All reader waits, fragments and string construction |
| FrammentiJSON | FOR JSON chunks, not table row count |
| CaratteriJSON | String character count, not network bytes |
| DatiCambiati | Whether GridData was published |
| ColonneRicalcolate | Whether column configuration was rebuilt |

Metric identifiers remain unchanged for compatibility. All FOR JSON fragments must be concatenated. Compare these wrapper logs with the web diagnostic timeline; the logs do not automatically appear in the popup and there is no shared SQL refresh ID.

## Acceptance

Test first load, unchanged data, changed data, configuration changes, empty results, escaped headers, active edits, connection/query failure, None/real selection and repeated page reopening. Confirm resource cleanup and guard reset after errors.

For performance comparisons use identical data, query, browser and refresh interval; collect repeated warmed cycles and observe median/max clock delay. If SQL remains slow, optimize its query/data volume or move acquisition to a runtime-supported asynchronous boundary. Never put this loader in the fast clock timer or create unsupported background threads that write UI properties.

## References

- [AVEVA scripting guide](https://cdn.logic-control.com/docs/aveva/hmi-scada/application-server/Scripting.pdf)
- [Microsoft connection pooling](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql-server-connection-pooling?view=sql-server-ver17)
- [Microsoft JSON result handling](https://learn.microsoft.com/en-us/sql/connect/golang/json-xml-data?view=sql-server-ver17)

Rollback restores the previous script; no database or native widget change is required.
