# Security

## Data handling

The current application is a static browser prototype. Camera frames, selected photos and label artwork are processed locally by the page and are not intentionally uploaded by application code.

## Third-party network requests

The runtime still depends on third-party infrastructure for:

- Three.js from jsDelivr;
- MediaPipe Tasks Vision from jsDelivr;
- MediaPipe WASM assets;
- EfficientDet model files hosted by Google.

A production deployment should treat these as supply-chain and availability dependencies. Pinning versions reduces accidental drift but does not make CDN delivery equivalent to vendored, integrity-verified assets.

## Camera permissions

Camera access is requested through the browser permission model. The app requires HTTPS or localhost. Users should be able to continue with photo/manual mode if camera permission is denied.

## Local files

Artwork and photo inputs may contain confidential client material. Do not add automatic telemetry or upload behavior without making it explicit in the UI and documentation.

## Reporting a security issue

Do not publish private client images, access tokens or exploit details in a public issue. Describe the affected component and reproduction conditions without including sensitive data.

## Production hardening backlog

- vendor or integrity-pin critical runtime dependencies;
- add a Content Security Policy compatible with the final asset strategy;
- make detector/model initialization errors explicit;
- preserve a no-upload architecture unless product requirements deliberately change it;
- add browser tests for permission denial and model-load failure.
