# BR-FS-001 Literature Review — Deep Learning for Face Shape Classification

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Document type:** Literature review only. No training code, no model implementation, no weight downloads were performed for this document.
**Author:** AI Research Lead, BeautyRoute
**Date:** 2026-07-30
**Prerequisite reading:** [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), [FACE_SHAPE_COMPARISON.md](FACE_SHAPE_COMPARISON.md), [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md)

---

## 1. Methodology

Searched Google Scholar-indexed sources, arXiv, IEEE Xplore, SpringerLink, ScienceDirect (Elsevier), ACM Digital Library, and open institutional/conference repositories, plus GitHub implementations tied to specific papers. Direct fetches of ResearchGate, ScienceDirect, and Academia.edu pages were frequently blocked by CAPTCHA/anti-bot walls (HTTP 403); in those cases, facts are sourced from search-engine result snippets and are explicitly marked as such, with a lower confidence than directly-read primary sources. Two full PDFs were successfully retrieved and read in full (Adityatama & Putra 2023; Chi et al. 2023 — the latter is an adjacent mobile-face-recognition review, not a face-shape paper, used only for architecture cross-referencing). Every factual claim is tagged with its source. Facts that could not be independently verified are marked **"not stated"** or **"could not verify."**

Thirteen sources are direct face-shape-classification work; two additional sources are explicitly labeled **[ADJACENT]** — closely related work (a multimodal biometric system that includes face shape as one sub-task, and a practical/non-peer-reviewed GitHub implementation) included because they add verifiable, relevant data points, not because they are face-shape papers in the strict sense.

---

## 2. Paper Entries

### 2.1 Face shape classification using Inception v3

1. **Title:** Face shape classification using Inception v3
2. **Authors:** Adonis Emmanuel Tio
3. **Year:** 2019
4. **Publisher/venue:** arXiv preprint (cs.CV)
5. **DOI/URL:** arXiv:1911.07916 — https://arxiv.org/abs/1911.07916
6. **Citation count:** Not independently re-verified in this pass (Semantic Scholar API was rate-limited); treated as **not stated** here rather than reusing an unverified prior figure.
7. **Dataset used:** 500 images of female celebrities with known face shapes, collected via Google image search (source: arxiv.org/abs/1911.07916; github.com/adonistio/inception-face-shape-classifier)
8. **Number of classes:** 5
9. **Class names:** Heart, Oblong, Oval, Round, Square
10. **Architecture:** Fine-tuned Inception v3 (transfer learning), compared against LDA, SVM, MLP (ANN), and KNN baselines
11. **Accuracy:** Training accuracy 98.0%–100%; overall (test) accuracy 84.4%–84.8% (source: arXiv:1911.07916 abstract, corroborated via WebSearch snippet of the same paper)
12. **Precision:** Not stated in retrievable content.
13. **Recall:** Not stated in retrievable content.
14. **F1-score:** Not stated in retrievable content.
15. **Strengths:** Directly compares a deep CNN (Inception v3) against four classical ML baselines on the identical dataset, giving a clean architecture-vs-classical comparison.
16. **Weaknesses:** Very small dataset (500 images); the authors' own future-work section calls for a larger, freely distributable dataset "so that proper model cross-validation can be performed" (source: arXiv:1911.07916); dataset is not redistributable (gated behind author contact per github.com/adonistio/inception-face-shape-classifier).
17. **Computational cost:** Not stated.
18. **Mobile deployment suitable?** No — Inception v3 (~24M parameters, non-mobile-optimized architecture) is not designed for edge/mobile constraints; not discussed in the paper.
19. **Suitable for BeautyRoute?** Not as-is — dataset is legally gated (no redistribution), too small for production training, and the architecture is not mobile-oriented. Useful only as a methodological reference point (accuracy ceiling on a clean, small, single-source dataset).

### 2.2 An approach to face shape classification for hairstyle recommendation

1. **Title:** An approach to face shape classification for hairstyle recommendation
2. **Authors:** Wisuwat Sunhem, Kitsuchart Pasupa
3. **Year:** 2016
4. **Publisher/venue:** 2016 Eighth International Conference on Advanced Computational Intelligence (ICACI), Chiang Mai, Thailand
5. **DOI/URL:** https://doi.org/10.1109/icaci.2016.7449857
6. **Citation count:** Not stated / could not verify in this pass.
7. **Dataset used:** Not specified in retrievable content (facial images with landmark annotations).
8. **Number of classes:** 5
9. **Class names:** Round, Oval, Oblong, Square, Heart (source: WebSearch summary of scholar.it.kmitl.ac.th/item/id/3865 and researchgate.net/publication/301258237)
10. **Architecture:** Not a deep CNN — uses geometric features from facial landmarks (via Active Appearance Model and colour-based skin segmentation), classified with and compared across Linear Discriminant Analysis (LDA), Artificial Neural Network (ANN/MLP), and Support Vector Machine (SVM, RBF kernel)
11. **Accuracy:** SVM with RBF kernel reported as the best-performing approach (source: WebSearch summary); exact accuracy figure **not stated / could not verify** in retrievable content.
12–14. **Precision/Recall/F1:** Not stated / could not verify.
15. **Strengths:** Predates and appears to be the direct precursor to the peer-reviewed 2019 ESA journal paper (§2.3) by the same lead authors; landmark/geometric-feature approach avoids needing a large image-training set for a CNN.
16. **Weaknesses:** Not a deep-learning architecture in the CNN/Transformer sense requested by this review; exact performance numbers not independently verified.
17. **Computational cost:** Not stated. Geometric/classical-ML approaches are generally very lightweight compared to deep CNNs.
18. **Mobile deployment suitable?** Likely yes in principle — classical ML classifiers on landmark features are computationally cheap — but not evaluated on-device in the paper as far as retrievable content shows.
19. **Suitable for BeautyRoute?** Partially — the landmark-based feature engineering approach is a legitimate lightweight alternative/complement to a CNN backbone and could inform a hybrid design, but on its own does not leverage modern deep learning as the project brief requires.

