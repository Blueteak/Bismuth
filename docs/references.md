# References

## Applicability rule

The four local photographs are the product's visual ground truth. Outside
sources constrain explanations; they do not overrule the target. Before using
a paper, record its composition/purity, growth route, scale and dimensional
constraint, observed habit, domain state, allowed claim, and forbidden
inference.

Use these classifications:

- `target class`: bulk elemental-bismuth melt growth with a hopper habit;
- `structure only`: elemental-bismuth crystallography, but a different growth
  route or habit;
- `mechanism only`: a relevant physical effect in a mismatched specimen;
- `numerical only`: equations or discretization without target-habit evidence;
- `incompatible habit`: a visibly different specimen that cannot define
  product geometry.

Only `target class` evidence may constrain a product-habit hypothesis, and the
specific observed trait must still match. No generic or different-specimen
source may set Candidate 2D geometry, facet indices, coefficients, or
morphology acceptance. Several mismatched sources do not add up to one matched
source.

## Ground-truth target specimens

| Reference                                                          | Composition, route, domain                                                                                       | Allowed claim                                                                                  | Forbidden inference                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`crystal_small_1.jpg`](../crystal_references/crystal_small_1.jpg) | User-supplied real-world bismuth hopper target; detailed provenance and domain state are not encoded in the file | Deep rectilinear/rhombohedral-pyramidal hopper, one dominant sector, continuous winding ledges | Miller indices, purity, growth coefficients, or a screw-dislocation cause |
| [`crystal_small_2.jpg`](../crystal_references/crystal_small_2.jpg) | Same target class; detailed provenance unknown                                                                   | Offset deep opening, interrupted and asymmetric terrace bands                                  | A perfect centered loop model or an identified defect source              |
| [`crystal_small_3.jpg`](../crystal_references/crystal_small_3.jpg) | Same target class; domain state unknown                                                                          | Intergrown sectors and strongly varied ledge widths in one connected specimen                  | Independent decorative crystals or assumed single-domain structure        |
| [`crystal_small_4.jpg`](../crystal_references/crystal_small_4.jpg) | Same target class; domain state unknown                                                                          | Branching sectors, irregular connected structure, deep stepped recesses                        | Cosmetic branching or a generic dendrite substitute                       |

These images authorize visible acceptance traits only. The complete file
manifest and hashes live in `docs/simulation-model.md`.

## Direct bulk elemental-bismuth evidence

