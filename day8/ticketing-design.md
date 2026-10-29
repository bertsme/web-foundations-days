# TicketHub: Event Ticketing System Design

## 1. Requirements

### Functional

- Visitors can browse and search events, then view an event's seat map and current availability.
- A signed-in user can temporarily hold available seats, pay for an order, and view or cancel eligible tickets.
- Users can see clear hold expiry, payment, and purchase status.
- Event organizers can create events, define seating, set prices, and monitor sales.

### Non-functional

- **Correctness:** a seat can belong to at most one active hold or completed order; payment retries must not create duplicate charges or tickets.
- **Fairness:** queue buyers during a high-demand sale and admit them at a controlled rate; use a short, visible hold timer and do not let clients reserve seats by merely viewing them.
- **Speed:** event pages and seat maps should load quickly, while the purchase path prioritizes correct, current inventory over stale cached data.
- **Availability:** browsing should remain available during component failures; checkout should fail safely rather than promise a seat it cannot reserve.
- **Security:** authenticate buyers, authorize organizer actions, validate input, and never store raw payment card details.

## 2. Traffic and storage estimates

### Assumptions

- A day has 86,400 seconds. Normal-day visits are spread across the day; a 5x multiplier represents ordinary busy periods.
- During the popular sale, the stated 200,000 people arrive over 10 minutes and each attempts to buy one seat. They first load event/seat data and make one hold attempt. Retry traffic is rate limited and excluded from the base estimate.
- TicketHub stores ticket/order records and event data, not uploaded media. Allow 2 KB per ticket/order record for a rough storage estimate; logs, backups, indexes, and payment-provider records are excluded.

### Normal day

- Page views: 50,000 visitors × 10 pages = **500,000 page views/day**.
- Average page/API read rate: 500,000 ÷ 86,400 = **5.8 reads/second**; at 5x busy-hour load, about **29 reads/second**.
- Completed ticket sales: 5,000 ÷ 86,400 = **0.058 tickets/second** on average, or about **5,000 ticket writes/day**.
- Ticket record storage: 5,000 × 2 KB × 365 = **3.65 GB/year**. Event, user, index, and backup storage add to this estimate.

### Popular sale

- Buyer arrival/seat-map read rate: 200,000 ÷ 600 seconds = **about 333 reads/second**.
- If each buyer makes one seat-hold attempt, the inventory path receives **about 333 hold attempts/second** for the event.
- There are only 20,000 seats, so successful holds/sales cannot exceed **about 33.3 seats/second** over the 10-minute window. The other requests must see unavailable seats or remain in a queue; they must not cause overselling.
- The sale's arrival rate is about **57 times** the estimated normal busy-hour read rate. Cacheable event details can absorb much of the read load, but live seat availability and holds must reach the authoritative database.

## 3. API design

All endpoints use HTTPS and JSON. Buyer endpoints require an authenticated user. Organizer endpoints also check organizer permissions. Mutating requests accept an `Idempotency-Key` so network retries return the original result.

| Method and path | Purpose | Success / common errors |
|---|---|---|
| `GET /v1/events?query=&cursor=` | Browse published events using cursor pagination. | `200`, `400` |
| `GET /v1/events/{eventId}` | Read event details. | `200`, `404` |
| `GET /v1/events/{eventId}/seats` | Read seat labels, prices, and a near-current availability snapshot. | `200`, `404` |
| `POST /v1/events/{eventId}/holds` | Atomically hold one or more seats for the signed-in buyer. | `201`, `400`, `401`, `409`, `429` |
| `POST /v1/orders/{orderId}/payment` | Request payment for a held order through the payment provider. | `202`, `401`, `404`, `409`, `429` |
| `GET /v1/me/tickets` | List the signed-in buyer's purchased tickets. | `200`, `401` |
| `DELETE /v1/holds/{holdId}` | Release a buyer's unpurchased hold. | `204`, `401`, `404`, `409` |

### List events request and response

```http
GET /v1/events?query=music&cursor=eyJwYWdlIjoyfQ
Authorization: Bearer <access-token>
```

```json
{
  "items": [
    { "id": "evt_482", "name": "Summer Sounds", "startsAt": "2027-07-12T19:00:00Z", "venue": "City Arena" }
  ],
  "nextCursor": null
}
```

### Create a seat hold request and response

