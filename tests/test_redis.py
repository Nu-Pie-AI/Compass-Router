import pytest
from redis.exceptions import AuthenticationError


def _services():
    from app import services

    return services


class FakePool:
    connection_kwargs = {"host": "redis.example", "port": 6380}


class FakeRedis:
    def __init__(self, values=None, error=None):
        self.values = values or [0, 1, 12]
        self.error = error
        self.connection_pool = FakePool()
        self.closed = False
        self.eval_args = None

    def ping(self):
        if self.error:
            raise self.error
        return True

    def eval(self, *args):
        if self.error:
            raise self.error
        self.eval_args = args
        return self.values

    def close(self):
        self.closed = True


def test_redis_health_uses_tls_url_and_pooled_client(monkeypatch):
    services = _services()
    client = FakeRedis()
    captured = {}

    def from_url(url, **kwargs):
        captured["url"] = url
        captured["kwargs"] = kwargs
        return client

    monkeypatch.setattr(services.Redis, "from_url", from_url)
    result = services.check_redis("rediss://user:password@redis.example:6380/0")

    assert result == {"status": "ok", "scheme": "rediss", "host": "redis.example", "port": 6380}
    assert captured["url"].startswith("rediss://")
    assert captured["kwargs"]["socket_connect_timeout"] > 0
    assert captured["kwargs"]["socket_timeout"] > 0
    assert captured["kwargs"]["max_connections"] > 0
    assert client.closed is True


def test_redis_health_hides_authentication_failures(monkeypatch):
    services = _services()
    client = FakeRedis(error=AuthenticationError("credential must not escape"))
    monkeypatch.setattr(services.Redis, "from_url", lambda *_args, **_kwargs: client)

    with pytest.raises(RuntimeError, match="Redis health check failed") as error:
        services.check_redis("rediss://user:password@redis.example:6380/0")
    assert "credential" not in str(error.value)
    assert client.closed is True


def test_rate_limit_uses_atomic_eval_and_ttl_script(monkeypatch):
    services = _services()
    client = FakeRedis(values=[0, 4, 120])
    monkeypatch.setattr(services.Redis, "from_url", lambda *_args, **_kwargs: client)

    allowed, reason = services.redis_team_rate_limit("rediss://user:password@redis.example:6380/0", "team-1", 30, 60, 250000)

    assert allowed is True
    assert reason is None
    assert client.eval_args[1] == 2
    assert "INCR" in client.eval_args[0]
    assert "INCRBY" in client.eval_args[0]
    assert "EXPIRE" in client.eval_args[0]
    assert client.closed is True


def test_rate_limit_rejects_script_limit_result(monkeypatch):
    services = _services()
    client = FakeRedis(values=[1, 61, 30])
    monkeypatch.setattr(services.Redis, "from_url", lambda *_args, **_kwargs: client)

    allowed, reason = services.redis_team_rate_limit("redis://redis.example:6379/0", "team-1", 30, 60, 250000)

    assert allowed is False
    assert reason == "rate_limit_exceeded"
