# Current Tasks

Updated 2026-07-13.

## Status

Milestone 1B is reset to Candidate 2D. The four files in
`crystal_references/` are the visual ground truth for the product habit. They
show bulk iridescent bismuth hopper specimens with dominant rectilinear or
rhombohedral-pyramidal sectors, deep open recesses, many winding stepped
ledges, uneven spacing, interruptions, asymmetry, and, in the larger examples,
branching or intergrowth.

Candidate 2C is rejected as product morphology. Its seed did not cause the
hexagon: the carrier projected three `{1-102}` directions from a microscopic
polycrystalline Sn-Bi pyramid study, added their opposites, assigned six equal
supports, and advanced complete homothetic loops. That guarantees a regular
hexagonal terrace stack and cannot express a winding step head. The Candidate
2C conservation ledger and development WebGPU extraction proof remain useful
evidence, but the carrier is no longer the default review surface and may not
be promoted into the product path.

The source audit found two directly relevant bulk elemental-bismuth anchors.
Frawley, Maurer, and Childs report `99.999+%` Bi changing from prismatic to
hopper, triplanar, and branched growth as supercooling increased, with many
hopper dendrites twinned. Steger and Price grew and sectioned macroscopic
three-dimensional bismuth hoppers from the upper melt surface. Pure-Bi thin-
film observations support stepwise faceted advance, and high-purity melt work
supports a conditional local twin-plane source. No matching primary study yet
proves that the target winding bands are screw-dislocation spirals.

All generic, alloy, thin-film, vapor-grown, or other-material papers are now
mechanism or numerical evidence only unless they pass the specimen-match gate
in `docs/references.md`. They cannot define Candidate 2D geometry, facet
families, calibration, or morphology acceptance.

## Candidate 2D representation checkpoint

The first executable slice is complete as a representation and extraction
proof, not as morphology:

- Four independent support planes produce one asymmetric quadrilateral sector;
  no Miller indices or Candidate 2C facets are imported.
- Each side advances as one exact trapezoidal front. Its reported head lies on
  the actual partial-patch boundary, completed transverse fronts join the next
  side, and the open route has no self-contact.
- Area, volume, and latent return accumulate independently from the partial
  polygons and close per ledge and globally. Event splitting is invariant to
  elapsed-time partitioning.
- The scalar carrier has one connected solid and an opening connected to the
  exterior. Its topology survives a two-to-one extraction refinement and the
  finer mesh improves volume error.
- Five fixed checkpoints produce five valid production WebGPU meshes, four
  visible mesh changes, no overflow, and no browser or GPU errors.

The fixed-view comparison rejects the generated habit. It is approximately
`15.2 x 13.9 x 2.5`, has only four visible elevations and about two winding
cycles, and reads as a broad shallow terrace stack over a flat central floor.
It does not reproduce the deep recess, many persistent bands, or strong
rim-over-core structure in references 1 and 2. `acceptedMorphology` remains
false.

## Twin-plane source checkpoint

The first source discriminator is complete and remains isolated from the
rejected carrier:

- An actual twin segment must lie inside the solid and terminate at the shared
  vertex of two faceted-interface rays. The computed solid angle must be
  re-entrant, and the continued growth ray must enter liquid; a declared label
  alone cannot activate the source.
- Positive signed thermal driving emits one local front at that intersection.
  It advances parallel to the twin. Its travel times an independent
  out-of-section twin/facet length gives the swept local facet strip, which
  pays volume and latent heat exactly once.
- No-twin, non-terminating, twin-outside-solid, growth-into-solid,
  non-re-entrant, non-faceted, zero-driving, and reversed-driving arms emit no
  step and sweep no volume. A signed reversal also stalls an already emitted
  front. Thermal, volume, and latent ledgers close across arbitrary
  elapsed-time partitions.
- The accessible primary record supplies no bismuth rate coefficient,
  recurrence rule, facet frame, or winding law. The dimensionless local
  mobility is explicitly an isolation closure, not a calibration.

The local twin mechanism passes its scoped eligibility test. The implementation
deliberately emits exactly one straight front because the accessible source
supplies no recurrence law. It therefore does not test recurring or multi-twin
supply, turns, a deep many-elevation sector, or the target winding topology.
Persistent twin-driven winding remains unresolved, and the current evidence
is insufficient for target-source promotion; this does not disprove
twin-plane re-entrant growth. `acceptedMorphology` and
`acceptedAsTargetSource` remain false.