```http
POST /v1/events/evt_482/holds
Authorization: Bearer <access-token>
Idempotency-Key: 3f1385b4-4418-4bd5-8e69-8c9fa73ad1b8
Content-Type: application/json
```

```json
{ "seatIds": ["seat_A12", "seat_A13"] }
```

```http
HTTP/1.1 201 Created
```

```json
{
  "holdId": "hold_813",
  "orderId": "ord_771",
  "seatIds": ["seat_A12", "seat_A13"],
  "expiresAt": "2027-07-01T10:05:00Z",
  "status": "held"
}
```

If another buyer already holds a requested seat, return `409 Conflict` with an error code such as `SEAT_UNAVAILABLE`. Never return a successful hold for only part of a multi-seat request unless the API explicitly offers that behavior.

## 4. Data model

Use a relational database (for example PostgreSQL) for inventory, holds, and orders because foreign keys, transactions, unique constraints, and row-level locks protect purchase correctness.

### Tables and relationships

- **users**: one user can place many orders.
- **events**: one event has many seats and orders.
- **seats**: each seat belongs to one event; its state is `available`, `held`, or `sold`.
- **orders**: one buyer and one event per order; status progresses through `pending`, `paid`, `expired`, or `cancelled`.
- **order_items**: joins orders to seats and stores the purchase price snapshot. A seat can have many historical order-item rows over time, but at most one active reservation or paid sale.

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  sale_starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'cancelled'))
);

