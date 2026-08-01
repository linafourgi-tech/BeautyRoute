# Face Shape Dataset Research

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Target classes (6):** Oval, Round, Square, Heart, Diamond, Oblong
**Document type:** AI research only. No model code, no training, no downloads were performed for this document.
**Author:** Lead AI Research Engineer, BeautyRoute
**Date:** 2026-07-27
**Status:** Research complete, pending human license/legal review (see [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md))

---

## 1. Methodology

- Sources searched: Kaggle, Hugging Face Datasets, GitHub, Roboflow Universe, arXiv, Google Scholar-indexed publisher pages (ScienceDirect, ACM DL), and one university repository (CSU ScholarWorks).
- Every dataset page was fetched directly where possible. Kaggle dataset pages are JavaScript-rendered single-page applications; where a direct fetch returned only a page title, the page was re-fetched through the `r.jina.ai` text-extraction proxy to obtain the actual rendered text. This is noted per-entry.
- **Every factual claim below is tagged with the exact source URL it came from.** Where a fact could not be retrieved or independently confirmed — even after the proxy workaround — it is explicitly marked **"not stated"** or **"could not verify."** No field was filled in by inference presented as fact; inferences are labeled **[Assumption]**.
- Two sources could not be accessed at all despite multiple attempts (Kaggle `hoangthangcdt/face-shape`, CSU ScholarWorks thesis). They are included below for completeness (per instructions to document rejects), flagged as unverifiable.
- This research does not constitute legal advice. License interpretation below is a plain reading of the label/text found on each source page, not a legal opinion.

---

## 2. Dataset Entries

### 2.1 Face Shape Dataset (niten19) — Kaggle

- **URL:** https://www.kaggle.com/datasets/niten19/face-shape-dataset
- **Creator:** Niten Lama (source: kaggle.com/datasets/niten19/face-shape-dataset)
- **Publication year:** Not stated exactly; page shows "~7 years ago" relative to access date, i.e. approximately 2019 (source: same). **[Fact, imprecise]**
- **Number of images:** 5,000 images / 5,002 files, 727.69 MB (source: kaggle.com/niten19/face-shape-dataset/metadata)
- **Number of classes:** 5
- **Class names:** Heart, Oblong, Oval, Round, Square (source: kaggle.com/datasets/niten19/face-shape-dataset). **No Diamond class** — one of BeautyRoute's 6 target classes is absent.
- **Images per class:** 1,000 per class — 800 train / 200 test (source: same)
- **License:** The "License" field on the dataset's own metadata page is present as a heading but shows **no populated value** when the live page is read directly (source: kaggle.com/niten19/face-shape-dataset/metadata). A search-engine snippet elsewhere claimed "CC0: Public Domain," but this could not be reproduced by reading the live page directly, so it is **not treated as verified fact**. **License status: unstated / unverifiable.**
- **Commercial use allowed?** Cannot determine — license field blank on source.
- **Redistribution allowed?** Cannot determine — license field blank on source.
- **Attribution required?** Cannot determine — license field blank on source.
- **Image quality:** Not formally specified (no resolution/lighting spec stated). Described only as photographs of "female celebrities from all around the globe" (source: kaggle.com/datasets/niten19/face-shape-dataset).
- **Front-facing or not:** Not explicitly guaranteed on the dataset page. A downstream project built on this data reports the resulting classifier "does not predict well on images that the full face cannot be detected (i.e. tilted face, wearing sunglasses, cropped parts of the face)," implying the source set contains some non-ideal / non-strictly-frontal images (source: github.com/Cheshmyar/Face-Shape-Classification).
- **Diversity:** 100% female by construction ("female celebrities from all around the globe"); no quantified ethnic/age breakdown found (source: kaggle.com/datasets/niten19/face-shape-dataset).
- **Known issues:** A downstream project reports a documented ethnic bias: "the model has been pretrained on fewer Asian images," causing Asian oval faces to be misclassified as round; Oval is reported as the most frequently misclassified category overall (source: github.com/Cheshmyar/Face-Shape-Classification README).
- **Community credibility:** 72,100 total views (700 in last 30 days), 10,100 total downloads (193 in last 30 days), 7 comments (source: kaggle.com/niten19/face-shape-dataset/metadata). This is by far the most-reused dataset found in this research — it is the underlying data for the HuggingFace mirror (2.2), the Roboflow mirror (2.9), the preprocessed derivative (2.5), and multiple independent GitHub projects (Cheshmyar/Face-Shape-Classification, Pratch-yani/Face-Shape-Classification-using-CNN, Arbaz57/Face-Shape-Classification).
- **Last update:** "~7 years ago" relative to access date; exact date not stated.
- **Citation information:** None provided on the Kaggle page. **Not stated.**

