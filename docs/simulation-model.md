# Simulation Model

## Product boundary

The product target is not a generic hopper, a hexagonal bismuth plate, or the
three-sided pyramid observed in eutectic Sn-Bi solder. It is the family of
bulk, iridescent bismuth hopper specimens supplied in `crystal_references/`.
The model must visibly generate that habit during growth from one connected
site. A connected specimen is not assumed to be one crystallographic domain;
direct bismuth evidence and the supplied references allow twins, branching,
and intergrown sectors.

Generic crystal algorithms may remain numerical or extraction scaffolding.
They may never define product geometry, facet directions, calibration, or
morphology acceptance. Mesh carving, stamped terraces, decorative spirals,
noise, smooth bowls, and overlapping cosmetic crystals cannot satisfy the
gate.

## Ground-truth target set

The user designated these four files as the visual morphology authority on
2026-07-13. Preserve the image bytes. Their hashes make the reviewed target set
unambiguous; changing a file requires an explicit target revision.

| File                                                               |      Pixels | SHA-256                                                            | Primary target evidence                                  |
| ------------------------------------------------------------------ | ----------: | ------------------------------------------------------------------ | -------------------------------------------------------- |
| [`crystal_small_1.jpg`](../crystal_references/crystal_small_1.jpg) | 1024 x 1024 | `dbcf1b49fa3a12f8944f95bbd49183b7b560a1c5c3b716c03cdf373b6b7ab061` | One dominant deep hopper, continuous winding ledges      |
| [`crystal_small_2.jpg`](../crystal_references/crystal_small_2.jpg) | 1024 x 1024 | `c6c70580a0ab3b57afbbf4792de6018024763265bcb6f4d3e8e988f31c0a7d7a` | Offset opening, interrupted and asymmetric bands         |
| [`crystal_small_3.jpg`](../crystal_references/crystal_small_3.jpg) |   946 x 946 | `3608fc058f0454f387b7e3963d89e6b236a28ca6764dba407d946ce675140200` | Intergrown sectors and strongly varied ledge widths      |
| [`crystal_small_4.jpg`](../crystal_references/crystal_small_4.jpg) | 1588 x 1588 | `719707a2cf1ebd9125fb3d2e5c356c2b5a58205b538b19180f3fe5ff2ffd09d0` | Branched connected structure and irregular nested ledges |

The photographs establish visible morphology, not crystallographic indices,
purity, domain count, or a defect mechanism. `Rhombohedral` has two distinct
uses here:

- Ambient elemental bismuth has the rhombohedral A7 crystal structure.
- The target has a visually rectilinear or rhombohedral-pyramidal macroscopic
  habit.

The first fact does not derive the second. Do not map the unit cell directly
into an outer support shape or attach Miller indices to photographed faces
without target-matched evidence.

## Observable morphology contract

Every accepted candidate must reproduce all of these target traits:

- A dominant blocky, rectilinear, or visually rhombohedral-pyramidal sector;
  projected ledges commonly make approximately right-angle turns.
- A deep open hopper recession with a strong rim-over-core relationship.
- Many stepped bands joined into a continuous winding or spiral-like path
  across successive elevations, not merely two or three complete rings.
- Uneven terrace widths, offsets, interruptions, partial fronts, and visible
  asymmetry while the solid remains connected.
- A single dominant sector matching references 1 and 2 at the first gate.
- Connected branching or intergrowth matching references 3 and 4 at the later
  multi-sector gate.

The word `spiral` describes the visible winding topology only. No current
target-matched primary source proves that a screw dislocation causes the
macroscopic bands. Until that changes, use `winding ledge` in model claims and
treat screw-dislocation, twin-plane, repeated-nucleation, and edge-driven
sources as competing mechanisms.

These habits are explicit rejection outcomes:

