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

| File                                                               |      Pixels | SHA-256                                                            | Trait                                                 |
| ------------------------------------------------------------------ | ----------: | ------------------------------------------------------------------ | ----------------------------------------------------- |
| [`crystal_small_1.jpg`](../crystal_references/crystal_small_1.jpg) | 1024 x 1024 | `dbcf1b49fa3a12f8944f95bbd49183b7b560a1c5c3b716c03cdf373b6b7ab061` | Deep dominant hopper; winding ledges                  |
| [`crystal_small_2.jpg`](../crystal_references/crystal_small_2.jpg) | 1024 x 1024 | `c6c70580a0ab3b57afbbf4792de6018024763265bcb6f4d3e8e988f31c0a7d7a` | Offset opening; interrupted asymmetric bands          |
| [`crystal_small_3.jpg`](../crystal_references/crystal_small_3.jpg) |   946 x 946 | `3608fc058f0454f387b7e3963d89e6b236a28ca6764dba407d946ce675140200` | Intergrown sectors; varied widths                     |
| [`crystal_small_4.jpg`](../crystal_references/crystal_small_4.jpg) | 1588 x 1588 | `719707a2cf1ebd9125fb3d2e5c356c2b5a58205b538b19180f3fe5ff2ffd09d0` | Branched connected structure; irregular nested ledges |

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
- Later: connected branching/intergrowth vs 3-4.

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

## Candidate decisions

- Generic cubic: Bollada/Jimack/Mullis binary-alloy solute hopper. Regression
  for solver/controller/extraction only; no elemental-Bi product review.
- Candidate 1 rejected: lattice translations misused as surface-energy
  generators; generic calibration; boundary-limited body. A7 cell does not
  authorize macroscopic habit.
- 2A mechanism only: conservative pure-melt enthalpy, variational anisotropy,
  phase-specific free-surface heat boundary pass; 3D grew center before rim.
  Smooth healing defeats opening; cannot carry discrete ledges. Rename retained
  evidence normals to `snBiPyramidFacetNormals`; `{1-102}` comes from microscopic
  polycrystalline Sn-Bi, never Candidate 2D.
- 2B generic mechanism only: surface-adatom nonlocal transport can create
  perimeter-over-core signal; wrong route/material/calibration.
- 2C product rejected: exact volume/latent ledger, conservative reduced cold
  content, deterministic ledges, CPU-carrier/WebGPU seam reusable. Geometry
  invalid: three projected Sn-Bi `{1-102}` directions + opposites + equal
  inradius -> centered hexagon; one offset -> homothetic rings; uniform whole
  loops -> no heads/interruptions/unequal speeds/winding; scalar = polygon base
  - annular prisms, not sloped hopper. Cancel direct GPU reconstruction. Keep
    retired `?mode=candidate2c-evidence` label.

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

## Candidate 2D ledge model

Observable topology first; source unresolved. Not 2C with four supports.

Required single-sector state:

- Sloped rectilinear/visually rhombohedral-pyramidal envelope; independent
  support planes; no assumed Miller indices.
- Ordered explicit partial-segment path; heads with position, direction,
  elevation, birth source, deterministic local advance.
- Approximate right-angle turns; no closed-loop requirement.
- Interrupted/incomplete fronts; per-segment advance.
- One connected swept solid; exact area/volume/latent ledgers.

Never reuse 2C loop ordinal/area/birth clock/perimeter temperature/topology/
annular scalar as geometry. For step height `h`, actual swept planar `Delta A`:

```text
Delta V = h Delta A
Delta Q_latent = L Delta V
```

Derive `Delta A` from advanced segments, clipped corners, partial fronts; never
loop count/stamp. Reduced cold-content allowed only if same `Delta V` repays
latent heat exactly once.

### Closed representation checkpoint

Four cyclic supports with independent offsets. Active side `i`: outer endpoints
`O0,O1`; endpoints after moving only active support inward by terrace width
`I0,I1`; normalized head progress `p`:

```text
O(p) = (1 - p) O0 + p O1
I(p) = (1 - p) I0 + p I1
```

Swept partial trapezoid: `[O0,O(p),I(p),I0]`; head = `O(p)`. On completion,
`O1 -> I1` connects forward; `I1` starts next side. Result: continuous open
route, no tangent-projection backtracking/crossing.

Shoelace area; independently accumulate per-ledge/global `Delta A`, `h Delta A`,
`L h Delta A`. Extraction-only scalar unions nonoverlapping patch prisms +
closed four-plane sloped base; no state feedback.

Pass: continuity, non-contact, partition invariance, conservation, connected
solid, open core, refinement. Fail morphology: repeated prescribed prefixes ->
four elevations, broad shallow stack, flat floor; no deep rim/core or many
bands. No tuning heights/births/widths/camera/material. Reusable result only:
compact partial-front state + neutral extraction seam.

### Closed twin local-source checkpoint

2D local section only. Two facet rays share interface vertex. Solid-interior
sample selects sector; re-entrant iff solid angle `> pi`. Nondegenerate twin
inside solid, exactly one endpoint at vertex. Project operational eligibility:

```text
g_twin = faceted
         and twin_present
         and twin_terminates_at_interface
         and twin_lies_in_solid
         and growth_direction_lies_in_liquid
         and solid_angle > pi
```

