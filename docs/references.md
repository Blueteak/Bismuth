# References

Use primary sources for equations, crystallography, and growth mechanisms.
These links define what each source may support; do not copy coefficients or
claims across incompatible materials and geometries.

## Generic hopper scaffold

- P. C. Bollada, P. K. Jimack, and A. M. Mullis, "Phase field modelling of
  hopper crystal growth in alloys" (2023):
  <https://doi.org/10.1038/s41598-023-38741-2>
- Open manuscript:
  <https://eprints.whiterose.ac.uk/id/eprint/201666/8/Phase%20field%20modelling%20of%20hopper%20crystal%20growth%20in%20alloys.pdf>
- Author code: <https://github.com/prepcb/PhaseField>

This is the equation and generic cubic regression source, not a bismuth
product model.

## Bismuth structure and melt growth

- L. Wei et al., "From a volatile molecular precursor to twin-free single
  crystals of bismuth" (2019): <https://doi.org/10.1039/C9CC02820J>

  Use the corrected ambient rhombohedral structure and 298 K hexagonal lattice
  constants. The vapor-grown specimens are not a melt-hopper calibration.

- T. Tokoro, S. Sugawara, and J. Watanabe, "In-situ Observation of Melt Growth
  Process of Bi (100) Thin Films" (1990):
  <https://doi.org/10.2320/matertrans1989.31.759>

  Supports facet-specific, stepwise pure-bismuth melt growth; the thin-film
  geometry is not a bulk hopper model.

- A. Luktuke et al., "Bismuth pyramid formation during solidification of
  eutectic tin-bismuth alloy using 4D X-ray microtomography" (2024):
  <https://doi.org/10.1038/s43246-024-00538-9>

  Supports interface-reaction control, slow `{1-102}` facets, and faster
  free-surface/trijunction growth. Its Sn-Bi coefficients and polycrystalline
  pyramid are not high-purity single-crystal calibration data.

- R. S. Wagner and H. Brown, "Growth of Bismuth Crystals from the Melt by a
  Twin Plane Mechanism" (1962):
  <https://uat-oneminewebsite.azurewebsites.net/documents/institute-of-metals-division-growth-of-bismuth-crystals-from-the-melt-by-a-twin-plane-mechanism>

  Establishes twin-assisted high-purity melt growth as a conditional mechanism,
  not proof that the target hopper is twinned.

## Candidate 2 scaffolding

- A. Karma and W.-J. Rappel, "Quantitative phase-field modeling of dendritic
  growth in two and three dimensions" (1998):
  <https://doi.org/10.1103/PhysRevE.57.4323>
- Author PDF: <https://rappel.ucsd.edu/Publications/quan23.pdf>

  Source for the pure-melt thermal field and thin-interface mapping. Bismuth
  properties and facet kinetics require separate evidence.

- B. T. Helenbrook, "Solidification along a wall or free surface with heat
  removal" (2015): <https://doi.org/10.1016/j.jcrysgro.2015.02.028>

  Supports treating heat removal as a boundary-value problem at the
  trijunction and requiring a solid/liquid surface-flux jump for a finite
  growth wedge rather than a local artistic growth multiplier.

- N. Bagheri-Sadeghi and B. T. Helenbrook, "Effects of the inert phase on
  solidification near a triple-phase line" (2024):
  <https://doi.org/10.1016/j.jcrysgro.2023.127438>

  Source for separate solid-inert and liquid-inert heat balances, temperature
  continuity, and one Stefan latent-heat jump at a three-phase line.

- M. Albani et al., "Competition Between Kinetics and Thermodynamics During
  the Growth of Faceted Crystal by Phase Field Modeling" (2019):
  <https://doi.org/10.1002/pssb.201800518>

  Source for Candidate 2B's surface-adatom continuity, tangential chemical
  potential flux, and orientation-dependent incorporation time. Its examples
  are dimensionless or calibrated to other materials; it provides neither
  bismuth coefficients nor a melt-air-crystal trijunction law.

- O. Weinstein and S. Brandon, "Dynamics of partially faceted melt/crystal
  interfaces I: Computational approach and single step-source calculations"
  (2004): <https://doi.org/10.1016/j.jcrysgro.2004.04.108>

  Source for step-flow velocity, macroscopic two-dimensional nucleation
  kinetics, and analogous outer-boundary step sources on concave melt-growth
  interfaces. Candidate 2C's deterministic layer clock is a derived isolation;
  this paper does not establish heterogeneous bismuth trijunction nucleation.

## Specimen references

- Synthetic concentric hopper, Mindat photo 159321:
  <https://www.mindat.org/photo-159321.html>
- Wikimedia bismuth hopper:
  <https://commons.wikimedia.org/wiki/File:Bismuth_hopper_crystal.jpg>
- Ryan Clark, "Environmental effects on single crystal growth in molten
  bismuth" (2019): <https://scholarworks.lib.csusb.edu/osr/vol5/iss1/9/>

Use link-only references unless redistribution rights are confirmed. A visible
connected specimen does not by itself prove a single crystallographic domain.

## Runtime stack

- Three.js r185 pin: <https://github.com/mrdoob/three.js/releases/tag/r185>
- WebGPU renderer: <https://threejs.org/manual/en/webgpurenderer>
- TSL: <https://threejs.org/docs/TSL.html>
- Chrome WebGPU overview:
  <https://developer.chrome.com/docs/web-platform/webgpu/overview>
- Express static serving:
  <https://expressjs.com/en/5x/starter/static-files/>

The project pins `three@0.185.0`; do not change it without an explicit decision.
