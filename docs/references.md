# References

## Applicability

Local photos = visual ground truth; outside sources constrain explanations,
never overrule targets. Before use, record composition/purity, route, scale/
dimension, habit, domain, allowed claim, forbidden inference.

Classes:

- `target class`: bulk elemental-Bi melt hopper.
- `structure only`: elemental Bi; wrong route/habit.
- `mechanism only`: relevant effect; mismatched specimen.
- `numerical only`: equation/discretization; no target habit.
- `incompatible habit`: visibly different; cannot define geometry.

Only matched observed target-class traits constrain product-habit hypotheses.
Generic/mismatched sources never set Candidate 2E geometry, indices,
coefficients, acceptance. Multiple mismatches != one match.

## Ground-truth photos

| Reference / specimen                                                                                       | Allow                                                                           | Forbid                                                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`crystal_small_1.jpg`](../crystal_references/crystal_small_1.jpg); user target, provenance/domain unknown | Deep rectilinear/rhombohedral-pyramidal hopper; dominant sector; winding ledges | Indices, purity, coefficients, screw cause                   |
| [`crystal_small_2.jpg`](../crystal_references/crystal_small_2.jpg); same, unknown                          | Offset deep opening; interrupted/asymmetric bands                               | Perfect centered loops; identified defect                    |
| [`crystal_small_3.jpg`](../crystal_references/crystal_small_3.jpg); same, domain unknown                   | Connected intergrown sectors; varied widths                                     | Decorative independent crystals; assumed single domain       |
| [`crystal_small_4.jpg`](../crystal_references/crystal_small_4.jpg); same, domain unknown                   | Connected branching; irregular nested ledges/deep recesses                      | Cosmetic branching; generic dendrite substitute              |
| [`crystal_multiseed_giant.jpg`](../crystal_references/crystal_multiseed_giant.jpg); same, domain unknown   | Many visibly different local frames; mutual occlusion/intergrowth               | Seed/grain/twin count; indexed orientation; cosmetic overlap |

Visible traits only. Hash/pixel manifest: `docs/simulation-model.md`.

## Direct bulk elemental Bi