- a regular six-sided or hexagonal plate;
- a simple three-sided Sn-Bi pyramid;
- a generic cube or six-face cubic hopper;
- complete concentric or homothetic closed rings;
- a shallow central dimple or smooth bowl;
- perfect repeated symmetry used to substitute for irregular ledge growth;
- generic dendrites, compounds, films, nanorods, or decorative intergrowths.

Iridescent oxide color is a rendering target. It never supplies shape or hides
a failed growth model.

## Source-import gate

Before a source changes an equation, facet, boundary, coefficient, or
acceptance rule, record these fields in `docs/references.md`:

1. composition and purity;
2. growth phase and route;
3. specimen scale and dimensional constraint;
4. observed external habit;
5. single-domain, twinned, polycrystalline, or unknown state;
6. exact allowed claim and forbidden inference.

Classify the result as target-shape evidence, target-process evidence,
mechanism-only, numerical-only, or incompatible. Only target-shape evidence
may define product geometry. A mismatch does not make a source useless, but it
forces the imported claim into an isolated mechanism or numerical test. No
chain of several mismatched papers can be combined to imply a target-matched
habit.

## Candidate decisions

### Generic cubic scaffold

Bollada, Jimack, and Mullis model a cubic binary-alloy hopper driven by solute
transport. It remains regression scaffolding for solver, controller, and
extraction behavior. Elemental bismuth has no solute-rejection field of that
kind, and the generic cubic carrier cannot enter product morphology review.

### Candidate 1 - rejected

The direct rhombohedral remapping used lattice translations as surface-energy
generators, retained generic calibration, and produced a boundary-limited
body. The rhombohedral unit cell does not authorize that macroscopic habit.

### Candidate 2A - mechanism evidence only

The thermal phase-field path established conservative pure-melt enthalpy,
variational anisotropy, and a phase-specific free-surface heat boundary. Its
first 3D screen stayed connected and finite but grew the center ahead of the
rim, producing no hopper opening. A resolved discriminator then showed smooth
phase-field healing overwhelming the opening drive. Candidate 2A cannot carry
discrete target ledges.

Its former `bismuthSlowFacetNormals` name was incorrect in scope. The function
is now `snBiPyramidFacetNormals`: its `{1-102}` family comes from microscopic,
polycrystalline Sn-Bi pyramids and is retained only for old evidence. It must
not define Candidate 2D.

### Candidate 2B - generic mechanism evidence only

The surface-adatom isolation demonstrates that nonlocal tangential transport
can create a perimeter-over-core signal. Its deposited-faceted-crystal source
is neither bulk melt growth nor bismuth calibration, so it cannot set the
target habit or active coefficients.

### Candidate 2C - rejected product habit

Candidate 2C successfully demonstrated exact swept-volume/latent accounting,
a conservative reduced cold-content driver, deterministic explicit ledges,
and a visible CPU-carrier-to-WebGPU extraction seam. Those are reusable
patterns, not morphology approval.

The carrier was incompatible with the target by construction:

- three Sn-Bi `{1-102}` directions were projected into the display plane;
- each opposite direction was added and every support was assigned the same
  inradius, guaranteeing a centered regular hexagon;
- every ledge used one scalar offset against all six supports, guaranteeing
  complete concentric homothetic loops;
- whole loops were born and advanced uniformly, so no step head, interrupted
  front, unequal edge speed, or continuous winding path could exist;
- the scalar carrier extruded a polygon base plus complete annular prisms, not
  sloped rhombohedral-pyramidal hopper faces.

Candidate 2C is therefore closed despite its valid numerical proof. Its direct
GPU reconstruction task is canceled. The evidence fixture is available only
through `?mode=candidate2c-evidence` and must remain labeled as retired.

## Direct bismuth constraints for Candidate 2D

The current source audit establishes a narrower set of defensible constraints:

