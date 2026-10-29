# SnapShare: Scaling a Photo-Sharing App

## Assumptions

- SnapShare has 10 million registered users, and 10% are active on a typical day: **1 million daily active users (DAU)**.
- Each active user uploads one photo and views 50 feed pages per day.
- Each original photo is 2 MB and each photo gets one 50 KB thumbnail.
- Activity is spread across 24 hours for the average-rate calculation. Peak rates use the assignment's 5× multiplier.
- One feed view is one API page request. A page can contain many photos, whose image files are served separately through the CDN.
- The storage estimate keeps every original and thumbnail for 365 days. It uses decimal units (1 TB = 1,000,000 MB), and excludes replicas, backups, metadata and growth beyond one year.

## Back-of-the-envelope estimates

There are 86,400 seconds in a day.

| Measure | Calculation | Average rate / annual amount | Peak rate |
| --- | --- | ---: | ---: |
| Daily active users | 10,000,000 × 10% | 1,000,000 users/day | — |
| Photo uploads | 1,000,000 ÷ 86,400 | 11.6 uploads/second | 57.9, about **58 uploads/second** |
| Feed page views | 1,000,000 × 50 ÷ 86,400 | 579 views/second | 2,894, about **2,900 views/second** |
| Originals stored per year | 1,000,000 × 2 MB × 365 | **730 TB/year** | — |
| Thumbnails stored per year | 1,000,000 × 50 KB × 365 | **18.25 TB/year** | — |
| Total photo files | 730 TB + 18.25 TB | **748.25 TB/year** | — |

Feed reads outnumber uploads by about 50 to 1, so SnapShare is **read-heavy**. The design prioritizes fast feed reads with caching, a read replica and CDN delivery, while keeping the upload path reliable and processing thumbnails asynchronously.

## Architecture

```text
                         ┌───────────────────────────┐
                         │       Object Storage      │
                         │ originals + thumbnails   │
                         └───────────▲───────────────┘
                                     │ write thumbnail
                              ┌──────┴──────┐
                              │   Worker    │◄──────┐
                              │ thumbnails  │       │ job
                              └─────────────┘  ┌────┴─────┐
                                               │  Queue   │
                                               └────▲─────┘
                                                    │ enqueue
┌─────────┐   ┌─────┐   ┌──────────┐   ┌────────────┴───┐
│ Clients │──>│ DNS │──>│   CDN    │──>│ Load Balancer  │
└────▲────┘   └─────┘   │ images + │   └───────┬────────┘
     │                  │ static UI│       ┌────┴────┐
     └──────────────────┴──────────┘       │         │
                                      ┌─────▼───┐ ┌───▼──────┐
                                      │ App Srv 1│ │ App Srv 2│
                                      └───┬───┬──┘ └───┬───┬──┘
                                          │   │        │   │
                                          │   └────┬───┘   │
                                          │      ┌─▼─┐     │
                                          │      │Cache    │
                                          │      └───┘     │
                                   writes │                │ reads
                                      ┌───▼────────┐   ┌───▼────────┐
                                      │  Primary   │──>│ Read       │
                                      │ Database   │   │ Replica    │
                                      └────────────┘   └────────────┘
```

### What each component does

- **Client:** uploads photos and requests the feed from the app API.
- **DNS:** maps the SnapShare host name to the CDN or API entry point.
- **CDN:** serves cached static assets and photo files from locations close to users, reducing origin traffic and image latency.
- **Load balancer:** distributes API requests across healthy application servers and removes unhealthy servers from rotation.
- **App servers:** authenticate users, enforce permissions, manage photo metadata and coordinate database, storage and queue operations.
- **Cache:** keeps frequently requested feed pages and metadata in memory to reduce repeated database reads.
- **Primary database:** stores durable user, follow, post and photo metadata and accepts writes.
- **Read replica:** serves read-only feed queries so high read traffic does not overwhelm the primary database.
- **Object storage:** durably stores large original and thumbnail files outside the relational database.
- **Queue:** buffers thumbnail work so slow image processing does not delay a successful photo upload.
- **Thumbnail worker:** consumes queued jobs, creates a smaller image and writes it back to object storage.

## Photo upload flow

1. The client asks the API to start an upload. The app server checks the user's identity and permissions, creates a pending photo record, and returns a short-lived signed upload URL for object storage.
2. The client uploads the 2 MB original directly to object storage using that URL; the large file does not pass through the application server.
3. The client tells the API the upload completed. The app server verifies the object key, marks the photo as processing and publishes a thumbnail job to the queue.
4. A worker picks up the job, reads the original, creates a 50 KB thumbnail and stores it in object storage.
5. The worker updates the photo metadata to ready. The API can now include the thumbnail URL in feed results, and the CDN caches the image for later views.

## Trade-offs

- **Asynchronous thumbnails improve upload latency but make the photo briefly unavailable in the feed.** The app shows a processing state and retries failed jobs; queue depth and job age are monitored so delays are visible.
- **A read replica and cache increase read capacity but can return slightly stale feeds.** SnapShare accepts short replica lag for feed browsing, while writes and permission checks use the primary database and cache entries are invalidated or expire after updates.
- **CDN caching lowers latency and bandwidth costs but makes deletions and privacy changes harder to propagate immediately.** Photo URLs use authorization-aware access or short-lived signed links, and sensitive cache entries receive short TTLs or explicit invalidation.
- **Direct-to-object-storage uploads reduce application-server bandwidth but add a multi-step upload flow.** The API tracks pending uploads, expires abandoned records and validates completion before publishing a photo.

## Availability and failure handling

Application servers run in at least two independent instances behind the load balancer, so one server failure does not stop the API. The database uses a primary and replica with automated health checks and a documented failover process; the queue and object storage use their managed redundancy features. Monitoring alerts on API error rate, latency, replica lag, storage failures, queue depth and thumbnail processing time.
