# Simulation Model

## Product boundary

Target: connected growth of the bulk iridescent Bi hopper family in
`crystal_references/`; not generic hopper, hexagonal plate, or Sn-Bi pyramid.
Connected != single crystallographic domain; twins/branches/intergrowth allowed.

Generic algorithms: numerical/extraction scaffolds only. Never derive product
geometry, facets, calibration, acceptance. Reject carving, stamped terraces,
decorative spirals/noise/bowls/intergrowth.

## Ground truth

User-designated morphology authority, 2026-07-13. Preserve bytes; hash change
requires explicit target revision.

| File                                                                               |      Pixels | SHA-256                                                            | Trait                                                                 |
| ---------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`crystal_small_1.jpg`](../crystal_references/crystal_small_1.jpg)                 | 1024 x 1024 | `dbcf1b49fa3a12f8944f95bbd49183b7b560a1c5c3b716c03cdf373b6b7ab061` | Deep dominant hopper; winding ledges                                  |
| [`crystal_small_2.jpg`](../crystal_references/crystal_small_2.jpg)                 | 1024 x 1024 | `c6c70580a0ab3b57afbbf4792de6018024763265bcb6f4d3e8e988f31c0a7d7a` | Offset opening; interrupted asymmetric bands                          |
| [`crystal_small_3.jpg`](../crystal_references/crystal_small_3.jpg)                 |   946 x 946 | `3608fc058f0454f387b7e3963d89e6b236a28ca6764dba407d946ce675140200` | Intergrown sectors; varied widths                                     |
| [`crystal_small_4.jpg`](../crystal_references/crystal_small_4.jpg)                 | 1588 x 1588 | `719707a2cf1ebd9125fb3d2e5c356c2b5a58205b538b19180f3fe5ff2ffd09d0` | Branched connected structure; irregular nested ledges                 |
| [`crystal_multiseed_giant.jpg`](../crystal_references/crystal_multiseed_giant.jpg) |   894 x 894 | `771d0b274afaf01f0ca6fa1bcf76826be998849035aa22c14d525e45b3b9c630` | Many differently framed, mutually occluding/intergrown hopper sectors |

Photos authorize visible morphology only; not indices, purity, domain count,
mechanism. Distinguish rhombohedral A7 structure from visually
rhombohedral-pyramidal macroscopic habit. Never map unit cell -> envelope or
assign photographed-face Miller indices without matching evidence.

## Morphology contract

Require:

- Dominant blocky rectilinear/visually rhombohedral-pyramidal sector; roughly
  right-angle projected turns.
- Deep open recess; strong rim-over-core.
- Many elevations joined as continuous winding/spiral-like path; not 2-3 rings.
- Uneven widths/offsets, interruptions, partial fronts, asymmetry; connected.
- First gate: one dominant sector vs references 1-2.
- Later: connected branching/intergrowth/arbitrary frames vs 3-5.

`Spiral` = visible topology only. No matching source proves screw causation.
Claim `winding ledge`; keep screw, twin, repeated nucleation, edge supply as
separate hypotheses.

Reject: regular hexagon; three-sided Sn-Bi pyramid; generic cubic hopper;
closed concentric/homothetic rings; shallow dimple/bowl; perfect repeated
symmetry; generic dendrite/compound/film/nanorod/decorative intergrowth.
Iridescence renders shape; never supplies/conceals it.

## Source-import gate

Before importing equation/facet/boundary/coefficient/acceptance, record in
`docs/references.md`: composition/purity; phase/route; scale/dimensionality;
habit; domain state; allowed claim; forbidden inference. Classify `target
class`, `structure only`, `mechanism only`, `numerical only`, `incompatible
habit`. Only target-shape evidence defines geometry. Several mismatches never
sum to a target match.

## Retired candidate ledger

Code, tests, and review fixtures removed 2026-07-14. Summary only; none may
define active geometry, kinetics, facets, or acceptance.

| Work                 | Scope / approach                                             | Result                                                                                     |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Generic cubic        | Published binary-alloy solute phase field                    | Solver/extraction regression only; wrong material/habit                                    |
| Candidate 1          | Mapped A7 lattice translations into surface anisotropy       | Rejected: translations are not facet normals; boundary-limited wrong body                  |
| Candidate 2A         | Pure-thermal enthalpy, anisotropy, free-surface boundary     | Local math passed; smooth center-first healing cannot preserve a hopper opening            |
| Candidate 2B         | Generic surface-adatom nonlocal transport                    | Perimeter signal possible; wrong route/material/calibration                                |
| Candidate 2C         | Sn-Bi-derived six-support thermal ledges + annular carrier   | Conservation/extraction passed; forced centered hexagon/homothetic rings; product rejected |
| Candidate 2D carrier | Four-support partial-front state + sloped scalar carrier     | Continuity/ledgers/extraction passed; broad shallow four-level stack failed targets        |
| Candidate 2D twin    | One re-entrant twin source + signed drive + strip extraction | Local null/reversal/conservation passed; one straight strip, no recurrence/winding         |
| Candidate 2D edge    | One upper-surface seed + Stefan front + ribbon extraction    | Local null/reversal/conservation passed; one ribbon, no persistent supply/route            |
| Candidate 2D path    | Scripted planar path + rails/treads/risers; four slices      | Numerics/WebGPU passed; box, rails, shelves, then planar grid; no bulk 3D hopper           |

## Direct Bi constraints

- Frawley/Maurer/Childs: `99.999+%` bulk melt; supercooling sequence prismatic
  -> hopper -> triplanar -> branched; many hopper dendrites twinned. Supports
  bulk hopper regime/branching/local twin possibility, not twin-made hopper,
  target indices, universal thresholds.
