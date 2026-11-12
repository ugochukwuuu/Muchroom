'use client';

import { useState } from 'react';
import { ProductPhoto } from './product';
import type { Variant } from '../lib/types';

export function ProductGallery({ variant }: { variant: Variant }) {
  const [selected, setSelected] = useState(0);
  return <div className="product-gallery">
    <ProductPhoto variant={variant} source={variant.images[selected]} position={selected}/>
    {variant.images.length > 1 && <div className="photo-thumbnails" role="group" aria-label="Product photos">
      {variant.images.map((url, index) => <button key={url} type="button" aria-pressed={index === selected}
        aria-label={`Show photo ${index + 1} of ${variant.images.length}`} onClick={() => setSelected(index)}>
        <img src={url} alt="" loading="lazy"/>
      </button>)}
    </div>}
  </div>;
}
