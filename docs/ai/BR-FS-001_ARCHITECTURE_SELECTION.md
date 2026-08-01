# BR-FS-001 Architecture Selection

**Model:** BeautyRoute Face Shape Classifier (BR-FS-001)
**Document type:** Architecture selection only. No training code, no model implementation, no weight downloads were performed for this document.
**Author:** AI Research Lead, BeautyRoute
**Date:** 2026-07-30
**Prerequisite reading:** [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md), [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md)

---

## 1. Methodology and constraints

This document compares six candidate backbone architectures — EfficientNet, MobileNetV3, ResNet50, ConvNeXt, Vision Transformer (ViT), and Swin Transformer — against BeautyRoute's stated project constraints:

- **No paid APIs.** The model must be trainable and fine-tunable using open, self-hosted tooling (PyTorch/torchvision/timm), not a proprietary hosted model.
- **Trainable on a realistically small dataset.** Per [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5 and [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), no clean, license-clear face-shape dataset larger than roughly 5,000 images was identified. This favors architectures with a strong pretrained-transfer-learning path and a parameter count that doesn't invite overfitting on a small, fine-tuned dataset.
- **Mobile-deployment potential.** BeautyRoute is a consumer-facing SaaS product; on-device or low-latency inference is a stated goal.
- **Maintainability.** The team must be able to train, debug, and redeploy the model without deep infrastructure investment — this favors architectures with mature, native PyTorch/torchvision support.

Facts below are grounded in the original architecture papers, official PyTorch/torchvision documentation, the timm library, and — where available — published benchmark tables. Figures are cross-checked against a second, independent source where possible; discrepancies between sources are stated explicitly rather than silently reconciled. Facts not found in any checkable source are marked **"not stated in surveyed sources."** This comparison also draws on [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5, finding 7, which is repeated here as an important caveat: **no source found in this project's literature review evaluates MobileNetV3, ConvNeXt, or plain ViT specifically on the face-shape classification task.** The recommendation in §4 is therefore grounded in general architecture properties, adjacent mobile-face literature, and the face-shape-specific results that do exist for related CNN families (Inception, Xception, ResNet, VGG, EfficientNetV2) — this gap is stated as a limitation, not resolved by inference.

---

## 2. Architecture Profiles

### 2.1 EfficientNet (B0–B7)

- **Original paper:** "EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks," Mingxing Tan & Quoc V. Le, ICML 2019. arXiv:1905.11946 — https://arxiv.org/abs/1905.11946
- **Parameter count:** B0 5.3M, B1 7.8M, B2 9.1M, B3 12.2M, B4 19.3M, B5 30.4M, B6 43.0M, B7 66.3M (source: docs.pytorch.org/vision/stable/models.html). Independently corroborated for B0 (5.3M) by Chi et al. 2023 (iJIM), Table 1 — see BR-FS-001_LITERATURE_REVIEW.md for context on this adjacent review source.
- **Inference speed:** Single-core Intel Xeon E5-2690 CPU, batch=1: B1 78.8% top-1 @ 0.098s vs. ResNet-152 77.8% @ 0.554s (5.7× faster); B7 84.4% @ 3.1s vs. GPipe 84.3% @ 19.0s (6.1× faster, 8.4× fewer params) (source: arXiv:1905.11946, Table 4).
- **Memory usage:** GFLOPs (torchvision): B0 0.39 through B7 37.75. Model size in MB not published directly by the authors; a computed fp32 estimate (not a cited figure) is roughly 21MB (B0) to 265MB (B7).
- **Ease of deployment:** Native in `torchvision.models` and in timm; ONNX-exportable. Google published a dedicated **EfficientNet-Lite** family specifically for TFLite/mobile CPU/GPU/EdgeTPU, removing Squeeze-and-Excite and replacing Swish with ReLU6 "because SE are not well supported for some mobile accelerators" (blog.tensorflow.org, March 2020) — the existence of this mobile-specific variant is itself evidence that the *vanilla* EfficientNet family is not optimal for mobile out of the box.
- **Community support:** timm (huggingface/pytorch-image-models) has on the order of 36k GitHub stars per search results; exact current citation count not independently re-verified (Semantic Scholar API rate-limited during this research), but the paper is unambiguously among the most-cited efficiency papers in computer vision.
- **PyTorch maturity:** Native to torchvision since v0.11 (~2021); continuously maintained; also in timm since its early releases.
- **Advantages:** Compound depth/width/resolution scaling gives strong accuracy-per-FLOP; the B0–B3 range is a reasonable size for fine-tuning on a small dataset.
- **Disadvantages:** FLOP-efficiency does not translate directly to real-hardware latency-efficiency — a dedicated critique paper, "The Efficiency Misnomer" (arXiv:2110.12894), makes this point explicitly; Google's own EfficientNet-Lite documentation implicitly confirms it by stripping SE/Swish for mobile.
- **Mobile verdict:** Good with caveats — genuinely mobile-friendly only via the Lite variant, which is not natively bundled in torchvision/timm and would require additional conversion work.
- **Face-shape-specific evidence:** [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §2.10 (Grd, Tomičić & Barčić, 2024, JUCS) applies EfficientNetV2S specifically to face-shape classification; performance metrics could not be retrieved in this research pass, so this is confirmed *prior art* but not a confirmed *accuracy data point*.

### 2.2 MobileNetV3 (Small / Large)

- **Original paper:** "Searching for MobileNetV3," Andrew Howard, Mark Sandler, Grace Chu, Liang-Chieh Chen, Bo Chen, Mingxing Tan, Weijun Wang, Yukun Zhu, Ruoming Pang, Vijay Vasudevan, Quoc V. Le, Hartwig Adam. ICCV 2019. arXiv:1905.02244 — https://arxiv.org/abs/1905.02244
- **Parameter count:** Per paper: Large 5.4M, Small 2.5M. Torchvision reports Large as 5.5M (a small, noted discrepancy likely from classifier-head differences). Independently corroborated at 5.4M (Large, "MobileNet v3(1.0)") by Chi et al. 2023 (iJIM), Table 1.
- **Inference speed:** Paper Table 3, Pixel phone latency (float): Large 1.0× — 75.2% top-1 @ 51ms (Pixel 1)/61ms (Pixel 2)/44ms (Pixel 3); Small 1.0× — 67.4% @ 15.8/19.4/14.4ms. For reference, MobileNetV2 1.0× reaches 72.0% @ 64/76/56ms — MobileNetV3-Large is ~20% faster than V2 at similar accuracy (source: arXiv:1905.02244, Table 3).
- **Memory usage:** GFLOPs (torchvision): Large 0.22, Small 0.06 — the lowest compute footprint of any architecture in this comparison. MAdds per paper: Large 219M, Small 56M.
- **Ease of deployment:** Native `torchvision.models.mobilenet_v3_large/small`, **plus an official quantized variant** (`torchvision.models.quantization.mobilenet_v3_large`, INT8, CPU inference) — a deployment-maturity signal none of the other five architectures in this comparison have out of the box in torchvision. TFLite/CoreML conversion is well documented (Apple's coremltools PyTorch conversion guide).
- **Community support:** Official TensorFlow reference implementation lives in `tensorflow/models`; precise citation count not independently pinned down in this pass, but this is one of the most widely deployed mobile CNN families in production use.
- **PyTorch maturity:** Native since torchvision v0.9 (2021); stable; the official quantized variant is a distinguishing maturity signal.
- **Advantages:** Explicitly designed via hardware-aware Neural Architecture Search (NAS) + NetAdapt for mobile phone CPUs (arXiv:1905.02244 abstract) — the only architecture in this comparison whose stated design goal is mobile deployment.
- **Disadvantages:** Lower accuracy ceiling than larger backbones (75.2% ImageNet top-1 for Large vs. 82–84% for ConvNeXt-T/EfficientNet-B7) — trades raw capacity for latency/size.
- **Mobile verdict:** Best-documented mobile fit of the six architectures compared — explicit mobile design goal, and the only one with an official quantized torchvision path.
- **Face-shape-specific evidence:** None found. [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5, finding 7 confirms this gap explicitly. The closest adjacent evidence is Chi et al. 2023 (iJIM), a mobile-*face-recognition* (not face-shape) review, which states directly: "MobileNetv3 is recommended for applications that require real-time performance on mobile devices" (source: full text read directly, §4 "Discussions and Recommendations").

### 2.3 ResNet50

- **Original paper:** "Deep Residual Learning for Image Recognition," Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun. CVPR 2016 (arXiv Dec 2015). arXiv:1512.03385 — https://arxiv.org/abs/1512.03385
- **Parameter count:** 25.6M (source: docs.pytorch.org/vision/stable/models.html) — the most consistently cited figure across sources checked.
- **Inference speed:** 4.09 GFLOPs (torchvision). The original 2015 paper predates standard latency-benchmarking practice and reports no ms/throughput figures; **GPU/CPU throughput for ResNet50 specifically is not stated in surveyed sources** — only FLOPs/params are solidly confirmed.
- **Memory usage:** Not published in MB in the original paper; a computed fp32 estimate is roughly 98MB.
- **Ease of deployment:** The oldest and most universally supported architecture in this comparison. Native to torchvision since its earliest releases; has an official quantized variant (`torchvision.models.quantization.resnet50`); PyTorch's own official ONNX-export tutorial uses ResNet-50 as its canonical example. Universally supported across ONNX Runtime, TensorRT, and CoreML.
- **Community support:** Official reference repo `KaimingHe/deep-residual-networks` has roughly 6.7k GitHub stars per search. Citation counts vary sharply by aggregator (two ScisSpace entries show 112,405 and 195,826 for what appears to be the same paper) — the exact number is not independently pin-downable, but the paper is unambiguously one of the most-cited computer vision papers ever published (order of 100,000+ citations by any measure).
- **PyTorch maturity:** Extremely mature; predates most of the other five architectures in torchvision; the de facto standard baseline architecture in the field.
- **Advantages:** Residual/skip connections solve the vanishing-gradient/degradation problem for deep networks; maximal ecosystem support and an abundance of pretrained checkpoints across nearly every framework and hosting platform.
- **Disadvantages:** Older architecture, outclassed on accuracy-per-compute by newer nets (EfficientNet-B1 matches/exceeds ResNet-152 accuracy at 5.7× lower CPU latency per arXiv:1905.11946, Table 4); heavier than mobile-first architectures (25.6M vs. MobileNetV3-Large's 5.4M) and not designed with mobile constraints in mind.
- **Mobile verdict:** Poor fit relative to purpose-built mobile nets — usable via quantization/TFLite conversion, but not designed for edge use.
- **Face-shape-specific evidence:** [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §2.11 references a direct Indonesian-language comparison of ResNet50 against Xception, InceptionResNet-v2, and Inception-v3 on 4,500 face-shape images, but the resulting per-architecture accuracy figures could not be retrieved in this research pass (CAPTCHA-blocked source) — confirmed prior art, unconfirmed result.

### 2.4 ConvNeXt (Tiny / Small / Base)

- **Original paper:** "A ConvNet for the 2020s," Zhuang Liu, Hanzi Mao, Chao-Yuan Wu, Christoph Feichtenhofer, Trevor Darrell, Saining Xie. CVPR 2022. arXiv:2201.03545 — https://arxiv.org/abs/2201.03545
- **Parameter count:** Consistent across paper and torchvision: Tiny 28.6M, Small 50.2M, Base 88.6M.
- **Inference speed:** Paper Table 1, A100 GPU throughput: Tiny 774.7 img/s @ 82.1% top-1; Small 447.1 img/s @ 83.1%; Base 292.1 img/s @ 83.8% (source: arXiv:2201.03545, Table 1).
- **Memory usage:** GFLOPs: Tiny 4.46, Small 8.68, Base 15.36. MB not published; computed fp32 estimate roughly 114MB (T) to 354MB (B).
- **Ease of deployment:** Native `torchvision.models` since v0.12 (2022); in timm. A third-party technical review (Medium, not peer-reviewed — flagged as such) notes ConvNeXt's "inference speed on TensorRT/CoreML is severely limited by inefficient components, such as 7×7 depthwise convolution, LayerNorm, and GELU."
- **Community support:** Official repo `facebookresearch/ConvNeXt` has roughly 6k GitHub stars (now archived per search results); successor ConvNeXt-V2 has roughly 1.9k stars. Citation count fetched directly from the Semantic Scholar API during this project's earlier architecture research: **8,862 citations** for arXiv:2201.03545.
- **PyTorch maturity:** Added to torchvision more recently (v0.12, 2022) than ResNet/EfficientNet; actively maintained; also in timm.
- **Advantages:** A pure-CNN design that matches/exceeds Swin Transformer at similar compute in the paper's own comparison table; retains convolution's architectural simplicity and doesn't require ViT-style large-scale pretraining.
- **Disadvantages:** Uses LayerNorm, GELU, and 7×7 depthwise convolutions — operations less optimized on many mobile/edge inference backends than plain BatchNorm/ReLU/3×3 convolutions (per the third-party review cited above); larger than MobileNet/EfficientNet-B0-class models.
- **Mobile verdict:** Middling — convolutional in principle (favorable), but specific operations are flagged by a non-peer-reviewed but technically detailed third-party source as bottlenecks on TensorRT/CoreML.
- **Face-shape-specific evidence:** None found in this project's literature review — confirmed gap.

### 2.5 Vision Transformer (ViT-B/16)

- **Original paper:** "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale," Alexey Dosovitskiy et al. ICLR 2021. arXiv:2010.11929 — https://arxiv.org/abs/2010.11929
- **Parameter count:** ViT-B/16: 86.6M (source: docs.pytorch.org/vision/stable/models.html) — consistent with the commonly cited ~86M figure.
- **Inference speed:** The original paper reports pretraining *compute* cost (~2.5k TPUv3-core-days for the best model) rather than inference latency — a training, not inference, figure. Direct ViT-B/16 inference throughput was **not stated in surveyed sources**. As an architecturally similar proxy (not the same model), DeiT-B (86M params, comparable size) reaches 292.3 img/s on a V100 per the Swin Transformer paper's own benchmark table (arXiv:2103.14030, Table 1) — cited as a stand-in, not ViT's own number.
- **Memory usage:** 17.56 GFLOPs (torchvision). MB not published; computed fp32 estimate roughly 330MB.
- **Ease of deployment:** Native `torchvision.models.vit_b_16` (added v0.12, 2022); in timm; ONNX-exportable. However, a mobile-inference-latency study found that "64 of 190 real-world ViTs cannot be quantized due to operations unsupported by PyTorch Mobile" (arXiv:2510.25166) — a concrete, citable mobile-deployment obstacle.
- **Community support:** Official repo `google-research/vision_transformer` has roughly 12.1–12.2k GitHub stars per search. Citation count per one aggregator: 36,890 (not independently re-verified via a live API call in this pass).
- **PyTorch maturity:** Added to torchvision in v0.12 (2022) — later than ResNet/EfficientNet; community reimplementations (e.g., `lucidrains/vit-pytorch`) predate official support; considered stable now.
- **Advantages:** Pure self-attention scales very well with data/model size; the original paper states it "attains excellent results compared to state-of-the-art convolutional networks while requiring substantially fewer computational resources to train" — but explicitly *only* when pretrained on large amounts of data (arXiv:2010.11929, abstract).
- **Disadvantages:** The paper itself states ViT lacks CNN inductive biases (locality, translation equivariance) and underperforms when trained on insufficient data, requiring large-scale pretraining (ImageNet-21k/JFT-300M) to be competitive — directly relevant given BeautyRoute's dataset is small (at most ~5,000 images per FACE_SHAPE_DATASET_RESEARCH.md). Heavier memory footprint and documented attention-op support gaps for mobile quantization.
- **Mobile verdict:** Weakest fit of the six for BeautyRoute's mobile-deployment goal, both due to the paper's own stated large-data-pretraining requirement and the third-party-documented mobile-quantization support gap.
- **Face-shape-specific evidence:** None found in this project's literature review — confirmed gap. This absence is itself informative: unlike CNN families (Inception, Xception, ResNet, VGG, EfficientNetV2), which recur repeatedly across the face-shape literature surveyed, no plain-ViT face-shape paper was located in Google Scholar, arXiv, IEEE Xplore, or SpringerLink searches during this review.

### 2.6 Swin Transformer (Swin-T)

- **Original paper:** "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows," Ze Liu, Yutong Lin, Yue Cao, Han Hu, Yixuan Wei, Zheng Zhang, Stephen Lin, Baining Guo (Microsoft Research Asia). ICCV 2021. arXiv:2103.14030 — https://arxiv.org/abs/2103.14030
- **Parameter count:** Swin-T: 28.3M (torchvision) / 29M (paper, rounded) — consistent.
- **Inference speed:** Paper Table 1(a), V100 GPU throughput: Swin-T 755.2 img/s; Swin-S 436.9 img/s; Swin-B (224²) 278.1 img/s. For comparison on the same table: DeiT-S reaches 940.4 img/s and RegNetY-4G reaches 1,156.7 img/s at similar parameter counts (source: arXiv:2103.14030, Table 1).
- **Memory usage:** 4.49 GFLOPs (torchvision) / 4.5G (paper). MB not published; computed fp32 estimate roughly 108MB.
- **Ease of deployment:** Native `torchvision.models.swin_t/swin_s/swin_b` (added v0.13, 2022); in timm. Notably, a mobile-ViT-latency study specifically flags that the "roll" operation used by Swin's shifted-window mechanism "is currently unavailable in ML frameworks for mobile GPUs" (arXiv:2510.25166) — a concrete, citable mobile-deployment obstacle unique to Swin among the six architectures compared here.
- **Community support:** Official repo `microsoft/Swin-Transformer` has roughly 15.4k GitHub stars per search (search-result caching showed some variance, 8.9k–16k, flagged as such). Citation count fetched directly from the Semantic Scholar API during this project's architecture research: **34,139** for arXiv:2103.14030 — notably different from a separate third-party aggregator's figure of 15,758 for the same paper, illustrating that citation-count aggregators disagree meaningfully; the live-queried figure is treated as more authoritative here.
- **PyTorch maturity:** Added to torchvision in v0.13 (2022); in timm; widely used as a backbone in detection/segmentation frameworks (e.g., mmdetection).
- **Advantages:** Shifted-window hierarchical design gives linear (not quadratic) compute complexity with image size, unlike plain ViT's global attention, while remaining competitive on classification/detection/segmentation.
- **Disadvantages:** ConvNeXt's own paper shows ConvNeXt-T outperforming Swin-T at similar compute; the shifted-window "roll" operation is specifically flagged as unsupported on mobile GPU ML frameworks (arXiv:2510.25166); more implementation complexity (window partition/merge, relative position bias) than a plain CNN or plain ViT, complicating export/quantization.
- **Mobile verdict:** Poor — the "roll" operation issue is a specific, sourced obstacle to mobile GPU deployment, the most concrete negative mobile finding of any architecture in this comparison.
- **Face-shape-specific evidence:** **This is the one architecture in the comparison with direct, on-topic prior art**: [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §2.9 (Procedia Computer Science, 2023, BINUS) applies Swin Transformer specifically to face-shape classification, reporting **86.34% accuracy with augmentation** — below the best CNN transfer-learning results found in the same review (92.7%, VGG16/VGGFace; see BR-FS-001_LITERATURE_REVIEW.md §5, finding 5).

---

## 3. Comparison Table

| Architecture | Variant | Params | GFLOPs | Published speed (hardware, source) | Mobile-friendly? | torchvision native | Face-shape prior art (this review) |
|---|---|---|---|---|---|---|---|
| ResNet50 | — | 25.6M | 4.09 | Not stated in surveyed sources | No | Yes (+ quantized) | Referenced, results unverified (§2.11) |
| EfficientNet | B0 | 5.3M | 0.39 | 0.098s/img @ Xeon E5-2690 CPU (B1) | Partial — needs -Lite variant | Yes | EfficientNetV2S used, results unverified (§2.10) |
| MobileNetV3 | Large | 5.4–5.5M | 0.22 | 44–61ms @ Pixel 1–3 | **Yes — explicit design goal** | Yes (+ quantized) | **None found** |
| ConvNeXt | Tiny | 28.6M | 4.46 | 774.7 img/s @ A100 GPU | Limited (LayerNorm/GELU/7×7 dwconv) | Yes | None found |
| ViT-B/16 | Base | 86.6M | 17.56 | Not stated (only training cost known) | No — large-pretrain-data need + mobile quant. gaps | Yes | None found |
| Swin-T | Tiny | 28.3M | 4.49 | 755.2 img/s @ V100 GPU | No — "roll" op unsupported on mobile GPU frameworks | Yes | **86.34% accuracy** (§2.9) |

---

## 4. Recommendation

### Recommended architecture: **MobileNetV3-Large, ImageNet-pretrained, fine-tuned via transfer learning**

**Technical justification:**

1. **Mobile deployment is a stated BeautyRoute requirement, and MobileNetV3 is the only architecture in this comparison whose original design goal is mobile CPU deployment** — confirmed directly from the paper's own hardware-aware NAS methodology (arXiv:1905.02244) and reinforced by an independent, adjacent mobile-face-recognition review's explicit recommendation of MobileNetV3 "for applications that require real-time performance on mobile devices" (Chi et al. 2023, iJIM, §4). No other architecture compared here carries this same direct, sourced mobile-first design intent.
2. **It is the only architecture in this comparison with an official, torchvision-native quantized variant** (`torchvision.models.quantization.mobilenet_v3_large`), which materially reduces the engineering risk of shipping an on-device model without paid third-party tooling — directly satisfying BeautyRoute's "no paid APIs" constraint at the deployment stage, not just the training stage.
3. **Its small parameter count (5.4–5.5M) is well matched to BeautyRoute's realistically small training dataset** (at most ~5,000 images, per [FACE_SHAPE_DATASET_RESEARCH.md](FACE_SHAPE_DATASET_RESEARCH.md), and pending the licensing gate in [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md)). [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5, finding 2 shows transfer learning consistently and substantially outperforms training from scratch on this exact task; a smaller pretrained backbone is generally less prone to overfitting when fine-tuned on a few thousand images than an 86M-parameter Transformer, consistent with ViT's own paper stating it needs large-scale pretraining data to be competitive (arXiv:2010.11929).
4. **It has mature, native, continuously-maintained PyTorch/torchvision support** (since v0.9, 2021), satisfying the maintainability requirement without needing bleeding-edge library versions or custom op support.

**Honest limitation of this recommendation:** as stated in §1 and confirmed in [BR-FS-001_LITERATURE_REVIEW.md](BR-FS-001_LITERATURE_REVIEW.md) §5 finding 7, **no face-shape-classification paper using MobileNetV3 was found in this literature review.** This recommendation is therefore an engineering judgment call grounded in (a) MobileNetV3's general, well-sourced mobile/efficiency properties, (b) the strong, repeated evidence across this literature that transfer learning on a modestly-sized pretrained CNN backbone reaches 85–93% accuracy on this task regardless of the specific CNN family used (Inception v3, Xception, VGG16 have all reached this range — see BR-FS-001_LITERATURE_REVIEW.md §5 finding 1), and (c) an adjacent, credible mobile-deployment review's direct recommendation of MobileNetV3 for real-time mobile use. It is not a claim that MobileNetV3 has already been proven on this exact task. Validating this assumption empirically (i.e., actually fine-tuning MobileNetV3-Large on the eventual approved dataset and comparing against at least one literature-precedented backbone such as Xception or EfficientNetV2S) should be an explicit early step of the implementation phase, not skipped on the strength of this document alone.

### Why the other five were rejected

- **ResNet50 — rejected as primary, viable as a fallback.** Heaviest well-established CNN in this comparison (25.6M params) with no mobile-first design intent; outclassed on accuracy-per-compute by newer architectures (§2.3). It has real face-shape prior art in the literature (§2.11), so it remains a reasonable *accuracy-first fallback* if MobileNetV3 fine-tuning underperforms — but it is not the primary recommendation given BeautyRoute's mobile requirement.
- **EfficientNet (vanilla B0–B7) — rejected as primary, EfficientNetV2S noted as a secondary lead.** Strong accuracy-per-FLOP on paper, but the vanilla family's real-hardware mobile latency is documented as unreliable without switching to the separate EfficientNet-Lite variant, which is not natively bundled in torchvision/timm (§2.1). Notably, EfficientNetV2S is the one EfficientNet-family variant with direct, on-topic face-shape prior art (BR-FS-001_LITERATURE_REVIEW.md §2.10) — if MobileNetV3's empirical validation underperforms, EfficientNetV2S is the recommended first alternative to test, given it has both a plausible mobile deployment path (faster training characteristics per its own paper) and actual face-shape precedent.
- **ConvNeXt — rejected.** Larger than MobileNetV3 (28.6M+ params) with no mobile-first design goal; a third-party technical review specifically flags its LayerNorm/GELU/7×7-depthwise-convolution operations as bottlenecks on mobile inference backends like TensorRT/CoreML (§2.4). No face-shape-specific prior art found.
- **Vision Transformer (ViT-B/16) — rejected.** The original paper's own stated requirement — large-scale pretraining data to be competitive — directly conflicts with BeautyRoute's small realistic dataset size; a third-party mobile-quantization study documents concrete on-device deployment gaps for ViT-family models (§2.5). No face-shape-specific prior art found.
- **Swin Transformer — rejected despite having the strongest direct face-shape prior art of any Transformer-family architecture.** It is the only architecture in this comparison with a directly-sourced face-shape accuracy figure (86.34%, BR-FS-001_LITERATURE_REVIEW.md §2.9) — but that figure is below the best CNN transfer-learning results found elsewhere in the same literature (92.7%, VGG16/VGGFace), and the shifted-window "roll" operation has a specific, sourced mobile-GPU-framework support gap (§2.6) that directly conflicts with BeautyRoute's mobile-deployment goal. Having *some* prior art is not, on its own, sufficient to outweigh a documented mobile-deployment blocker plus a lower accuracy ceiling than the CNN alternatives.

---

## 5. Facts vs. Recommendations — Explicit Separation

**Facts:** All architecture properties (parameters, FLOPs, published speed figures, PyTorch/deployment support, original design goals, documented mobile-deployment obstacles) in §2 and the table in §3, each with an inline source. The absence of face-shape-specific prior art for MobileNetV3, ConvNeXt, and ViT is also a fact (an absence-of-evidence finding from a documented search process), not a recommendation.

**Recommendations (judgment calls, not facts):** The choice of MobileNetV3-Large as the primary architecture (§4); the designation of EfficientNetV2S and ResNet50 as fallback candidates; the recommendation to empirically validate MobileNetV3 against at least one literature-precedented backbone before committing to it for production.

---

## 6. Decision Status

This is an architecture *recommendation*, not an implementation authorization. Per [FACE_SHAPE_DECISION.md](FACE_SHAPE_DECISION.md), no training may begin until the dataset licensing gate is resolved (status: **REQUIRES LICENSE REVIEW**). This document's recommendation is independent of, and does not resolve, that gate. See [BR-FS-001_MODEL_SPECIFICATION.md](BR-FS-001_MODEL_SPECIFICATION.md) for how this architecture choice translates into a concrete model specification, still at the documentation stage only.

**Do not proceed to implementation until approval, per the task instructions governing this document.**
