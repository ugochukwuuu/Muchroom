# Muchroom

Muchroom’s storefront and staff admin use one Next.js application and PostgreSQL. The storefront includes a product finder that interprets plain English with local rules and ranks available variants using their catalogue data.

## Start locally

1. Install Node.js 24 and run `npm install`.
2. Run `npm run dev` and open http://127.0.0.1:3000.
3. Open http://127.0.0.1:3000/admin and use the local demo password shown on the sign-in page.

With no database URL, development uses an embedded PostgreSQL database persisted under `.data/postgres`. It creates an illustrative catalogue, including a sold-out item for inventory testing, and confirms demo checkout orders without charging anyone. It never imports the demo catalogue when a database URL is provided.

Try “Laptop for coding under ₦400k”, then “make it ₦350k”. Record a walk-in sale against a variant, check stock and reports in the admin, then receive or correct stock and check the storefront again.

## Configure production

Provide `DATABASE_URL` pointing to a PostgreSQL database. The application initialises its tables on first connection, so the database user must have schema creation rights for initial setup. Set `ADMIN_PASSWORD` and a long, random `SESSION_SECRET`. The initial admin implementation uses one staff credential.

Online payment uses Paystack when `PAYSTACK_SECRET_KEY` and the public HTTPS `APP_URL` are configured. Point Paystack at `APP_URL/api/paystack/webhook`. Use a Paystack test key in a test environment before taking payments. A checkout reserves stock for 20 minutes, and a verified payment after expiry enters the admin review queue. Staff reconcile those payments in Paystack.

Pickup is available by default. Set `DELIVERY_FEE_NGN` to enable delivery with the configured flat fee. Staff add the actual product catalogue through Inventory. Run `npm run build`, then `npm start` on a Node.js host with database access.

## Product photos

Copy the cloud name, API key and API secret from Cloudinary Console → Settings → API Keys. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `.env.local` or the deployment environment. Restart the app. Uploads are signed on the server.

When creating or editing a product in Admin → Inventory, choose files or use Take photo to add up to three listing photos. Preview or remove each selection before saving. For an existing product, staff can also manage uploads and choose the storefront cover in Listing photos. Removed photos stay in the Cloudinary Media Library.

Use Product issue photos to document defects or damage with an optional note. The app uploads these as authenticated Cloudinary assets and requires a staff session to view them. Each file can be up to 8 MB and must be JPEG, PNG or WebP.

## AI fill for products

Set `GEMINI_API_KEY` in `.env.local` or the deployment environment, then restart the app. The default model is Gemini 3.5 Flash-Lite. Set `GEMINI_MODEL` to override it.

In the inventory product form, choose a JPEG, PNG or WebP up to 4 MB, or select **Take photo** to capture one with your camera. Select **Use AI to fill** to send the photo to Gemini and fill editable fields. Review them before saving. **Clear AI fill** discards the selected photo and restores the previous values of fields you have not edited since the scan. If Cloudinary is configured, you can attach the same photo when saving.

The storefront hero photograph is [by XPS on Unsplash](https://unsplash.com/photos/turned-on-black-laptop-computer-on-desk-rJ8MF_jWkOo).
