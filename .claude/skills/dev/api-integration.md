---
name: api-integration
description: >
  Document, implement, and troubleshoot integrations with external APIs including
  advertising platforms, affiliate networks, AI generation services, and data providers.
  Use this skill whenever implementing or documenting a connection to any external API
  such as Facebook Ads, Google Ads, Meta Ad Library, YouTube Data API, Hotmart, ClickBank,
  Anthropic, image or video generation APIs, or storage services. Triggers on: integrate with,
  connect to API, Facebook Ads API, Google Ads API, Hotmart API, Meta Ad Library, webhook,
  OAuth, or any request involving external service connectivity.
---

# API Integration Documentation

A skill for implementing and documenting integrations with external APIs in a consistent, secure, and resilient pattern.

---

## Integration Documentation Template

For every external API integration, document:

```markdown
## {Service Name} Integration

### Purpose
What this integration enables in the platform.

### Authentication
- Type: OAuth 2.0 | API Key | Bearer Token
- Credentials stored: {table.column in database}
- Refresh mechanism: {how tokens are refreshed}

### Rate Limits
- Requests per hour/day: {number}
- Quota unit cost per operation: {if applicable}
- Rate limit response: HTTP {status code}
- Our handling: {retry strategy}

### Endpoints Used
| Endpoint | Method | Purpose | Rate cost |
|---|---|---|---|
| /endpoint | POST | What it does | 1 unit |

### Error Handling
| Error code | Meaning | Our response |
|---|---|---|
| 400 | Bad request | Log and notify user |
| 401 | Auth expired | Refresh token and retry |
| 429 | Rate limited | Backoff and queue |
| 500 | Server error | Retry with backoff |

### Data Flow
Input → transformation → API call → response → output

### Fallback Behavior
What happens if this integration is unavailable.
```

---

## Meta Ads API (Facebook Ads)

### Authentication
OAuth 2.0. User connects their Facebook account via the Meta for Developers flow.

```python
# app/tools/facebook_ads.py
import httpx
from app.config import CredentialManager

BASE_URL = "https://graph.facebook.com/v19.0"

async def create_campaign(
    ad_account_id: str,
    user_id: str,
    name: str,
    objective: str,
    status: str = "PAUSED"  # Always start PAUSED — human approves before activating
) -> dict:
    """
    Create a Facebook Ads campaign.
    Always creates in PAUSED status — never active without human approval.
    """
    credentials = CredentialManager()
    access_token = credentials.get_api_key("facebook_access_token", user_id)
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/act_{ad_account_id}/campaigns",
            json={
                "name": name,
                "objective": objective,
                "status": status,
                "special_ad_categories": []
            },
            params={"access_token": access_token}
        )
        
        if response.status_code == 429:
            raise RateLimitError("facebook_ads", retry_after=60)
        
        response.raise_for_status()
        return response.json()
```

### Scopes Required
```
ads_management
ads_read
business_management
```

### Rate Limits
- 200 calls per hour per ad account
- Managed by central RateLimiter with key `facebook_ads`

---

## Meta Ad Library API

### Authentication
App access token (no user OAuth required). Register app at developers.facebook.com.

```python
# app/tools/search_ad_library.py
import httpx
import os

AD_LIBRARY_URL = "https://graph.facebook.com/v19.0/ads_archive"

async def search_ads(
    search_terms: str,
    ad_reached_countries: list[str],
    ad_type: str = "ALL",
    limit: int = 20,
    fields: list[str] = None
) -> list[dict]:
    """
    Search Meta Ad Library for ads matching criteria.
    Returns ads with creative content, run dates, and page info.
    Does NOT return performance metrics (spend, reach) — those are private.
    """
    if fields is None:
        fields = [
            "id", "ad_creation_time", "ad_delivery_start_time",
            "ad_creative_bodies", "ad_creative_link_descriptions",
            "ad_creative_link_titles", "ad_snapshot_url",
            "page_name", "page_id"
        ]
    
    params = {
        "search_terms": search_terms,
        "ad_reached_countries": ad_reached_countries,
        "ad_type": ad_type,
        "fields": ",".join(fields),
        "limit": limit,
        "access_token": os.environ["META_APP_ACCESS_TOKEN"]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(AD_LIBRARY_URL, params=params)
        response.raise_for_status()
        return response.json().get("data", [])
```

### Rate Limits
- 60 requests per hour (free tier)
- Quota managed with key `meta_ad_library`

---

## YouTube Data API v3

### Authentication
API Key (no OAuth needed for public data searches).

```python
# app/tools/search_youtube.py
import httpx
import os

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3"

# Quota costs per operation
QUOTA_COSTS = {
    "search": 100,
    "videos.list": 1,
    "commentThreads.list": 1,
    "captions.list": 50,
}

async def search_videos(
    query: str,
    max_results: int = 10,
    order: str = "relevance",
    video_duration: str = "medium"  # short | medium | long
) -> list[dict]:
    """
    Search YouTube videos. Costs 100 quota units per call.
    Use sparingly — daily limit is 10,000 units.
    """
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "order": order,
        "videoDuration": video_duration,
        "key": os.environ["YOUTUBE_API_KEY"]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{YOUTUBE_API_URL}/search", params=params)
        response.raise_for_status()
        return response.json().get("items", [])

async def get_video_transcript(video_id: str) -> str | None:
    """
    Attempt to get video transcript via captions API.
    Returns None if video has no public captions.
    Costs 50 quota units.
    """
    # Implementation
    pass

async def get_video_comments(video_id: str, max_results: int = 100) -> list[dict]:
    """
    Get top comments for a video.
    Critical for extracting audience language patterns.
    Costs 1 quota unit per call.
    """
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": max_results,
        "order": "relevance",
        "key": os.environ["YOUTUBE_API_KEY"]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{YOUTUBE_API_URL}/commentThreads", params=params)
        response.raise_for_status()
        return response.json().get("items", [])
```

