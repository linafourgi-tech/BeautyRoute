# Face Shape Dataset Comparison

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Prerequisite reading:** [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md) — this document assumes those facts and citations without repeating every source URL. Refer back to it for provenance of any claim reused here.
**Date:** 2026-07-27

---

## 1. Rejection Pass

The task's rejection criteria are applied literally, one dataset at a time. A dataset is rejected if it meets **any one** of the stated conditions (unclear licensing, unreliable labels, fake/generated images, mixed profile/frontal, extreme class imbalance, missing required classes, appears abandoned, no academic/community credibility).

| # | Dataset | Rejection trigger(s) | Verdict |
|---|---|---|---|
| 2.1 | niten19 (Kaggle) | Unclear licensing (field blank); missing required class (no Diamond) | **Rejected as standalone** — retained as a *technical/community reference and potential merge base*, contingent on license resolution |
| 2.2 | bkprocovid19 (HuggingFace) | Unclear licensing (none stated); unreliable labels (unresolved class-taxonomy discrepancy vs. its likely source); low community credibility (2 likes) | **Rejected** |
| 2.3 | attanmhd (Kaggle) | Missing required classes (only 3 of 6 — no Heart, Diamond, Oblong) | **Rejected** |
| 2.4 | lucifierx (Kaggle) | Extremely unbalanced/tiny classes (12–19 images/class, 98 total); unclear licensing ("Unknown"); off-taxonomy class (Triangle) | **Rejected** |
| 2.5 | zeyadkhalid (Kaggle) | Unclear licensing (none stated); missing required class (no Diamond) | **Rejected as standalone** — retained as a *preprocessing-quality reference*, contingent on license resolution |
| 2.6 | hoangthangcdt (Kaggle) | No verifiable information at all — effectively no confirmable community/academic credibility | **Rejected** |
| 2.7 | minhquangbui (Kaggle) | Extremely thin per-class counts (64–94 images/class); low community credibility (usability 2.50); off-taxonomy class (Pear); licensing label unverified beyond page text | **Rejected as standalone** — retained as the *only meaningful Diamond-class source found*, contingent on license resolution |
| 2.8 | hanakb (Kaggle) | Unclear licensing (explicit "Unknown"); unreliable/unverifiable class labels; no community credibility (usability score 0); male-only (no diversity) | **Rejected** |
| 2.9 | Roboflow project-bsmpw | Missing required class (no Diamond); underlying image-rights provenance unresolved despite a stated platform license | **Rejected as standalone** — retained as the *strongest license-labeled candidate*, contingent on provenance verification |
| 2.10 | Tio 2019 (arXiv/GitHub) | Unclear/restrictive licensing (explicitly academic-only, no redistribution, gated behind author contact); very small (500 images) | **Rejected** |
| 2.11 | dsmlr / Pasupa et al. 2019 | Unclear licensing (not stated); size and exact class labels not disclosed | **Rejected pending disclosure** — flagged as the *most credible academic lead* for direct author outreach |
| 2.12 | CelebHair | Unreliable labels (machine-pseudo-labeled, not human-annotated); unclear/non-commercial licensing (inherited from CelebA); extreme class imbalance (author-acknowledged skew toward Heart) | **Rejected** |
| 2.13 | CSU thesis | Inaccessible — no verifiable information | **Rejected** |
| 2.14 | FASSEG | Lacks required classes entirely (wrong task — segmentation, not shape classification) | **Rejected** |
| 2.15 | FaceARG | Lacks required classes entirely (wrong task — demographic attributes, not shape classification) | **Rejected** |

**Result of the rejection pass:** every dataset found fails at least one hard rejection criterion outright. **No dataset qualifies for unconditional approval.** Four datasets (2.1, 2.5, 2.7, 2.9) and one academic lead (2.11) are retained below for comparative scoring because they are the closest thing to viable building blocks — each is scored on its merits so the team can see *how close* it comes and *exactly what* would need to be resolved (almost always: licensing) before use. This is not an override of the rejection pass; it is the input to the decision in [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md).

