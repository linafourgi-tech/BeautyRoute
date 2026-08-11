# BR-FS-001 — Current Status (Definitive)

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Document type:** Definitive current-status record, written for the Phase 14 handover-closure pass. Supersedes nothing — it consolidates and cross-checks the existing research documents below, all of which remain the source of record for their own detail. Every claim here traces to a specific file/line already in this repository; nothing is inferred or assumed.
**Date:** 2026-08-11
**Read alongside:** `FACE_SHAPE_DATASET_RESEARCH.md`, `FACE_SHAPE_COMPARISON.md`, `FACE_SHAPE_DECISION.md`, `BR-FS-001_LITERATURE_REVIEW.md`, `BR-FS-001_ARCHITECTURE_SELECTION.md`, `BR-FS-001_MODEL_SPECIFICATION.md` — all in this same directory.

---

## 1. One-line status

**Research and specification complete. Implementation has not started and may not start. No dataset is cleared for use — academic or commercial.**

---

## 2. Status by stage

| # | Stage | Status | Evidence |
|---|---|---|---|
| 1 | Problem definition | **DONE** | `BR-FS-001_MODEL_SPECIFICATION.md` §2: single-label classification, one RGB frontal photo in, one of 6 classes out. |
| 2 | Intended classifier purpose | **DONE** | Face-shape reading to drive BeautyRoute's hairstyle/service recommendations (product context: `docs/PROJECT_ROADMAP.md` Phase 10). |
| 3 | Architecture decision | **DONE** | `BR-FS-001_ARCHITECTURE_SELECTION.md` §4: MobileNetV3-Large, ImageNet-pretrained, transfer learning. Six architectures compared with sourced parameter counts, FLOPs, and mobile-deployment evidence. |
| 4 | MobileNetV3-Large decision — evidence quality | **DONE, with an explicitly stated gap** | Justified by mobile-first design intent, an official torchvision quantized variant, and small-dataset suitability (§4, points 1–4). The document itself states plainly: **"no face-shape-classification paper using MobileNetV3 was found in this literature review"** — this is an engineering judgment call, not a proven-on-this-task claim, and the document says so explicitly. |
| 5 | Literature review | **DONE** | `BR-FS-001_LITERATURE_REVIEW.md` — cross-checked, sourced (arXiv/DOI/GitHub), with facts and recommendations explicitly separated throughout. |
| 6 | Dataset candidates | **DONE (identified, none cleared)** | Three candidates identified and scored — see §4 below. |
| 7 | Dataset licensing | **BLOCKED** | `FACE_SHAPE_DECISION.md` §3: **"FINAL DECISION: REQUIRES LICENSE REVIEW."** No dataset has been downloaded or used. |
| 8 | Academic/research usage rights | **NOT VERIFIED for any candidate** | See §4 below — every candidate requires an outreach/verification step that has not happened. |
| 9 | Commercial/product usage rights | **NOT VERIFIED, and explicitly a separate, later question** | `FACE_SHAPE_COMPARISON.md` weights "license clarity & commercial safety" at 30% of its own scoring specifically because commercial rights are harder to clear than research access. See §5 below. |
| 10 | Dataset availability/download status | **NOT STARTED** | No dataset has been downloaded anywhere in this repository. Verified: no `dataset/`, `data/`, `.ipynb`, model-weight (`.h5`/`.pt`/`.pth`/`.onnx`/`.tflite`), or training-related directory exists anywhere in this repo. |
| 11 | Label/class definition | **DONE** | `BR-FS-001_MODEL_SPECIFICATION.md` §2: Oval, Round, Square, Heart, Diamond, Oblong (6 classes) — a known mismatch against the 5-class taxonomy most literature/datasets use (Diamond is the missing class almost everywhere). |
| 12 | Preprocessing specification | **DONE (specified, not built)** | §3: RGB, 224×224, single front-facing unobstructed face, MTCNN-based face detection/alignment recommended pre-classification — explicitly stated as "a recommendation carried from the literature, not a component that has been built or tested by BeautyRoute." |
| 13 | Training implementation | **NOT STARTED** | No training code exists anywhere in this repository (verified this pass — see §10 above). |
| 14 | Training runs | **NOT STARTED** | None. Zero. |
| 15 | Validation/evaluation | **NOT STARTED** | No model exists to evaluate. |
| 16 | Metrics | **DEFINED (target only, not measured)** | `BR-FS-001_MODEL_SPECIFICATION.md` §6: target 80–90% overall test accuracy (conservative vs. the 84–93% literature range, explicitly because of the extra class and unproven backbone), plus per-class precision/recall/F1, a confusion matrix, and a specific fairness check for a documented Asian-face Oval↔Round misclassification bias found in two independent literature sources. **These are targets, not results — no model has been trained.** |
| 17 | Deployment/inference integration | **NOT STARTED (target specified)** | §7: PyTorch checkpoint, INT8 quantized torchvision export, and/or ONNX, no paid inference API. Client Portal's face-shape "analysis" (`src/pages/ClientPortal.jsx`) is a `setInterval`+`Math.random()` UI simulation with its own `TODO(mockData-audit, 2026-08-05)` comment — it is not, and does not call, any part of this specification. |

