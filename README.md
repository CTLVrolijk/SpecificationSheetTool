# QC Spec Builder

A web-based tool for **program managers** at Close the Loop to onboard new material streams under R2v3 Appendix E. Walks the user through every question the R2 Standard, REC v1.2, and ISO 9001 / 14001 / 45001 §7.5 require to be answered, then exports a controlled QC Spec sheet as a **PDF + JSON sidecar** pair.

> Single file, no backend, no build step. Runs entirely in the browser; data stays on the device.

---

## Deploying to GitHub Pages

1. Create a new GitHub repo (private is fine — Pages still works on free private repos for organization accounts).
2. Drop `index.html`, `tool.js`, and `README.md` into the repo root.
3. Settings → Pages → Source: `main` branch, `/` (root).
4. Tool is live at `https://[username].github.io/[repo]/`.

Bookmark on iPad / iPhone home screen for offline-capable use (browser caches after first load).

---

## The eleven steps

| # | Step | What gets captured |
|---|---|---|
| 01 | Load / start | Drop an existing JSON sidecar to revise — or start fresh |
| 02 | Identify | Spec name and production process |
| 03 | Photo | Camera capture, library pick, drag-drop, or paste from clipboard |
| 04 | Source | Electronic / non-electronic / mixed / unknown (COP §10.3.1) |
| 05 | FM screen | Six tristate questions (Yes / Possible / No) for each Focus Material category |
| 06 | Basel | B3011 vs A3210 vs Y48 for plastic streams |
| 07 | Classify | Derived REC classification with manual override and required justification |
| 08 | QC details | Frequency, method, non-conformance action, plastic types |
| 09 | Disposition | Next R2 process and DSV/buyer with Core 2 hierarchy check |
| 10 | Control | ISO 7.5 doc control: Doc ID, revision, approver, dates |
| 11 | Generate | Download PDF + JSON sidecar |

---

## How revisions work

Every export produces two files with the same base name:

```
QC_Spec_HDPE_Float_D-QC-042_Rev0_15jun26.pdf      ← controlled document
QC_Spec_HDPE_Float_D-QC-042_Rev0_15jun26.json     ← machine-readable record
```

**The PDF is the master.** It goes into the CtL DMS as the controlled document.
**The JSON is the source.** Drop it back into the tool's Master Copy slot to reload every answer (including the photo) and bump the revision number.

In the DMS upload screen:
- Drop the **JSON** as the master copy (it's what the tool reads back).
- The **PDF** is the viewing copy.
- The description-of-change field is captured in the DMS at upload time — not in this tool.

If the JSON is ever lost, you can re-key the spec from the PDF as if starting fresh; nothing about losing the JSON makes the PDF less authoritative.

---

## Data entry features

- **Auto-saved draft** — every change persists to `localStorage`. Close the tab, come back later, pick up where you left off.
- **Keyboard shortcut** — Cmd/Ctrl+Enter advances to the next step.
- **Smart classification** — the tool computes the suggested REC classification from your answers in real time. You can override.
- **Conditional reveals** — Basel screening only appears for plastic streams; FM-removal SOP only appears when an FM is present; hierarchy justification only appears for energy recovery / disposal.
- **Citation chips** — inline regulatory references (e.g. `COP §10.3.1`, `Core 6(a)(3)`) next to fields, so you know what each question maps to.
- **Validation on review** — required fields are checked before the PDF can be generated, with jump-to-step links.
- **Paste images** — when on the Photo step, you can paste an image straight from the clipboard.
- **Auto-suggest DSVs** — disposition field auto-completes from CtL's FM Plan DSV list.

---

## Document control field mapping

| Tool field | ISO clause |
|---|---|
| Document ID | 7.5.2(a) |
| Created date | 7.5.2(b) |
| Created by | 7.5.2(b) |
| Approved by | 7.5.2(b), 7.5.2(d) |
| Approval date | 7.5.2(d) |
| Revision | 7.5.3.2(b) |
| Revised by / Revision date | 7.5.3.2(c) |
| "Uncontrolled when printed" footer | 7.5.3.2(a) |

The DMS handles description-of-change capture and distribution control on upload, per CtL's existing SOP.

---

## R2v3 / REC requirements addressed

- **Core 6(a)(2)** — documented correlation between internal categories and REC categories
- **Core 6(b)(1)** — every controlled material identified with REC category
- **Core 6(e)(1)(B)** — unrestricted-stream justification required and captured
- **Core 7** — data storage devices routed appropriately
- **Appendix E(6)** — upstream FM-removal SOP reference prompted whenever FM present
- **Appendix E(9)** — re-categorization at every output stream
- **REC v1.2 Table 1** — all classifications driven by Table 1 entries
- **COP §10.3.1** — source linkage to electronic equipment captured
- **COP §11** — Y48/A3210 deferred DSV due diligence noted in classification reasoning

---

## Browser support

| Browser | Photo capture | Drag-drop | Clipboard paste |
|---|---|---|---|
| Safari iOS / iPadOS | ✓ native camera | — | — |
| Chrome desktop | ✓ file picker | ✓ | ✓ |
| Firefox desktop | ✓ file picker | ✓ | ✓ |
| Edge desktop | ✓ file picker | ✓ | ✓ |
| Chrome Android | ✓ native camera | — | — |

Camera capture uses the standard `<input capture="environment">` attribute. On iPad / iPhone this triggers the native rear camera; on desktop browsers it falls back to the file picker.

---

## Architecture

- Single HTML file, single JS file, plus this README — no build step
- Vanilla JS, no framework
- `jspdf` + `jspdf-autotable` loaded from CDN for PDF generation
- All data stays in the browser; nothing transmitted anywhere
- Draft auto-saved to `localStorage` between sessions

---

## When REC updates

When SERI publishes a new REC version (1.3, 2.0, etc.) or Table 1 changes, edit `tool.js`:

- `CLASSIFICATION_LABELS` — update labels
- `deriveClassification()` — update the decision tree
- The HTML `<select id="f-classification">` options — update the manual override list

Bump the `generatorVersion` constant so the PDF audit trail shows which tool version produced each spec.

---

*collect today · create tomorrow*