CREATE TABLE seats (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id),
  seat_label TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'held', 'sold')),
  hold_order_id BIGINT,
  hold_expires_at TIMESTAMPTZ,
  UNIQUE (event_id, seat_label)
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  event_id BIGINT NOT NULL REFERENCES events(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  seat_id BIGINT NOT NULL REFERENCES seats(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  UNIQUE (order_id, seat_id)
);

ALTER TABLE seats
  ADD CONSTRAINT seats_hold_order_fk FOREIGN KEY (hold_order_id) REFERENCES orders(id);

```

Indexes for the main lookups:

```sql
CREATE INDEX events_published_start ON events (starts_at) WHERE status = 'published';
CREATE INDEX seats_event_status ON seats (event_id, status);
CREATE INDEX orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX seats_expired_holds ON seats (hold_expires_at) WHERE status = 'held';
```

These support event browsing, event seat-map retrieval, a buyer's order history, and efficient discovery of expired holds. The seat row and its transactionally updated state enforce the active inventory invariant; `UNIQUE (event_id, seat_label)` prevents duplicate seat definitions.

### Example queries

```sql
-- 1. Browse published events.
SELECT id, name, venue, starts_at
FROM events
WHERE status = 'published' AND starts_at >= now()
ORDER BY starts_at
LIMIT 20;

-- 2. Read a seat map with its current state.
SELECT seat_label, price_cents, status, hold_expires_at
FROM seats
WHERE event_id = $1
ORDER BY seat_label;

-- 3. List tickets and event details for a buyer (JOIN).
SELECT e.name, e.starts_at, s.seat_label, oi.price_cents, o.status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN seats s ON s.id = oi.seat_id
JOIN events e ON e.id = o.event_id
WHERE o.user_id = $1 AND o.status = 'paid'
ORDER BY e.starts_at;

-- 4. Release timed-out holds in small batches; production worker also checks order status.
UPDATE seats
SET status = 'available', hold_order_id = NULL, hold_expires_at = NULL
WHERE id IN (
  SELECT id FROM seats
  WHERE status = 'held' AND hold_expires_at < now()
  ORDER BY hold_expires_at
  FOR UPDATE SKIP LOCKED
  LIMIT 500
);
```

### Preventing two buyers from purchasing one seat

The hold operation runs in a database transaction. It creates/reuses an idempotent pending order, then updates each requested seat only when `status = 'available'` (or when an earlier hold has expired). For multiple seats, lock rows in sorted ID order and roll back the whole transaction if any seat update fails. The conditional update is atomic: concurrent requests for the same seat serialize on its row, and only the first can change it from available to held. The transaction writes the hold expiry and order items before commit. Payment is requested after the hold commits; on verified payment success, a second transaction changes the seats from held by that order to sold and marks the order paid. If payment fails or the hold expires, a worker conditionally releases only seats still held by that order. Idempotency keys and payment-provider event IDs make retries safe. The application never confirms a ticket using a cached seat-map result.

For a single seat, the core compare-and-set is:

```sql
UPDATE seats
SET status = 'held', hold_order_id = $2, hold_expires_at = $3
WHERE id = $1 AND event_id = $4
  AND (status = 'available' OR (status = 'held' AND hold_expires_at <= now()))
RETURNING id;
```

No returned row means the seat is unavailable and the transaction must not confirm the hold. A multi-seat request repeats this for every seat in one transaction and rolls back if any update returns no row.

## 5. Architecture and purchase flows

```text
Buyers / Organizers
        |
      DNS
        |
 CDN + WAF -------------- Static event pages, images, cached public event details
        |
 Load balancer
    /        \
App server A  App server B   (stateless, multiple instances)
    |        /
    +---- distributed cache (event metadata, short-lived seat-map snapshots)
    |
 API rate limiter / virtual sale queue
    |                         \
Primary relational DB            Payment provider
    |                                  |
Read replica                    signed payment events
    |
Durable queue --> hold-expiry / ticket worker --> email/notification provider
```

- **DNS** directs buyers to the service's healthy public endpoint.
- **CDN + WAF** serves static content near users, caches public event details, and filters common abusive traffic.
- **Load balancer** distributes requests across healthy application instances and removes failed instances from rotation.
- **Virtual sale queue and rate limiter** admit buyers at a controlled rate during a high-demand sale and protect inventory writes.
- **Stateless app servers** validate requests, enforce authentication and permissions, and run the hold/order transactions.
- **Distributed cache** reduces repeated reads for event descriptions and seat-map snapshots; it is never the authority for a hold or sale.
- **Primary relational database** serializes seat-state changes and stores users, inventory, holds, orders, and tickets.
- **Read replica** serves safe, slightly stale reads such as event listings and ticket-history views while the primary handles checkout.
- **Durable queue and workers** expire holds, issue ticket notifications, and retry background work without blocking buyer requests.
- **Payment provider** securely collects payment details and sends signed success/failure events; TicketHub stores provider references, not card numbers.

### Browse and view seats

1. DNS resolves the TicketHub domain and the CDN serves static assets and cached public event details.
2. The browser requests event and seat-map data through the load balancer; an app server checks the cache first.
3. If data is missing, the app reads event details or a seat availability snapshot from the database/replica and caches only data that can safely be stale.
4. The client labels the map as a snapshot; before a purchase, the primary database rechecks availability.

### Hold and purchase seats

1. A buyer passes through the sale queue and sends a hold request with an idempotency key.
2. The app validates the buyer, sale window, seat IDs, and queue token, then starts a transaction on the primary database.
3. It conditionally changes every requested available seat to held with an expiry and creates order items. If any seat is no longer available, the transaction rolls back and returns `409`.
4. The app commits the hold and returns its expiry. The buyer pays through the payment provider while the hold is active.
5. A verified provider event triggers an idempotent transaction that marks the order paid and its seats sold; the worker then issues tickets and sends confirmation.
6. If payment fails or time runs out, the expiry worker releases seats only if they remain held by that order.

## 6. Trade-offs and resilience

1. **Correctness over checkout availability:** the primary database is a serialization point for a seat. If it is unavailable, checkout pauses rather than selling a seat twice. Replication, automated failover, backups, and tested recovery reduce downtime, but a failover can still briefly pause sales.
2. **Queue fairness versus instant access:** a virtual queue smooths the 333-per-second arrival burst and reduces database contention, but buyers wait and queue position must be transparent. Rate limits and signed queue tokens prevent clients from skipping ahead.
3. **Freshness versus speed:** cached seat maps make browsing fast but may show a seat that another buyer just held. The checkout always checks the primary, so a stale map can cause a retry but cannot cause an oversale.
4. **Short holds versus payment completion:** short expiries return abandoned seats quickly but can inconvenience slow buyers. Show a clear timer and use a bounded payment grace process; never extend a hold without atomically confirming it is still owned by that order.

### Avoiding single points of failure

Run multiple app servers across failure zones behind health-checked load balancers; replicate and back up the database with a rehearsed failover path; use a highly available cache and durable replicated queue; and configure CDN, DNS, payment-provider, and notification-provider health monitoring. Queue, worker, and provider outages must leave order state recoverable and must not mark a ticket paid without verified payment confirmation.
