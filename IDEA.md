# IDEA

This website is a loose collection of small, browser-only web pieces that are nice to look at, play with, or learn from. Not productivity tools (those live on tools.jakob-r.de): visualizations, simulations, explorable explanations, generative art, toys. Very random, slightly artistic.

The landing page shows

- a small introduction
- a gallery grid of the available pieces
- a search function (once there is something to search)
- every piece has a thumbnail, short title and description, and possible tags
- Let the visitor know everything runs in the browser.

Principles:

- Every piece lives on a separate page and loads only what it needs.
- Every piece is small and self-contained. One idea per piece.
- No backend.

Design:

- warm, a bit playful, a bit artistic; the shared chrome stays quiet so each piece can have its own look.
- pieces may go full-bleed and use the whole viewport.
- explanations are short and sit next to the thing they explain; small info icons for the rest.
- Pieces should work on desktop and degrade gracefully on mobile unless stated otherwise.

## Pieces

### Fourier Lens

Demonstrate how images live in frequency space, and how keeping/dropping coefficients there is the foundation of many compression techniques (JPEG-style intuition, not a full codec).

- Left: spatial image (X,Y)
- Right: frequency view of the same image
  * default: FFT, log-scaled magnitude, low frequencies centered (fftshift)
  * optional switch: DCT (real coefficients — closer to what JPEG uses; low freq toward a corner, labeled)
- Both sides: zoomable / panable canvas (touch-friendly)
- Color space: RGB or YCbCr; show combined or individual channels (Y vs chroma is the compression-relevant contrast)
- Default sample image; visitor can load their own (stays in the browser)
- Edit the right side by masking coefficients (not painting the magnitude preview); inverse transform updates the left
  * circular keep/remove (radius ≈ “how many high frequencies survive”)
  * brush to zero bands
  * optional “keep lowest N%” slider for a one-knob compression demo
- Short info hints: magnitude vs phase, why log scale, why YCbCr, FFT vs DCT