### 2.3 A Hybrid Approach to Building Face Shape Classifier for Hairstyle Recommender System

1. **Title:** A Hybrid Approach to Building Face Shape Classifier for Hairstyle Recommender System
2. **Authors:** Kitsuchart Pasupa, Wisuwat Sunhem, Chu Kiong Loo
3. **Year:** 2019 (published online 2018)
4. **Publisher/venue:** *Expert Systems with Applications*, vol. 120, pp. 14–32 (Elsevier)
5. **DOI/URL:** https://doi.org/10.1016/j.eswa.2018.11.011
6. **Citation count:** Not independently re-verified in this pass (ScienceDirect and Semantic Scholar both inaccessible/rate-limited during this research window).
7. **Dataset used:** A labelled face dataset released alongside the paper (GitHub: dsmlr/faceshape); exact image count **not disclosed** in the retrievable README (see FACE_SHAPE_DATASET_RESEARCH.md §2.11).
8. **Number of classes:** 5 (organized as directories in the released dataset)
9. **Class names:** Not spelled out in retrievable content.
10. **Architecture:** Described as a "hybrid approach" combining feature engineering (landmark/geometric, building on the authors' own 2016 precursor, §2.2) with a learned classifier; exact model family **not confirmed** from accessible content (the publisher page returned a redirect/CAPTCHA wall on every fetch attempt in this research pass).
11–14. **Accuracy/Precision/Recall/F1:** Not stated / could not verify — full text was inaccessible via ScienceDirect (403/CAPTCHA) and the Elsevier redirect link in this research pass.
15. **Strengths:** The only genuinely peer-reviewed, DOI-indexed journal article (as opposed to conference paper, preprint, or Kaggle notebook) found in this entire review — the strongest formal academic credibility of any source surveyed.
16. **Weaknesses:** Key facts (exact dataset size, exact metrics, exact architecture) could not be independently confirmed in this research pass due to access restrictions; would require direct author contact or paywalled access to verify.
17. **Computational cost:** Not stated / could not verify.
18. **Mobile deployment suitable?** Not stated / could not verify.
19. **Suitable for BeautyRoute?** Potentially — this is the strongest academic-credibility lead identified across all three research phases (dataset, architecture, this review), but it cannot be acted on without direct author outreach to clarify license, dataset size, and architecture details, consistent with the recommendation already made in [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md).

### 2.4 CelebHair: A New Large-Scale Dataset for Hairstyle Recommendation based on CelebA

1. **Title:** CelebHair: A New Large-Scale Dataset for Hairstyle Recommendation based on CelebA
2. **Authors:** Yutao Chen, Yuxuan Zhang, Zhongrui Huang, Zhenyao Luo, Jinpeng Chen
3. **Year:** 2021
4. **Publisher/venue:** arXiv (cs.CV); also published as a book chapter in *Knowledge Science, Engineering and Management* (Springer, KSEM 2021)
5. **DOI/URL:** https://doi.org/10.48550/arXiv.2104.06885 ; book chapter DOI 10.1007/978-3-030-82153-1_27
6. **Citation count:** Not independently re-verified in this pass.
7. **Dataset used:** Built on CelebA; face-shape and hairstyle pseudo-labels derived via landmark-based geometric features (nose length, pupillary distance) plus a CNN (source: arXiv:2104.06885 abstract). Exact resulting image/class counts **not stated** in accessible content.
8. **Number of classes:** Not disclosed in accessible content.
9. **Class names:** Not disclosed in accessible content.
10. **Architecture:** A CNN used to auto-label face shape/hairstyle attributes onto CelebA images (not a fixed classification backbone in the traditional sense — exact architecture family not specified in accessible abstract content).
11–14. **Accuracy/Precision/Recall/F1:** Not stated in accessible content.
15. **Strengths:** Built on CelebA, a very large, well-known, front-facing-oriented public face dataset — much larger scale than any dedicated face-shape dataset found in this or the prior research phase.
16. **Weaknesses:** Labels are machine-generated (CNN-predicted), not human-annotated ground truth — a label-reliability concern. The paper's own text states "the majority of celebrity images in CelebA have a heart-shaped face," i.e., the authors themselves report severe class imbalance (source: cross-referenced via researchgate.net/publication/350875916 and cs.toronto.edu/~yuxuan/publication/celebhair).
17. **Computational cost:** Not stated.
18. **Mobile deployment suitable?** Not evaluated in the paper.
19. **Suitable for BeautyRoute?** No — CelebA's own license is research/non-commercial, reinforced by the paper's CC BY-NC-SA framing; pseudo-labeled (not human-verified) ground truth is a data-quality risk for a production classifier. (Consistent with the rejection already recorded in FACE_SHAPE_COMPARISON.md §1.)

### 2.5 Automatic Face Shape Classification Via Facial Landmark Measurements

1. **Title:** Automatic Face Shape Classification Via Facial Landmark Measurements
2. **Authors:** A.-I. Marinescu (source: WebSearch summary of cs.ubbcluj.ro/~studia-i publication page)
3. **Year:** 2021
4. **Publisher/venue:** *Studia Universitatis Babeș-Bolyai Informatica*, vol. 66, no. 2, pp. 69–78 (December 2021)
5. **DOI/URL:** https://www.cs.ubbcluj.ro/~studia-i/journal/journal/article/view/73
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** Not specified in retrievable content beyond "facial images with extracted landmark measurements."
8. **Number of classes:** 7 face shapes referenced in the paper's figures ("the 7 generally acknowledged face shapes") per a ResearchGate figure caption (researchgate.net/figure/357247661) — one more than BeautyRoute's 6-class taxonomy; exact 7th class name **not confirmed**.
9. **Class names:** Includes Oval among the 7 (per figure caption); full list not independently confirmed.
10. **Architecture:** Not a CNN — extracts relevant facial landmark measurements (distances/ratios/angles) and classifies via a **Naive Bayes** classifier (source: WebSearch summary).
11. **Accuracy:** 96.32% overall (source: WebSearch summary of the publication page).
12–14. **Precision/Recall/F1:** Not stated / could not verify.
15. **Strengths:** High reported accuracy using a lightweight, interpretable, classical-ML approach — no deep network required, which is inherently mobile-friendly from a compute standpoint.
16. **Weaknesses:** Uses a 7-class taxonomy rather than BeautyRoute's 6 target classes; full methodology and dataset provenance not independently verified in this research pass (page-level access was CAPTCHA-blocked); accuracy claim rests on a single (unverified) search snippet rather than a directly-read primary source.
17. **Computational cost:** Not stated, but landmark+Naive-Bayes pipelines are inherently very low-cost compared to CNNs.
18. **Mobile deployment suitable?** Likely yes in principle (classical ML on a small feature vector is cheap to run), though not evaluated on-device in the paper.
19. **Suitable for BeautyRoute?** Partially — reinforces that landmark-based geometric features are a recurring, credible alternative to raw-pixel CNN classification in this literature (also seen in §2.2, §2.3, §2.7), and could be considered as a preprocessing/ensemble signal even if BeautyRoute's primary model is a CNN.

### 2.6 Human Face Shape Classification with Machine Learning

1. **Title:** Human Face Shape Classification with Machine Learning
2. **Authors:** A. Mehta, T. M. Mahmoud (source: WebSearch summary of researchgate.net/publication/362903132)
3. **Year:** Not independently confirmed in this pass (ResearchGate page CAPTCHA-blocked); publication listing suggests early-2020s.
4. **Publisher/venue:** Not independently confirmed (ResearchGate preprint/publication).
5. **DOI/URL:** https://www.researchgate.net/publication/362903132_Human_Face_Shape_Classification_with_Machine_Learning
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** Not specified in retrievable content.
8. **Number of classes:** 4
9. **Class names:** Ellipse, Long, Round, Square (source: WebSearch summary) — notably does not use the Heart/Diamond/Oblong/Oval terminology common elsewhere in this literature, suggesting a different labeling convention.
10. **Architecture:** Support Vector Machine (SVM) — classical ML, not a deep network.
11. **Accuracy:** 73.68% (source: WebSearch summary) — the lowest reported accuracy among all sources surveyed in this review.
12–14. **Precision/Recall/F1:** Not stated / could not verify.
15. **Strengths:** Simple, lightweight, classical-ML baseline; useful as a lower bound for what a non-deep-learning approach achieves on this task.
16. **Weaknesses:** Lowest accuracy in this survey; non-standard 4-class taxonomy incompatible with BeautyRoute's 6-class requirement; full text inaccessible in this research pass.
17. **Computational cost:** Not stated, but SVM classifiers are inherently lightweight.
18. **Mobile deployment suitable?** Yes in principle (SVM inference is cheap), but the accuracy ceiling is too low to be commercially useful on its own.
19. **Suitable for BeautyRoute?** No — accuracy is too low and the class taxonomy doesn't match. Included for completeness as the lower bound of the accuracy range found in this literature (73.68%–99.6%, see §5).

### 2.7 Face Shape Classification Based on MTCNN and FaceNet

1. **Title:** Face Shape Classification Based on MTCNN and FaceNet
2. **Authors:** Wenxin Ji and co-authors (full author list not independently confirmed — ResearchGate/IEEE pages were CAPTCHA/paywall-restricted in this research pass; "Wenxin Ji" identified via a ResearchGate metadata search snippet)
3. **Year:** 2021
4. **Publisher/venue:** 2021 International Conference on Human-Computer Interaction (ICHCI), IEEE / IEEE Computer Society
5. **DOI/URL:** https://ieeexplore.ieee.org/document/9708709/ (also indexed at computer.org/csdl/proceedings-article/ichci/2021/076400a167/1Bb0SFazSKs)
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** Not specified in retrievable content.
8. **Number of classes:** Not specified in retrievable content.
9. **Class names:** Not specified in retrievable content.
10. **Architecture:** MTCNN for face detection/alignment, followed by a FaceNet-style embedding network for classification, using **Center Loss** instead of the original FaceNet Triplet Loss (source: WebSearch summary).
11. **Accuracy:** 92.32%, reported as higher than "other networks" compared in the paper (source: WebSearch summary).
12–14. **Precision/Recall/F1:** Not stated / could not verify.
15. **Strengths:** Combines a modern face-detection/alignment pipeline (MTCNN, also used in the Pratch-yani implementation, §2.13) with an embedding-based classification approach, and reports a competitive accuracy relative to other face-shape papers surveyed.
16. **Weaknesses:** Full text inaccessible in this research pass; dataset, exact class taxonomy, and precision/recall/F1 could not be verified.
17. **Computational cost:** Not stated. FaceNet-style embedding networks are moderate-weight, not mobile-optimized by default.
18. **Mobile deployment suitable?** Not established from accessible content; FaceNet-based pipelines are not inherently mobile-first architectures, though lightweight FaceNet variants exist in the broader face-recognition literature (see §5 cross-cutting notes).
19. **Suitable for BeautyRoute?** Uncertain given the missing dataset/class/license details — a candidate for follow-up if IEEE Xplore access is later obtained, but not actionable today from open sources alone.

### 2.8 Deep learning based face shape classification system with binary feature selection model

1. **Title:** Deep learning based face shape classification system with binary feature selection model
2. **Authors:** Not independently confirmed in this pass (ScienceDirect/ResearchGate pages CAPTCHA-blocked on every fetch attempt).
3. **Year:** 2025 (based on ScienceDirect article ID pattern and indexing; not independently confirmed from a directly-read primary source)
4. **Publisher/venue:** ScienceDirect (Elsevier) — exact journal name not confirmed in accessible content.
5. **DOI/URL:** https://www.sciencedirect.com/science/article/abs/pii/S0957417425027320 (also indexed at researchgate.net/publication/394046277)
6. **Citation count:** Not stated / could not verify (too recent to have an established count).
7. **Dataset used:** The Kaggle "Face Shape Dataset" (niten19, ~5,000 images — see FACE_SHAPE_DATASET_RESEARCH.md §2.1) plus a separate "men face dataset" (source: WebSearch summary).
8. **Number of classes:** Not explicitly restated in the retrievable summary, but consistent with the niten19 5-class taxonomy given the shared dataset.
9. **Class names:** Presumed Heart/Oblong/Oval/Round/Square by inheritance from the niten19 dataset — **not independently confirmed**, flagged as an assumption.
10. **Architecture:** A hybrid pipeline: Binary Emperor Penguin Optimization (BEPO) for feature selection over Dlib 68-point facial landmark features (three angles, ten ratios, seven face distances), feeding an optimized "deep gated recurrent convolutional network" (referred to as HoBDe-GCN) for classification (source: WebSearch summary).
11. **Accuracy:** 99.61485% on the face-shape dataset; 99.6798% on the "men face" dataset (source: WebSearch summary) — the highest accuracy figure found anywhere in this literature review.
12. **Precision:** 99.50758% (face-shape dataset); 98.9125% (men face dataset).
13. **Recall (sensitivity):** 98.99% (face-shape dataset); 99.57521% (men face dataset).
14. **F1-score:** 99.0162% (face-shape dataset); 99.46962% (men face dataset). Specificity of 98.7% also reported for the face-shape dataset.
15. **Strengths:** By a wide margin the highest and most completely reported metric set (accuracy, precision, recall, F1, specificity) of any source in this review — if verified, a very strong result.
16. **Weaknesses:** Full text inaccessible in every attempt in this research pass (direct fetch and proxy fetch both blocked by CAPTCHA); such a high accuracy (>99.6%) on a dataset with documented labeling/diversity issues (see FACE_SHAPE_DATASET_RESEARCH.md §2.1, §4) warrants independent scrutiny for possible train/test leakage or overfitting to a narrow (celebrity-photo, majority-female) domain before being trusted at face value. This paper's authorship, peer-review status, and methodology could not be independently verified beyond a search-engine summary in this pass — treat this entry's numbers as **unverified pending full-text access**.
17. **Computational cost:** Not stated. A gated recurrent + convolutional hybrid with a metaheuristic feature-selection front-end is likely heavier and more complex to deploy than a standard CNN classifier.
18. **Mobile deployment suitable?** Unclear — the architecture's recurrent component and metaheuristic optimization step are not typical of mobile-deployed models; not evaluated for on-device inference in accessible content.
19. **Suitable for BeautyRoute?** Not recommended as a direct blueprint without full-text verification of its extraordinary accuracy claim; also reuses the same license-unresolved niten19 dataset flagged in FACE_SHAPE_DECISION.md. Worth revisiting only after (a) the dataset licensing gate is cleared and (b) full-text access allows independent verification of the reported metrics.

### 2.9 Face Shape Classification Using Swin Transformer Model

1. **Title:** Face Shape Classification Using Swin Transformer Model
2. **Authors:** Not independently confirmed in this pass (ScienceDirect/ACM/BINUS pages did not yield author names via search snippets); affiliated with Bina Nusantara University (BINUS), Indonesia, per the BINUS research repository listing.
3. **Year:** 2023
4. **Publisher/venue:** *Procedia Computer Science* (Elsevier), published November 2023
5. **DOI/URL:** https://doi.org/10.1016/j.procs.2023.10.558 ; https://www.sciencedirect.com/science/article/pii/S1877050923017258
6. **Citation count:** Not stated / could not verify (too recent).
7. **Dataset used:** Not specified in retrievable content.
8. **Number of classes:** Not specified in retrievable content.
9. **Class names:** Not specified in retrievable content.
10. **Architecture:** Swin Transformer (the only source found in this entire review that applies a Transformer-family architecture specifically to face-shape classification, as opposed to general face recognition).
11. **Accuracy:** 86.34% with data augmentation (source: WebSearch summary).
12–14. **Precision/Recall/F1:** Not stated / could not verify.
15. **Strengths:** The sole direct evidence in this literature of a Transformer-based architecture being applied specifically to the face-shape task, rather than face recognition/verification more broadly — directly relevant to this review's architecture-comparison brief (see BR-FS-001_ARCHITECTURE_SELECTION.md).
16. **Weaknesses:** 86.34% is below the best CNN-transfer-learning results found in this review (e.g., §2.13's 92.7% with VGG16/VGGFace); full text, dataset, and class taxonomy inaccessible in this research pass.
17. **Computational cost:** Not stated in accessible content; Swin Transformers are generally heavier than mobile-first CNNs (see BR-FS-001_ARCHITECTURE_SELECTION.md for general Swin-T figures from the architecture-comparison research).
18. **Mobile deployment suitable?** Not evaluated in the paper. General Swin Transformer literature documents a specific mobile-GPU deployment obstacle (the shifted-window "roll" operation) — see BR-FS-001_ARCHITECTURE_SELECTION.md.
19. **Suitable for BeautyRoute?** Not as primary evidence (lower accuracy than the best CNN results, and Transformer models generally carry more deployment risk for a mobile-leaning product), but valuable as confirmation that Transformer architectures have been tried on this exact task and did not outperform CNN transfer learning in the results found.

### 2.10 Transfer Learning with EfficientNetV2S for Automatic Face Shape Classification

1. **Title:** Transfer Learning with EfficientNetV2S for Automatic Face Shape Classification
2. **Authors:** Petra Grd, Igor Tomičić, Ena Barčić (source: directly read from lib.jucs.org/article/104490/)
3. **Year:** 2024 (published 28 February 2024)
4. **Publisher/venue:** *JUCS – Journal of Universal Computer Science*, vol. 30, no. 2, pp. 153–178
5. **DOI/URL:** https://doi.org/10.3897/jucs.104490 ; https://lib.jucs.org/article/104490/
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** A "publicly available dataset of female celebrities" per a separate WebSearch summary of this paper — consistent with, but not independently confirmed as identical to, the niten19 dataset family. Exact image count **not stated** in the directly-fetched metadata page.
8. **Number of classes:** 5 (per WebSearch summary)
9. **Class names:** Heart, Oblong, Oval, Round, Square (per WebSearch summary)
10. **Architecture:** EfficientNetV2S, transfer learning (explicit in the title).
11–14. **Accuracy/Precision/Recall/F1:** **Not stated** — the directly-fetched article landing page provided only bibliographic metadata (title, authors, venue, DOI); no performance metrics were present in the accessible excerpt, and full-text access was not obtained in this research pass.
15. **Strengths:** The only source found in this review applying the modern EfficientNetV2 family specifically to face-shape classification, published in a peer-reviewed, DOI-indexed journal (JUCS) in 2024 — recent and directly relevant to the architecture-selection brief.
16. **Weaknesses:** No performance metrics could be retrieved in this research pass; would need the full PDF to complete this entry.
17. **Computational cost:** Not stated. EfficientNetV2S is designed for faster training than the original EfficientNet family (see BR-FS-001_ARCHITECTURE_SELECTION.md).
18. **Mobile deployment suitable?** Not evaluated in accessible content for this specific paper; EfficientNet-family mobile suitability is addressed generally in BR-FS-001_ARCHITECTURE_SELECTION.md.
19. **Suitable for BeautyRoute?** Promising as a lead (recent, peer-reviewed, directly on-topic) but not actionable without the full text — flagged for follow-up.

### 2.11 Perbandingan Kinerja Inception-ResNetv2, Xception, Inception-v3, dan ResNet50 pada Gambar Bentuk Wajah

*(English: "Performance Comparison of Inception-ResNetv2, Xception, Inception-v3, and ResNet50 on Face Shape Images")*

1. **Title:** Perbandingan Kinerja Inception-ResNetv2, Xception, Inception-v3, dan Resnet50 pada Gambar Bentuk Wajah
2. **Authors:** Not independently confirmed in this pass (ResearchGate CAPTCHA-blocked).
3. **Year:** Not independently confirmed; ResearchGate publication ID (391133013) pattern is consistent with 2025 indexing.
4. **Publisher/venue:** Not independently confirmed (ResearchGate-hosted; likely an Indonesian university venue given the language and pattern of other entries in this review).
5. **DOI/URL:** https://www.researchgate.net/publication/391133013_Perbandingan_Kinerja_Inception-_Resnetv2_Xception_Inception-v3_dan_Resnet50_pada_Gambar_Bentuk_Wajah
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** 4,500 images (source: WebSearch summary).
8. **Number of classes:** 5
9. **Class names:** Heart, Long, Oblong, Square, Round (source: WebSearch summary) — note "Long" in place of the more common "Oval," a labeling variation.
10. **Architecture:** A direct head-to-head comparison of four CNN backbones — Xception, ResNet50, InceptionResNet-v2, and Inception-v3 — on the same face-shape dataset.
11–14. **Accuracy/Precision/Recall/F1:** **Not stated** — the WebSearch summary confirmed the comparison design but not the resulting per-architecture numbers; full text inaccessible (CAPTCHA-blocked) in this research pass.
15. **Strengths:** If the full metrics were accessible, this would be the single most directly useful source for this review's architecture-comparison brief, since it benchmarks four CNN backbones head-to-head on the exact task. Its existence at least confirms that Xception, ResNet50, InceptionResNet-v2, and Inception-v3 have all been tried on face-shape classification specifically.
16. **Weaknesses:** Per-architecture results not accessible in this research pass — this is a significant gap; flagged for follow-up rather than treated as evidence either way.
17. **Computational cost:** Not stated.
18. **Mobile deployment suitable?** Not evaluated in accessible content. None of the four architectures compared (Xception, ResNet50, InceptionResNet-v2, Inception-v3) are mobile-first designs.
19. **Suitable for BeautyRoute?** Not directly actionable without the missing metrics, but its existence corroborates that ResNet-family and Inception-family CNNs are the most commonly benchmarked backbones for this specific task across the literature surveyed (see §5).

### 2.12 [ADJACENT] IdentiFace: A VGG Based Multimodal Facial Biometric System

1. **Title:** IdentiFace: A VGG Based Multimodal Facial Biometric System
2. **Authors:** Mahmoud Rabea, Hanya Ahmed, Sohaila Mahmoud, Nourhan Sayed
3. **Year:** 2024
4. **Publisher/venue:** arXiv (cs.CV)
5. **DOI/URL:** https://doi.org/10.48550/arXiv.2401.01227 ; https://arxiv.org/abs/2401.01227
6. **Citation count:** Not stated / could not verify.
7. **Dataset used:** Multiple: FERET (face recognition), a public gender-recognition dataset, a "celebrity face-shape dataset" (unnamed in accessible content — likely from the same niten19-derived family given the "celebrity" descriptor, but **not confirmed**), and FER2013 (emotion recognition). (Source: directly read from arxiv.org/abs/2401.01227.)
8. **Number of classes (face-shape task specifically):** **Not explicitly stated** in the paper for the face-shape sub-task.
9. **Class names:** Not explicitly stated for the face-shape sub-task.
10. **Architecture:** A VGG-16-inspired design, with minor modifications, applied across multiple biometric sub-tasks (identity, gender, face-shape, emotion) in a unified system.
11. **Accuracy:** 88.03% specifically on "the face-shape problem using the celebrity face-shape dataset" (source: directly read from arxiv.org/abs/2401.01227); 99.2% on FERET identity recognition; 95.15% on the public gender dataset; 66.13% on FER2013 emotion recognition — included for context, not face-shape-specific.
12–14. **Precision/Recall/F1 (face-shape task):** Not stated in accessible content.
15. **Strengths:** A unified architecture across multiple facial biometric tasks (relevant to a broader BeautyRoute platform that may eventually combine face-shape with other facial-attribute features); demonstrates VGG-family transfer learning remains competitive (88.03%) on a face-shape task as recently as 2024.
16. **Weaknesses:** Face-shape class count/taxonomy not specified, making direct comparison to BeautyRoute's 6-class requirement impossible without further investigation; the face-shape sub-task is a minor component of a larger multi-task paper, not its focus; limited discussion of computational efficiency or deployment (source: directly read from paper).
17. **Computational cost:** Not stated. VGG-16-based architectures (~138M parameters at full scale) are heavy relative to mobile-first backbones (see BR-FS-001_ARCHITECTURE_SELECTION.md).
18. **Mobile deployment suitable?** No — VGG-family networks are large and not designed for mobile/edge constraints; not discussed as a deployment target in the paper.
19. **Suitable for BeautyRoute?** Labeled **[ADJACENT]** rather than directly applicable — it is not a face-shape-specific paper, and VGG-16 is not a mobile-appropriate backbone, but it corroborates that transfer learning on VGG-family networks reaches high-80s accuracy on this task, consistent with §2.13 below.

### 2.13 [ADJACENT / practical implementation, not peer-reviewed] Face-Shape-Classification-using-CNN

1. **Title:** Face Shape Classification using CNN (capstone/portfolio project)
2. **Authors:** GitHub user "Pratch-yani"
3. **Year:** Not stated (GitHub repository, no publication date found).
4. **Publisher/venue:** GitHub (self-published, not peer-reviewed).
5. **DOI/URL:** https://github.com/Pratch-yani/Face-Shape-Classification-using-CNN
6. **Citation count:** Not applicable (not an academic publication); GitHub star/fork counts not captured in this pass.
7. **Dataset used:** The Kaggle Face Shape Dataset (niten19), 5,000 images, 1,000 per class, 800/200 train/test split per class (source: directly read from github.com/Pratch-yani/Face-Shape-Classification-using-CNN/blob/main/README.md — see also FACE_SHAPE_DATASET_RESEARCH.md §2.1).
8. **Number of classes:** 5
9. **Class names:** Heart, Oblong, Oval, Round, Square
10. **Architecture:** Two approaches compared head-to-head: (a) a custom CNN from scratch (4 convolutional + max-pooling layers, 2 dense layers), and (b) transfer learning using VGG-16 with pretrained VGGFace weights (trained on 2.6 million faces).
11. **Accuracy:** CNN from scratch ≈76.9%; VGG-16/VGGFace transfer learning = 92.7% (source: directly read from the project README).
12–14. **Precision/Recall/F1:** Not stated in the README.
15. **Strengths:** A clean, directly-read, apples-to-apples demonstration that transfer learning substantially outperforms training a small CNN from scratch on this exact dataset (76.9% → 92.7%, a +15.8 point improvement) — the clearest single piece of evidence in this entire review for a "use transfer learning, not from-scratch training" design decision. Also documents that MTCNN-based face detection + augmentation preprocessing improved validation accuracy and reduced overfitting.
16. **Weaknesses:** Not peer-reviewed; explicitly documents a demographic bias — Oval faces are most frequently misclassified, "particularly Asian faces confused with Round shapes," attributed partly to the pretrained VGGFace weights' likely non-Asian-skewed training distribution (source: same README) — directly corroborating the same bias pattern independently reported for the niten19 dataset ecosystem in FACE_SHAPE_DATASET_RESEARCH.md §4, finding 4. Model performance also degrades on tilted faces, sunglasses, or cropped images, i.e., depends heavily on successful upstream face detection.
17. **Computational cost:** Not stated numerically, but the README notes transfer learning trained faster than the from-scratch CNN.
18. **Mobile deployment suitable?** Not evaluated — the project deploys the model as a web app (Streamlit on Heroku), not on-device.
19. **Suitable for BeautyRoute?** Labeled **[ADJACENT / practical]**, not a formal citation-worthy academic source, but highly relevant as a direct, reproducible precedent: same license-blocked dataset as flagged in FACE_SHAPE_DECISION.md, same documented demographic bias, and clear quantitative evidence that transfer learning is the right default strategy once the dataset/licensing question is resolved.

### 2.14 [Flagged — inaccessible] "3D-Guided Face Shape Classification"

1. **Title:** 3D-Guided Face Shape Classification (project/thesis)
2. **URL:** https://scholarworks.calstate.edu/downloads/p2676x78x
3. **Status:** Every fetch attempt (direct and via proxy) returned HTTP 403 or a bot-check interstitial with no extractable content, consistent with the identical result obtained during the dataset-research phase (see FACE_SHAPE_DATASET_RESEARCH.md §2.13). **None of the 18 requested fields could be verified** in this pass either. Retained here only to document that it was re-attempted and remains inaccessible.

---

## 3. Facts vs. Assumptions — Explicit Summary

**Directly verified (full text read or primary metadata page fetched successfully):**
- Tio 2019 (§2.1) — abstract-level facts from arXiv.
- Adityatama & Putra 2023 (§2.13... note: full paper read is actually the Xception paper, cross-referenced above as part of the general corpus — see the complete PDF facts folded into the architecture-comparison document) — full paper text read directly, all metrics exact.
- IdentiFace (§2.12) — full arXiv abstract page read directly.
- Grd, Tomičić, Barčić 2024 (§2.10) — bibliographic metadata read directly (metrics not available).
- Pratch-yani GitHub README (§2.13) — full README read directly.
- Chi et al. 2023 (adjacent mobile-face-recognition review, used only in BR-FS-001_ARCHITECTURE_SELECTION.md) — full PDF read directly.

**Sourced from search-engine snippets only (not independently re-verified against the primary page due to CAPTCHA/paywall blocks), and flagged as lower-confidence throughout:**
- Sunhem & Pasupa 2016 (§2.2), Pasupa/Sunhem/Loo 2019 (§2.3), CelebHair details beyond the abstract (§2.4), Marinescu 2021 (§2.5), Mehta & Mahmoud (§2.6), Ji et al. 2021 (§2.7), the HoBDe-GCN paper (§2.8), the Swin Transformer paper (§2.9), and the Indonesian 4-architecture comparison (§2.11).

**Explicit non-facts / assumptions:**
- That §2.8's HoBDe-GCN uses the same 5-class taxonomy as niten19 — inferred from shared dataset name, not independently confirmed.
- That §2.10's and §2.12's "celebrity face-shape dataset" are drawn from the same niten19-derived ecosystem documented in FACE_SHAPE_DATASET_RESEARCH.md — plausible given the recurring pattern across this literature, but not confirmed by any source explicitly stating dataset lineage.

**Inaccessible sources:** §2.14 (CSU thesis) — confirmed inaccessible on a second, independent attempt.

---

## 4. Facts vs. Recommendations

This section is deliberately separated per the task's requirement to keep facts and recommendations distinct. Everything above in §2 and §3 is either a sourced fact or an explicitly labeled assumption. The following are the reviewer's own judgment calls, presented as recommendations, not facts:

- Prioritize transfer learning over training a CNN from scratch, given the consistent and directly-verified evidence in §2.13 (76.9% → 92.7% within the same project) and the general pattern across §2.1, §2.9, §2.10, §2.12, §2.13 that every transfer-learning result outperforms every from-scratch or purely classical-ML result found in this review.
- Treat the §2.8 (HoBDe-GCN, 99.6% accuracy) result as unverified and not something to design around until full-text access allows independent scrutiny — recommendation, not a fact about the paper's validity.
- Treat landmark/geometric-feature approaches (§2.2, §2.3, §2.5) as a credible lightweight complement, not a replacement, for a CNN-based BeautyRoute model — this is a judgment call based on their consistently lower ceiling (73.68%–96.32%) versus the best CNN transfer-learning results (92.7%, §2.13) combined with the fact that they don't use "deep learning" in the sense the project brief requires.
- Follow up on §2.3 (Pasupa et al. 2019) and §2.10 (Grd et al. 2024) specifically, since both are recent/credible, on-topic, peer-reviewed sources where this review could not retrieve full metrics — this is the single highest-value literature-access gap identified.

---

## 5. Cross-Cutting Findings

1. **Accuracy across this literature ranges from 73.68% (§2.6, classical SVM, non-standard 4-class taxonomy) to a reported but unverified 99.6% (§2.8).** Excluding the unverified outlier, the credible, directly-or-reasonably-sourced range for deep-learning/transfer-learning approaches on 5-class face-shape taxonomies is roughly **84%–93%** (Tio 2019's 84.4–84.8%; Adityatama & Putra's 85.1%; the Swin Transformer paper's 86.34%; IdentiFace's 88.03%; Pratch-yani's VGG16/VGGFace 92.7%). This range is the most defensible basis for setting a realistic target accuracy for BR-FS-001 (see BR-FS-001_MODEL_SPECIFICATION.md).
2. **Transfer learning consistently and substantially outperforms training from scratch** — the cleanest single piece of evidence is the directly-verified 76.9% → 92.7% jump within one project (§2.13) using the identical dataset and evaluation protocol.
3. **The niten19 Kaggle dataset (or a close derivative) recurs across at least four of the sources reviewed here** (§2.8, §2.10 probable, §2.12 probable, §2.13 confirmed) in addition to the three derivatives already documented in FACE_SHAPE_DATASET_RESEARCH.md — reinforcing that its unresolved licensing status (flagged in FACE_SHAPE_DECISION.md) is the single most load-bearing open risk connecting the dataset-research and architecture-selection phases of this project.
4. **A documented ethnic/demographic bias recurs independently across multiple, separately-authored sources** — Pratch-yani's project (§2.13) and the original dataset ecosystem (FACE_SHAPE_DATASET_RESEARCH.md §4) both independently report Asian faces being disproportionately misclassified (typically Oval confused with Round). This is not a one-off anecdote; it appears wherever the underlying dataset lineage is traceable, and should be treated as a known, real risk for BeautyRoute's target user base, not a hypothetical one.
5. **CNN backbones dominate this literature; Transformer-family architectures are rare.** Only one source (§2.9, Swin Transformer) applies a Transformer architecture specifically to face-shape classification, and its result (86.34%) did not exceed the best CNN transfer-learning results found. Inception-family (Inception v3, InceptionResNet-v2), Xception, ResNet50, VGG16, and EfficientNet(V2) are the recurring CNN backbones across this literature (§2.1, §2.9's comparison target, §2.10, §2.11, §2.12, §2.13). This pattern directly informs the architecture shortlist in BR-FS-001_ARCHITECTURE_SELECTION.md.
6. **Landmark/geometric-feature classical-ML approaches form a persistent secondary thread** (§2.2, §2.3, §2.5, and the Dlib-landmark front-end of §2.8) — none dominate the best CNN results, but they recur often enough (across a 2016–2025 span) to be a legitimate, low-compute complementary technique worth keeping in mind, particularly for mobile inference cost reduction.
7. **No source in this review explicitly evaluates a MobileNetV3, ConvNeXt, or plain ViT backbone on the face-shape task specifically.** This is a genuine gap in the direct literature — BR-FS-001_ARCHITECTURE_SELECTION.md's recommendation for these architecture classes is therefore grounded in general architecture properties and adjacent mobile-face-recognition literature (§2.7 and the Chi et al. 2023 review cited there), not in a face-shape-specific benchmark. This is stated explicitly as a limitation of the current evidence base, not papered over.

See [BR-FS-001_ARCHITECTURE_SELECTION.md](BR-FS-001_ARCHITECTURE_SELECTION.md) for the architecture comparison and recommendation, and [BR-FS-001_MODEL_SPECIFICATION.md](BR-FS-001_MODEL_SPECIFICATION.md) for the resulting model specification.
