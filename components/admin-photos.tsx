import { makeListingCover, removeListingPhoto } from '../app/admin/actions';
import { PhotoUpload } from './photo-upload';
import { photoUploadsEnabled } from '../lib/cloudinary';
import { productPhotos } from '../lib/product-photos';
import { maxProductPhotos } from '../lib/types';

export async function AdminPhotos({ product, listingCount }: { product: string; listingCount: number }) {
  const photos = await productPhotos(product);
  const listing = photos.filter(photo => photo.purpose === 'listing');
  const issues = photos.filter(photo => photo.purpose === 'issue');
  const enabled = photoUploadsEnabled();
  return <div className="admin-grid spaced">
    <section className="panel form-stack">
      <h2>Listing photos</h2>
      <p className="muted">{listingCount} of {maxProductPhotos} photos. The cover appears on product cards.</p>
      {enabled && listingCount < maxProductPhotos && <PhotoUpload product={product} purpose="listing" slots={maxProductPhotos - listingCount}/>}
      {enabled && listingCount >= maxProductPhotos && <p className="muted">Remove a photo to add another.</p>}
      {!enabled && <p className="notice">Configure Cloudinary to upload photos.</p>}
      {listing.length > 0 && <ul className="admin-photo-list">
        {listing.map((photo, index) => <li key={photo.id}>
          <img src={photo.url ?? ''} alt={`Listing photo ${index + 1}`} loading="lazy"/>
          <div className="prompt-row">
            {index === 0 ? <strong>Cover</strong> : <form action={makeListingCover}>
              <input type="hidden" name="product" value={product}/><input type="hidden" name="photo" value={photo.id}/>
              <button className="text-button">Make cover</button>
            </form>}
            <form action={removeListingPhoto}>
              <input type="hidden" name="product" value={product}/><input type="hidden" name="photo" value={photo.id}/>
              <button className="text-button" aria-label={`Remove listing photo ${index + 1}`}>Remove</button>
            </form>
          </div>
        </li>)}
      </ul>}
    </section>
    <section className="panel form-stack">
      <h2>Product issue photos</h2>
      <p className="muted">Visible to staff only. Use these to record defects or damage.</p>
      {enabled && <PhotoUpload product={product} purpose="issue"/>}
      {issues.length > 0 && <ul className="admin-photo-list">
        {issues.map((photo, index) => <li key={photo.id}>
          <a href={`/api/admin/issue-photos/${photo.id}`} target="_blank" rel="noreferrer">
            <img src={`/api/admin/issue-photos/${photo.id}`} alt={`Open issue photo ${index + 1}`} loading="lazy"/>
          </a>
          {photo.note && <p>{photo.note}</p>}
        </li>)}
      </ul>}
    </section>
  </div>;
}