---

## 3. Architecture decision and evidence (summary)

**Recommended: MobileNetV3-Large, ImageNet-pretrained, fine-tuned via transfer learning.**

- Only architecture of the 6 compared whose original design goal is mobile CPU deployment (hardware-aware NAS, arXiv:1905.02244).
- Only one with an official torchvision-native quantized variant (`torchvision.models.quantization.mobilenet_v3_large`).
- Smallest parameter count (5.4–5.5M) of the six, best matched to a realistically small (~5,000-image-or-fewer) training set.
- **Explicit, stated limitation:** no face-shape-specific prior art exists for this exact backbone. The recommendation is an engineering judgment call built from adjacent evidence, not a proven result. `BR-FS-001_ARCHITECTURE_SELECTION.md` §4 itself calls for empirically benchmarking MobileNetV3-Large against a literature-precedented backbone (Xception or EfficientNetV2S) as an early implementation step — **not yet done, because implementation has not started.**
- Fallback order if MobileNetV3-Large underperforms: EfficientNetV2S, then ResNet50 (both have some direct, if metrics-unverified, face-shape prior art).

---

## 4. Dataset candidates — exact status per candidate

| Candidate | Source | Score | Stated license | Academic/research rights | Commercial rights | What's missing to clear it |
|---|---|---|---|---|---|---|
| Face Shape Classification (`project-bsmpw`) | Roboflow Universe | 65/100 (highest scored) | CC BY 4.0, explicitly stated on the page | **Not verified** — the license label likely covers only the re-publisher's own rights, not the original photographed individuals' likeness/photographer copyright. `FACE_SHAPE_DECISION.md`: *"This must be independently verified before any download or use."* | Not verified (same provenance problem as academic rights — a CC BY 4.0 label on a re-export doesn't establish the underlying rights were ever cleared) | Direct contact with the Roboflow project owner and/or Kaggle's `niten19` to confirm original image provenance. Also missing the Diamond class entirely. |
| Face Shape Dataset (`niten19`) | Kaggle | 55/100 | **Blank / unstated** | Not verified — no license at all to evaluate | Not verified | Direct contact with the creator to obtain any license terms at all. Best-balanced, most community-validated candidate (1,000 images/class, 72,100 views) if this is resolved. Also missing Diamond. |
| Pasupa, Sunhem & Loo (2019), *Expert Systems with Applications* | Peer-reviewed academic paper | Not scored competitively (insufficient disclosed detail) | Not stated on the paper's GitHub page | **Not verified** — requires direct author outreach; this is the step that has not happened | Not applicable yet — academic access itself is unresolved | Direct author contact to obtain license terms, exact dataset size, and class labels. If successful, this is the most defensible provenance of any option (the only peer-reviewed, DOI-citable source found), valuable for both academic use and a future commercial product. |

**No dataset — academic or commercial — is currently verified or cleared for use.** This is stated explicitly, not implied: `FACE_SHAPE_DECISION.md` §3's own final line: *"No dataset should be downloaded or used for BR-FS-001 until"* one of the three outreach paths above clears.

**Diamond-class gap, independent of licensing:** no single candidate covers all 6 target classes. `FACE_SHAPE_DECISION.md` §1 identifies `minhquangbui` (64 Diamond images) as the only meaningful Diamond-class source found, meaning even a fully-licensed 5-class dataset would still require a separate merge-and-normalize step with its own data-quality risk (different photo pool, different lighting/resolution/demographic composition) — not yet executed or approved.

---

## 5. Academic vs. commercial rights — kept explicitly separate

Per this closure pass's instruction: *"Train on an academically licensed set now so you can move. The commercial-rights review is a separate track for later."* This principle is sound and is reflected in how `FACE_SHAPE_COMPARISON.md`/`FACE_SHAPE_DECISION.md` already separate the two concerns. **However, applying it here requires an academically-licensed set to actually exist and be verified — and none currently does** (§4 above). The gate is not "commercial rights are missing so we can't start" — it's "no candidate's rights, academic or commercial, have been confirmed at all yet."

Once academic/research access is confirmed for any candidate (via the outreach in §6 below), the correct sequence is:
1. Proceed with academic-track model development (training, benchmarking, evaluation) using that access.
2. Track commercial/product shipping rights as a **separate, later** approval — do not block academic development on it, and do not assume academic clearance implies commercial clearance either. `FACE_SHAPE_COMPARISON.md`'s own 30%-weighted "commercial safety" criterion exists precisely because these are different questions with different answers per dataset.

---

## 6. Permission-request template (draft only — not sent)

Per instruction: this is prepared for use, not dispatched. No outreach has been sent. The most promising, most-cleanly-provenanced path is the academic author contact (Pasupa, Sunhem & Loo, 2019) — the only peer-reviewed, DOI-citable candidate, and the one most naturally aligned with "an academically licensed set." The same template's first two paragraphs can be adapted for the `niten19`/Roboflow outreach path by substituting the second paragraph's specifics.

```
Subject: Research/dataset access request — face-shape classification dataset (student project)

Dear [Author name(s)],

I'm writing regarding your [2019] paper "[exact title]" published in
[Expert Systems with Applications]. I'm developing BeautyRoute, a
university/student project building a face-shape classifier
(MobileNetV3-Large-based) as part of a broader beauty-services
application, and your dataset appeared in our literature review as the
strongest available option with genuine peer-reviewed provenance.

Could you tell me:
1. What license or usage terms apply to the dataset described in your
   paper?
2. Is the dataset available for academic/research use, and if so, how
   can I obtain access?
3. Separately from research use — if this project were to continue
   toward a commercial product, would commercial use require a
   different agreement, and who would I need to speak with about that?
4. Could you confirm the exact number of images, class labels, and any
   demographic/provenance documentation available for the dataset?

I'm asking now specifically to confirm research/academic terms before
doing any further work: no data will be downloaded or used until this is
resolved. Commercial use, if the project reaches that stage, will be
handled as a fully separate follow-up request — I'm not asking you to
decide that now.

Thank you for your time,
[Name]
[Institution / project]
[Contact email]
```

**Do not send this without human review and sign-off.** It is a draft only.

---

## 7. Should training start now? **No.**

Per this closure pass's own decision rule: *"do not train/download a dataset whose academic rights are not verified."* §4 above shows no candidate currently has verified academic rights. Therefore:

- **No training run was started or is recommended in this pass.**
- No dataset was downloaded.
- No model code was written.

This is not a stall for its own sake — it is the direct, evidence-based consequence of §4's findings, re-verified fresh for this document rather than assumed from older reports.

---

## 8. Exact next action (single, executable)

**Send the outreach in §6 (or the equivalent adapted for `niten19`/Roboflow) to the Pasupa, Sunhem & Loo (2019) authors, requesting academic/research access terms.** This is the fastest path to a genuinely defensible, academically-licensed dataset per the existing research's own ranking (`FACE_SHAPE_DECISION.md` §1: "the most defensible provenance of any option in this research"). Once a reply confirms academic/research terms:

1. Re-evaluate the confirmed dataset against `FACE_SHAPE_COMPARISON.md`'s existing weighted criteria (per `FACE_SHAPE_DECISION.md` §3's own closing instruction).
2. Only then begin implementation: environment setup, data loading, the MobileNetV3-Large baseline plus the literature-precedented benchmark comparison already called for in `BR-FS-001_ARCHITECTURE_SELECTION.md` §4 and `BR-FS-001_MODEL_SPECIFICATION.md` §6.3.
3. Track commercial/product rights for the same dataset as a separate, later approval (§5) — do not conflate the two, do not assume one implies the other.

