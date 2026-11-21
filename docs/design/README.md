# Approved screens

`screens/` holds the approved KapeKonek Phase 1 screens, exported from the Claude Design canvas "KapeKonek — Phase 1 Pages":
https://claude.ai/artifact/4KyhXQ9d8BtaDgg61uLz3h

- `canvas.json` lists each screen with its title and size.
- Each `*.dc.html` file is a self-contained design page. Inline styles hold the exact values, and the script at the bottom holds sample data and interactions. `docs/DESIGN.md` §1 explains how to read one.
- These files run only inside the design canvas. Opening one directly in a browser won't render it. Read them as a spec.

## Optional: PNG references

For pixel comparisons, export each screen as an image from the canvas and save it here as `png/<ScreenName>.png` (for example `png/Main.png`). Claude Code will compare its Playwright screenshots against them.

## If the design changes

When the canvas is edited again, re-download the changed `.dc.html` files into `screens/` so the code and the design stay in sync.
