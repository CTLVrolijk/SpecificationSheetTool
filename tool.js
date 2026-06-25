/* ============================================================
   QC Spec Builder — Close the Loop
   Vanilla JS, no build step. Single-file deploy on GitHub Pages.
   Build: v1.0.4 — added GMI and GMT processes to dropdown
   ============================================================ */

(function() {
'use strict';

// ============================================================
// State — single source of truth, persisted to localStorage as draft
// ============================================================
const SCHEMA_VERSION = 1;
const DRAFT_KEY = 'ctl-qc-spec-draft-v1';

let state = freshState();

function freshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: 'CtL QC Spec Builder',
    generatorVersion: '1.0.4',

    // identify
    name: '',
    process: '',

    // photo (base64 data URL)
    photo: null,
    photoFilename: '',

    // source
    sourceLink: '',          // electronic | non-electronic | mixed | unknown
    surface: '',
    size: '',
    ingredients: '',
    contamination: '',

    // FM screening
    fm: {
      pcbs: null,
      mercury: null,
      crt: null,
      batteries: null,
      boards: null,
      eol: null,
    },
    fmRemovalSop: '',
    dataStorage: '',

    // Basel
    isPlastic: '',
    bfr: '',
    purity: '',

    // Classification
    classification: '',
    userOverrodeClassification: false,
    unrestrictedJustification: '',

    // QC
    qcFrequency: '',
    qcMethod: '',
    nonconformanceAction: '',
    plasticTypes: '',

    // Disposition
    nextProcess: '',
    disposition: '',
    hierarchyJustification: '',

    // Doc control
    docId: '',
    revision: '0',
    effectiveDate: '',
    createdBy: '',
    createdDate: todayISO(),
    revisedBy: '',
    revisedDate: '',
  };
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const mon = monthNames[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}

function formatDateCompact(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const mon = monthNames[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}${mon}${yr}`;
}

// ============================================================
// Step navigation
// ============================================================
let currentStep = 0;
const TOTAL_STEPS = 11;

function goToStep(n) {
  if (n < 0 || n >= TOTAL_STEPS) return;
  const isFirstLoad = (currentStep === 0 && n === 0);
  currentStep = n;
  // hide all panels
  document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  // show current
  const panel = document.querySelector(`[data-step-content="${n}"]`);
  const step = document.querySelector(`.step[data-step="${n}"]`);
  if (panel) panel.classList.add('active');
  if (step) step.classList.add('active');
  // scroll to top of panel, but only if user-triggered (not on initial load)
  if (!isFirstLoad) {
    const shell = document.querySelector('.shell');
    if (shell) {
      const topbarH = document.querySelector('.topbar').offsetHeight;
      window.scrollTo({ top: shell.offsetTop - topbarH - 20, behavior: 'smooth' });
    }
  }
  // run any per-step setup
  if (n === 6) renderClassification();
  if (n === 10) renderReview();
  saveDraft();
}

document.querySelectorAll('.step').forEach(step => {
  step.addEventListener('click', () => goToStep(parseInt(step.dataset.step)));
});

document.querySelectorAll('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => {
    collectCurrent();
    if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1);
  });
});

document.querySelectorAll('[data-prev]').forEach(btn => {
  btn.addEventListener('click', () => {
    collectCurrent();
    if (currentStep > 0) goToStep(currentStep - 1);
  });
});

// Keyboard: Cmd/Ctrl+Enter to advance, Esc to go back
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA') return; // don't hijack in textareas
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    collectCurrent();
    if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1);
  }
});

// ============================================================
// Field binding — collect current step's values into state
// ============================================================
const FIELD_MAP = {
  'f-name': 'name',
  'f-process': 'process',
  'f-surface': 'surface',
  'f-size': 'size',
  'f-ingredients': 'ingredients',
  'f-contam': 'contamination',
  'f-fmsop': 'fmRemovalSop',
  'f-datastorage': 'dataStorage',
  'f-classification': 'classification',
  'f-unrestricted-justification': 'unrestrictedJustification',
  'f-qcfreq': 'qcFrequency',
  'f-qcmethod': 'qcMethod',
  'f-nonconformance': 'nonconformanceAction',
  'f-plastictypes': 'plasticTypes',
  'f-nextprocess': 'nextProcess',
  'f-disposition': 'disposition',
  'f-hierarchy-justification': 'hierarchyJustification',
  'f-docid': 'docId',
  'f-revision': 'revision',
  'f-effective': 'effectiveDate',
  'f-createdby': 'createdBy',
  'f-createdate': 'createdDate',
  'f-revisedby': 'revisedBy',
  'f-revisedate': 'revisedDate',
};

function collectCurrent() {
  // collect all simple input fields
  for (const [id, key] of Object.entries(FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el) state[key] = el.value;
  }
  saveDraft();
  // recompute classification when user changes any input that feeds it
  if (currentStep <= 6) recomputeSuggested();
}

function populateFields() {
  for (const [id, key] of Object.entries(FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el && state[key] !== undefined && state[key] !== null) {
      el.value = state[key];
    }
  }
  // radio cards
  setRadio('source-link', state.sourceLink);
  setRadio('is-plastic', state.isPlastic);
  setRadio('bfr', state.bfr);
  setRadio('purity', state.purity);
  // tristate
  for (const fm of Object.keys(state.fm)) {
    setTristate(fm, state.fm[fm]);
  }
  // photo
  if (state.photo) {
    showPhoto(state.photo);
  }
  // conditional sections
  updateConditionalUI();
}

// auto-save on any input change
document.addEventListener('input', (e) => {
  if (e.target.matches('input, select, textarea')) {
    // track manual override on classification
    if (e.target.id === 'f-classification') {
      state.userOverrodeClassification = true;
    }
    collectCurrent();
    updateConditionalUI();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('input, select, textarea')) {
    if (e.target.id === 'f-classification') {
      state.userOverrodeClassification = true;
    }
    collectCurrent();
    updateConditionalUI();
  }
});

// ============================================================
// Radio cards
// ============================================================
function setRadio(name, value) {
  const inputs = document.querySelectorAll(`input[name="${name}"]`);
  inputs.forEach(inp => {
    inp.checked = (inp.value === value);
    const card = inp.closest('.radio-card');
    if (card) card.classList.toggle('checked', inp.checked);
  });
}

document.addEventListener('change', (e) => {
  if (e.target.matches('input[type="radio"]')) {
    const name = e.target.name;
    const value = e.target.value;
    // update visual state
    document.querySelectorAll(`input[name="${name}"]`).forEach(inp => {
      const card = inp.closest('.radio-card');
      if (card) card.classList.toggle('checked', inp.checked);
    });
    // store in state
    if (name === 'source-link') state.sourceLink = value;
    else if (name === 'is-plastic') state.isPlastic = value;
    else if (name === 'bfr') state.bfr = value;
    else if (name === 'purity') state.purity = value;
    saveDraft();
    recomputeSuggested();
    updateConditionalUI();
  }
});

// allow clicking the card area to select the radio
document.querySelectorAll('.radio-card').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const inp = card.querySelector('input[type="radio"]');
    if (inp) {
      inp.checked = true;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
});

// ============================================================
// Tristate (FM screening)
// ============================================================
function setTristate(fmKey, value) {
  const row = document.querySelector(`.tristate[data-fm="${fmKey}"]`);
  if (!row) return;
  row.querySelectorAll('button').forEach(b => {
    b.classList.remove('selected', 'yes', 'possible', 'no');
    if (b.dataset.val === value) {
      b.classList.add('selected', value);
    }
  });
  row.classList.toggle('flagged', value === 'yes' || value === 'possible');
}

document.querySelectorAll('[data-tristate] button').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.tristate');
    const fmKey = row.dataset.fm;
    const value = btn.dataset.val;
    state.fm[fmKey] = value;
    setTristate(fmKey, value);
    saveDraft();
    recomputeSuggested();
    updateConditionalUI();
  });
});

// ============================================================
// Photo upload — camera + library + drag-drop + paste
// ============================================================
const photoArea = document.getElementById('photo-area');
const photoCamera = document.getElementById('photo-camera');
const photoLibrary = document.getElementById('photo-library');
const photoRemove = document.getElementById('photo-remove');
const photoPreview = document.getElementById('photo-preview');
const photoEmpty = document.getElementById('photo-empty');

function showPhoto(dataUrl) {
  photoPreview.src = dataUrl;
  photoPreview.classList.remove('hidden');
  photoEmpty.classList.add('hidden');
  photoRemove.style.display = 'inline-block';
}

function clearPhoto() {
  state.photo = null;
  state.photoFilename = '';
  photoPreview.src = '';
  photoPreview.classList.add('hidden');
  photoEmpty.classList.remove('hidden');
  photoRemove.style.display = 'none';
  saveDraft();
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.photoFilename = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    // resize down to max 1280px wide to keep PDFs manageable
    const img = new Image();
    img.onload = () => {
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', 0.85);
      state.photo = out;
      showPhoto(out);
      saveDraft();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

photoCamera.addEventListener('change', e => handleImageFile(e.target.files[0]));
photoLibrary.addEventListener('change', e => handleImageFile(e.target.files[0]));
photoRemove.addEventListener('click', clearPhoto);

// drag & drop on photo area
['dragenter', 'dragover'].forEach(ev => {
  photoArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    photoArea.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(ev => {
  photoArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    photoArea.classList.remove('dragover');
  });
});
photoArea.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleImageFile(file);
});

// paste support — paste image from clipboard
document.addEventListener('paste', (e) => {
  if (currentStep !== 2) return;
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      handleImageFile(item.getAsFile());
      break;
    }
  }
});

// ============================================================
// JSON sidecar import (Master Copy)
// ============================================================
const dzMaster = document.getElementById('dz-master');
const dzView = document.getElementById('dz-view');
const fileMaster = document.getElementById('file-master');
const fileView = document.getElementById('file-view');

function loadJsonSidecar(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.schemaVersion) {
        alert('This does not appear to be a QC Spec sidecar file.');
        return;
      }
      // Backward compat: legacy sidecars (≤v1.0.2) had approvedBy/approvedDate.
      // If createdBy isn't set but approvedBy is, promote it. Then drop the legacy keys.
      if (!data.createdBy && data.approvedBy) data.createdBy = data.approvedBy;
      if (!data.createdDate && data.approvedDate) data.createdDate = data.approvedDate;
      delete data.approvedBy;
      delete data.approvedDate;
      // Merge into state — preserve all top-level keys
      state = Object.assign(freshState(), data);
      // Bump revision in anticipation of edits — but allow user to undo via the field
      const currentRev = String(state.revision || '0');
      const next = bumpRevision(currentRev);
      state.revision = next;
      state.revisedDate = todayISO();
      // mark loaded
      dzMaster.classList.add('loaded');
      document.getElementById('dz-master-title').textContent = `Loaded: ${file.name}`;
      document.getElementById('dz-master-desc').textContent = `Revision bumped from ${currentRev} to ${next}. Edit and re-export.`;
      populateFields();
    } catch (err) {
      alert('Could not parse JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function bumpRevision(rev) {
  // Numeric: 0 -> 1, 1 -> 2
  // Alpha: A -> B, B -> C
  if (/^\d+$/.test(rev)) return String(parseInt(rev) + 1);
  if (/^[A-Z]$/.test(rev)) return String.fromCharCode(rev.charCodeAt(0) + 1);
  return rev + '+';
}

fileMaster.addEventListener('change', e => loadJsonSidecar(e.target.files[0]));
fileView.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    dzView.classList.add('loaded');
    document.getElementById('dz-view-title').textContent = `Loaded: ${file.name}`;
    document.getElementById('dz-view-desc').textContent = 'Available for side-by-side reference in a separate tab.';
    // Open in new tab as a quick affordance
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  }
});

// drag & drop on both dropzones
[dzMaster, dzView].forEach(dz => {
  ['dragenter', 'dragover'].forEach(ev => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('dragover');
    });
  });
});
dzMaster.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.json')) loadJsonSidecar(file);
});
dzView.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.pdf')) {
    dzView.classList.add('loaded');
    document.getElementById('dz-view-title').textContent = `Loaded: ${file.name}`;
    document.getElementById('dz-view-desc').textContent = 'Opened in new tab for reference.';
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  }
});

// ============================================================
// Classification logic
// ============================================================
function deriveClassification() {
  // Returns { code, label, severity, cite, reasoning }
  // Order matters — more specific cases first.

  const anyFmYes = Object.values(state.fm).some(v => v === 'yes');
  const anyFmPossible = Object.values(state.fm).some(v => v === 'possible');
  const anyFm = anyFmYes || anyFmPossible;

  // PV modules
  if (state.fm.eol === 'yes' && state.process && state.process.toLowerCase().includes('pv')) {
    return {
      code: 'pv',
      label: 'PV Modules (Appendix G)',
      severity: 'controlled',
      cite: 'REC Table 1; Appendix G',
      reasoning: 'PV module presence routes to Appendix G regardless of other factors.'
    };
  }

  // Unsanitized data storage
  if (state.dataStorage === 'yes') {
    return {
      code: 'unsanitized',
      label: 'Unsanitized devices/media (Core 7)',
      severity: 'controlled',
      cite: 'REC Table 1; Core 7',
      reasoning: 'Data storage devices present route to Core 7 / Appendix B controls before any further classification.'
    };
  }

  // FM content → R2 Controlled
  if (anyFm) {
    if (anyFmYes) {
      return {
        code: 'fm-containing',
        label: 'FM-containing equipment/components (Appendix A/E/F)',
        severity: 'controlled',
        cite: 'REC Table 1; R2 Standard Focus Materials definitions',
        reasoning: 'One or more Focus Materials are confirmed present. Appendix E(6) FM-removal requirements apply upstream of shredding/MR.'
      };
    } else {
      return {
        code: 'fm-containing',
        label: 'FM-containing equipment/components (Appendix A/E/F)',
        severity: 'controlled',
        cite: 'REC Table 1; R2 Standard Focus Materials definitions',
        reasoning: 'One or more Focus Materials are possibly present. Conservative classification as FM-containing pending verification.'
      };
    }
  }

  // Plastic streams — Basel logic
  if (state.isPlastic === 'yes') {
    // Conservative: BFR present or unknown → A3210
    if (state.bfr === 'present' || state.bfr === 'unknown') {
      return {
        code: 'a3210',
        label: 'Basel A3210 — BFR-containing plastic (R2 Controlled)',
        severity: 'controlled',
        cite: 'REC Table 1; Basel Annex VIII A3210; COP §11',
        reasoning: 'Brominated flame retardants present or unverified. Classified as A3210 R2 Controlled stream. Note: COP §11 allows deferred DSV due diligence until 1/1/2028 for A3210/Y48 but all other Core Requirements remain.'
      };
    }
    // BFR-free + mixed → Y48
    if (state.bfr === 'verified-free' && state.purity === 'mixed') {
      return {
        code: 'y48',
        label: 'Basel Y48 — mixed plastic failing B3011 (R2 Controlled)',
        severity: 'controlled',
        cite: 'REC Table 1; Basel Annex II Y48; COP §11',
        reasoning: 'Mixed plastic stream does not meet B3011 single-resin purity criteria. Classified as Y48 R2 Controlled stream.'
      };
    }
    // BFR-free + single resin → B3011 unrestricted
    if (state.bfr === 'verified-free' && state.purity === 'single') {
      return {
        code: 'b3011',
        label: 'Non-focus materials including Basel B3011 (Unrestricted)',
        severity: 'unrestricted',
        cite: 'REC Table 1; Basel Annex IX B3011',
        reasoning: 'Single-resin plastic, BFR-free, meeting B3011 criteria. Classified as Unrestricted under Core 2. Core 6(e)(1)(B) justification required.'
      };
    }
  }

  // Non-electronic, no FM → Unrestricted
  if (state.sourceLink === 'non-electronic' && !anyFm) {
    return {
      code: 'non-electronic',
      label: 'Non-electronic equipment (Unrestricted)',
      severity: 'unrestricted',
      cite: 'REC Table 1; Core 2',
      reasoning: 'Non-electronic material with no Focus Materials present. Classified as Unrestricted under Core 2. Core 6(e)(1)(B) justification required.'
    };
  }

  // Mixed → controlled until sorted
  if (state.sourceLink === 'mixed') {
    return {
      code: 'unevaluated',
      label: 'Unevaluated equipment, components & materials (Core 6)',
      severity: 'controlled',
      cite: 'REC Table 1; Core 6',
      reasoning: 'Mixed-source stream with both electronic and non-electronic components. Controlled until sorted and reclassified per Appendix E(9).'
    };
  }

  // Unknown
  if (state.sourceLink === 'unknown' || !state.sourceLink) {
    return {
      code: 'unevaluated',
      label: 'Unevaluated equipment, components & materials (Core 6)',
      severity: 'controlled',
      cite: 'REC Table 1; Core 6',
      reasoning: 'Default state. Stream is controlled until characterized.'
    };
  }

  // Electronic source but no FM declared — needs review
  return {
    code: '',
    label: 'Insufficient information — review and select manually',
    severity: 'pending',
    cite: '',
    reasoning: 'Not enough information to derive a classification. Complete FM screening and Basel screening (if plastic).'
  };
}

function recomputeSuggested() {
  // when user has not manually overridden, keep the field synced to derived
  const derived = deriveClassification();
  if (!state.userOverrodeClassification && derived.code) {
    state.classification = derived.code;
    const el = document.getElementById('f-classification');
    if (el) el.value = derived.code;
  }
}

function renderClassification() {
  const derived = deriveClassification();
  const container = document.getElementById('classification-result');
  if (!derived.code) {
    container.innerHTML = `
      <div class="classification-card">
        <div class="classification-eyebrow">Suggested classification</div>
        <div class="classification-title">${escapeHtml(derived.label)}</div>
        <div class="classification-detail">${escapeHtml(derived.reasoning)}</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="classification-card ${derived.severity}">
        <div class="classification-eyebrow">Suggested classification · ${derived.severity === 'controlled' ? 'R2 Controlled' : derived.severity === 'unrestricted' ? 'Unrestricted' : 'Review needed'}</div>
        <div class="classification-title">${escapeHtml(derived.label)}</div>
        <div class="classification-detail">${escapeHtml(derived.reasoning)}</div>
        <div class="classification-cite">${escapeHtml(derived.cite)}</div>
      </div>
    `;
  }
  // sync field if not manually overridden
  if (!state.userOverrodeClassification && derived.code) {
    state.classification = derived.code;
    document.getElementById('f-classification').value = derived.code;
  }
  updateConditionalUI();
}

// ============================================================
// Conditional UI — show/hide blocks based on answers
// ============================================================
function updateConditionalUI() {
  // FM removal block — show if any FM is yes/possible
  const fmRemovalBlock = document.getElementById('fm-removal-block');
  if (fmRemovalBlock) {
    const anyFm = Object.values(state.fm).some(v => v === 'yes' || v === 'possible');
    fmRemovalBlock.classList.toggle('hidden', !anyFm);
  }

  // Basel block — only if plastic = yes
  const baselBlock = document.getElementById('basel-block');
  if (baselBlock) {
    baselBlock.classList.toggle('hidden', state.isPlastic !== 'yes');
  }

  // Unrestricted justification — only if classification is unrestricted-type
  const unrestrictedClasses = ['oem-packaged', 'non-electronic', 'b3011', 'planned-return'];
  const justifyBlock = document.getElementById('unrestricted-justification-block');
  if (justifyBlock) {
    const showJustify = unrestrictedClasses.includes(state.classification);
    justifyBlock.classList.toggle('hidden', !showJustify);
  }

  // Hierarchy block — show if next process is energy recovery or disposal
  const hierarchyBlock = document.getElementById('hierarchy-block');
  if (hierarchyBlock) {
    const showHierarchy = state.nextProcess === 'energy-recovery' || state.nextProcess === 'disposal';
    hierarchyBlock.classList.toggle('hidden', !showHierarchy);
  }
}

// ============================================================
// Validation
// ============================================================
function validateAll() {
  const errors = [];
  const warnings = [];

  if (!state.name) errors.push({ step: 1, msg: 'Spec name is required.' });
  if (!state.process) errors.push({ step: 1, msg: 'Production process is required.' });
  if (!state.sourceLink) errors.push({ step: 3, msg: 'Source linkage is required (COP §10.3.1).' });
  if (!state.surface) errors.push({ step: 3, msg: 'Surface description is required.' });
  if (!state.size) errors.push({ step: 3, msg: 'Size / length is required.' });
  if (!state.ingredients) errors.push({ step: 3, msg: 'Ingredients are required.' });
  if (!state.contamination) errors.push({ step: 3, msg: 'Acceptable level of contamination is required.' });

  // FM screening — every line must be answered
  for (const [fm, val] of Object.entries(state.fm)) {
    if (!val) errors.push({ step: 4, msg: `Focus Material screening incomplete: ${fm}` });
  }

  if (!state.isPlastic) errors.push({ step: 5, msg: 'Plastic-stream question must be answered.' });
  if (state.isPlastic === 'yes') {
    if (!state.bfr) errors.push({ step: 5, msg: 'BFR / POPs status is required for plastic streams.' });
    if (!state.purity) errors.push({ step: 5, msg: 'Resin purity (B3011 criteria) is required for plastic streams.' });
  }

  if (!state.classification) errors.push({ step: 6, msg: 'REC classification must be confirmed.' });

  const unrestrictedClasses = ['oem-packaged', 'non-electronic', 'b3011', 'planned-return'];
  if (unrestrictedClasses.includes(state.classification) && !state.unrestrictedJustification) {
    errors.push({ step: 6, msg: 'Unrestricted-stream justification is required (Core 6(e)(1)(B)).' });
  }

  if (!state.qcFrequency) errors.push({ step: 7, msg: 'QC frequency is required.' });
  if (!state.qcMethod) errors.push({ step: 7, msg: 'Method of check is required.' });
  if (!state.nonconformanceAction) errors.push({ step: 7, msg: 'Non-conformance action is required.' });

  if (!state.nextProcess) errors.push({ step: 8, msg: 'Next R2 process is required.' });
  if ((state.nextProcess === 'energy-recovery' || state.nextProcess === 'disposal') && !state.hierarchyJustification) {
    errors.push({ step: 8, msg: 'Core 2 hierarchy justification is required for energy recovery / disposal.' });
  }

  if (!state.docId) errors.push({ step: 9, msg: 'Document ID is required (ISO 7.5.2 a).' });
  if (!state.revision && state.revision !== '0') errors.push({ step: 9, msg: 'Revision is required.' });
  if (!state.createdBy) errors.push({ step: 9, msg: 'Created by is required (ISO 7.5.2 b).' });
  if (!state.createdDate) errors.push({ step: 9, msg: 'Created date is required.' });

  // Soft warnings
  if (!state.photo) warnings.push({ step: 2, msg: 'No photo attached. Recommended for operator reference.' });
  // Approved By is auto-mirrored from Created By in the UI, so no separate warning needed.
  const anyFm = Object.values(state.fm).some(v => v === 'yes' || v === 'possible');
  if (anyFm && !state.fmRemovalSop) warnings.push({ step: 4, msg: 'FM present but no upstream removal SOP referenced.' });

  return { errors, warnings };
}

// ============================================================
// Review summary
// ============================================================
function renderReview() {
  const { errors, warnings } = validateAll();

  // summary block
  const summary = document.getElementById('review-summary');
  const derived = deriveClassification();
  summary.innerHTML = `
    <div class="spec-summary">
      <div class="spec-summary-header">
        <div class="spec-summary-title">${escapeHtml(state.name || 'Untitled spec')} · Rev ${escapeHtml(state.revision || '0')}</div>
        <div class="mono muted">${escapeHtml(state.docId || 'No Doc ID')}</div>
      </div>
      <div class="spec-summary-body">
        ${summaryRow('Process', state.process)}
        ${summaryRow('Source', state.sourceLink)}
        ${summaryRow('Classification', classificationLabel(state.classification) || derived.label)}
        ${summaryRow('Next process', nextProcessLabel(state.nextProcess))}
        ${summaryRow('Disposition', state.disposition)}
        ${summaryRow('QC frequency', state.qcFrequency)}
        ${summaryRow('Method', state.qcMethod)}
        ${summaryRow('Created / Approved by', state.createdBy)}
        ${summaryRow('Date', formatDateDisplay(state.createdDate))}
        ${summaryRow('Revised by', state.revisedBy)}
        ${summaryRow('Revision date', formatDateDisplay(state.revisedDate))}
      </div>
    </div>
  `;

  // errors + warnings
  const errContainer = document.getElementById('validation-errors');
  let html = '';
  if (errors.length) {
    html += `
      <div class="banner error">
        <span class="banner-icon">!</span>
        <div class="banner-content">
          <div class="banner-title">${errors.length} required field${errors.length > 1 ? 's' : ''} missing</div>
          <ul style="margin-top: 6px; padding-left: 18px;">
            ${errors.map(e => `<li>${escapeHtml(e.msg)} <a href="#" class="mono" data-jump="${e.step}" style="color: var(--ctl-teal-dark);">→ jump</a></li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  if (warnings.length) {
    html += `
      <div class="banner warn">
        <span class="banner-icon">!</span>
        <div class="banner-content">
          <div class="banner-title">Soft warnings (will not block export)</div>
          <ul style="margin-top: 6px; padding-left: 18px;">
            ${warnings.map(w => `<li>${escapeHtml(w.msg)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  if (!errors.length && !warnings.length) {
    html += `
      <div class="banner info">
        <span class="banner-icon">✓</span>
        <div class="banner-content">
          <div class="banner-title">Ready to generate</div>
          All required fields complete. Click <strong>Generate PDF + JSON</strong> to export the controlled document pair.
        </div>
      </div>
    `;
  }
  errContainer.innerHTML = html;

  // jump links
  errContainer.querySelectorAll('[data-jump]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      goToStep(parseInt(a.dataset.jump));
    });
  });

  // toggle the generate button
  document.getElementById('btn-generate-pdf').disabled = errors.length > 0;
}

function summaryRow(label, value) {
  const v = value ? escapeHtml(value) : '<span class="empty">— not set —</span>';
  return `<div class="spec-summary-row"><div class="spec-summary-key">${label}</div><div class="spec-summary-val">${v}</div></div>`;
}

const CLASSIFICATION_LABELS = {
  'unevaluated': 'Unevaluated equipment, components & materials',
  'pv': 'PV Modules',
  'unsanitized': 'Unsanitized devices/media',
  'test-repair': 'Equipment/components for test & repair',
  'fm-containing': 'FM-containing equipment/components',
  'fm': 'Focus materials',
  'a3210': 'Basel A3210 — BFR-containing plastic',
  'y48': 'Basel Y48 — mixed plastic failing B3011',
  'oem-packaged': 'New equipment in unopened OEM packaging',
  'non-electronic': 'Non-electronic equipment',
  'b3011': 'Non-focus materials (Basel B3011)',
  'planned-return': 'Planned return equipment/components',
};
function classificationLabel(code) {
  return CLASSIFICATION_LABELS[code] || code;
}

const NEXT_PROCESS_LABELS = {
  'mr-internal': 'Materials Recovery — internal (Appendix E)',
  'mr-dsv': 'Materials Recovery — DSV (Appendix A)',
  'reuse-internal': 'Reuse — internal (Appendix C/D)',
  'reuse-dsv': 'Reuse — DSV (Appendix A)',
  'data-sanitization': 'Data sanitization (Appendix B)',
  'internal-process': 'Internal further processing',
  'energy-recovery': 'Energy recovery / W2E',
  'disposal': 'Disposal',
};
function nextProcessLabel(code) {
  return NEXT_PROCESS_LABELS[code] || code;
}

// ============================================================
// Persistence — auto-save draft to localStorage
// ============================================================
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch (e) {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.schemaVersion === SCHEMA_VERSION) {
        // Strip legacy fields from older drafts saved by v1.0.0–v1.0.2
        if (!data.createdBy && data.approvedBy) data.createdBy = data.approvedBy;
        if (!data.createdDate && data.approvedDate) data.createdDate = data.approvedDate;
        delete data.approvedBy;
        delete data.approvedDate;
        state = Object.assign(freshState(), data);
        populateFields();
      }
    }
  } catch (e) {}
}

// ============================================================
// Reset / new
// ============================================================
document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Start a new blank spec? Current draft will be cleared.')) return;
  state = freshState();
  state.createdDate = todayISO();
  localStorage.removeItem(DRAFT_KEY);
  populateFields();
  // clear photo display
  clearPhoto();
  // clear dropzone visuals
  dzMaster.classList.remove('loaded');
  dzView.classList.remove('loaded');
  document.getElementById('dz-master-title').textContent = 'Drop JSON sidecar here';
  document.getElementById('dz-master-desc').textContent = 'Or click to browse. Reloads form fields, image, and document-control metadata.';
  document.getElementById('dz-view-title').textContent = 'Drop PDF here (optional)';
  document.getElementById('dz-view-desc').textContent = 'For side-by-side reference. Not parsed — the JSON is the source of truth.';
  goToStep(0);
});

// ============================================================
// Export — PDF + JSON sidecar
// ============================================================
function filenameBase() {
  const name = (state.name || 'spec').replace(/[^A-Za-z0-9_-]/g, '_');
  const id = (state.docId || '').replace(/[^A-Za-z0-9_-]/g, '_');
  const rev = (state.revision || '0').replace(/[^A-Za-z0-9_-]/g, '_');
  const date = formatDateCompact(state.createdDate || todayISO());
  return `QC_Spec_${name}${id ? '_' + id : ''}_Rev${rev}_${date}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function exportJSON() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filenameBase() + '.json');
}

document.getElementById('btn-export-json').addEventListener('click', exportJSON);
document.getElementById('btn-generate-json').addEventListener('click', exportJSON);

// ============================================================
// PDF Generation — matches Faith's existing template layout
// ============================================================
document.getElementById('btn-generate-pdf').addEventListener('click', async () => {
  const { errors } = validateAll();
  if (errors.length) {
    alert('Please complete the required fields before generating the PDF.');
    return;
  }
  generatePDF();
  // also export the JSON sidecar
  setTimeout(exportJSON, 300);
});

function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // ============================================================
  // Header — CtL wordmark + DMS + spec title
  // ============================================================
  const headerH = 56;
  // outer border
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, contentWidth, headerH);
  // dividers
  const col1 = margin + 130;
  const col2 = margin + 290;
  doc.line(col1, margin, col1, margin + headerH);
  doc.line(col2, margin, col2, margin + headerH);
  // shade right column
  doc.setFillColor(220, 220, 220);
  doc.rect(col2, margin, contentWidth - (col2 - margin), headerH, 'F');
  doc.setDrawColor(160, 160, 160);
  doc.rect(margin, margin, contentWidth, headerH);
  doc.line(col1, margin, col1, margin + headerH);
  doc.line(col2, margin, col2, margin + headerH);

  // CtL wordmark — left column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('CLOSE', margin + 12, margin + 22);
  doc.setFontSize(7);
  doc.setTextColor(123, 191, 186);
  doc.text('THE', margin + 12, margin + 30);
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('LOOP', margin + 12, margin + 42);
  // tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(91, 163, 158);
  doc.text('collect today', margin + 12, margin + 50);
  doc.text('create tomorrow', margin + 60, margin + 50);

  // DMS middle column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const dmsLines = doc.splitTextToSize('Document Management System', col2 - col1 - 16);
  let dmsY = margin + 24;
  dmsLines.forEach(line => {
    doc.text(line, col1 + 8, dmsY);
    dmsY += 14;
  });

  // Spec name right column (shaded)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  const titleText = `QC Spec ${state.name}`;
  const titleLines = doc.splitTextToSize(titleText, pageWidth - margin - col2 - 16);
  let titleY = margin + 26;
  titleLines.forEach(line => {
    doc.text(line, col2 + 8, titleY);
    titleY += 16;
  });

  // QC SPECIFICATION header
  let cursorY = margin + headerH + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('QUALITY CONTROL SPECIFICATION', margin, cursorY);
  cursorY += 16;

  // ============================================================
  // Document control bar — Doc ID, Revision, Page
  // ============================================================
  doc.setDrawColor(160, 160, 160);
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Doc ID: ${state.docId || '—'}`, margin + 8, cursorY + 12);
  doc.text(`Rev: ${state.revision || '0'}`, margin + 200, cursorY + 12);
  doc.text(`Effective: ${formatDateDisplay(state.effectiveDate) || '—'}`, margin + 300, cursorY + 12);
  doc.text(`Page 1 of 1`, pageWidth - margin - 60, cursorY + 12);
  cursorY += 26;

  // ============================================================
  // Production Process block
  // ============================================================
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('Production Process', margin + 8, cursorY + 13);
  cursorY += 18;

  doc.rect(margin, cursorY, contentWidth / 2, 22);
  doc.rect(margin + contentWidth / 2, cursorY, contentWidth / 2, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(state.process || '—', margin + 8, cursorY + 15);
  doc.text(state.name || '—', margin + contentWidth / 2 + 8, cursorY + 15);
  cursorY += 22;

  // Description header
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description of Product:', margin + 8, cursorY + 13);
  cursorY += 18;

  // Description body — table with left column labels, middle values, right photo
  const descColLabelW = 130;
  const descColValueW = 220;
  const descColPhotoW = contentWidth - descColLabelW - descColValueW;

  // Per-row heights: Surface Description gets more room (often wraps to 2-3 lines);
  // Length/Size is usually short and doesn't need much.
  const descRows = [
    ['Surface Description:', state.surface, 42],
    ['Length / Size:', state.size, 18],
    ['Ingredients:', state.ingredients, 30],
    ['Acceptable Level of Contamination:', state.contamination, 30],
  ];

  const descBlockHeight = descRows.reduce((sum, r) => sum + r[2], 0);

  // Photo cell — spans all 4 rows
  doc.rect(margin + descColLabelW + descColValueW, cursorY, descColPhotoW, descBlockHeight);
  if (state.photo) {
    try {
      // jspdf can take dataURL directly
      doc.addImage(
        state.photo,
        'JPEG',
        margin + descColLabelW + descColValueW + 4,
        cursorY + 4,
        descColPhotoW - 8,
        descBlockHeight - 16,
        undefined,
        'FAST'
      );
    } catch (e) {
      console.error('Could not embed photo:', e);
    }
    // caption
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(state.name || '', margin + descColLabelW + descColValueW + descColPhotoW / 2, cursorY + descBlockHeight - 4, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(no image)', margin + descColLabelW + descColValueW + descColPhotoW / 2, cursorY + descBlockHeight / 2, { align: 'center' });
  }

  // Description rows
  let descY = cursorY;
  for (const [label, value, rowH] of descRows) {
    doc.rect(margin, descY, descColLabelW, rowH);
    doc.rect(margin + descColLabelW, descY, descColValueW, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(label, margin + 6, descY + 12, { maxWidth: descColLabelW - 12 });
    doc.setFont('helvetica', 'normal');
    // Allow up to 4 wrapped lines so the Surface row fully renders
    const wrapped = doc.splitTextToSize(value || '—', descColValueW - 12);
    const maxLines = Math.max(1, Math.floor((rowH - 4) / 11));
    doc.text(wrapped.slice(0, maxLines), margin + descColLabelW + 6, descY + 12);
    descY += rowH;
  }
  cursorY = descY;

  // ============================================================
  // REC Classification banner
  // ============================================================
  doc.setFillColor(232, 244, 242);
  doc.setDrawColor(91, 163, 158);
  doc.setLineWidth(1);
  doc.rect(margin, cursorY, contentWidth, 32, 'FD');
  doc.setLineWidth(0.5);
  doc.setDrawColor(160, 160, 160);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(91, 163, 158);
  doc.text('R2v3 / REC v1.2 CLASSIFICATION', margin + 8, cursorY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(classificationLabel(state.classification) || '—', margin + 8, cursorY + 22);
  // R2 source linkage on right side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const sourceText = `Source linkage: ${state.sourceLink || '—'}  |  Data storage: ${state.dataStorage || '—'}`;
  doc.text(sourceText, margin + 8, cursorY + 30);
  cursorY += 32;

  // FM screening row
  const fmSummary = formatFmSummary();
  doc.rect(margin, cursorY, contentWidth, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('FM screening:', margin + 8, cursorY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(fmSummary, margin + 90, cursorY + 14, { maxWidth: contentWidth - 100 });
  cursorY += 22;

  // Basel row (if plastic)
  if (state.isPlastic === 'yes') {
    doc.rect(margin, cursorY, contentWidth, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Basel classification:', margin + 8, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    const baselText = `BFR: ${state.bfr || '—'}  |  Purity: ${state.purity || '—'}`;
    doc.text(baselText, margin + 110, cursorY + 14);
    cursorY += 22;
  }

  // Justification row (if unrestricted)
  const unrestrictedClasses = ['oem-packaged', 'non-electronic', 'b3011', 'planned-return'];
  if (unrestrictedClasses.includes(state.classification) && state.unrestrictedJustification) {
    const jLines = doc.splitTextToSize(state.unrestrictedJustification, contentWidth - 100);
    const rowH = Math.max(22, jLines.length * 11 + 10);
    doc.rect(margin, cursorY, contentWidth, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Unrestricted justification:', margin + 8, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(jLines, margin + 140, cursorY + 14);
    cursorY += rowH;
  }

  // FM removal SOP (if applicable)
  if (state.fmRemovalSop) {
    doc.rect(margin, cursorY, contentWidth, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Upstream FM-removal SOP:', margin + 8, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(state.fmRemovalSop, margin + 150, cursorY + 14, { maxWidth: contentWidth - 160 });
    cursorY += 22;
  }

  // ============================================================
  // QC Check block
  // ============================================================
  cursorY += 6;
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth / 2, 18, 'FD');
  doc.rect(margin + contentWidth / 2, cursorY, contentWidth / 2, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('Quality Check Frequency:', margin + 8, cursorY + 13);
  doc.text('Method of Check:', margin + contentWidth / 2 + 8, cursorY + 13);
  cursorY += 18;

  doc.rect(margin, cursorY, contentWidth / 2, 22);
  doc.rect(margin + contentWidth / 2, cursorY, contentWidth / 2, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(state.qcFrequency || '—', margin + 8, cursorY + 15);
  doc.text(state.qcMethod || '—', margin + contentWidth / 2 + 8, cursorY + 15);
  cursorY += 22;

  // Non-conformance action
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Action to be taken in the event of non-conformance:', margin + 8, cursorY + 13);
  cursorY += 18;

  const ncLines = doc.splitTextToSize(state.nonconformanceAction || '—', contentWidth - 16);
  const ncH = Math.max(40, ncLines.length * 12 + 14);
  doc.rect(margin, cursorY, contentWidth, ncH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(ncLines, margin + 8, cursorY + 14);
  cursorY += ncH;

  // Plastic types / disposition
  if (state.plasticTypes) {
    doc.setFillColor(239, 238, 232);
    doc.rect(margin, cursorY, contentWidth, 18, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Plastic Types:', margin + 8, cursorY + 13);
    cursorY += 18;
    doc.rect(margin, cursorY, contentWidth, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(state.plasticTypes, margin + 8, cursorY + 15);
    cursorY += 22;
  }

  // Disposition
  doc.setFillColor(239, 238, 232);
  doc.rect(margin, cursorY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Disposition / Next R2 Process:', margin + 8, cursorY + 13);
  cursorY += 18;
  doc.rect(margin, cursorY, contentWidth, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const dispText = `${state.disposition || '—'}  ·  ${nextProcessLabel(state.nextProcess) || '—'}`;
  doc.text(dispText, margin + 8, cursorY + 15, { maxWidth: contentWidth - 16 });
  cursorY += 22;

  if ((state.nextProcess === 'energy-recovery' || state.nextProcess === 'disposal') && state.hierarchyJustification) {
    const hjLines = doc.splitTextToSize(state.hierarchyJustification, contentWidth - 100);
    const hjH = Math.max(22, hjLines.length * 11 + 10);
    doc.rect(margin, cursorY, contentWidth, hjH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Core 2 hierarchy justification:', margin + 8, cursorY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(hjLines, margin + 150, cursorY + 14);
    cursorY += hjH;
  }

  // ============================================================
  // Footer — approval chain (ISO 7.5.2 b/d)
  // ============================================================
  // Anchored at bottom — leaving a fixed amount of space
  const footerY = pageHeight - margin - 90;
  const footerStartY = Math.max(cursorY + 20, footerY);

  doc.setFillColor(239, 238, 232);
  doc.rect(margin, footerStartY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('Document Control', margin + 8, footerStartY + 13);

  const ctrlY = footerStartY + 18;
  const ctrlColW = contentWidth / 2;
  doc.rect(margin, ctrlY, ctrlColW, 44);
  doc.rect(margin + ctrlColW, ctrlY, ctrlColW, 44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Created / Approved By:', margin + 6, ctrlY + 12);
  doc.text('Revised By:', margin + ctrlColW + 6, ctrlY + 12);

  // Names row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(state.createdBy || '—', margin + 6, ctrlY + 26);
  doc.text(state.revisedBy || '—', margin + ctrlColW + 6, ctrlY + 26);

  // Dates row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Date: ${formatDateDisplay(state.createdDate) || '—'}`, margin + 6, ctrlY + 39);
  doc.text(`Date: ${formatDateDisplay(state.revisedDate) || '—'}`, margin + ctrlColW + 6, ctrlY + 39);

  // "Uncontrolled when printed" + generator stamp
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Uncontrolled when printed · Master copy resides in CtL DMS', margin, ctrlY + 56);
  doc.text(`Generated ${formatDateDisplay(todayISO())} by ${state.generator} v${state.generatorVersion}`, pageWidth - margin, ctrlY + 56, { align: 'right' });

  // ============================================================
  // Save
  // ============================================================
  doc.save(filenameBase() + '.pdf');
}

function formatFmSummary() {
  const fmNames = {
    pcbs: 'PCBs',
    mercury: 'Hg',
    crt: 'CRT',
    batteries: 'Batt',
    boards: 'Boards',
    eol: 'EOL'
  };
  const parts = [];
  for (const [k, v] of Object.entries(state.fm)) {
    if (v) {
      const sym = v === 'yes' ? '✓' : v === 'possible' ? '?' : '×';
      parts.push(`${fmNames[k]} ${sym}`);
    }
  }
  return parts.join('   ') || '—';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// Init
// ============================================================
loadDraft();
goToStep(0);

})();
