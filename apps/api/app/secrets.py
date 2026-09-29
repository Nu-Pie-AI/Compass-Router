from functools import lru_cache

from .config import get_settings
from .errors import compass_error


class SecretManager:
    """Small provider boundary for production secrets and local fallback storage."""

    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = settings.secret_manager_enabled
        self.project_id = settings.gcp_project_id
        self.prefix = settings.gcp_secret_manager_prefix.strip("/")

    def _client(self):
        try:
            from google.cloud import secretmanager
        except ImportError as exc:
            raise compass_error(503, "secret_manager_unavailable", "Google Cloud Secret Manager support is not installed.") from exc
        if not self.project_id:
            raise compass_error(503, "secret_manager_unavailable", "GCP_PROJECT_ID is required for Secret Manager-backed credentials.")
        return secretmanager.SecretManagerServiceClient()

    def _name(self, reference: str) -> str:
        if not reference.startswith("gcp-secret:"):
            raise ValueError("not a Secret Manager reference")
        secret_id = reference.removeprefix("gcp-secret:").strip("/")
        return f"projects/{self.project_id}/secrets/{secret_id}"

    def access(self, reference: str) -> str:
        client = self._client()
        response = client.access_secret_version(request={"name": f"{self._name(reference)}/versions/latest"})
        return response.payload.data.decode("utf-8")

    def put(self, secret_id: str, value: str) -> str:
        client = self._client()
        parent = f"projects/{self.project_id}"
        full_id = f"{self.prefix}/{secret_id}" if self.prefix else secret_id
        name = f"{parent}/secrets/{full_id}"
        try:
            client.get_secret(request={"name": name})
        except Exception:
            client.create_secret(request={"parent": parent, "secret_id": full_id, "secret": {"replication": {"automatic": {}}}})
        client.add_secret_version(request={"parent": name, "payload": {"data": value.encode("utf-8")}})
        return f"gcp-secret:{full_id}"

    def delete_versions(self, reference: str) -> None:
        # Secret deletion is intentionally not automatic. Revoking a Compass
        # credential must not destroy a version still needed for incident recovery.
        return None


@lru_cache
def get_secret_manager() -> SecretManager:
    return SecretManager()


def secret_reference_value(reference: str) -> str:
    if reference.startswith("gcp-secret:"):
        return get_secret_manager().access(reference)
    return reference