---

## 9. Training-readiness checklist

Every item below is marked only when supported by evidence already cited above. An unmarked item is not a criticism — most of this checklist cannot be completed until §8's next action resolves.

### Dataset

| Item | Status |
|---|---|
| Source identified | ✅ DONE — 3 candidates, §4 |
| Authoritative source URL/reference documented | ✅ DONE — `FACE_SHAPE_DATASET_RESEARCH.md`, `FACE_SHAPE_COMPARISON.md` |
| License text obtained | ❌ NOT STARTED for 2 of 3 (niten19 blank, Pasupa et al. unstated); ⚠️ PARTIAL for Roboflow (a license label exists but is unverified — see §4) |
| Academic/research use verified | ❌ BLOCKED — §8 is the action to resolve this |
| Commercial status separately recorded | ✅ DONE as a *distinct, tracked-separately* open question (§5) — not resolved, but not conflated with academic access either |
| Dataset downloaded | ❌ NOT STARTED |
| Integrity checked | ❌ NOT STARTED (no dataset to check) |
| Labels/classes verified | ❌ NOT STARTED |
| Class distribution audited | ❌ NOT STARTED |
| Duplicates checked | ❌ NOT STARTED |
| Obvious leakage risks checked | ❌ NOT STARTED |

### ML design

