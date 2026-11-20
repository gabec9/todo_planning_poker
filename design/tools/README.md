# Re-exporting the Figma images
The `.fig` is a zip; `canvas.fig` inside is Figma's "kiwi" binary. These scripts decode it and
render every top-level frame/component to SVG, then PNG (2x). No Figma account needed.

    pip install zstandard && npm i playwright
    cd design/tools
    unzip -o "../../Planning Poker.fig" -d /tmp/fig
    PYTHONPATH=. python3 fig2svg.py /tmp/fig/canvas.fig /tmp/svg
    node png.js /tmp/svg /tmp/png

Wireframe-grade renderer (text uses Inter via the browser). If a frame looks off, re-export from Figma itself.
