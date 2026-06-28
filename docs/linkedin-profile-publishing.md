# eFruitMandi public-profile RSS and LinkedIn publishing

The backend creates one persistent publication record when a newly registered
profile becomes eligible. It exposes those records as RSS and can publish them
directly to the eFruitMandi LinkedIn Page.

## Eligibility and privacy

A registration is eligible only when:

- the owner explicitly enables the public-profile checkbox for that role;
- the account is active;
- the firm name, supported business type, city, and state are present;
- the profile was registered after this feature was deployed (legacy records
  without a per-role registration timestamp are not backfilled).

The stored publication snapshot contains only:

- firm name;
- business type;
- city and state;
- official company-logo URL, or the eFruitMandi branding image;
- public profile URL and generated post text.

Mobile numbers, email addresses, full addresses, contact-person names, personal
photos, KYC data, and private business fields are never copied into the
publication record or feed.

Supported labels are Grower, Buyer, Exporter, Commission Agent, Cold Storage,
and Logistics. Exporter, Commission Agent, and Cold Storage are buyer business
sub-types, so existing marketplace permissions remain unchanged.

## RSS feed

Production feed:

`https://api.efruitmandi.live/rss/public-profiles.xml`

Compatibility URL:

`https://api.efruitmandi.live/api/rss/public-profiles.xml`

Every item includes the standard RSS title, description, link, publication
date, and GUID, plus Media RSS image data and namespaced eFruitMandi fields for
firm logo, business type, city, state, and profile URL.

The GUID and database uniqueness key prevent a registration from appearing
twice. Profile edits update no published registration item and create no new
LinkedIn post.

## LinkedIn Page setup

1. Create or use a LinkedIn developer application with access to the Posts and
   Images APIs.
2. Grant the token `w_organization_social`.
3. Ensure the authenticated LinkedIn member is an Administrator, Direct
   Sponsored Content Poster, or Content Admin for the eFruitMandi Page.
4. Add the backend-only environment values documented in
   `apps/backend/.env.example`.
5. Set `LINKEDIN_PROFILE_PUBLISHING_ENABLED=true` only after the token and Page
   organization ID have been verified.

The publisher uses LinkedIn's versioned `/rest/images` and `/rest/posts` APIs.
Set `LINKEDIN_API_VERSION` to a currently supported `YYYYMM` version when
LinkedIn releases a newer version.

Image downloads are restricted to HTTPS and an explicit hostname allowlist to
prevent server-side requests to arbitrary hosts. Cloudinary and eFruitMandi
hosts are allowed by default.

## Featured profiles

Normal updates never republish. An authorized admin can explicitly queue one
new featured publication:

`POST /api/admin/users/:id/feature-profile`

JSON body:

```json
{
  "role": "grower"
}
```

The profile must still be public and meet every eligibility rule. Each explicit
feature action receives a new event identifier and therefore a new RSS item and
LinkedIn post.

## Failure behavior

Image download/upload failures and explicit retryable LinkedIn responses use
bounded exponential retries. If a post-creation request has an ambiguous
result, the record moves to `needs_review` and is not retried automatically;
this favors the “never publish twice” rule over risking a duplicate Page post.
