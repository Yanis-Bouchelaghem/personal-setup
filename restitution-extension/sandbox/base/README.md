# Gateway adapter

Proxies inference and marketplace calls to the gateway through Apigee.

## Configuration

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, 8080 by default |
| `ADAPTER_APIGEE_URL` | Base URL of the Apigee proxy |
| `ADAPTER_TOKEN` | Bearer token for the gateway |

## Routes

- `POST /v1/inference` forwards the body to the gateway.
- `GET /v1/marketplace` returns the rewritten plugin catalog.

## Running

```sh
npm run build && node dist/index.js
```
