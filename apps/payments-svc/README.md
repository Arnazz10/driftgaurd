# payments-svc

Tiny Go HTTP service used for the DriftGuard blue-green rollout.

## Local run

```bash
VERSION=local FAIL_RATE=0 go run .
curl http://localhost:8080/
curl http://localhost:8080/metrics
```

Set `FAIL_RATE=0.5` to make roughly half of root requests fail with HTTP 500.