- Frawley, Maurer, and Childs used `99.999+%` bulk bismuth and reported a
  supercooling-dependent sequence from prismatic to hopper, triplanar, and
  branched growth. Many hopper dendrites were twinned, but their twin-plane
  claim concerns prismatic daughter growth from a twinned hopper surface. This
  is direct evidence for material, bulk-melt route, a hopper regime, branching,
  and a possible local twin contribution; it does not show that a twin formed
  the hopper or index every target face.
- Steger and Price grew four macroscopic three-dimensional bismuth hoppers
  downward from an upper melt-surface nucleation point. Section outlines became
  irregular and convoluted through depth. This supports a complex connected
  bulk carrier, not a surface step law or coefficient set.
- Tokoro, Sugawara, and Watanabe directly observed faceted, sometimes stepwise
  advance in pure-Bi melt-regrown thin films. This supports discrete step
  kinetics as a mechanism, not the bulk outer habit.
- Wagner and Brown reported high-purity bismuth crystals apparently growing
  from a supercooled melt with the aid of a deformation twin. They proposed
  that a twin terminating at a faceted interface can form a re-entrant step.
  Their accessible record is qualitative, discusses prismatic products, warns
  that the necessary conditions may be insufficient, and supplies no
  recurrence law or coefficient. This makes one local twin-source isolation
  credible, not a hopper or winding model.
- No current matching primary source demonstrates that the target's winding
  macroscopic ledges are generated by a screw dislocation.

The full applicability matrix and links live in `docs/references.md`.

## Candidate 2D target-habit ledge model

Candidate 2D begins with observable topology and keeps its unresolved source
mechanism explicit. It is a replacement carrier, not Candidate 2C with four
supports.

### Required state

The smallest single-sector state must contain:

- a sloped rectilinear or visually rhombohedral-pyramidal outer envelope with
  independently configurable support planes and no assumed Miller indices;
- an ordered ledge path made of explicit partial segments;
- one or more step heads with position, direction, elevation, birth source,
  and deterministic local advance;
- approximately right-angle direction changes without requiring a closed loop;
- incomplete or interrupted fronts and per-segment advancement;
- one connected swept-solid representation and exact accumulated area, volume,
  and latent-energy ledgers.

Changing six supports to four is insufficient. Candidate 2C's loop ordinal,
area formula, birth clock, perimeter-averaged temperature, topology checks, and
annular scalar all assume a complete homothetic loop and must not be reused as
Candidate 2D geometry.

For step height `h` and actual newly swept planar region `Delta A`, the only
allowed geometry-to-energy coupling is

```text
Delta V = h Delta A
Delta Q_latent = L Delta V
```

`Delta A` must be derived from the advanced path segments, including clipped
corners and partial fronts. It cannot be inferred from a loop count or stamped
profile. A reduced cold-content driver may be reused only if this same
`Delta V` pays back latent heat exactly once.

### Representation checkpoint and rejected carrier

The first Candidate 2D implementation uses four cyclic support planes with
independent offsets. For active side `i`, let `O0` and `O1` be the endpoints
of its current outer support edge and `I0` and `I1` the endpoints after moving
only that support inward by the active terrace width. At normalized head
progress `p`, the advancing front is

```text
O(p) = (1 - p) O0 + p O1
I(p) = (1 - p) I0 + p I1
```

and the actual new partial region is the clipped trapezoid
`[O0, O(p), I(p), I0]`. The declared head is `O(p)`, so it lies on the same
front that defines swept area. When the side completes, `O1 -> I1` becomes a
forward corner connector and `I1` is the next side's start. This produces one
continuous open route without the backtracking connectors or corner crossings
created by projecting a full-strip tangent extreme onto the inner edge.

Polygon area is evaluated directly with the shoelace formula. Each advance
independently accumulates `Delta A`, `h Delta A`, and `L h Delta A`; global
values are sums of the per-ledge ledgers rather than recomputed aliases. The
development scalar unions those non-overlapping patch prisms with a closed
four-plane sloped base. This carrier is extraction-only and does not feed back
into ledge state.