### 2.2 face_shape (bkprocovid19) — Hugging Face

- **URL:** https://huggingface.co/datasets/bkprocovid19/face_shape
- **Creator:** Hugging Face user "bkprocovid19"
- **Publication year:** Not stated on the page.
- **Number of images:** 5,000 (source: huggingface.co/datasets/bkprocovid19/face_shape) — matches 2.1's total, strongly suggesting a re-upload/mirror of the niten19 set. **[Assumption: this is a mirror, not independently confirmed]**
- **Number of classes:** Not independently confirmed from the raw dataset card (only "Heart" was directly visible in the fetched preview). A downstream model card that trains on this dataset (huggingface.co/fahd9999/face_shape_classification) lists: Oval, Round, Square, Heart, Diamond.
- **Class names:** See above. Note this label set **differs** from niten19's (Oblong vs. Diamond) — this discrepancy could not be resolved from available pages and is flagged as **unresolved**, not fact.
- **Images per class:** Not stated.
- **License:** Not stated on the dataset card.
- **Commercial / redistribution / attribution:** Cannot determine — no license stated.
- **Image quality:** Image widths observed ranging 101–6,666 px in the dataset viewer preview; no documentation of lighting or cropping standards (source: huggingface.co/datasets/bkprocovid19/face_shape).
- **Front-facing or not:** Preview images appear frontal, but this is a visual impression from a partial preview only, not a documented guarantee.
- **Diversity:** Not documented.
- **Known issues:** Not documented on the card. The unresolved class-taxonomy discrepancy with niten19 (§2.1) raises a label-reliability concern.
- **Community credibility:** 2 likes, 54 downloads in the last month (source: huggingface.co/datasets/bkprocovid19/face_shape) — low.
- **Last update:** Not stated.
- **Citation information:** None provided.
- **Related downstream model:** fahd9999/face_shape_classification (EfficientNetB4 transfer-learning model; reported 85% accuracy, 0.83 macro F1, 2 likes) — huggingface.co/fahd9999/face_shape_classification.

### 2.3 Face Shape (Oval, Round, Square) — Kaggle (attanmhd)

- **URL:** https://www.kaggle.com/datasets/attanmhd/face-shape-oval-round-square
- **Creator:** Muhammad Attan (source: r.jina.ai render of the above URL)
- **Publication year:** "Updated 2 years ago" relative to access; exact date not stated.
- **Number of images:** 3,000 files
- **Number of classes:** 3
- **Class names:** Oval, Round, Square
- **Images per class:** Not specified.
- **License:** Labeled "MIT" on the page (source: r.jina.ai render). The literal license text/clause was not independently visible — only the label.
- **Commercial use allowed?** If the "MIT" label is accurate: yes, in principle. Not independently verified beyond the label.
- **Redistribution allowed?** Same caveat as above.
- **Attribution required?** MIT nominally requires retaining copyright/license notices; exact clause not visible on this page.
- **Image quality:** Not documented.
- **Front-facing or not:** Not documented.
- **Diversity:** Not documented.
- **Known issues:** **Only covers 3 of BeautyRoute's 6 target classes** — Heart, Diamond, and Oblong are entirely absent.
- **Community credibility:** Usability score 5.63; 105 downloads total (3 in last 30 days); 988 views total (46 in last 30 days); 0 comments (source: r.jina.ai render).
- **Last update:** "2 years ago" relative to access; exact date not stated.
- **Citation information:** Not stated.

### 2.4 Face shape classification (LucifierX) — Kaggle

