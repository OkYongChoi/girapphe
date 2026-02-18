# API Specification

## Base

- Runtime: Next.js Route Handlers
- Content type: `application/json`

## GET `/api/graph`

Returns full graph for a user, including knowledge overlays and aggregate stats.

### Query params

- `user_id` (optional): user identifier for personalized graph view.

### Response `200`

```json
{
  "nodes": [
    {
      "id": "gradient_descent",
      "label": "Gradient Descent",
      "domain": "Optimization",
      "level": 2,
      "difficulty": 3,
      "type": "algorithm",
      "knowledge": 0.7,
      "confidence": 0.85,
      "growth_daily": 0.02,
      "growth_weekly": 0.1,
      "growth_monthly": 0.3
    }
  ],
  "links": [
    {
      "source": "partial_derivatives",
      "target": "gradient_descent",
      "type": "prerequisite",
      "weight": 0.8
    }
  ],
  "stats": {
    "total_nodes": 247,
    "known": 35,
    "partial": 42,
    "unknown": 170,
    "avg_knowledge": 0.28,
    "domains": {}
  }
}
```

## POST `/api/quiz_result`

Submits the result of an assessment for a single node.

### Request body

```json
{
  "user_id": "u123",
  "node_id": "gradient_descent",
  "result": 1
}
```

### Validation

- `node_id` is required.
- `result` is required.
- `result` must be one of: `0`, `0.5`, `1`.

### Backend processing flow

1. Direct node update
2. Local propagation to adjacent nodes
3. Global diffusion pass
4. Timestamp updates (`last_updated`, optional `first_known_at`)

### Response `200`

```json
{
  "success": true,
  "node": {
    "id": "gradient_descent",
    "knowledge": 1,
    "confidence": 0.9
  },
  "knowledge_state": 1,
  "confidence": 0.9,
  "propagated_count": 5,
  "first_known_at": "2026-02-18T01:00:00.000Z"
}
```

### Error responses

- `400`: invalid payload
- `500`: internal error

## GET `/api/health`

Returns service availability and storage mode health.

### Response

- `200` with status `ok` when healthy.
- `503` with status `degraded` when DB-configured mode is unreachable.
