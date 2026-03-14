# Draft email: Spark/FlexMLS support — VOW subscription & history/historical errors

**Send to:** Your Spark Platform support contact or MLS technology contact (adjust greeting as needed).

---

**Subject:** VOW subscription — listing history & historical endpoints returning errors (400, 403, Code 1500)

---

Hi,

I recently switched my Spark API access to a **VOW (Virtual Office Website) subscription**. I’m still seeing errors when calling the **listing history** and **historical listings** endpoints. I’d like to confirm whether my VOW agreement includes access to these and, if so, what I need to change so the requests succeed.

**My situation**
- I use the Spark API to power a consumer-facing real estate site.
- My subscription is now **VOW**.
- I need to show **listing history** (status/event/price changes) and/or **historical listings** (off-market records for a property) where the MLS allows it for VOW.

**API calls and errors (tested with a real listing)**

I tested with **ListingKey/ListNumber 21627** (a valid listing in my synced database). Same errors occur with other listing IDs.

Request format:
- **Base URL:** `https://sparkapi.com/v1`
- **Auth header:** `Authorization: Bearer {my_access_token}`
- **Accept header:** `Accept: application/json`
- **Method:** GET (no query parameters on these endpoints)

**1) Listing History (status/event changes on a listing)**
- **Endpoint:** `GET https://sparkapi.com/v1/listings/{id}/history`
- **Exact request tested:** `GET https://sparkapi.com/v1/listings/21627/history`
- **Result:** **HTTP 400** Bad Request.

**2) Price history (under historical)**
- **Endpoint:** `GET https://sparkapi.com/v1/listings/{id}/historical/pricehistory`
- **Exact request tested:** `GET https://sparkapi.com/v1/listings/21627/historical/pricehistory`
- **Result:** **HTTP 403** Forbidden.

**3) Historical listings (off-market listings for same property)**
- **Endpoint:** `GET https://sparkapi.com/v1/listings/{id}/historical`
- **Exact request tested:** `GET https://sparkapi.com/v1/listings/21627/historical`
- **Result:** **HTTP 200** with a JSON body indicating permission denied (not a successful result):

```json
{
  "D": {
    "Message": "You do not have permission to perform the requested action",
    "Code": 1500,
    "Success": false
  }
}
```

**Summary of errors**
| Endpoint | HTTP status | Error code / body |
|----------|-------------|-------------------|
| `GET /v1/listings/21627/history` | **400** | Bad Request |
| `GET /v1/listings/21627/historical/pricehistory` | **403** | Forbidden |
| `GET /v1/listings/21627/historical` | **200** | **Code 1500** — "You do not have permission to perform the requested action" (`Success: false` in response body) |

**What I’m asking**
1. Does my current **VOW** subscription include access to any of these endpoints for our MLS?
2. If yes, what do I need to change (e.g. different endpoint, different auth, or an entitlement/flag on my account) so these calls succeed instead of returning 400, 403, or Code 1500?
3. If the MLS restricts history/historical for VOW, is there a different product or permission we can request to get listing history and/or historical listings for our site?

I’m happy to provide a redacted request sample or run another test with a specific listing if that would help troubleshoot.

Thank you,

[Your name]  
[Your company / site]  
[Contact email or phone]
