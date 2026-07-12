# References

## Scientific baseline

### Hopper phase-field model

- P. C. Bollada, P. K. Jimack, and A. M. Mullis, "Phase field modelling of hopper crystal growth in alloys," _Scientific Reports_ 13, 12637 (2023).  
  Paper: <https://doi.org/10.1038/s41598-023-38741-2>  
  Open PDF: <https://eprints.whiterose.ac.uk/id/eprint/201666/8/Phase%20field%20modelling%20of%20hopper%20crystal%20growth%20in%20alloys.pdf>  
  Author code: <https://github.com/prepcb/PhaseField>

Use this as the initial equation, parameter, morphology, and validation source. Retrieve and review its supplementary material before implementing the numerical kernels.

### Bismuth faceted and twin-plane growth

- R. S. Wagner and H. Brown, "Growth of Bismuth Crystals from the Melt by a Twin Plane Mechanism" (1962).  
  Abstract/source: <https://uat-oneminewebsite.azurewebsites.net/documents/institute-of-metals-division-growth-of-bismuth-crystals-from-the-melt-by-a-twin-plane-mechanism>

This supports the relevance of orientation-dependent faceted growth and twin-assisted nucleation in bismuth. It does not by itself define the hopper solver.

### Single and clustered lab-grown bismuth

- Ryan Clark, "Environmental effects on single crystal growth in molten bismuth" (2019).  
  <https://scholarworks.lib.csusb.edu/osr/vol5/iss1/9/>

This reports both large single and clustered formations and motivates using a reference distribution rather than assuming all specimens share one nucleation pattern.

## Specimen-reference guidance

- Mindat example of an explicitly synthetic, concentric hoppered bismuth specimen:  
  <https://www.mindat.org/photo-159321.html>

Build a curated reference set before cluster tuning. Record URL, photographer/owner, specimen description, and usage rights. Do not copy images into the repository unless redistribution is permitted.

## Three.js and WebGPU

- Three.js r185 release (pinned as npm `three@0.185.0`, verified as latest stable on 2026-07-11):  
  <https://github.com/mrdoob/three.js/releases/tag/r185>

- Three.js WebGPU renderer overview:  
  <https://threejs.org/manual/en/webgpurenderer>
- Three.js TSL specification and compute primitives:  
  <https://threejs.org/docs/TSL.html>
- Three.js `Storage3DTexture`:  
  <https://threejs.org/docs/pages/Storage3DTexture.html>
- Three.js `IndirectStorageBufferAttribute`:  
  <https://threejs.org/docs/pages/IndirectStorageBufferAttribute.html>
- Three.js physical material iridescence controls:  
  <https://threejs.org/docs/pages/MeshPhysicalMaterial.html>

Bismuth-oxide optical constants used to bound the provisional film IOR:

- Patil, Yadav, Puri, and Puri, "Optical properties and adhesion of air
  oxidized vacuum evaporated bismuth thin films," reports refractive indices
  `1.854..1.991`:
  <https://doi.org/10.1016/j.jpcs.2007.02.019>
- Roozeboom et al., "Growth of Bi2O3 Films by Thermal- and Plasma-Enhanced
  Atomic Layer Deposition Monitored with Real-Time Spectroscopic Ellipsometry
  for Photocatalytic Water Splitting," reports process-dependent values around
  `2.3..2.7` at `3 eV`:
  <https://doi.org/10.1021/acsanm.9b01261>

The material-study value `2.1` is a conservative provisional value within this
published process-dependent spread, not a calibrated composition claim.

Use Three.js r185 exactly. Re-check these APIs during the foundation spike because the WebGPU/TSL surface is evolving, but do not change the pinned version without a recorded decision.

## Browser and automated testing

- Chrome WebGPU overview and platform support:  
  <https://developer.chrome.com/docs/web-platform/webgpu/overview>
- Chrome WebGPU troubleshooting and secure-context requirements:  
  <https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips>
- Playwright visual comparisons:  
  <https://playwright.dev/docs/test-snapshots>

## Production serving

- Express static-file serving:  
  <https://expressjs.com/en/5x/starter/static-files/>
- Express production performance and reliability guidance:  
  <https://expressjs.com/en/advanced/best-practice-performance/>

Remote deployment must use a trusted HTTPS origin for WebGPU. Localhost may use HTTP during development.
