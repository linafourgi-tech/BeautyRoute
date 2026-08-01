# Face Shape Dataset — Decision

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Prerequisite reading:** [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md)
**Date:** 2026-07-27
**Scope:** This is a research/documentation decision only. No dataset has been downloaded, no model has been trained, and no code has been written as part of this decision.

---

## 1. Recommendation

### Best dataset (highest-scoring, conditional)
**Face Shape Classification (project-bsmpw) — Roboflow Universe** (§2.9 of the research doc), scored **65/100**.

- **Why it's best among the candidates found:** It is the only source in this entire research pass with an explicit, page-stated, machine-readable open license (CC BY 4.0) rather than an unstated or ambiguous one. It is reasonably sized (4,904 images) and reuses the same well-trodden 5-class taxonomy (Square, Heart, Oblong, Oval, Round) as the rest of this dataset ecosystem.
- **Why it is not an unconditional "yes":** Its images very likely originate from the same unlicensed, scraped celebrity photographs as niten19 (2.1) — see cross-cutting finding 3 in the research document. A CC BY 4.0 label applied by a re-publisher on a hosting platform does not, by itself, establish that the original photographed individuals' likeness rights or the original photographers' copyrights were cleared for redistribution. **This must be independently verified before any download or use**, ideally by contacting the Roboflow project owner and/or Kaggle's niten19 to ask directly about original image provenance. It is also missing the Diamond class.

### Backup dataset (conditional)
**Face Shape Dataset (niten19) — Kaggle** (§2.1), scored **55/100**.

- **Why it's the backup:** It is the best-balanced (exactly 1,000 images/class) and most community-validated dataset found (72,100 views, 10,100 downloads, and the basis for at least three other candidates and multiple independent GitHub projects). If direct outreach to the creator resolves the licensing ambiguity in BeautyRoute's favor, this becomes a strong primary candidate — arguably stronger than the Roboflow mirror, since it is the original source rather than a re-export.
- **Why it's ranked second, not first:** Its own license field is blank on the source page, which is a more direct and unambiguous licensing gap than 2.9's "license present, provenance unresolved" situation, and is scored accordingly.

### Longer-term academic lead (not scored competitively, but worth pursuing)
**Pasupa, Sunhem & Loo (2019), *Expert Systems with Applications*** (§2.11) — the only peer-reviewed, DOI-citable dataset found. Its GitHub page discloses too little (no license, no exact size/class labels) to score well today, but direct author contact could resolve this and yield the most defensible provenance of any option in this research, which matters for both the graduation submission and a future commercial product. Recommended as a parallel outreach effort, not a blocking dependency.

### Should datasets be merged?
**Yes, conditionally.** No single dataset found covers BeautyRoute's full 6-class taxonomy (Oval, Round, Square, Heart, Diamond, Oblong) at usable scale — every 5-class option (2.1, 2.5, 2.9) is missing Diamond entirely. The only meaningful source of labeled Diamond images found is **minhquangbui (§2.7)** (64 Diamond images), with lucifierx (§2.4, 12 Diamond images) as a much smaller secondary option. A merge of a chosen 5-class base with this Diamond supplement is the only path in this research to full class coverage. This merge:
- Does **not** resolve licensing on its own — each merged component's rights must be cleared independently.
- Introduces a secondary data-quality risk (Diamond images would come from a different, unrelated photo pool, with likely differences in resolution, lighting, and demographic composition from the base set) that would require explicit normalization and QA in a future data-engineering phase.
- Should not be actioned until the licensing questions below are answered — this section documents the *path*, not an authorization to proceed.

---

## 2. Facts vs. Assumptions vs. Recommendations (final separation)

**Facts** (sourced, see research doc for citations):
- Every dataset examined has at least one unresolved rejection-criterion issue — most commonly unclear or unverifiable licensing.
- The most-reused dataset in this space (niten19) has a blank license field on its own page and is missing a Diamond class.
- The only dataset with an explicit open-license label (Roboflow CC BY 4.0) is very likely a re-export of that same unlicensed source.
- A documented ethnic bias exists in at least one downstream model trained on this dataset ecosystem.

**Assumptions** (explicitly flagged, not treated as fact anywhere above):
- That the Roboflow, HuggingFace, and zeyadkhalid entries are derivatives of niten19 — inferred from matching class taxonomy and near-identical image counts, not confirmed by any source stating lineage.

**Recommendations** (judgment calls, not facts):
- Pursue direct license clarification with the niten19 creator and/or the Roboflow project owner before considering either as a data source.
- Pursue academic outreach to Pasupa, Sunhem & Loo in parallel as a higher-provenance long-term option.
- If licensing is cleared, plan a merge with a Diamond-class supplement (minhquangbui) rather than expecting any single dataset to cover all 6 classes.
- Do not use CelebHair, Tio 2019, or any dataset flagged with explicit non-commercial/gated/unknown licensing under any circumstance for a commercial BeautyRoute product without a separate, explicit rights grant.

---

## 3. Final Decision

Every dataset identified in this research fails at least one of the stated hard-rejection criteria — in nearly every case, the failure is licensing: either no license is stated, or a stated license does not resolve the underlying image-rights provenance (real, named individuals' photographs scraped from the internet). At the same time, viable technical building blocks do exist (adequate size, balance, and community validation), and there are concrete, actionable next steps (direct creator/author outreach) that could resolve the blocking issue rather than requiring an entirely new search.

This is not a dead end, and it is not a clean approval. It is a licensing gate.

### **FINAL DECISION: REQUIRES LICENSE REVIEW**

No dataset should be downloaded or used for BR-FS-001 until:
1. The niten19 (Kaggle) creator and/or the Roboflow project-bsmpw owner has been directly contacted to clarify original image licensing and provenance, **or**
2. The Pasupa, Sunhem & Loo (2019) authors have been contacted and have provided license terms and dataset details sufficient for evaluation, **or**
3. An alternative, unambiguously licensed dataset not surfaced in this research pass is identified.

Whichever path clears review first should be re-evaluated against the same weighted criteria in [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md) before any download or training work begins.