- **URL:** https://www.kaggle.com/datasets/lucifierx/face-shape-classification
- **Creator:** Kaggle user "LucifierX"
- **Publication year:** "~4 years ago" relative to access; exact date not stated.
- **Number of images:** 98 files total
- **Number of classes:** 7
- **Class names:** Diamond, Heart, Oblong, Oval, Round, Square, Triangle (Triangle is not one of BeautyRoute's target classes)
- **Images per class:** Diamond 12, Heart 14, Oblong 19, Oval 14, Round 12, Square 14, Triangle 13
- **License:** Labeled "Unknown" on the page.
- **Commercial / redistribution / attribution:** Cannot determine — license explicitly unknown.
- **Image quality:** Not documented.
- **Front-facing or not:** Described as male facial photographs; front-facing status not otherwise documented.
- **Diversity:** All-male by description — opposite skew from the mostly-female niten19 set.
- **Known issues:** Extremely small (as few as 12 images in a class); introduces an off-taxonomy class ("Triangle").
- **Community credibility:** Usability score 5.00; 5,772 views, 789 downloads.
- **Last update:** "~4 years ago" relative to access.
- **Citation information:** Not stated.

### 2.5 Face Shape Preprocessed (zeyadkhalid) — Kaggle

- **URL:** https://www.kaggle.com/datasets/zeyadkhalid/faceshape-processed
- **Creator:** Zeyad Khalid (source: r.jina.ai render)
- **Publication year:** "~5 years ago" relative to access; exact date not stated.
- **Number of images:** 4,979 files
- **Number of classes:** 5
- **Class names:** Heart, Oblong, Round, Square, Oval — same taxonomy as niten19 (2.1), missing Diamond.
- **Images per class:** Not specified in retrievable content.
- **License:** Not listed on the page. **Not stated.**
- **Commercial / redistribution / attribution:** Cannot determine — no license present.
- **Image quality:** Explicitly described: "Faces are recognized, rotated and extracted from original images," organized into train/test folders per class — i.e., a face-detected/aligned/cropped preprocessing pass on a source set (source: same).
- **Front-facing or not:** Implied by the face-detection-and-rotation preprocessing, but not explicitly guaranteed as a documented spec.
- **Diversity:** Not independently documented; near-identical class taxonomy and count to niten19 strongly suggests it inherits niten19's female-celebrity composition. **[Assumption]**
- **Known issues:** Very likely a derivative of 2.1 (same class names, near-identical count minus images dropped by failed face detection); inherits any labeling/bias issues from that source if so.
- **Community credibility:** 5,981 views (116 in last 30 days), 1,144 downloads (source: same).
- **File size:** 82.73 MB (much smaller than niten19's 727 MB — consistent with a cropped/resized preprocessing pass).
- **Last update:** "~5 years ago" relative to access.
- **Citation information:** Not stated.

### 2.6 face shape (hoangthangcdt) — Kaggle

- **URL:** https://www.kaggle.com/datasets/hoangthangcdt/face-shape
- **Status: UNVERIFIABLE.** Direct WebFetch, the r.jina.ai proxy, and the `/metadata` sub-path all returned only the page title or a "preview truncated" placeholder. **None of the 19 requested fields could be verified** beyond the dataset's existence and name. Flagged explicitly as an inaccessible source per research instructions.

### 2.7 Face shapes (minhquangbui) — Kaggle

- **URL:** https://www.kaggle.com/datasets/minhquangbui/face-shapes
- **Creator:** Minh Quang Bui (source: r.jina.ai render)
- **Publication year:** "~3 years ago" relative to access; exact date not stated.
- **Number of images:** 596 files
- **Number of classes:** 7
- **Class names:** Diamond, Heart, Oblong, Oval, Pear, Round, Square (Pear is not one of BeautyRoute's target classes)
- **Images per class:** Diamond 64, Heart 94, Oblong 85, Oval 88, Pear 83, Round 91, Square 91
- **License:** Labeled "Apache 2.0" on the page. Literal clause text not independently visible — label only.
- **Commercial use allowed?** If the label is accurate: yes, in principle (Apache-2.0 permits commercial use). Not independently verified beyond the label.
- **Redistribution / attribution:** Apache-2.0 nominally requires preserving notices and a copy of the license; not independently confirmed from page text.
- **Image quality:** Not documented.
- **Front-facing or not:** Not documented.
- **Diversity:** Not documented.
- **Known issues:** Low usability score (2.50); small dataset (64–94 images per class); introduces an off-taxonomy class ("Pear").
- **Community credibility:** Usability score 2.50 (notably low); 588 views, 104 downloads.
- **Last update:** "~3 years ago" relative to access.
- **Citation information:** Not stated.
- **Note:** This is the only dataset found in this research with a labeled **Diamond** class of meaningful size (64 images), making it a potential supplementary source if a 6-class set is assembled by merging sources — subject to the same license-verification caveat as above.

### 2.8 men-face-shape (hanakb) — Kaggle

- **URL:** https://www.kaggle.com/datasets/hanakb/men-face-shape
- **Creator:** "hanakb and 1 collaborator" (source: r.jina.ai render)
- **Publication year:** "Updated ~3 years ago" relative to access; exact date not stated.
- **Number of images:** 1,312 files
- **Number of classes / class names:** Only "training_set"/"testing_set" folder split was visible; exact class subfolder names could not be extracted. **Not stated / unverifiable.**
- **Images per class:** Not stated.
- **License:** Labeled explicitly "Unknown" on the page.
- **Commercial / redistribution / attribution:** Cannot determine — license explicitly Unknown.
- **Image quality:** Not documented.
- **Front-facing or not:** Not documented.
- **Diversity:** Male-only by title/description; no other diversity information available.
- **Known issues:** Class taxonomy unverifiable; gender-restricted (no cross-gender coverage); license is explicitly the Kaggle "no rights info provided" placeholder — the highest legal-risk category found in this research.
- **Community credibility:** Usability score 0 (lowest possible observed in this research); 3,133 views, 557 downloads.
- **Last update:** "~3 years ago" relative to access.
- **Citation information:** Not stated.

### 2.9 Face Shape Classification (project-bsmpw) — Roboflow Universe

- **URL:** https://universe.roboflow.com/project-bsmpw/face-shape-classification-fmivb
- **Creator:** Roboflow Universe project "project-bsmpw"
- **Publication year:** Last updated "~3 years ago" (approximately 2023-08-31 per page); original creation date not stated.
- **Number of images:** 4,904 (source: r.jina.ai render) — close to niten19's 5,000, strongly suggesting this is a re-hosted export of the same underlying data. **[Assumption]**
- **Number of classes:** 5
- **Class names:** Square, Heart, Oblong, Oval, Round — identical taxonomy to niten19; missing Diamond.
- **Images per class:** Not individually confirmed in retrievable content.
- **License:** **CC BY 4.0** (Creative Commons Attribution 4.0 International), explicitly labeled on the Roboflow page.
- **Commercial use allowed?** Yes, per the CC BY 4.0 label as stated on this specific hosting page, subject to attribution. **Caveat:** this license is the re-publisher's own grant on the Roboflow platform; it is not independent proof that the underlying celebrity photographs themselves were originally rights-cleared for redistribution (see §4, cross-cutting finding 3).
- **Redistribution allowed?** Yes, under CC BY 4.0 as stated, with attribution — same provenance caveat applies.
- **Attribution required?** Yes, per CC BY 4.0.
- **Image quality:** Not documented beyond image count.
- **Front-facing or not:** Not independently documented; presumed similar to source set. **[Assumption]**
- **Diversity:** Not independently documented; presumed similar to niten19 (female-celebrity skew) given near-identical class taxonomy and count. **[Assumption]**
- **Known issues:** Same underlying provenance issue as niten19 if it is in fact a re-export (real, named celebrity photos scraped from the internet).
- **Community credibility:** 81 downloads, 3 stars/ratings, ~2,070 views, 2 dataset versions, 1 attached pre-trained model with 78.2% reported accuracy.
- **Last update:** ~2023-08-31 (relative "~3 years ago" at time of access).
- **Citation information:** Not stated beyond the Roboflow project page itself.

**Other Roboflow Universe listings** surfaced via search but not deep-fetched (lower priority; all labeled "CC BY 4.0" per search snippets only, **not independently verified page-by-page**): `yes-ripdh/face-shape-d4mv0`; `faceshape-vxygg/faceshape-atkte` (~6,500 images; classes heart/long/oval/round/square); `plant-id/shape-face-oumca` (mixed, noisy taxonomy: Diamond/Heart/Rectangle/Round/Square/Triangle plus demographic tags — appears to be a miscellaneous/non-benchmark project); `face-detection-beautysense/face-shape-real-lagcm` (800 images; non-standard taxonomy: Triangle/Square/Diamond/Heart/"Inverted Face Shape"). Included for completeness only; excluded from scoring due to unverified sourcing.

### 2.10 Face shape classification using Inception v3 — arXiv paper (Tio, 2019)

- **URL:** https://arxiv.org/abs/1911.07916 (PDF: https://arxiv.org/pdf/1911.07916); companion code: https://github.com/adonistio/inception-face-shape-classifier
- **Author:** Adonis Emmanuel Tio
- **Publication year:** 2019
- **Number of images:** 500 total
- **Number of classes:** 5
- **Class names:** Heart, Oblong, Oval, Round, Square (standard 5-class taxonomy)
- **Images per class:** Not stated.
- **Image source:** Female celebrity images "downloaded via Google image search" (source: github.com/adonistio/inception-face-shape-classifier README).
- **License:** Not stated in the paper. The companion GitHub repo explicitly states the author will share images/features "for academic purposes" only and requires contacting the author directly (adonis@eee.upd.edu.ph) for access.
- **Commercial use allowed?** No — explicitly academic-purposes-only per the author's stated terms.
- **Redistribution allowed?** No — explicitly prohibited per the repo README.
- **Attribution required?** Not formally specified beyond citing the paper.
- **Image quality / front-facing:** Not documented beyond "downloaded via Google image search."
- **Diversity:** Female-only by description; not otherwise quantified.
- **Known issues:** The paper's own future-work section states the dataset should be expanded and, ideally, "freely distributed to the research community, so that proper model cross-validation can be performed" — the author himself flags the small size (500 images) and closed distribution as limitations.
- **Community credibility:** Peer-reviewed arXiv preprint; GitHub companion repo star/fork count not captured in this pass.
- **Last update:** 2019 (paper); repo update date not captured.
- **Citation information:** arXiv:1911.07916 [cs.CV]. DOI: https://doi.org/10.48550/arXiv.1911.07916

### 2.11 dsmlr/faceshape (Pasupa, Sunhem, Loo — Expert Systems with Applications, 2019)

- **URL:** https://github.com/dsmlr/faceshape
- **Authors:** Kitsuchart Pasupa, Wisuwat Sunhem, Chu Kiong Loo
- **Associated paper:** "A Hybrid Approach to Building Face Shape Classifier for Hairstyle Recommender System," *Expert Systems with Applications*, vol. 120, pp. 14–32, 2019 (published online 2018). DOI: https://doi.org/10.1016/j.eswa.2018.11.011 (corroborated at sciencedirect.com/science/article/abs/pii/S0957417418307346 and eprints.um.edu.my/20013/)
- **Publication year:** 2019 (journal); 2018 (online-first)
- **Number of images:** Not disclosed in the retrievable README. **Not stated.**
- **Number of classes:** 5 face-shape categories (organized as directories under a "published_dataset" folder)
- **Class names:** Not spelled out in the retrievable README text. **Not stated.**
- **Images per class:** Not stated.
- **License:** Not mentioned anywhere in the retrievable README. **Not stated.**
- **Commercial / redistribution / attribution:** Cannot determine — no license found.
- **Image quality / front-facing:** Not documented in the README.
- **Diversity:** README implies a female-subject skew (built for a hairstyle-recommender use case) but does not quantify it.
- **Known issues:** Key facts (size, exact class labels, license) are not disclosed in the README; would require downloading the `published_dataset` folder directly to verify — out of scope for this research-only pass.
- **Community credibility:** 49 GitHub stars, 6 forks, 11 commits, 0 open issues. This is the most rigorously peer-reviewed source found in this research (published journal article with DOI), which raises its academic credibility relative to the Kaggle entries above, even though page-level transparency is lower.
- **Last update:** Not captured precisely.
- **Citation information:** Pasupa, K., Sunhem, W., & Loo, C. K. (2019). A hybrid approach to building face shape classifier for hairstyle recommender system. *Expert Systems with Applications*, 120, 14–32. https://doi.org/10.1016/j.eswa.2018.11.011

### 2.12 CelebHair (Chen, Zhang, Huang, Luo, Chen — 2021)

- **URL:** https://arxiv.org/abs/2104.06885 (PDF: https://arxiv.org/pdf/2104.06885)
- **Authors:** Yutao Chen, Yuxuan Zhang, Zhongrui Huang, Zhenyao Luo, Jinpeng Chen
- **Publication year:** 2021 (arXiv); also published as a book chapter in *Knowledge Science, Engineering and Management* (Springer), DOI: 10.1007/978-3-030-82153-1_27 (source: dl.acm.org/doi/abs/10.1007/978-3-030-82153-1_27)
- **Base data:** Built on top of CelebA — "inherited the majority of facial images along with some beauty-related facial attributes from CelebA" (source: arxiv.org/abs/2104.06885 abstract).
- **Number of images / number of classes:** Not stated in the retrievable abstract/landing content. The paper describes deriving face-shape and hairstyle pseudo-labels from CelebA images using landmark-based features (nose length, pupillary distance) plus a CNN — but exact resulting class count and per-class counts were not disclosed in accessible content.
- **License:** The arXiv paper text itself is under CC BY-NC-SA 4.0 (source: arxiv.org/abs/2104.06885). This license governs the paper, not necessarily the underlying image data, which is inherited from CelebA's own non-commercial, research-only terms.
- **Commercial use allowed?** No — CelebA's license is explicitly research/non-commercial, reinforced by the paper's own CC BY-NC-SA framing.
- **Redistribution / attribution:** Non-commercial share-alike terms apply if using CelebA-derived data; not suitable for a commercial product without independently re-licensing/re-collecting images.
- **Image quality / front-facing:** Inherited from CelebA (a large, well-known, front-facing-oriented celebrity face-attributes dataset), but shape labels here are not human-annotated ground truth.
- **Diversity:** Inherited from CelebA's demographic composition; not independently quantified for the face-shape subset.
- **Known issues:** The paper reports, in its own text, that "the majority of celebrity images in CelebA have a heart-shaped face" — the authors themselves flag severe class imbalance skewed toward Heart (source: cross-referenced via researchgate.net/publication/350875916 and the authors' project page cs.toronto.edu/~yuxuan/publication/celebhair). Labels are machine-generated (CNN-predicted) rather than human-annotated, which is a label-reliability concern for a production classifier's ground truth.
- **Community credibility:** Peer-reviewed book chapter (Springer, KSEM 2021).
- **Last update:** 2021.
- **Citation information:** Chen, Y., Zhang, Y., Huang, Z., Luo, Z., & Chen, J. (2021). CelebHair: A New Large-Scale Dataset for Hairstyle Recommendation based on CelebA. arXiv:2104.06885. DOI: https://doi.org/10.48550/arXiv.2104.06885

### 2.13 "3D-Guided Face Shape Classification" — CSU master's thesis/project

- **URL:** https://scholarworks.calstate.edu/downloads/p2676x78x
- **Status: INACCESSIBLE.** Direct WebFetch returned HTTP 403 Forbidden; the r.jina.ai proxy returned a generic browser-compatibility interstitial with no content. **None of the requested facts could be verified.** The title alone is confirmed (it surfaced independently in three separate searches: Kaggle, arXiv, and Papers-with-Code queries), which suggests it is a real, citable academic project, but its dataset section could not be read. Flagged explicitly as an inaccessible source.

### 2.14 FASSEG (Facial Semantic Segmentation) — GitHub / Mendeley Data

- **URL:** https://github.com/massimomauro/FASSEG-repository (also: https://data.mendeley.com/datasets/sv7ns5xv7f/1)
- **Authors:** Khalil Khan, Massimo Mauro, Riccardo Leonardi, Pierangelo Migliorati
- **Confirmed purpose:** This is a **facial semantic segmentation** dataset (pixel-level masks for mouth, nose, eyes, hair, skin, background) — **not** a face-shape (oval/round/square/heart/diamond/oblong) classification dataset. Confirmed directly from the README (source: github.com/massimomauro/FASSEG-repository).
- **Composition:** Frontal01 (70 images, rough masks); Frontal02 (same 70 images, high-precision masks); Frontal03 (150 annotated twin faces); Multipose01 (200+ faces, multiple poses, masks). Cross-referenced with researchgate.net/publication/331997975.
- **License:** Not stated in the README.
- **Citation information:** Khan et al., "Multi-class semantic segmentation of faces," ICIP 2015; Khan et al., "Head pose estimation through multiclass face segmentation," ICME 2017.
- **Reason for exclusion:** Wrong task category entirely. Included here only because it surfaced repeatedly in searches for "face shape" and to explicitly document why it was excluded, per the requirement to document rejected candidates.

### 2.15 FaceARG

- **Status:** Surfaced during search as an in-the-wild face dataset annotated with race, age, gender, and accessory information, reportedly 175,000+ images (source: WebSearch result summaries; a primary FaceARG page/paper was not independently fetched because the topic mismatch was unambiguous across multiple independent search snippets).
- **Reason for exclusion:** Confirmed off-topic for BR-FS-001 — this dataset targets demographic attribute classification, not geometric face-shape (oval/round/etc.) classification. No face-shape labels exist in it per any source consulted. Not deep-dived further given clear irrelevance.

---

## 3. Facts vs. Assumptions — Explicit Summary

**Confirmed facts (directly read from a primary source page):**
- Exact class taxonomies, image counts, and license *labels* (where present) for datasets 2.1, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, as fetched.
- The academic citation and non-commercial licensing chain for CelebHair (2.12), and the closed/gated distribution terms for Tio 2019 (2.10).
- The wrong-task nature of FASSEG (2.14) and FaceARG (2.15).

**Explicit non-facts / assumptions (flagged inline above, repeated here for visibility):**
- That HuggingFace (2.2), Roboflow project-bsmpw (2.9), and zeyadkhalid (2.5) are mirrors/derivatives of niten19 (2.1) — inferred from near-identical image counts and class taxonomies, not confirmed by any source stating lineage explicitly.
- That the "CC0" label reported in a search snippet for niten19 (2.1) is accurate — the live page itself showed no populated license value at time of access, so this claim is **not** treated as fact.
- Diversity/front-facing characteristics for any dataset beyond what was explicitly stated in text (visual impressions from partial previews are labeled as such, not stated as guarantees).

**Unverifiable / inaccessible sources:**
- 2.6 (hoangthangcdt/Kaggle) and 2.13 (CSU thesis) — pages could not be rendered by any method attempted.

---

## 4. Cross-Cutting Findings

1. **No dataset in this research has a clearly confirmed, source-verified, commercially-safe open license covering the underlying images.** The single positive license label found (Roboflow's CC BY 4.0 on 2.9) applies to a platform re-export that is very likely built on the same unlicensed celebrity photos as niten19 (2.1) — the license grant does not resolve the underlying image-rights question.
2. **The dominant / most-reused dataset (niten19, 2.1, ~5,000 images) lacks a Diamond class.** Every major derivative found (2.2, 2.5, 2.9) inherited that same 5-class gap. A 6-class BeautyRoute model will need a Diamond source from elsewhere (2.7 or 2.4 are the only datasets found with a labeled Diamond class, both small).
3. **The widely-reused source images across this ecosystem (2.1, 2.5, 2.9, and 2.10) appear to be scraped, real-name celebrity photographs** — confirmed via the Cheshmyar GitHub README (for 2.1's derivative ecosystem) and Tio's own paper methodology (2.10). This is a real-person likeness/publicity-rights exposure for a commercial product, independent of whatever license tag a re-uploader applies downstream.
4. **A documented demographic bias exists**: a model trained on the niten19-derived data reportedly misclassifies Asian oval faces as round, attributed to underrepresentation in the training data (source: github.com/Cheshmyar/Face-Shape-Classification). This is directly relevant to BeautyRoute given its target users' diversity.
5. **The most academically rigorous source (Pasupa et al. 2019, peer-reviewed journal, 2.11) is the least transparent about size, class labels, and license** on its public GitHub page — a deeper investigation would require either downloading its `published_dataset` folder or contacting the authors directly, both out of scope for this research-only phase.
6. **CelebHair (2.12)** is the only source with explicit, author-acknowledged severe class imbalance (skewed toward Heart) and machine-generated (not human-annotated) shape labels, in addition to non-commercial licensing.

---

## 5. Recommendations (research-phase only — not a download authorization)

- Do not proceed to acquire any dataset without first resolving licensing directly with the relevant rights holder (Kaggle creators niten19 and/or the Roboflow re-publisher, and/or the Pasupa et al. authors for 2.11).
- If the team wants to pursue the academic path, direct author outreach to Pasupa, Sunhem, and Loo (2.11) is the most promising avenue for a dataset with genuine peer-reviewed provenance — contingent on them being willing to clarify license terms and share exact image/class counts.
- Any 6-class BeautyRoute set will require merging a Diamond-labeled source (2.7, and to a lesser extent 2.4) with a base 5-class set (2.1/2.5/2.9) — see [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md) for the formal recommendation and its conditions.

See [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md) for the weighted scoring of the datasets that survived initial screening, and [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md) for the final decision.