The representation passes continuity, non-self-contact, partition invariance,
per-ledge conservation, connected-solid, open-core, and extraction-refinement
checks. It is rejected as product morphology. Time-staggered copies of one
prescribed planar route create only four visible elevations and a broad,
shallow terrace stack over a flat central floor. The result does not have the
deep rim-over-core structure or many persistent bands in references 1 and 2.
Increasing height, births, widths, camera contrast, or material response would
only tune prescribed geometry and is forbidden as a Candidate 2D fix.

The reusable result is narrower: the compact state and model-neutral
extraction seam can represent partial fronts correctly. The next candidate
must make a declared local source state generate the 3D ledge supply and must
pass morphology before this carrier is considered for production residency.

### Twin-plane local-source checkpoint

The twin-plane discriminator represents a local two-dimensional section, not
a target-shaped sector. Two facet rays meet at a shared interface vertex. A
solid-interior sample selects which angular sector is solid, so the intersection
is re-entrant only when that sector exceeds `pi`. A nondegenerate twin segment
must lie in the solid and have exactly one endpoint at the interface vertex.
Wagner/Brown supplies qualitative eligibility criteria; the explicit
two-dimensional angle and segment tests below are this project's local
operationalization:

```text
g_twin = faceted
         and twin_present
         and twin_terminates_at_interface
         and twin_lies_in_solid
         and growth_direction_lies_in_liquid
         and solid_angle > pi
```

The paper supplies no kinetic equation. The isolation therefore declares the
dimensionless project closure

```text
dx/dt = mu g_twin max(theta, 0)
Delta A = ell Delta x
Delta V = h Delta A
Delta Q_latent = L Delta V
C theta = C theta_0 + Q_removed - Q_latent
```

Here `ell` is the independent out-of-section length of the local twin/facet
intersection. The eligibility rays live only in the perpendicular section;
`Delta A` is the facet strip swept by extruding front travel along `ell`, not a
same-section rectangle crossing the solid sector. `theta` is signed local
thermal driving and `mu` is not a measured bismuth mobility. Signed
heat-removal impulses provide the external term, and the reduced ODE is
integrated in closed form between an impulse and front completion. Reversed
driving stops the growth-only front; no unsupported dissolution law is
implied.

The frozen positive arm emits exactly one front at the computed twin/facet
intersection, advances it parallel to the twin through the local facet strip,
and closes swept-area, volume, latent, and cold-content ledgers independently.
Removing the twin, moving it off the interface, placing it outside the solid,
pointing its continuation back into solid, changing the solid sector to a
non-re-entrant corner, removing faceting, setting zero driving, or reversing
thermal driving yields no event and no swept volume. Arbitrary elapsed-time
partitioning preserves the same physical and ledger state, and a signed
heat-addition reversal stalls an already emitted front without changing its
accumulated volume.

For the mandatory 3D closeout, the extraction-only carrier is exactly the
swept strip. With source point `p`, unit growth direction `g`, observational
in-section perpendicular `n = (-g_y, g_x)`, and out-of-section axis `e_z`, its
solid set is

```text
p + u g + v n + w e_z
0 <= u <= x, |v| <= h/2, |w| <= ell/2
```

The perpendicular `n` only embeds the two-dimensional isolation in the fixed
review volume; it is not a sourced crystallographic normal. The carrier adds
no base, hopper body, ledge recurrence, or target-shaped mask. Its analytic
volume is therefore exactly `x h ell`, the same volume already paid by the
source ledger. Source-null, zero-driving, and initially reversed states map to
an empty scalar. A post-emission reversal maps to the unchanged accumulated
strip because the model declares growth arrest rather than dissolution.

