# Mockup Vision — Product Vision

## One-line proposition

**Create the scene. Apply your brand.**

Mockup Vision separates generative creativity from brand fidelity.

## User problem

Image generators are good at inventing products, environments and lighting, but they can distort logos, typography, labels and exact artwork when asked to generate the final branded image in one step.

Mockup Vision uses a two-stage workflow:

1. generate or upload the **scene**;
2. apply the **real brand asset** afterwards.

## Core workflows

### Create scene

Inputs:
- product description;
- scene description;
- style;
- desired customizable surface;
- optional product reference;
- optional scene/style reference.

Output:
- unbranded product scene with a clean target surface.

### Use my photo

Input:
- existing photo or mockup.

Output:
- editable base scene.

### Shared editor

Both routes continue through:

- detect target surface;
- adjust four corners;
- upload real artwork;
- Apply or Replace;
- tune perspective, light, blend and tone;
- export PNG.

## Product principles

1. **Brand fidelity over generative convenience.** Final logos and artwork are applied, not hallucinated.
2. **Automation is editable.** Detection proposes; the user can correct geometry.
3. **Progressive realism.** Start with reliable planar surfaces before cylinders, bottles and proxy 3D.
4. **Honest capability boundaries.** Blur is not inpainting; bounding-box detection is not exact surface understanding; proxy 3D is not full reconstruction.
5. **Local editing by default.** Photo/artwork editing stays browser-side where possible.
6. **Provider isolation.** Image-generation vendors sit behind an adapter so the product is not coupled to one API.

## V2 scope

In scope:
- flat photo surfaces;
- screens, posters, book covers, box fronts and similar planes;
- existing-mockup replacement;
- brand-safe scene briefing;
- product/scene references;
- local perspective and realism controls.

Deferred:
- production generator backend;
- semantic inpainting;
- occlusion masks;
- cylinders/bottles;
- arbitrary 3D reconstruction.

## Future product layers

### V2.1
Connect a server-side scene-generation adapter.

### V2.2
Improve detection from object boxes to target-surface quadrilaterals.

### V2.3
Add masks, occlusion-aware composition and semantic replacement.

### V3
Return to cylindrical packaging using proxy geometry and shared Studio controls.
