# Validation plan

Mockup Vision should be evaluated as a geometry/compositing system, not only by whether one demo looks convincing.

## Core metrics

For each test image or frame, record a manually reviewed reference fit and compare the automatic result.

Recommended measurements:

- center error as % of image width/height;
- radius error as % of reference radius;
- body-height error as % of reference height;
- roll error in degrees;
- tilt error in degrees when the top ellipse is visible;
- time to first usable fit;
- tracking-loss rate during a 20–30 second sequence.

## Test matrix

### Object

- slim can;
- standard beverage can;
- tall can;
- bottle-like cylinder;
- object with partially hidden top/bottom.

### Background

- plain high contrast;
- plain low contrast;
- vertical edges near the object;
- textured room background;
- outdoor scene.

### Lighting

- diffuse daylight;
- side light;
- frontal light;
- dim indoor light;
- strong specular reflection.

### Camera

- laptop webcam;
- Android rear camera;
- Android front camera;
- iPhone/Safari;
- desktop Chrome/Edge.

## Manual baseline

Use the four-corner tool as a human-assisted reference. Save the same frame with:

1. manual four-corner fit;
2. automatic detector + tracker fit;
3. edge-snap fit.

The comparison should focus on geometry, not label aesthetics.

## Acceptance criteria for a stronger prototype

Suggested initial targets, to be revised after real measurements:

- median center error < 3% of image dimension;
- median radius error < 8%;
- median height error < 8%;
- median roll error < 4°;
- no catastrophic fit jumps after lock in the benchmark set;
- manual mode remains functional when model initialization fails.

These are engineering targets, not claims that the current implementation already meets them.

## Visual compositing review

Separately score:

- seam visibility;
- preservation of real shadow/highlight cues;
- label edge alignment;
- perspective plausibility;
- readability of artwork after curvature.

## Future automation

Add representative, redistributable fixtures under `tests/fixtures/` and make geometry tests deterministic. Avoid committing private client photos without explicit permission.
