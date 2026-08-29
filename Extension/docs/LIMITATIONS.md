# Limitations

- Document PiP is supported by current desktop Chrome, not all browsers.
- DRM, cross-origin frames (same-origin frames are attempted), closed Shadow DOM, and player DOM coupling can prevent relocation.
- A site may replace the video or navigate while PiP is open; restoration is best effort.
- UTF-8 (including BOM) is supported; legacy encodings such as Windows-1258 are not converted.
- Embedded stream ads remain part of the media; this extension does not block ads.
