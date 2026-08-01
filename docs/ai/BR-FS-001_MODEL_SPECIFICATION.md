# BR-FS-001 Model Specification

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Document type:** Specification only. This document describes the intended design of a model that does not yet exist. No training code, no model implementation, and no weight downloads were performed to produce this document.
**Author:** AI Research Lead, BeautyRoute
**Date:** 2026-07-30
**Prerequisite reading:** [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md), [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md), [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md), [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md)
**Status: SPECIFICATION ONLY — NOT APPROVED FOR IMPLEMENTATION.** See §8.

---

## 1. Purpose and scope

This document translates the architecture recommendation in [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md) (MobileNetV3-Large, transfer learning) into a concrete, reviewable model specification: inputs, outputs, backbone/head design, training strategy, evaluation protocol, and deployment target. It is a specification, not a build — every design choice below is stated as a plan to be reviewed and approved, not as work already performed. Where a design choice depends on an open question from an earlier phase (most importantly, the unresolved dataset licensing gate), that dependency is stated explicitly rather than assumed away.

---

## 2. Task definition

- **Task:** Single-label image classification.
- **Input:** One RGB frontal facial photograph.
- **Output:** One of 6 mutually exclusive classes: **Oval, Round, Square, Heart, Diamond, Oblong.**
- **Out of scope for BR-FS-001:** Multi-face images, profile/angled face images, video input, and confidence calibration beyond a standard softmax output are not addressed by this specification and would require separate design work.

This 6-class taxonomy is BeautyRoute's product requirement, established prior to this research phase. As documented in [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md) §4 finding 2 and reinforced throughout [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md), the great majority of publicly documented face-shape datasets and papers use a 5-class taxonomy (omitting Diamond) — this mismatch is a known, carried-forward risk, not a new finding of this document.

---

## 3. Input specification

| Property | Specification | Rationale / source |
|---|---|---|
| Color space | RGB | Standard for all architectures compared in BR-FS-001_ARCHITECTURE_SELECTION.md |
| Input resolution | 224×224 px | Native input size for MobileNetV3 as published (arXiv:1905.02244) and as used by torchvision's `mobilenet_v3_large`; also matches the resolution used in the directly-verified Xception face-shape paper (Adityatama & Putra 2023, BR-FS-001_LITERATURE_REVIEW.md §2.13's Adityatama entry — see literature review for the full citation), allowing comparable evaluation. |
| Face framing | Single, front-facing, unobstructed face, ideally pre-cropped/aligned | Multiple independent sources in the literature review report degraded performance on tilted faces, sunglasses, or cropped/occluded faces (e.g., github.com/Cheshmyar/Face-Shape-Classification and the Pratch-yani project README, both cited in FACE_SHAPE_DATASET_RESEARCH.md and BR-FS-001_LITERATURE_REVIEW.md §2.13) — this is a **recommendation** based on repeatedly observed failure modes, not a guarantee the model will reject bad input on its own. |
| Preprocessing pipeline (recommended) | Face detection + alignment (e.g., MTCNN) prior to classification | MTCNN-based preprocessing is used in the directly-verified Pratch-yani project (BR-FS-001_LITERATURE_REVIEW.md §2.13) and in the MTCNN+FaceNet face-shape paper (§2.7); the Pratch-yani README specifically credits MTCNN-based preprocessing with reducing overfitting and improving validation accuracy. This is a **recommendation carried from the literature**, not a component that has been built or tested by BeautyRoute. |

---

## 4. Model architecture specification

Per [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md) §4:

- **Backbone:** MobileNetV3-Large, initialized from ImageNet-pretrained weights (the standard torchvision-provided checkpoint).
- **Backbone parameter count:** ~5.4–5.5M (source: arXiv:1905.02244 and docs.pytorch.org/vision/stable/models.html, as detailed in BR-FS-001_ARCHITECTURE_SELECTION.md §2.2).
- **Classification head:** Replace the final ImageNet 1000-way classification layer with a head producing 6 outputs (one per target class), consistent with standard transfer-learning practice for MobileNetV3 in torchvision. The exact head design (e.g., single linear layer vs. an additional hidden layer with dropout) is an implementation detail to be finalized during the implementation phase, not specified further here, since specifying it precisely would begin to constitute model design/implementation rather than a high-level specification.
- **Training strategy:** Transfer learning (fine-tuning a pretrained backbone), not training from scratch. This is a direct, evidence-based recommendation from [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5 finding 2: the only directly-verified, apples-to-apples comparison found in this project's research (Pratch-yani, §2.13) showed transfer learning outperforming training-from-scratch by +15.8 percentage points (76.9% → 92.7%) on the same dataset and evaluation protocol.
- **Fallback architectures, in priority order, if MobileNetV3-Large underperforms during empirical validation:**
  1. EfficientNetV2S — the only EfficientNet-family variant with direct (though metrics-unverified) face-shape prior art (BR-FS-001_LITERATURE_REVIEW.md §2.10).
  2. ResNet50 — has face-shape prior art via comparison (BR-FS-001_LITERATURE_REVIEW.md §2.11, metrics unverified) and is the most universally supported fallback architecture per BR-FS-001_ARCHITECTURE_SELECTION.md §2.3.

---

## 5. Data requirements and dependency on dataset approval

**This section is a hard dependency, not a formality.** Per [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md), the current dataset status is **REQUIRES LICENSE REVIEW** — no dataset has been cleared for use. This model specification assumes that dependency will eventually be resolved through one of the three paths already documented there (creator/re-publisher license clarification, academic author outreach, or an alternative dataset). Nothing in this document should be read as authorization to acquire or use any dataset discussed in the prior research documents.

Once a dataset is approved, it must satisfy, at minimum:
- All 6 target classes represented (Oval, Round, Square, Heart, Diamond, Oblong) — per [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md) §4, no single dataset identified in this research meets this bar alone; a merge of a 5-class base set with a Diamond-labeled supplement was the only path identified, and any merge requires the normalization/QA step flagged in that document.
- A train/validation/test split with no leakage across splits — the niten19-derived ecosystem's own established convention (800/200 train/test per class, per FACE_SHAPE_DATASET_RESEARCH.md §2.1) is a reasonable reference point if that dataset family is ultimately cleared for use, but is not itself an approval of that dataset.
- Documented, or at minimum inspectable, demographic composition — given the repeatedly-documented Asian-face misclassification bias found independently in two separate sources during this research (FACE_SHAPE_DATASET_RESEARCH.md §4 finding 4; BR-FS-001_LITERATURE_REVIEW.md §2.13 and §5 finding 4), any approved dataset should be explicitly evaluated for this failure mode before training, not discovered after deployment.

---

## 6. Target performance and evaluation protocol

### 6.1 Target accuracy range

Based on [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5 finding 1, credible deep-learning/transfer-learning results on 5-class face-shape taxonomies in the surveyed literature range roughly **84%–93%** overall accuracy (Tio 2019: 84.4–84.8%; Adityatama & Putra 2023: 85.1%; Swin Transformer paper: 86.34%; IdentiFace: 88.03%; Pratch-yani VGG16/VGGFace: 92.7%). A single outlier claim of 99.6% (HoBDe-GCN, BR-FS-001_LITERATURE_REVIEW.md §2.8) is explicitly excluded from this range because it could not be independently verified in this research and is flagged as unverified pending full-text access.

**Recommended target for BR-FS-001's first trained iteration: 80–90% overall test accuracy**, set conservatively below the top of the literature range because:
- The target taxonomy has 6 classes rather than the 5 used by most literature results (an additional class generally increases task difficulty).
- No prior art exists for the specific backbone (MobileNetV3) being recommended (BR-FS-001_ARCHITECTURE_SELECTION.md §4).
- The eventual training dataset's exact size/quality is not yet known, pending the licensing gate in §5.

This target is a **recommendation**, to be revisited once an approved dataset and a first trained baseline exist — not a committed SLA.

### 6.2 Evaluation metrics

- Overall accuracy (top-1).
- Per-class precision, recall, and F1-score — not just an aggregate, given that multiple sources in this research report class-specific failure patterns (Oval most often misclassified, per FACE_SHAPE_DATASET_RESEARCH.md §4 finding 4 and BR-FS-001_LITERATURE_REVIEW.md §2.13).
- A full confusion matrix, specifically reviewed for the Asian-face Oval↔Round confusion pattern documented in two independent sources during this research, as a targeted fairness check rather than a generic aggregate metric.
- If demographic metadata is available in the approved dataset (not guaranteed — see §5), stratified accuracy by the available demographic groupings, to make any bias measurable rather than anecdotal.

### 6.3 Benchmarking

The empirical validation step recommended in [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md) §4 should be executed here: train the recommended MobileNetV3-Large baseline and at least one literature-precedented backbone (Xception or EfficientNetV2S, both with direct face-shape prior art per BR-FS-001_LITERATURE_REVIEW.md) on the same approved dataset and split, to confirm the mobile-first architecture choice does not come at an unacceptable accuracy cost relative to the literature-precedented alternatives.

---

## 7. Deployment specification

- **Target formats:** Standard PyTorch checkpoint (training/evaluation), plus an export path via `torchvision.models.quantization.mobilenet_v3_large` for INT8 CPU inference, and/or ONNX export for cross-platform serving — both paths are natively supported by torchvision without paid third-party tooling, per BR-FS-001_ARCHITECTURE_SELECTION.md §2.2.
- **Deployment targets:** Server-side inference (initial) and on-device/mobile inference (stated product goal) — the quantized MobileNetV3 path is specifically chosen to keep the on-device path realistic without requiring a separate mobile-specific architecture migration later.
- **No paid inference APIs:** Consistent with BeautyRoute's stated philosophy, no step in this specification depends on a third-party paid model-hosting API.

---

## 8. Approval status and open items

**This document is a specification only. It does not authorize training, data acquisition, or implementation.**

Before implementation may begin, the following must occur, in order:
1. **Dataset licensing gate must be resolved** — status remains **REQUIRES LICENSE REVIEW** per [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md). This is the single blocking dependency for this entire specification.
2. **Human review and explicit sign-off on this specification and the architecture recommendation in [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md)** — in particular, sign-off on the explicitly-stated risk that no face-shape-specific prior art exists for the recommended MobileNetV3 backbone (BR-FS-001_ARCHITECTURE_SELECTION.md §4), and on the recommendation (not yet executed) to empirically benchmark it against a literature-precedented alternative before committing to production use.
3. **Confirmation of the target class taxonomy and Diamond-class data sourcing plan** — per §5 and [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md) §4, no single approved-pending dataset covers all 6 classes; the merge strategy described there has not been executed or approved.

**Facts vs. recommendations, restated for clarity:** every performance figure, architecture property, and citation in this document traces to a source in [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) or [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md). The specific numeric targets in §6.1, the input/preprocessing choices in §3, and the fallback ordering in §4 are this document's own recommendations, offered for review — they are not established facts about how BR-FS-001 will perform, because BR-FS-001 does not yet exist.

**Do not proceed to implementation until approval.**