| Source / classification                                                                                                                                                                                                                                                                                                                                                                                                                                    | Allow                                                                                                                                                        | Forbid                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Frawley, Maurer, Childs, "Vacuum Decanting of Bismuth and Bismuth Alloys," AIME 242 (1968), [catalog](https://aimehq.org/themes/custom/aime/doclibrary/transactions/vol242.html). `target class`: `99.999+%` bulk Bi; supercooled/decanted; prismatic near `10 C`, hopper `20 C`, triplanar `25 C`, branched `35 C`; many hoppers twinned                                                                                                                  | Elemental-Bi hopper regime; supercooling changes habit; credible twin/branch physics; twinned hopper surface can support prismatic daughters                 | Target indices/winding; universal thresholds; all hoppers twinned; twin formed hopper                            |
| Steger, Price, "Edgy Growth: Preliminary Assessment of Sectioned Hopper Microstructure Using Synthetic Bismuth" (2018), [abstract](https://gsa.confex.com/gsa/2018SC/webprogram/Paper310206.html). `target class`: suspended steel-wire nucleation point; four about `1 cc` macroscopic hoppers crystallized downward from upper melt surface; purity/domain unknown                                                                                       | Isolated deep 3D bulk hoppers; irregular/convoluted interiors; wire-seeded upper-surface origin; downward growth                                             | Advancing contact-line law, spontaneous birth, recurrence, route, rate, calibration, target indices/cause        |
| Wagner, Brown, "Growth of Bismuth Crystals from the Melt by a Twin Plane Mechanism" (1962), [record](https://www.onemine.org/documents/institute-of-metals-division-growth-of-bismuth-crystals-from-the-melt-by-a-twin-plane-mechanism), [catalog](https://aimehq.org/themes/custom/aime/doclibrary/transactions/vol224.html). `mechanism only`: high-purity Bi, supercooled melt, scale unstated; prismatic products apparently aided by deformation twin | Faceting + possible twin terminating at interface as re-entrant step; lower supercooling than ordinary 2D nucleation possible; usually fast parallel to twin | Rate law, critical supercooling, mobility, recurrence, facet frame, target geometry, target bands twin-generated |

Frawley + Steger/Price are closest outside matches; neither records full
evolution of exact photo habit. Photos remain authority. Wagner/Brown is
qualitative: conditions may be insufficient; some interfaces may need multiple
twins for self-perpetuation; no recurring-source equation/coefficient. Permit
one local re-entrant isolation only; never attribute invented recurrence.

Edge audit: Steger/Price supplies seed, upper-surface origin, downward direction
only. Generic triple-line work supplies local heat-transfer constraints, not a
Bi source law. Permit one existing seed + one signed Stefan front only; never
infer contact-line motion, later births, persistence, or route selection.

## Elemental-Bi structure/steps

| Source / classification                                                                                                                                                                                                                                                   | Allow                                                                                                        | Forbid                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Wei et al., "From a volatile molecular precursor to twin-free single crystals of bismuth" (2019), [paper](https://pubs.rsc.org/en/content/articlelanding/2019/cc/c9cc02820j). `structure only`: elemental-Bi vapor-grown tiny twin-free blocks                            | Ambient A7/rhombohedral structure, corrected lattice; conventional melt cooling often stepped/twinned/hopper | Bulk-melt shape, source, facet frame, calibration            |
| Tokoro, Sugawara, Watanabe, "In-situ Observation of Melt Growth Process of Bi (100) Thin Films" (1990), [paper](https://www.jstage.jst.go.jp/article/matertrans1989/31/9/31_9_759/_article). `mechanism only`: `99.9%`/`99.9999%` Bi thin films, partially melted/regrown | Pure-Bi faceted interfaces advance stepwise/steadily; melt growth may contain defects                        | Bulk outline/winding, screw source, macroscopic coefficients |
| Anthony et al., "Bismuth," [Handbook of Mineralogy](https://rruff.geo.arizona.edu/doclib/hom/bismuth.pdf). Natural elemental-Bi context                                                                                                                                   | Rhombohedral structure; hopper/parallel groups; common polysynthetic twins                                   | Controlled synthetic law/calibration                         |

## Mismatched/generic evidence

| Source / classification                                                                                                                                                                                                                                                                                                            | Allow                                                                                                              | Forbid                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Luktuke et al., "Bismuth pyramid formation during solidification of eutectic tin-bismuth alloy using 4D X-ray microtomography" (2024), [paper](https://www.nature.com/articles/s43246-024-00538-9). `incompatible habit`: microscopic primary Bi in Sn-58Bi; polycrystalline; one free-surface + three melt-facing `{1-102}` faces | Isolate interface-reaction control, layer nucleation, free-surface/trijunction, branching hypotheses in that class | Candidate 2E facets/six sides/pure-Bi calibration/target validation |
| Bollada, Jimack, Mullis, "Phase field modelling of hopper crystal growth in alloys" (2023), [paper](https://www.nature.com/articles/s41598-023-38741-2), [code](https://github.com/prepcb/PhaseField). `numerical only`: cubic binary-alloy phase field + solute rejection                                                         | Regression equations; six-face cubic test                                                                          | Elemental-Bi mechanism/shape/facets/winding/calibration             |
| Karma, Rappel, "Quantitative phase-field modeling of dendritic growth in two and three dimensions" (1998), [paper](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.57.4323), [PDF](https://rappel.ucsd.edu/Publications/quan23.pdf). `numerical only`: generic pure-melt dendrite                                           | Thermal phase field; thin-interface mapping                                                                        | Faceted Bi hopper/winding                                           |
| Helenbrook, "Solidification along a wall or free surface with heat removal" (2015), [paper](https://www.sciencedirect.com/science/article/abs/pii/S0022024815001189). `mechanism only`: generic Stefan triple junction/ribbon numerics                                                                                             | Finite wedge requires surface-flux jump or growth angle; local Stefan constraint                                   | Bi source/birth/route/rate/facets/calibration; project stencil      |
| Bagheri-Sadeghi, Helenbrook, "Effects of the inert phase on solidification near a triple-phase line" (2024), [manuscript](https://par.nsf.gov/servlets/purl/10528507). `mechanism only`: analytic three-phase heat transfer; silicon ribbon validation                                                                             | Three-phase conductivities/angles affect local temperature-gradient behavior                                       | Bi geometry/spiral/source/recurrence rule                           |
| Albani et al., "Competition Between Kinetics and Thermodynamics During the Growth of Faceted Crystal by Phase Field Modeling" (2019), [paper](https://onlinelibrary.wiley.com/doi/full/10.1002/pssb.201800518). `mechanism only`: deposited faceted micro/nanostructures                                                           | Isolated surface-adatom diffusion + anisotropic incorporation                                                      | Bulk hopper/trijunction/Bi coefficients                             |
| Weinstein, Brandon, "Dynamics of partially faceted melt/crystal interfaces I" (2004), [paper](https://doi.org/10.1016/j.jcrysgro.2004.04.108). `mechanism only`: 2D YAG/silicon step-source calculations                                                                                                                           | Generic step flow, 2D nucleation, defect-source operators                                                          | Bulk-Bi outer source/layer clock/winding/calibration                |
| Amelinckx, "A dislocation mechanism for the growth of hopper crystal faces and the growth of salol crystals from solution and from the melt" (1953), [record](https://biblio.ugent.be/publication/01HT203ADRJ1SGC499GSNMYZ2T). `mechanism only`: salol dislocation hopper                                                          | Persistent dislocation = plausible winding-step hypothesis                                                         | Supplied Bi targets are screw spirals                               |
| Liu et al., "Template-catalyst-free growth of single crystalline Bismuth nanorods by RF magnetron sputtering" (2009), [paper](https://www.sciencedirect.com/science/article/abs/pii/S0038109808005905). `incompatible habit`: elemental-Bi vapor-solid nanorods                                                                    | Proposed Bi spiral regime in different process                                                                     | Macroscopic melt-hopper spiral/Candidate 2E geometry                |

## Cellular-automata numerics

All entries below are `numerical only` or mismatched mechanism evidence. They
authorize architecture/validation methods, never Bi habit, parameters, facets,
or source cause.

| Source / domain                                                                                                                                                                                                                                                                                                                    | Allow                                                                                                                                                                                                | Forbid                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Libbrecht, "Physically Derived Rules for Simulating Faceted Crystal Growth using Cellular Automata" (2008), [paper](https://arxiv.org/abs/0807.2616), [PDF](https://www.its.caltech.edu/~atomic/publist/automatarules5.pdf). Ice from vapor                                                                                        | Local diffusion, interface mass accumulation/cell conversion, attachment anisotropy, grid/time stability, macrostep capability                                                                       | Bi transport/attachment law, parameters, facet frame, target morphology                           |
| Kelly, Boyer, "Physical improvements to a mesoscopic cellular automaton model for three-dimensional snow crystal growth" (2014), [paper](https://arxiv.org/abs/1308.4910). 3D ice from vapor                                                                                                                                       | 3D crystal/boundary/medium states; supply relaxation; explicit warnings on grid symmetry/free parameters                                                                                             | Bi mechanism; morphology by parameter search                                                      |
| Gandin, Rappaz, "Stochastic Modelling of Solidification Grain Structures" (1995), [paper](https://www.jstage.jst.go.jp/article/isijinternational1989/35/6/35_6_651/_article). Alloy grain solidification                                                                                                                           | Random per-seed frames; shared thermal field; growth competition/impingement                                                                                                                         | Bismuth hopper rule; dendrite envelope as target geometry                                         |
| Natsume, Ohsasa, "Three-dimensional Cellular Automaton Model for the Prediction of Microsegregation in Solidification Grain Structures" (2014), [paper](https://www.jstage.jst.go.jp/article/isijinternational/54/2/54_415/_html/-char/en). Al-Si grains                                                                           | Owner/boundary cell state; decentered capture; local supply/temperature coupling                                                                                                                     | Bi solute model, octahedral target habit                                                          |
| Yu et al., "A multi-grid Cellular Automaton model for simulating dendrite growth" (2021), [paper](https://arxiv.org/abs/2105.11143). Additive-manufacturing dendrites                                                                                                                                                              | Arbitrary frame vs storage grid; rotated/decentered capture validation                                                                                                                               | Per-seed grids required before simpler method fails; Bi morphology                                |
| Stefan-Kharicha et al., "Impact of hydrodynamics on growth and morphology of faceted crystals" (2020), [paper](https://www.sciencedirect.com/science/article/pii/S0022024820301901). Fe-Al crystal in Zn melt                                                                                                                      | Facet-front orientation independent of Eulerian mesh; shared flow/transport concept                                                                                                                  | Its facet set, kinetics, flow law, or habit as Bi evidence                                        |
| c0re-i5, `3d-cellular-automata` `crystal_hopper`, [repository](https://github.com/c0re-i5/3d-cellular-automata), [frozen rule](https://github.com/c0re-i5/3d-cellular-automata/blob/5a913075302d553dedf18ea90f99237e68527533/simulator.py#L2989-L3074). `numerical only`: experimental generic phase-field/CA; no matched specimen | 27-neighbor isotropic stencil; frame-local normal/orientation; eighth-power singular kinetic interpolation; local-field depletion as an edge-vs-face screening hypothesis; deterministic checkpoints | Cubic facet family, coefficients, undercooling scale, defect noise, Bi mechanism/shape/acceptance |

## Winding conclusion

No current primary source follows a matching macroscopic bulk-melt elemental-Bi
hopper and assigns its rectilinear winding bands to screw dislocation. Defensible:

- Bulk elemental Bi forms hopper/branched habits.
- One direct study: many hopper dendrites twinned.
- High-purity Bi can use twin-plane re-entrant growth.
- Pure-Bi melt interfaces can step and contain defects.
- Screw-driven hopper growth exists in other materials/processes.

Therefore require `continuous winding ledge`; isolate screw, twin, repeated
nucleation, edge supply as separate hypotheses.

Strategy boundary: target-class sources provide final habits, regime changes,
twinning incidence, seed location, and growth direction, but no time-resolved
band source/path. Elemental-Bi step/layer-spreading evidence does not select its
source. No persistent-source or route-selection law is evidence-backed.

2E.2 sparse-source schedules therefore test a numerical representation only.
Wagner/Brown permits imperfection-aided facet-layer nucleation as a category;
Tokoro et al. permits stepwise pure-Bi facet advance. Neither permits a birth
period/probability, source location, persistence, winding, or target geometry.

Research closure: repeated source cycles found no target-matched time-resolved
primary study that supplies the missing persistent source + winding route.
Further open-ended search for that same paper is an objective dead end for this
project. Reopen only for a newly identified target-class primary source; do not
reinterpret generic/mismatched work as cumulative support.

## Supplemental context

- Clark, "Environmental effects on single crystal growth in molten bismuth"
  (2019), [abstract](https://scholarworks.lib.csusb.edu/osr/vol5/iss1/9/):
  growth/oxidation context; no completed parameters, indexed facets, mechanism.
- Mindat [synthetic concentric hopper](https://www.mindat.org/photo-159321.html):
  visual only.
- Wikimedia [bismuth hopper](https://commons.wikimedia.org/wiki/File:Bismuth_hopper_crystal.jpg):
  visual only.

Supplemental images: link only unless redistribution rights confirmed.

## Runtime sources

- [Three.js r185](https://github.com/mrdoob/three.js/releases/tag/r185)
- [WebGPU renderer](https://threejs.org/manual/en/webgpurenderer)
- [TSL](https://threejs.org/docs/TSL.html)
- [Chrome WebGPU](https://developer.chrome.com/docs/web-platform/webgpu/overview)
- [Express static serving](https://expressjs.com/en/5x/starter/static-files/)

Pin `three@0.185.0`; change only by explicit decision.