The mandatory 3D closeout is complete on `/__dev/material`. The review maps
only the swept one-front state into an oriented rectangular prism, runs the
source-null, initially reversed, growing, and post-emission-reversal arms
through the production WebGPU extraction path, and leaves the final positive
state visible beside all four ground-truth images. The null arms remain empty,
the reversed emitted front remains stalled, and the positive checkpoints
produce changing valid meshes without overflow or GPU errors.

The fixed-view comparison rejects the generated shape. It is one thin local
strip with no hopper opening, recurring elevations, winding ledges,
rhombohedral-pyramidal sector assembly, or branching intergrowth. This closes
the twin slice as local mechanism evidence only; it does not promote the
source or connect it to the rejected winding carrier. `acceptedMorphology` and
`acceptedAsTargetSource` remain false.

## Milestone 1B and Candidate 2D direction review

Milestone 1B still requires compact source state to visibly grow the supplied
bulk-bismuth hopper habit at a production-plausible cadence. A valid ledger,
connected scalar, or changing GPU mesh is necessary infrastructure evidence;
none substitutes for morphology or source compatibility.

Candidate 2D remains the correct program because it locks acceptance to the
right specimens and separates source, morphology, and runtime claims. The
rejected part is the current time-staggered stack of identical prescribed
ledge prefixes. Do not tune its base height, step height, birth count, camera,
or material into a better-looking crystal. That would turn a representation
test into decorative target fitting.

The next evidence-backed exploration is the edge/free-surface source
discriminator, not a twin retune or carrier adapter:

The source preflight sets a strict limit before implementation. Current
evidence supports, at most, one existing heterogeneous seed at a real
solid-liquid-free-surface contact line advancing one local front under a
signed Stefan heat balance. It does not supply spontaneous edge nucleation, a
second birth, recurrence, turns, or winding. The edge slice may test that one
front as eligibility and conservation evidence, but it may not describe the
result as persistent supply or morphology progress. If its mandatory 3D
closeout is another local ribbon, close the mechanism honestly and review the
remaining source strategy instead of adding births or retuning geometry.

1. Re-audit the exact primary claim before importing an equation. Steger and
   Price support wire-seeded macroscopic bismuth-hopper growth from the upper
   melt surface; generic triple-line papers may support only an isolated
   boundary mechanism.
2. Declare the smallest local thermal or transport state that can emit a front
   from the edge/free-surface region. Do not prescribe its route, elevations,
   terrace widths, target mask, or complete-ring births.
3. Freeze source-removed and reversed-driving outcomes first. Failed supply
   must remain a model failure, not trigger a fallback source or decorative
   geometry.
4. Keep `persistentSupplyDemonstrated` and `routeSelectionDemonstrated` false
   for the one-front isolation. They may become true only after a separately
   sourced recurrence and path-selection law creates a deep, many-elevation
   winding sector matching references 1 and 2.
5. Retain the one-front twin result as unresolved mechanism evidence; do not
   blend it into the edge hypothesis. Keep screw-dislocation supply on hold.
   Add connected branching or intergrowth only after one sector passes;
   references 3 and 4 remain the later boundary.
6. End the edge/free-surface slice with the same mandatory closeout: map only
   generated state into the model-neutral 3D bridge, run frozen checkpoints,
   compare with all four references, and record pass or rejection without
   retuning.

`/__dev/material` now defaults to the twin-source 3D closeout beside all four
references. `?mode=candidate2d-carrier-evidence` retains the rejected topology
carrier, `?mode=candidate2c-evidence` retains the old Candidate 2C WebGPU seam,
and `?mode=material` retains the oxide fixture. Do not resume direct-GPU
reconstruction, coefficient calibration, public lifecycle work, clustering,
performance selection, or deployment until the Candidate 2D single-sector
habit discriminator passes.

## Working loop

```powershell
npm.cmd run check:fast
npm.cmd run check:baseline
review.cmd
```

Use `check:fast` while editing and `check:baseline` before handoff. Use the
review route for target comparison and visible changes. Record durable model
decisions in `docs/simulation-model.md` and source applicability in
`docs/references.md`; do not retain run transcripts.
