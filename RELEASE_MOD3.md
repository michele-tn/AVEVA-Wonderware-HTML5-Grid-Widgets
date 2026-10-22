# MOD3 VISUAL — release information

Date: 22 October 2026. Development candidate requiring AVEVA runtime validation, not a certified production release.

## Package

- [GB_AGGridSQLWidget_mod3.cwp](./GB_AGGridSQLWidget_mod3.cwp)
- Internal identity: GB_AGGridSQLWidget_mod3.
- Source: [src/GB_AGGridSQLWidget_mod3](./src/GB_AGGridSQLWidget_mod3/).
- SHA256: see [the checksum file](./GB_AGGridSQLWidget_mod3.cwp.sha256.txt).
- Contract: 27 unchanged native properties; no new CP for diagnostics.

## Contents

README and index.html integrate MOD3 into Included Widgets. The guides cover installation, performance, diagnostics and the optional synchronous SQL loader. Screenshots show the English grid and diagnostic interface with synthetic data at 2× resolution.

MOD2/base/Tabulator CWP files remain at their existing paths. Backup-OLD preserves historical archives, checksums and old documentation without changing archived binaries.

Selection is idempotent, timers are coalesced and repeated redraw work is reduced. Ctrl+Alt+D opens the English visual popup. No overlapping button, continuous animation or new runtime dependency is introduced.

## Verification

- The English popup passed 14 local browser checks, including live updates, filtering, export and lifecycle.
- The documentation passed six local browser checks covering screenshots, links, desktop/mobile layout and interactive sections.
- The CWP is rebuilt from the included sources.
- Browser tests use a simulated host and synthetic data. They do not prove AVEVA import/bridge behavior or database access.

## Limits and rollback

Logs describe widget JavaScript, not SQL or network traffic. Summary records while the popup is closed; Off stops collection. The separate loader remains synchronous and requires IDE compilation/testing. No guaranteed one-second responsiveness or plant-level performance improvement is claimed.

Save the previous symbols and CWP before import and restore them for rollback. No database migration is required.