Two datasets initially in scope (2.2 HuggingFace mirror, 2.4 lucifierx) were dropped entirely from scoring — they add no capability the retained candidates lack (they are lower-fidelity duplicates or too small to matter) and both compound multiple hard rejections at once.

---

## 2. Weighted Scoring Methodology

Each retained candidate is scored 1–5 on seven criteria. Weights reflect BeautyRoute's stated priorities: this is a commercial product, so **legal safety of the license dominates the score**, followed by whether the class taxonomy actually matches the product's 6-class requirement.

| Criterion | Weight | Rationale |
|---|---|---|
| License clarity & commercial safety | 30% | A commercial SaaS product cannot ship a model trained on data with unclear or non-commercial rights. This is the single largest risk found across every candidate (see research doc §4, finding 1) and is weighted accordingly. |
| Class taxonomy completeness (6 target classes) | 20% | The product spec requires exactly Oval, Round, Square, Heart, Diamond, Oblong. Missing or extra classes require either supplementary data collection or label remapping — both add real engineering cost. |
| Dataset size & class balance | 15% | Undersized or imbalanced classes directly harm classifier accuracy and fairness across shapes. |
| Image quality & pose consistency (frontal-only) | 10% | A face-shape classifier is highly sensitive to pose; mixed frontal/angled images without documentation increase label noise. |
| Diversity (ethnicity, age, gender) | 10% | BeautyRoute serves a broad user base; a training set skewed to one demographic (as documented for niten19-derived data) risks unfair real-world performance. |
| Community credibility & maintenance signal | 10% | Reuse, downloads, stars, and peer review are proxies for a dataset having survived scrutiny rather than being an abandoned, unvetted upload. |
| Documentation & citation quality | 5% | Affects how defensible the choice is in a graduation submission and how easy it is to cite correctly. |

Score interpretation: 5 = fully satisfies the criterion with direct source evidence; 3 = partially satisfies or evidence is incomplete; 1 = fails the criterion or evidence is explicitly negative/absent. All scores below are justified against the facts in [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md) — no new facts are introduced here.

---

## 3. Scores

| Candidate | License (30%) | Classes (20%) | Size/Balance (15%) | Image Quality (10%) | Diversity (10%) | Credibility (10%) | Documentation (5%) | **Weighted Total /100** |
|---|---|---|---|---|---|---|---|---|
| **2.9 Roboflow project-bsmpw** | 4 | 3 | 4 | 3 | 2 | 2 | 3 | **65** |
| **2.7 minhquangbui** | 3 | 4 | 2 | 3 | 3 | 1 | 2 | **56** |
| **2.1 niten19 (Kaggle)** | 1 | 3 | 5 | 3 | 2 | 5 | 2 | **55** |
| **2.5 zeyadkhalid** | 1 | 3 | 4 | 4 | 2 | 3 | 2 | **50** |
| **2.11 dsmlr / Pasupa et al. 2019** | 1 | 3 | 2 | 2 | 2 | 4 | 4 | **44** |

*(2.2 HuggingFace bkprocovid19 was scored during triage at 36/100 and dropped for being a strictly weaker duplicate of 2.1 with no added value — included here only for transparency of the elimination, not as a live candidate.)*

### Score justifications

**2.9 Roboflow project-bsmpw — 65/100 (highest)**
- License 4/5: The only candidate with an explicitly stated, machine-readable license (CC BY 4.0) on the hosting page itself — a genuine, verifiable improvement over every Kaggle entry. Not a 5 because the underlying celebrity-photo provenance is unresolved (research doc §4, finding 3), so the license covers the re-publisher's packaging, not necessarily original image rights.
- Classes 3/5: Missing Diamond, same as its likely source.
- Size/Balance 4/5: 4,904 images, presumably close to the 1,000/class balance of its likely source, though not individually confirmed.
- Image Quality 3/5, Diversity 2/5: Not independently documented; assumed similar to source.
- Credibility 2/5: Modest adoption (81 downloads, 3 stars) — far less battle-tested than niten19 itself, despite the cleaner license.
- Documentation 3/5: Has an attached benchmark model (78.2% accuracy) which is a positive documentation signal absent elsewhere.

