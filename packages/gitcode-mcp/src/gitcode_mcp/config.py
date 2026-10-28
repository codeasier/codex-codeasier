"""Process configuration; credentials never enter tool schemas or reprs."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field

_COMPONENT = r"[A-Za-z0-9_][A-Za-z0-9_.-]*"
_REPOSITORY = re.compile(rf"{_COMPONENT}/{_COMPONENT}\Z")


class ConfigurationError(ValueError):
    """An actionable configuration error that contains no credential values."""


def repository_name(value: str) -> str:
    """Accept a canonical owner/repo identifier, never a URL or filesystem path."""
    if not _REPOSITORY.fullmatch(value) or any(x.endswith(".git") for x in value.split("/")):
        raise ConfigurationError(
            "Repository must be an owner/repo identifier without .git or a URL."
        )
    if any(".." in x for x in value.split("/")):
        raise ConfigurationError("Repository identifiers must not contain '..'.")
    return value


def _boolean(env: Mapping[str, str], name: str, default: bool = False) -> bool:
    value = env.get(name, str(default)).strip().lower()
    if value in {"true", "1", "yes"}:
        return True
    if value in {"false", "0", "no"}:
        return False
    raise ConfigurationError(f"{name} must be true or false.")


def _number(env: Mapping[str, str], name: str, default: str, low: float, high: float) -> float:
    try:
        value = float(env.get(name, default))
    except ValueError:
        raise ConfigurationError(f"{name} must be a number.") from None
    if not low <= value <= high:
        raise ConfigurationError(f"{name} must be between {low:g} and {high:g}.")
    return value


@dataclass(frozen=True)
class Settings:
    token: str = field(default="", repr=False)
    http_token: str = field(default="", repr=False)
    read_only: bool = False
    allowed_repositories: tuple[str, ...] = ()
    timeout: float = 30.0
    max_response_bytes: int = 2_000_000
    allowed_hosts: tuple[str, ...] = ("127.0.0.1:*", "localhost:*", "[::1]:*")

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        token = env.get("GITCODE_TOKEN") or env.get("GC_TOKEN", "")
        http_token = env.get("GITCODE_MCP_HTTP_TOKEN", "")
        if any(c.isspace() or ord(c) < 32 for c in token + http_token):
            raise ConfigurationError(
                "Credentials must not contain whitespace or control characters."
            )
        if http_token and (len(http_token) < 32 or http_token == token):
            raise ConfigurationError(
                "GITCODE_MCP_HTTP_TOKEN must be at least 32 characters and different from the GitCode PAT."
            )
        repositories = tuple(
            repository_name(x.strip())
            for x in env.get("GITCODE_MCP_ALLOWED_REPOS", "").split(",")
            if x.strip()
        )
        hosts = tuple(
            x.strip()
            for x in env.get("GITCODE_MCP_ALLOWED_HOSTS", "127.0.0.1:*,localhost:*,[::1]:*").split(
                ","
            )
            if x.strip()
        )
        if not hosts or any(
            "/" in host or "@" in host or any(c.isspace() for c in host) or host == "*"
            for host in hosts
        ):
            raise ConfigurationError(
                "GITCODE_MCP_ALLOWED_HOSTS must list explicit host names (optionally :*)."
            )
        return cls(
            token=token,
            http_token=http_token,
            read_only=_boolean(env, "GITCODE_MCP_READ_ONLY"),
            allowed_repositories=repositories,
            timeout=_number(env, "GITCODE_MCP_TIMEOUT", "30", 1, 120),
            max_response_bytes=int(
                _number(env, "GITCODE_MCP_MAX_RESPONSE_BYTES", "2000000", 1024, 10_000_000)
            ),
            allowed_hosts=hosts,
        )