| Item | Status |
|---|---|
| Target classes defined | ✅ DONE — 6 classes, §2 item 11 |
| Preprocessing specified | ✅ DONE (specified, not built) — §2 item 12 |
| Image sizing specified | ✅ DONE — 224×224 RGB |
| Augmentation strategy specified | ❌ NOT STARTED — not addressed in `BR-FS-001_MODEL_SPECIFICATION.md`; an implementation-phase decision |
| Train/validation/test split strategy defined | ⚠️ PARTIAL — `BR-FS-001_MODEL_SPECIFICATION.md` §5 references the niten19-ecosystem's 800/200 train/test convention as "a reasonable reference point... if that dataset family is ultimately cleared," explicitly **not** an approval or a committed split strategy |
| MobileNetV3-Large initialization strategy defined | ✅ DONE — ImageNet-pretrained torchvision checkpoint, §4 item 3/`BR-FS-001_MODEL_SPECIFICATION.md` §4 |
| Transfer-learning/fine-tuning plan defined | ✅ DONE at strategy level (fine-tune, don't train from scratch) — head-design specifics explicitly deferred to implementation |
| Baseline hyperparameters defined | ❌ NOT STARTED |
| Loss function defined | ❌ NOT STARTED |
| Optimizer defined | ❌ NOT STARTED |
| Metrics defined | ✅ DONE — §2 item 16 |
| Reproducibility seed defined | ❌ NOT STARTED |
| Experiment tracking approach defined | ❌ NOT STARTED |

### Evaluation

| Item | Status |
|---|---|
| Accuracy | ❌ NOT STARTED — target only (80–90%), no measured result |
| Precision | ❌ NOT STARTED — target defined (per-class), not measured |
| Recall | ❌ NOT STARTED — target defined (per-class), not measured |
| F1 | ❌ NOT STARTED — target defined (per-class), not measured |
| Confusion matrix | ❌ NOT STARTED — planned (§2 item 16), not produced |
| Per-class performance | ❌ NOT STARTED |
| Overfitting checks | ❌ NOT STARTED |

---

## 10. What this document deliberately does not do

- Does not fabricate or imply permission for any dataset.
- Does not start, schedule, or authorize a training run.
- Does not download any dataset.
- Does not treat academic access and commercial rights as the same question.
- Does not claim a trained, validated, or production-ready model exists — because none does, anywhere in this repository.
