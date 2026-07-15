# Current Tasks

Updated 2026-07-14.

## Status

Milestone 1B / Candidate 2D. Morphology authority: four
`crystal_references/` images: bulk iridescent Bi; dominant
rectilinear/rhombohedral-pyramidal sectors; deep openings; many winding,
uneven, interrupted ledges; asymmetry; later branching/intergrowth.

Candidate 2C: product-rejected. Three Sn-Bi `{1-102}` directions + opposites +
equal supports + homothetic loops guarantee a regular hexagonal stack without
a winding head. Keep ledger/WebGPU extraction evidence only; never promote.

Source boundary:

- Frawley/Maurer/Childs: `99.999+%` bulk Bi; rising supercooling -> prismatic,
  hopper, triplanar, branched; many hopper dendrites twinned.
- Steger/Price: macroscopic 3D Bi hoppers from upper melt-surface wire.
- Pure-Bi thin film: stepwise faceted advance.
- High-purity melt: conditional local twin-plane source.
- No matching primary evidence that target bands are screw spirals.
- Generic/alloy/film/vapor/other-material work: mechanism/numerics only unless
  it passes `docs/references.md`; never geometry, facets, calibration,
  acceptance.

## Closed checkpoint: representation carrier

Passes as representation/extraction only:

- Four independent supports; asymmetric quadrilateral; no imported facets.
- Exact trapezoidal partial fronts; real boundary head; joined open route; no
  self-contact.
- Independent per-ledge/global area, volume, latent ledgers; partition invariant.
- Connected scalar + exterior-connected opening; 2:1 extraction refinement;
  finer volume error improves.
- Five checkpoints -> five valid production WebGPU meshes; four visible
  changes; no overflow/browser/GPU errors.

Morphology fails: about `15.2 x 13.9 x 2.5`; four elevations/about two cycles;
broad shallow stack + flat floor, not references 1-2. `acceptedMorphology:
false`.

## Closed checkpoint: twin source

Passes local mechanism isolation only:

- Actual twin inside solid; terminates where two faceted rays meet; solid angle
  re-entrant; growth continuation enters liquid. Labels alone cannot activate.
- Positive signed driving emits one front parallel to twin. Travel x independent
  out-of-section length -> local strip; volume/latent paid once.
- No twin, wrong termination/location/direction/angle/faceting, zero or reversed
  driving -> no event/volume. Reversal stalls emitted front. Thermal/volume/
  latent ledgers partition invariant.
- Source gives no Bi rate, recurrence, facet frame, winding law. Dimensionless
  mobility = isolation closure, not calibration.

Exactly one straight front by design. Recurring/multi-twin supply, turns, deep
sector, winding remain untested. This neither disproves twin growth nor supports
target promotion. `acceptedMorphology: false`; `acceptedAsTargetSource: false`.

3D closeout on `/__dev/material`: swept one-front prism only; null, initially
reversed, growing, post-emission-reversed states through production WebGPU
extraction. Empty nulls; stalled reversal; changing valid positive meshes; no
overflow/GPU errors. Final thin strip fails all targets: no opening, recurring
elevations, winding, sector assembly, branching. Keep isolated from rejected
carrier.

## Closed checkpoint: edge/free-surface source

Source audit: Steger/Price proves suspended-wire nucleation + downward growth
from upper melt surface only. Generic triple-line papers constrain local heat
transfer; no Bi contact-line law, birth, recurrence, path, rate, facet frame.

Passes local mechanism isolation only:

- Actual seed terminates at a real solid-liquid-free-surface contact, approaches
  from non-liquid, continues into liquid. Labels alone cannot activate.
- Positive signed heat removal advances exactly one local front by Stefan
  balance; no fitted mobility. Area, volume, latent, removed heat close and are
  partition invariant.
- No seed, nonterminating seed, off-surface contact, seed into liquid, zero or
  reversed driving -> no event/volume. Reversal stalls an emitted front.
- Exactly one event by evidence boundary; no spontaneous birth, recurrence,
  contact-line motion, turn, route, complete ring.

3D closeout on `/__dev/material`: fixed-camera screenshot; generated ribbon
only; source-removed,
initially reversed, growing, post-emission-reversed states through production
WebGPU extraction. Empty controls; stalled reversal; three changing valid mesh
promotions; final 7,096 triangles; no overflow/browser/GPU errors; all targets
visible.

Direct visual comparison: final rectangular ribbon fails every target: no deep
opening, recurring elevations, winding, route selection, sector assembly,
branching.
`acceptedMorphology: false`; `acceptedAsTargetSource: false`;
`persistentSupplyDemonstrated: false`; `routeSelectionDemonstrated: false`.

## Next: Candidate 2D strategy review

Milestone still requires compact source state -> supplied bulk-Bi habit at
production-plausible cadence. Carrier, twin, edge slices prove local machinery,
not persistent supply or target geometry. Never blend/tune them into appearance.

1. Seek target-matched macroscopic bulk-melt Bi evidence for recurring source +
   route selection that can generate one deep winding sector.
2. Keep screw, repeated nucleation, twin recurrence, edge recurrence unselected
   until exact evidence/discriminator exists. One failure never permits mixing.
3. If evidence remains absent, stop for explicit scope choice: pause; allow a
   clearly phenomenological topology law; or add thermal/defect/orientation
   state with stated fidelity/realtime cost.
4. No branching/intergrowth until one sector passes references 1-2.

## Review/loop

`/__dev/material`: edge/free-surface closeout default.

- `?mode=candidate2d-twin-evidence`: closed twin-source slice.
- `?mode=candidate2d-carrier-evidence`: rejected topology carrier.
- `?mode=candidate2c-evidence`: retired Candidate 2C seam.
- `?mode=material`: oxide fixture.

Do not resume direct-GPU reconstruction, calibration, public lifecycle,
clustering, performance, or deployment before the single-sector discriminator
passes.

```powershell
npm.cmd run check:fast
npm.cmd run check:baseline
review.cmd
```

Fast while editing; baseline before handoff. Review requires fixed-camera
screenshot + explicit all-four visual verdict. Durable model/source decisions
only in owning docs; no run transcripts.