- Steger/Price: four macroscopic 3D hoppers from suspended steel-wire seed;
  downward from upper melt surface; irregular/convoluted sections. Supports
  seeded origin/direction, not contact-line motion, recurrence, route, rate.
- Tokoro/Sugawara/Watanabe: pure-Bi melt-regrown thin-film faceted/stepwise
  advance. Mechanism only.
- Wagner/Brown: high-purity supercooled-melt Bi; deformation twin ending at
  faceted interface may form re-entrant step. Qualitative prismatic result;
  necessary conditions possibly insufficient; no recurrence/coefficient.
  Supports one local isolation only.
- No matching source links target macroscopic winding ledges to screw defect.

Links/applicability: `docs/references.md`.

## Candidate 2E cellular model

Selected representation: orientation-aware 3D cellular growth. CA is not a
physical mechanism. Tests 5-12 reject broad-interface attachment as the body
carrier: gradient normals, propagated facet labels, and sharper facet kinetics
preserve the same centered octagonal barrel. Facet-front Tests 1-2 prove one
local sweep and perpendicular facet handoff but reject surface-only layers as a
finite-volume body carrier. No Bi coefficient, facet index, defect, or kinetic
claim.

Implemented reusable state:

- CPU reference 3D arrays: `phase`, `supply`, `interfaceMass`, `attachment`,
  `solidificationTime`, `openingInfluence`, `facetFamily`, `facetLayer`,
  `surfaceClass`, `frontDirection`, `frontAge`, `frontSource`; one configured
  seed morphology-frame quaternion. Snapshots feed production GPU extraction;
  this is not authoritative GPU growth.
- Frame rotates the local rule; global storage axes never define habit. Do not
  call it crystallographic orientation without matching evidence.
- Synchronous pass order: supply relaxation -> capture proposals -> deterministic
  arrival resolution -> supply consumption/solidification -> age.
- Growth only into liquid/interface cells. Solid is immutable during scoped
  one-seed growth.
- Exact normalized supply loss = solid gain; latent paid once on gain. Preserve
  deterministic batching and monotonic connectivity.

Later production/multi-seed state: GPU-resident phase/fill/supply/owner/frame/
age + deterministic boundary/impingement state; same-owner fronts merge,
different owners impinge, no overlap. Do not build it before a one-seed bulk
body carrier passes target morphology.

Implemented facet-local-front Test 1:

- facet family + seed-local layer coordinate per interface site;
- terrace/ledge/kink class from same-layer neighbors;
- active front direction, age, source; reversible adsorbate mass.

Rule: terrace arrivals expire to supply. One generic seed-boundary ledge source
starts the isolation. Only active ledge/kink neighbors capture; captures move
the front laterally within one facet-local layer. Facet adjacency stops it. No
coordinate route, loop, mask, or recurring nucleation. Global Moore exposure
does not define terrace/step/kink identity.

Forbidden: prepainted routes, target masks, permanent special empty cells,
stamped terraces, per-seed decorative meshes, iteration-order collision wins.
Dynamic cell classes must derive from local state/history.

Sequence:

1. `2E.1` Test 1 closed: terrace stall + coherent local layer passed; unchanged
   integrated run made one plane on a cube, with no deep recess or winding.
2. `2E.1` Test 2 closed: opening-orthogonal lateral identity + same-source
   perpendicular handoff made four connected planes and an open center, but
   only a thin rectangular shell. Mechanism/topology pass; target fail.
3. `2E.2` Test 1 closed: deterministic outer-edge births made finite-depth
   layers + open center, but source population scaled with exposed area and
   produced a smooth block. Per-site Bernoulli recurrence rejected.
4. `2E.2` later: front persistence/termination/merging, supply coupling.
5. `2E.3`: multiple arbitrary frames; shared supply and deterministic
   impingement/boundaries; references 3-5.

Numerical CA sources constrain diffusion/capture/orientation/grid-bias methods
only. They never set Candidate 2E Bi geometry or parameters. Applicability:
`docs/references.md`.

## Acceptance

Freeze numeric schedule before viewing. Every scientific slice -> deterministic
3D + fixed view beside all targets, including source/conservation/topology/
morphology failures. References 1-2: formal single-sector gate. References 3-5:
mandatory context, later multi-sector gate.

Single-sector checks:

- Outer-frame class; reject stable sixfold/three-sided symmetry.
- Normalized opening depth; rim/core height.
- Ledge continuity across elevations; dynamic turns; no authored route.
- Terrace width/offset distribution; partial/interrupted front.
- Connected solid; exact supply/solid/latent ledger; domain clearance.
- Time/grid refinement; rotation equivariance; update-order independence.
- Fixed view; appearance cannot override topology/conservation.

Only then add connected branching/intergrowth. Multiple frames require shared
transport, owner/boundary state, deterministic impingement, and
rotation/collision symmetry; no cosmetic overlap.

## Runtime/numerical boundary

Reusable: GPU classifier, compaction, emission, normals, age, capacity,
indirect draw, controller, model-neutral dev bridge. Public root neutral. One
fixed CPU snapshot proof allowed; production CA fields remain GPU-resident with
no recurring full-volume upload/readback.

- Treat grid spacing/time step jointly; reject unstable explicit configs.
- Seed RNG deterministically.
- No unreviewed clamp/smooth/remesh/art to hide instability.
- Separate scientific failure from harness/extraction/WebGPU failure.
- Record deliberate source departures near equations; no run transcripts.
- Repeat source audit for changed equation, coefficient, facet, boundary,
  domain assumption, morphology claim.