| Source and specimen                                                                                                                                                                                                                                                                                                                                                         | Classification                                                                                                                                                                                                    | Allowed claim                                                                                                                                                                                                                                                              | Forbidden inference                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J. J. Frawley, W. R. Maurer, and W. J. Childs, "Vacuum Decanting of Bismuth and Bismuth Alloys," Trans. Metall. Soc. AIME 242, 1517-1521 (1968), [official AIME volume catalog](https://aimehq.org/themes/custom/aime/doclibrary/transactions/vol242.html)                                                                                                                  | `target class`: `99.999+%` bulk Bi, supercooled melt, vacuum decanted; habit changed from prismatic near `10 C` to hopper near `20 C`, triplanar near `25 C`, and branched near `35 C`; many hoppers were twinned | Elemental Bi has a hopper regime; supercooling changes habit; twins and branching are credible Candidate 2D physics; twinned hopper surfaces can support prismatic daughter growth                                                                                         | The target face indices, exact winding topology, universal thresholds, a claim that every hopper is twinned, or that the twin mechanism formed the hopper            |
| J. W. Steger and J. D. Price, "Edgy Growth: Preliminary Assessment of Sectioned Hopper Microstructure Using Synthetic Bismuth" (2018), [GSA abstract](https://gsa.confex.com/gsa/2018SC/webprogram/Paper310206.html)                                                                                                                                                        | `target class`: four roughly `1 cc` macroscopic bismuth hoppers grown downward from an upper melt-surface wire and sectioned in three orientations; purity/domain state unstated                                  | Bulk Bi forms isolated, deeply three-dimensional hoppers with irregular, convoluted internal outlines and upper-surface nucleation                                                                                                                                         | Surface-step dynamics, calibration, facet indices for the supplied images, or spiral/twin causation                                                                  |
| R. S. Wagner and H. Brown, "Growth of Bismuth Crystals from the Melt by a Twin Plane Mechanism" (1962), [AIME/OneMine record](https://www.onemine.org/documents/institute-of-metals-division-growth-of-bismuth-crystals-from-the-melt-by-a-twin-plane-mechanism), [official AIME volume catalog](https://aimehq.org/themes/custom/aime/doclibrary/transactions/vol224.html) | `mechanism only`: high-purity elemental Bi grown from a supercooled melt; accessible abstract discusses prismatic products apparently aided by a deformation twin, but does not state specimen scale              | Faceted growth, a possible twin, and its termination at the interface as a re-entrant step are necessary qualitative conditions; nucleation can occur at lower supercooling than ordinary two-dimensional facet nucleation and growth is usually fast parallel to the twin | A quantitative rate law, critical supercooling, mobility, recurrence rule, facet frame, target geometry, or a claim that the target winding bands are twin-generated |

Frawley and Steger/Price are the closest outside matches. Neither records the
complete surface evolution of the exact visual habit in the four supplied
images, so the images remain the morphology authority.

The accessible Wagner/Brown primary record is qualitative. It explicitly says
the listed conditions may be insufficient and that some interface morphologies
may require multiple twin planes for a self-perpetuating system. It supplies
no equation or coefficient for a recurring source. Candidate 2D may therefore
test one local re-entrant step, but it may not attribute an invented recurrence
or winding law to that paper.

## Elemental-bismuth structure and step evidence

| Source and specimen                                                                                                                                                                                              | Classification                                                                                 | Allowed claim                                                                                                                                   | Forbidden inference                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| L. Wei et al., "From a volatile molecular precursor to twin-free single crystals of bismuth" (2019), [RSC paper](https://pubs.rsc.org/en/content/articlelanding/2019/cc/c9cc02820j)                              | `structure only`: elemental Bi, vapor-grown tiny twin-free blocks                              | Ambient A7/rhombohedral structure and corrected lattice parameters; conventional melt cooling often yields stepped, twinned, or hopper crystals | Bulk-melt hopper shape, step source, facet frame, or calibration                           |
| T. Tokoro, S. Sugawara, and J. Watanabe, "In-situ Observation of Melt Growth Process of Bi (100) Thin Films" (1990), [J-STAGE paper](https://www.jstage.jst.go.jp/article/matertrans1989/31/9/31_9_759/_article) | `mechanism only`: `99.9%` and `99.9999%` elemental-Bi thin films, partially melted and regrown | Pure-Bi faceted interfaces can advance stepwise or steadily; melt growth can contain dislocations and other defects                             | Bulk hopper outline, winding terrace topology, a screw source, or macroscopic coefficients |
| W. A. Anthony et al., "Bismuth," [Handbook of Mineralogy](https://rruff.geo.arizona.edu/doclib/hom/bismuth.pdf)                                                                                                  | Context compilation: natural elemental Bi                                                      | Rhombohedral structure; hoppered/parallel groupings and common polysynthetic twinning are established bismuth context                           | A controlled synthetic growth law or target calibration                                    |

## Different specimens and generic mechanisms

| Source and actual specimen                                                                                                                                                                                                                                                | Classification                                                                                                                                        | Allowed claim                                                                                                                                       | Forbidden inference                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A. Luktuke et al., "Bismuth pyramid formation during solidification of eutectic tin-bismuth alloy using 4D X-ray microtomography" (2024), [Communications Materials](https://www.nature.com/articles/s43246-024-00538-9)                                                  | `incompatible habit`: microscopic primary Bi in Sn-58Bi solder, polycrystalline, one free-surface face plus three melt-facing `{1-102}` pyramid faces | Interface-reaction control, layer nucleation, free-surface/trijunction effects, and branching are hypotheses worth isolating in that specimen class | Candidate 2D's facet frame, six equal sides, pure-Bi calibration, or validation of the supplied rectilinear hopper habit |
| P. C. Bollada, P. K. Jimack, and A. M. Mullis, "Phase field modelling of hopper crystal growth in alloys" (2023), [Scientific Reports](https://www.nature.com/articles/s41598-023-38741-2), [author code](https://github.com/prepcb/PhaseField)                           | `numerical only`: generic cubic binary-alloy phase field with solute rejection                                                                        | Regression equations and a six-face cubic hopper test                                                                                               | Elemental-Bi mechanism, target shape, facet directions, winding topology, or calibration                                 |
| A. Karma and W.-J. Rappel, "Quantitative phase-field modeling of dendritic growth in two and three dimensions" (1998), [Physical Review E](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.57.4323), [author PDF](https://rappel.ucsd.edu/Publications/quan23.pdf) | `numerical only`: generic pure-melt dendritic solidification                                                                                          | Thermal phase-field and thin-interface mapping                                                                                                      | Faceted Bi hopper habit or winding ledges                                                                                |
| B. T. Helenbrook, "Solidification along a wall or free surface with heat removal" (2015), [Journal of Crystal Growth](https://www.sciencedirect.com/science/article/abs/pii/S0022024815001189)                                                                            | `mechanism only`: generic Stefan triple junction and ribbon-growth numerics                                                                           | A solid/liquid surface-flux jump may be required for a finite growth wedge                                                                          | Bismuth ledge birth, target facets, calibration, or the project's finite-volume stencil                                  |
| N. Bagheri-Sadeghi and B. T. Helenbrook, "Effects of the inert phase on solidification near a triple-phase line" (2024), [primary manuscript](https://par.nsf.gov/servlets/purl/10528507)                                                                                 | `mechanism only`: analytical three-phase heat transfer, validated with silicon ribbon growth                                                          | Separate inert-phase heat balances and temperature continuity at a triple line                                                                      | Bismuth geometry, spiral law, or a Candidate 2D source rule                                                              |
| M. Albani et al., "Competition Between Kinetics and Thermodynamics During the Growth of Faceted Crystal by Phase Field Modeling" (2019), [physica status solidi](https://onlinelibrary.wiley.com/doi/full/10.1002/pssb.201800518)                                         | `mechanism only`: deposited faceted micro/nanostructures, not bulk melt Bi                                                                            | Surface-adatom diffusion and orientation-dependent incorporation as an isolated nonlocal mechanism                                                  | Bulk hopper habit, trijunction law, or bismuth coefficients                                                              |
| O. Weinstein and S. Brandon, "Dynamics of partially faceted melt/crystal interfaces I" (2004), [Journal of Crystal Growth](https://doi.org/10.1016/j.jcrysgro.2004.04.108)                                                                                                | `mechanism only`: two-dimensional YAG/silicon step-source calculations                                                                                | Generic step-flow, two-dimensional nucleation, and defect-source operators                                                                          | A bulk-Bi outer source, whole-layer clock, target winding path, or calibration                                           |
| S. Amelinckx, "A dislocation mechanism for the growth of hopper crystal faces and the growth of salol crystals from solution and from the melt" (1953), [UGent record](https://biblio.ugent.be/publication/01HT203ADRJ1SGC499GSNMYZ2T)                                    | `mechanism only`: dislocation-based hopper growth in salol                                                                                            | A persistent dislocation is a physically meaningful winding-step hypothesis                                                                         | Proof that the supplied bismuth hoppers are screw-dislocation spirals                                                    |
| X. Liu et al., "Template-catalyst-free growth of single crystalline Bismuth nanorods by RF magnetron sputtering" (2009), [Solid State Communications](https://www.sciencedirect.com/science/article/abs/pii/S0038109808005905)                                            | `incompatible habit`: elemental-Bi vapor-solid nanorods at nanometer scale                                                                            | Elemental Bi can exhibit a proposed spiral-growth regime in a different process                                                                     | Macroscopic melt-hopper spiral causation or Candidate 2D geometry                                                        |

## Spiral conclusion

No current primary source directly follows a macroscopic, bulk-melt,
elemental-bismuth hopper like the four targets and attributes its rectilinear
winding bands to a screw dislocation. The defensible claims are narrower:

- bulk elemental Bi forms hopper and branched habits;
- many bulk hopper dendrites in one direct study were twinned;
- high-purity Bi can grow by a twin-plane re-entrant mechanism;
- pure-Bi melt interfaces can advance in steps and contain dislocations;
- screw-dislocation hopper growth exists in other materials and processes.

Candidate 2D must therefore reproduce a `continuous winding ledge` while
keeping screw, twin-plane, repeated-nucleation, and edge-driven sources as
separate hypotheses.

## Supplemental process and visual context

- R. Clark, "Environmental effects on single crystal growth in molten
  bismuth" (2019), [institutional abstract](https://scholarworks.lib.csusb.edu/osr/vol5/iss1/9/): molten-Bi growth and oxidation context, but no completed parameter study,
  indexed facets, or mechanism result.
- Mindat photo 159321, [synthetic concentric hopper](https://www.mindat.org/photo-159321.html): visual comparison only.
- Wikimedia Commons, [bismuth hopper crystal](https://commons.wikimedia.org/wiki/File:Bismuth_hopper_crystal.jpg): visual comparison only.

Use link-only supplemental images unless redistribution rights are confirmed.

## Runtime stack

- Three.js r185 pin: <https://github.com/mrdoob/three.js/releases/tag/r185>
- WebGPU renderer: <https://threejs.org/manual/en/webgpurenderer>
- TSL: <https://threejs.org/docs/TSL.html>
- Chrome WebGPU overview:
  <https://developer.chrome.com/docs/web-platform/webgpu/overview>
- Express static serving:
  <https://expressjs.com/en/5x/starter/static-files/>

The project pins `three@0.185.0`; do not change it without an explicit decision.
