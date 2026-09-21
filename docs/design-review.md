# Framework Workbench Design Review

2026-09-20. Scope: review and standalone interactive mock.

## Direction
Reading this as an operator workbench for Check Point engineers, using the current Hardening App's neutral surfaces, pink selection states, compact navigation and evidence-first layout.

Taste settings: DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 6. Use native HTML/CSS and system fonts. Taste's landing-page-specific rules do not apply to dense product UI; its companion redesign guidance informs this proposal.

Reference inspected: the newer Hardening App's public/workbench.css and public/login.css, the older Hardening Scanner, and the framework's public/index.html and styles.css.

## Findings
| Current Pattern | Impact | Proposal |
| --- | --- | --- |
| Large stacked branding and uppercase connection URL | Competes with working area | Compact title and readable connection information |
| Four large context cards plus context selectors | Repeated information consumes space | Context selection alongside execution, with availability |
| Explorer, Gaia form and results stacked vertically | Scrolling separates action from evidence | Command navigation beside request and result |
| Oversized login typography | Form dominates screen | Hardening-style split login and 44px controls |
| Generic result section | Target relationship is harder to scan | Named targets and nearby decoded output |
| Preformatted output wraps anywhere | Gaia columns lose alignment | Horizontally scrollable monospace output |

## Mock
Open [design-mock.html](design-mock.html). Switch between login and workspace, choose SMS/Smart-1 Cloud/MDS, switch authentication, and preview API or Gaia output. All data is fictional. No network calls or credential storage.

The palette borrows #eef2f7, #142033, #526278, #ca004c, and #ffe9f1 from the newer Hardening App, with 6px controls, modest typography and command-to-result navigation. Scanner checks and remediation content are not part of the framework.

## Integration Requirements
Retain all management types, field identities, contexts, SessionManager dispatch, throttling, risk confirmations and raw responses. Bind each result to the submitted context and target. Add pending, failed, partial, empty and expired-session states before integrating.

Source review found separate functional issues: the command explorer still uses the generic renderer for run-script; polling selects the first result containing output instead of aggregating all tasks to completion; unknown task status can be labeled completed; timestamp objects need formatting. The mock demonstrates presentation and does not fix or validate those behaviors.

## Review Boundaries
This is a source-based audit and design proposal. Production files are unchanged. Browser validation should cover desktop/mobile layouts, keyboard navigation, long tenant URLs and long Gaia output before production adoption.

