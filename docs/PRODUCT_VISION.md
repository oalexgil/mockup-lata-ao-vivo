# Mockup Vision — Product Vision

## One-line proposition

**Create the scene. Apply your brand.**

Mockup Vision separates generative creativity from brand fidelity.

## Primary user journey

The product should feel like one guided creative flow, not a technical editor.

1. **Describe what you need** — natural-language request, optional product/model references and optional scene/inspiration images.
2. **Generate the scene** — one click creates an unbranded mockup-ready image.
3. **Iterate** — choose a generated version and describe what should change.
4. **Upload the real artwork** — one or many logos, labels, layouts or campaign pieces.
5. **Place automatically** — generated slot metadata or local detection proposes the available mockup surfaces and assigns the uploaded assets.
6. **Correct if needed** — every surface remains editable through four-corner fitting and per-area realism controls.
7. **Export** — save the final branded image.

The advanced controls exist, but they should stay secondary to this journey.

## Why the split matters

Image generators are useful for inventing products, environments, composition and lighting, but they can distort exact logos, typography, labels and artwork when asked to generate the final branded image in one step.

Mockup Vision therefore follows a strict rule:

> The generator creates the world. Mockup Vision applies the brand.

## Generation inputs

A user may start with:

- text only;
- product/model/object references only;
- scene/style/inspiration references only;
- or any combination of those inputs.

The generated image should contain clean customizable surfaces without readable branding.

## Iteration model

Generated images behave as lightweight versions inside the session:

- V1, V2, V3…;
- the user can return to an earlier version;
- iteration is expressed in natural language;
- the previous selected image is sent back to the generation adapter;
- usable mockup surfaces should be preserved unless the user asks to change them.

## Multi-art mockups

A scene may contain multiple independent mockup spaces, for example:

- six presentation pieces;
- several posters on a wall;
- a notebook screen plus a phone screen;
- multiple package fronts;
- a social-media presentation board.

The user can upload multiple artwork files in one action.

Each mockup space is represented as a **slot**:

- four-point geometry;
- label/name;
- assigned artwork;
- apply/replace mode;
- realism controls.

Mockup Vision distributes artwork across the slots automatically, while keeping each assignment editable.

## Surface discovery order

1. use slot metadata returned by the generation backend when available;
2. otherwise use local object detection to suggest several areas;
3. otherwise let the user add one or more areas manually.

Automation must never prevent manual correction.

## Product principles

1. **Brand fidelity over generative convenience.** Final artwork is applied, not hallucinated.
2. **Simple first, advanced second.** The main UI follows Brief → Scene → Artwork → Mockup.
3. **Automation is editable.** Detection proposes; the user corrects.
4. **Multi-art is first-class.** A mockup is not limited to one logo or one surface.
5. **Progressive realism.** Planar surfaces mature before cylinders, bottles and proxy 3D.
6. **Honest capability boundaries.** Blur is not inpainting; bounding-box detection is not exact surface understanding; proxy 3D is not full reconstruction.
7. **Local editing by default.** Artwork application remains browser-side where possible.
8. **Provider isolation.** Image generation sits behind a server adapter.

## Current V2 scope

Implemented client-side:

- natural-language scene request;
- optional image references;
- Generate/Iterate client contract;
- generated-version session history;
- manual import fallback while no provider is connected;
- one or many uploaded brand assets;
- one or many mockup slots;
- automatic art-to-slot assignment;
- local detector/manual slot fallback;
- four-corner perspective fitting;
- Apply/Replace;
- light/shadow preservation and blend controls;
- PNG export.

Still deferred:

- production scene-generation provider;
- semantic inpainting;
- true occlusion masks;
- dedicated printable-surface segmentation;
- cylinders/bottles in the main Studio;
- arbitrary 3D reconstruction.

## Future product layers

### V2.1
Connect the server-side generation adapter and return mockup slot metadata with the generated image.

### V2.2
Improve surface discovery beyond generic object bounding boxes.

### V2.3
Add masks, occlusion-aware composition and semantic replacement.

### V3
Return to cylindrical packaging using proxy geometry and the same Studio project/slot system.