**2.7 minhquangbui — 56/100**
- License 3/5: Apache-2.0 label present but unverified beyond the label.
- Classes 4/5 (highest of any candidate): the only dataset with all target classes represented, including a real Diamond class — at the cost of one off-taxonomy class (Pear) that would need to be dropped.
- Size/Balance 2/5: Only 64–94 images per class — thin for production training.
- Credibility 1/5: Lowest usability score (2.50) among license-labeled candidates and the fewest downloads (104).

**2.1 niten19 — 55/100**
- License 1/5 (lowest possible): License field is blank on the source page itself; an unverified "CC0" claim from a search snippet could not be reproduced.
- Size/Balance 5/5 (highest possible): Exactly 1,000 images per class, cleanly split 800/200 train/test — the best-balanced dataset found in this research.
- Credibility 5/5 (highest possible): By far the most reused dataset in this space — it underlies at least three other candidates and several independent GitHub projects.
- Classes 3/5: Missing Diamond. Diversity 2/5: 100% female, with a documented ethnic bias in downstream models.

**2.5 zeyadkhalid — 50/100**
- License 1/5: No license stated at all.
- Image Quality 4/5 (highest among candidates): Explicit face-detection/alignment/cropping preprocessing is a genuine quality-of-life improvement for training, assuming it is confirmed to derive from a license-clear source.
- Credibility 3/5: Moderate reuse, well below niten19's own numbers.

**2.11 dsmlr / Pasupa et al. 2019 — 44/100 (lowest scored)**
- License 1/5: Not stated anywhere accessible.
- Documentation 4/5 and Credibility 4/5: The only peer-reviewed, DOI-citable source in this comparison — a real academic credibility advantage.
- Size/Balance 2/5 and Image Quality 2/5: Penalized specifically for *undisclosed* facts, not confirmed poor quality — the low score reflects that the page itself does not let a downstream team verify what they'd be using, which is itself a usability problem for a production project on a deadline.

---

## 4. Comparative Analysis

- **No candidate scores above 65/100.** The ceiling is set by licensing risk, which is the single factor present in every candidate's weakest score. This is the central finding driving the decision in [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md).
- **There is a genuine size/quality vs. license-clarity trade-off**: niten19 (2.1) has the best size, balance, and community track record but the worst license transparency; the Roboflow mirror (2.9) has the best-labeled license but unresolved underlying provenance and far less community validation.
- **No single candidate covers all 6 target classes at usable scale.** The class-complete option (2.7) is also the smallest and least-validated. This points toward a **merge** strategy rather than picking one dataset outright.
- **The academic option (2.11)** cannot be scored competitively on the facts currently available, but is flagged as the best long-term path to a dataset the team could legitimately claim clean provenance for, if the authors can be reached and are willing to share size/license details.

### Should datasets be merged?

Yes, conditionally. A merge of a 5-class base set (2.1 or 2.9) with a Diamond-labeled supplement (2.7, and secondarily 2.4 for a small additional boost) is the only path found in this research to a dataset that actually covers BeautyRoute's full 6-class taxonomy at a workable scale. This merge does **not** resolve the licensing problem — each component's license would still need independent clearance — and it introduces a secondary risk that Diamond images (sourced from a different, unrelated photographer/photo pool than the other 5 classes) may differ systematically in image quality, lighting, or demographic composition from the rest of the set, which would need explicit normalization/QA before training. This is a recommendation for a future data-engineering phase, not an instruction to act on now.

See [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md) for the best/backup recommendation and the final decision status.
