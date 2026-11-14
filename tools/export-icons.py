"""Export the approved raster mark at Chrome sizes without changing its design."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / 'assets/branding/totonoex-icon-source.png'
with Image.open(source) as original:
    image = original.convert('RGBA')
if image.width != image.height:
    raise ValueError('Icon source must be square')
if image.getchannel('A').getextrema()[0] != 0:
    raise ValueError('Transparent source expected')
for size in (16, 32, 48, 128, 512):
    destination = (root / f'extension/icons/icon-{size}.png' if size != 512
                   else root / 'assets/branding/totonoex-icon-512.png')
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination, optimize=True)
    with Image.open(destination) as exported:
        assert exported.size == (size, size) and exported.mode == 'RGBA'
        assert exported.getpixel((0, 0))[3] == 0
        # Generated alpha can retain a small matting tolerance inside the tile.
        assert exported.getpixel((size // 2, size // 2))[3] >= 250
    print(f'{size}x{size}: {destination.relative_to(root)}')