Source has no kinetics. Declared dimensionless isolation closure:

```text
dx/dt = mu g_twin max(theta, 0)
Delta A = ell Delta x
Delta V = h Delta A
Delta Q_latent = L Delta V
C theta = C theta_0 + Q_removed - Q_latent
```

`ell`: independent out-of-section twin/facet length; `theta`: signed thermal
drive; `mu`: not measured Bi mobility. `Delta A`: front travel extruded along
`ell`, not same-section rectangle. Signed heat impulses; closed-form integration
between impulse/completion. Reversal arrests; no dissolution claim.

Positive arm: exactly one front at twin/facet intersection, parallel to twin;
area/volume/latent/cold-content close independently. Nulls: missing/misplaced
twin, twin outside solid, growth into solid, non-re-entrant/non-faceted, zero/
reversed driving. Partition invariant; post-emission reversal preserves volume.

3D extraction-only strip, source `p`, unit growth `g`, observational
perpendicular `n=(-g_y,g_x)`, out-of-section `e_z`:

```text
p + u g + v n + w e_z
0 <= u <= x, |v| <= h/2, |w| <= ell/2
```

`n` is embedding, not crystal normal. No base/body/recurrence/mask. Volume =
`x h ell`, already paid. Null/initial reversal -> empty; later reversal ->
unchanged strip.

Pass: eligibility, null/reversal, ledger, scalar, WebGPU extraction. Unresolved:
self-perpetuation/multi-twin/winding. One event by design; no target promotion,
carrier connection, or physical falsification of twin growth. Shape fails all
references. Next: edge/free-surface isolation. Screw on hold.

### Closed edge/free-surface local-source checkpoint

2D contact section only. Free-surface line + melt-interior direction; existing
seed segment must end at their contact, approach from non-liquid, and continue
into liquid. Operational eligibility:

```text
g_edge = seed_present
         and contact_on_free_surface
         and seed_terminates_at_contact
         and seed_approaches_from_nonliquid
         and growth_direction_enters_liquid
```

No Bi kinetics. One front uses only declared local Stefan balance:

```text
A_f = ell h
dx/dt = max(Qdot, 0) / (L A_f)
Delta V = A_f Delta x
Delta Q_latent = L Delta V = Qdot Delta t
```

`ell`: contact-line length; `h`: observational local front thickness; `Qdot`:
signed heat removal assigned to this front. Frozen dimensionless isolation;
not Bi rate/calibration. Negative driving arrests; no dissolution. Exactly one
event; no contact-line motion, second birth, recurrence, turn, route, ring.

3D extraction-only ribbon uses source point, generated travel, thickness, and
contact-line length. No seed body/base/hopper/carrier/mask. Source removed,
off-surface/misplaced seed, seed into liquid, zero/reversed driving -> empty;
later reversal -> unchanged ribbon.

Pass: geometry, null/reversal, Stefan/volume/latent ledger, scalar, WebGPU
extraction. Fail target source/morphology: one ribbon; no persistent supply,
route selection, opening, elevations, winding. Next: strategy review; never
blend closed local mechanisms into target fitting.

### Competing sources

| Hypothesis             | Evidence                                                          | Promotion discriminator                                                   |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Twin re-entrant        | One local source passes; recurrence/multi-twin unresolved         | Target-matched persistent winding dynamics                                |
| Screw dislocation      | Generic hopper/spiral + mismatched Bi only                        | Target-matched source/result links persistent head to macroscopic winding |
| Repeated 2D nucleation | Generic step flow + mismatched Sn-Bi                              | Independent births form one connected winding sequence, not rings         |
| Edge/free surface      | One seeded local Stefan front passes; recurrence/route unresolved | Target-matched persistent supply and path selection                       |

One failure never permits blending mechanisms to fit appearance.

## Acceptance

Freeze numeric schedule before viewing. Every scientific slice -> deterministic
3D + fixed view beside all targets, including source/conservation/topology/
morphology failures. References 1-2: formal single-sector gate. References 3-4:
mandatory context, later multi-sector gate.

Single-sector checks:

- Outer-frame class; reject stable sixfold/three-sided symmetry.
- Normalized opening depth; rim/core height.
- Ledge continuity across elevations; nonintersection; direction-change count.
- Terrace width/offset distribution; partial/interrupted front.
- Connected solid; monotonic exact volume/latent ledger; domain clearance.
- Time/grid refinement of path + extraction carrier.
- Fixed view; appearance cannot override topology/conservation.

Only then add connected branching/intergrowth. Multiple orientations require
documented shared-transport domain/twin model; no cosmetic overlap.

## Runtime/numerical boundary

Reusable: GPU classifier, compaction, emission, normals, age, capacity,
indirect draw, controller, model-neutral dev bridge. Public root neutral. One
fixed CPU snapshot proof allowed; production requires compact GPU-resident state,
no recurring full-volume upload/readback.

- Treat grid spacing/time step jointly; reject unstable explicit configs.
- Seed RNG deterministically.
- No unreviewed clamp/smooth/remesh/art to hide instability.
- Separate scientific failure from harness/extraction/WebGPU failure.
- Record deliberate source departures near equations; no run transcripts.
- Repeat source audit for changed equation, coefficient, facet, boundary,
  domain assumption, morphology claim.
