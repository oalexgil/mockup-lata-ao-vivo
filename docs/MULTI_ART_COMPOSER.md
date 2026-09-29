# Multi-art Surface Composer

Mockup Vision's recommended multi-art workflow is surface-first, not artwork-first.

1. Choose an original artwork.
2. Define exactly one real surface by local click detection or by marking four corners.
3. Review the geometry before approval.
4. Approve/freeze the surface.
5. Repeat for each additional surface.
6. Optionally refine only light/material parameters and export.

Assisted detection is a convenience layer. If it fails or does not coincide with the clicked target, the Studio switches to four-corner marking and does not render a floating fallback artwork.

Artwork is always rendered from the original uploaded file with contain-fit perspective mapping. Text, logos, colors and internal composition are not regenerated.