This passes the local eligibility and null/reversal isolation only. The
accessible evidence provides no self-perpetuation law, so the implementation
deliberately emits one event and cannot test recurring or multi-twin supply.
Persistent winding from a twin source remains unresolved, and target-source
promotion is unsupported at the current evidence boundary. This does not
physically falsify twin-mediated growth. The one-front state must not be
connected to the rejected winding carrier or promoted as target geometry. Its
diagnostic 3D closeout passes source-state, scalar, and WebGPU extraction
checks but visibly fails all four references: one strip contains no hopper
opening, recurring elevations, winding ledges, or intergrowth.
Edge/free-surface supply is the next evidence-backed exploration;
screw-dislocation supply remains on hold.

### Competing source mechanisms

Candidate 2D must isolate these alternatives before combining any of them:

| Hypothesis                           | Current evidence                                                                                        | Required discriminator                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twin-plane re-entrant source         | One local source passes; recurring or multi-twin supply remains unresolved                              | Promotion remains unsupported without target-matched persistent winding dynamics                                                                    |
| Screw-dislocation source             | Generic hopper/spiral literature and different-regime Bi evidence only                                  | A target-matched source or result must link one persistent step head to the macroscopic winding ledge                                               |
| Repeated two-dimensional nucleation  | Generic step-flow and different-specimen Sn-Bi evidence                                                 | Independent births must still form one connected winding sequence rather than complete rings                                                        |
| Edge/free-surface-driven step supply | Wire-seeded bulk-Bi growth from an upper surface plus generic finite-wedge reasoning; no recurrence law | Active next isolation: one real seeded contact line may emit one conservative local front; persistent births and route selection remain unsupported |

Failure of one hypothesis is evidence about that mechanism, not permission to
blend the others until the result looks right.

## Candidate 2D acceptance gates

The first fixed-view carrier comparison was rejected without changing its
predeclared thresholds. Freeze a new numeric schedule before inspecting each
source-driven candidate.

Every scientific slice concludes with a deterministic 3D generation and
fixed-view comparison beside all four target images, including slices rejected
by a source, conservation, topology, or morphology gate. References 1 and 2
remain the formal single-sector acceptance pair. References 3 and 4 are
mandatory regression context until branching/intergrowth becomes active, at
which point their traits become formal acceptance gates.

Every single-sector proof against references 1 and 2 must test:

- projected outer-frame classification and explicit rejection of stable
  sixfold or three-sided symmetry;
- normalized opening depth and rim-over-core height;
- ledge-path continuity across elevations, non-self-intersection, and number of
  direction changes;
- distribution of terrace widths and offsets, including at least one partial
  or interrupted front;
- connected solid, monotonic swept volume, exact latent-energy closure, and
  adequate domain clearance;
- time/grid refinement of the actual path state and extraction carrier;
- a fixed-view image comparison in which appearance cannot override failed
  topology or conservation.

Only after that gate passes may Candidate 2D add connected sector branching or
intergrowth and compare it with references 3 and 4. Multiple orientations need
a documented domain or twin representation with shared transport; they cannot
be overlapping cosmetic meshes.

## Reusable runtime boundary

The GPU marching-cubes classifier, compaction, vertex emission, normals,
surface age, capacity handling, indirect drawing, imperative controller, and
model-neutral development snapshot bridge remain valid infrastructure. The
public root stays neutral. Candidate 2D may use the CPU snapshot bridge for one
fixed development proof, but production still requires compact GPU-resident
state and no recurring full-volume upload or readback.

## Numerical rules

- Treat grid spacing and time step together and reject unstable explicit
  configurations before dispatch.
- Keep internal randomness seeded and deterministic.
- Do not hide instability with unreviewed clamping, smoothing, remeshing, or
  artistic post-processing.
- Keep scientific failure separate from harness, extraction, or WebGPU
  failure.
- Record deliberate departures from a compatible source near the equations
  they affect; do not preserve run transcripts as documentation.
- Repeat the source audit whenever an equation, coefficient, facet, boundary,
  domain assumption, or morphology claim changes.
