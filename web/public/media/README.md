# Hero video

The home page opens with a full-bleed motion shot of St Paul's. Drop your file
in this folder as **`st-pauls.mp4`** and it plays automatically — no code change
is needed.

```
web/public/media/st-pauls.mp4
```

Until that file exists the page falls back to `st-pauls-poster.svg`, the
stylised dome you can see on the site now. Nothing breaks; the still simply
stays put.

## What the file should be

| | |
|---|---|
| Format | MP4, H.264 (`yuv420p`), AAC or no audio track at all |
| Size | 1920×1080, or 1280×720 if you need it lighter |
| Length | 8–15 seconds, cut so the last frame matches the first — it loops |
| Weight | **Under 8 MB.** Above that the hero is slow on a phone |
| Sound | None. It is muted anyway; browsers block autoplay with audio |

A slow pan across the dome, the west front at dusk, or clouds moving behind the
lantern all work well. Avoid hard cuts — the loop is seamless only if the motion
is continuous.

## Compressing what you have

With ffmpeg:

```bash
ffmpeg -i original.mov \
  -t 12 -an \
  -vf "scale=1920:-2,fps=30" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 26 -preset slow -movflags +faststart \
  st-pauls.mp4
```

`-an` strips the audio, `-crf 26` trades a little quality for a much smaller
file, and `+faststart` lets playback begin before the whole file has arrived.

## A matching poster frame

The first frame is shown while the video loads. To use a still from your own
footage instead of the SVG:

```bash
ffmpeg -i st-pauls.mp4 -vframes 1 -q:v 3 st-pauls-poster.jpg
```

Then point the hero at it in `web/src/app/page.tsx`:

```tsx
<HeroVideo poster="/media/st-pauls-poster.jpg">
```

## Hosting it elsewhere

Video files are excluded from git (see `.gitignore`) so the repository stays
small. Two ways to get it live:

1. **Commit it anyway** — remove the `*.mp4` line from `.gitignore`. Fine for a
   file under ~10 MB.
2. **Serve it from a CDN or object store** — upload it anywhere public and set
   `NEXT_PUBLIC_HERO_VIDEO_URL` in Vercel to the full URL. The site uses that in
   preference to the local file.

## Licensing

Use footage you shot or that is explicitly licensed for commercial use.
Pexels, Coverr and Mixkit all carry free St Paul's clips that allow commercial
use without attribution — check each clip's licence before you publish, as the
terms are per-clip rather than per-site.

## Accessibility

The video is decorative, muted and marked `aria-hidden`. Anyone whose system
asks for reduced motion, who has data saver on, or who is on a 2G connection
sees the poster still instead. Do not put text or information in the video that
is not also on the page.
