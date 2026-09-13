# Demos

## 1. Successful Canary Promotion

1. Build and push a new `checkout-svc` image tag.
2. Update `charts/checkout-svc/values-dev.yaml`:
   ```yaml
   image:
     tag: v2
   env:
     version: v2
     failRate: "0"
   ```
3. Commit and push the change.
4. Watch Argo Rollouts:
   ```bash
   kubectl argo rollouts get rollout checkout-svc -n dev --watch
   ```
5. Confirm the rollout moves through 20, 40, 60, and 100 percent after Prometheus analysis succeeds.

## 2. Blue-Green Promotion

1. Build and push a new `payments-svc` image tag.
2. Update `charts/payments-svc/values-dev.yaml` with the new tag and version.
3. Commit and push.
4. Watch the preview stack:
   ```bash
   kubectl argo rollouts get rollout payments-svc -n dev --watch
   ```
5. Promote after preview analysis succeeds:
   ```bash
   kubectl argo rollouts promote payments-svc -n dev
   ```

## 3. Automatic Rollback

1. Push a new service image tag.
2. Set `env.failRate: "0.5"` in the target chart values file.
3. Commit and push.
4. Watch the rollout:
   ```bash
   kubectl argo rollouts get rollout checkout-svc -n dev --watch
   ```
5. Prometheus should report a 5xx rate above the threshold, causing the AnalysisTemplate to fail and the rollout to abort.

Reset `failRate` to `"0"` and commit a good version to recover.

## 4. ArgoCD Self-Heal

1. Delete a live resource:
   ```bash
   kubectl delete service checkout-svc -n dev
   ```
2. Watch ArgoCD restore it from Git:
   ```bash
   kubectl get service checkout-svc -n dev --watch
   ```
3. In the ArgoCD UI, confirm the app briefly shows drift and returns to Synced/Healthy.

