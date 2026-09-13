# Surface Composer validation

Validate the recommended multi-art workflow against these cases before calling it stable:

- three flat displays with different aspect ratios;
- poster + screen + package face;
- two nearby surfaces where a global detector could confuse them;
- failed assisted detection must switch to four-corner marking without rendering artwork;
- four-corner marking at canvas edges;
- re-open an approved surface, edit one corner, and require re-approval;
- remove an artwork and ensure only its dependent surface disappears;
- export with unused uploaded artworks but no unresolved previews;
- repeat the same artwork on multiple approved surfaces;
- Cloudflare quota/rate failure must leave manual mapping usable.

Acceptance rule: artwork pixels are never regenerated; placement is determined by approved four-point geometry and deterministic contain-fit perspective rendering.