### Quota Management
```python
# Daily quota: 10,000 units (free tier)
# Each search.list costs 100 units
# Safe daily search budget: 80 searches (8,000 units, leaving buffer)

async def check_youtube_quota_available(cost: int) -> bool:
    """Check if we have quota available before making a call."""
    from app.orchestration.rate_limiter import RateLimiter
    rate_limiter = RateLimiter()
    return rate_limiter.can_proceed("youtube_data", cost)
```

---

## Hotmart API

### Authentication
OAuth 2.0 with client credentials.

```python
# app/tools/hotmart.py
import httpx
import os

HOTMART_API_URL = "https://developers.hotmart.com/payments/api/v1"
HOTMART_AUTH_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token"

async def get_access_token() -> str:
    """Get Hotmart OAuth token using client credentials."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            HOTMART_AUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": os.environ["HOTMART_CLIENT_ID"],
                "client_secret": os.environ["HOTMART_CLIENT_SECRET"]
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        response.raise_for_status()
        return response.json()["access_token"]

async def get_product_details(product_id: str) -> dict:
    """
    Get product information available to affiliates.
    Returns: name, price, commission, description.
    Does NOT return VSL or sales page content.
    """
    token = await get_access_token()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{HOTMART_API_URL}/products/{product_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        return response.json()
```

---

## Cloudflare R2 Storage

### Authentication
AWS-compatible S3 API with R2-specific endpoint.

```python
# app/storage.py
import boto3
from botocore.config import Config
import os
import uuid

def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['CLOUDFLARE_R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto"
    )

async def upload_file(
    file_content: bytes,
    file_extension: str,
    folder: str,
    content_type: str
) -> str:
    """
    Upload file to R2 and return permanent public URL.
    
    Atomicity guarantee: if upload fails, raises exception immediately.
    Caller must catch and NOT save metadata to database.
    """
    client = get_r2_client()
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    file_key = f"{folder}/{uuid.uuid4()}.{file_extension}"
    
    client.put_object(
        Bucket=bucket,
        Key=file_key,
        Body=file_content,
        ContentType=content_type
    )
    
    # Return permanent URL
    return f"https://pub-{os.environ['CLOUDFLARE_R2_ACCOUNT_ID']}.r2.dev/{file_key}"

async def delete_file(file_url: str) -> None:
    """Delete a file from R2. Only called by user-initiated deletion."""
    client = get_r2_client()
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    # Extract key from URL
    key = file_url.split(f".r2.dev/")[1]
    client.delete_object(Bucket=bucket, Key=key)
```

---

## Atomic Save Pattern (R2 + Supabase)

Critical: file and metadata must be saved together or not at all.

```python
# app/orchestration/asset_saver.py
async def save_asset_atomically(
    file_content: bytes,
    file_extension: str,
    content_type: str,
    asset_metadata: dict,
    execution_id: str,
    project_id: str,
    user_id: str,
    max_retries: int = 10
) -> dict:
    """
    Save file to R2 and metadata to Supabase atomically.
    Retries indefinitely until both succeed.
    Never returns partial state.
    """
    supabase = get_supabase()
    
    for attempt in range(max_retries):
        try:
            # Step 1: Upload to R2
            file_url = await upload_file(
                file_content, file_extension,
                folder=f"executions/{execution_id}",
                content_type=content_type
            )
            
            # Step 2: Save to Supabase
            result = supabase.table("assets").insert({
                "execution_id": execution_id,
                "project_id": project_id,
                "user_id": user_id,
                "file_url": file_url,
                "integrity_status": "valid",
                **asset_metadata
            }).execute()
            
            # Both succeeded
            return result.data[0]
            
        except Exception as e:
            if attempt == max_retries - 1:
                # Notify user — never silently fail
                await notify_save_failure(execution_id, str(e))
                raise
            
            # Exponential backoff
            await asyncio.sleep(min(2 ** attempt, 30))
    
    raise RuntimeError("Failed to save asset after max retries")
```

---

## Webhook Pattern (for ad platform callbacks)

```python
# app/api/webhooks.py
from fastapi import APIRouter, Request, HTTPException
import hmac
import hashlib

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/facebook")
async def facebook_webhook(request: Request):
    """
    Receive real-time updates from Facebook Ads.
    Verify signature before processing.
    """
    # Verify webhook signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()
    
    expected = hmac.new(
        os.environ["FACEBOOK_APP_SECRET"].encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(f"sha256={expected}", signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    payload = await request.json()
    # Process webhook payload
    return {"status": "received"}
```
