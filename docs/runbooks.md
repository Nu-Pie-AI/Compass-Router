# Runbooks

## Provider Outage

Disable provider, verify health checks, route traffic to healthy providers, and review failed attempts.

## Database Outage

Stop deployments, verify Cloud SQL status, fail over or restore according to Cloud SQL recovery point objective.

## Payment Outage

Disable top-ups, keep API usage running for funded wallets, replay verified webhooks after recovery.

## Bad Deployment

Roll back Cloud Run to the previous image digest and verify `/health/ready`.

## Credential Rotation

Create new secret version, test provider health, mark old secret disabled, audit access logs.
