"""Spotify Web API + OAuth 2.0 (Authorization Code) implementation."""

import base64
import urllib.parse
from typing import Optional, Any
import httpx

from .base import MusicProvider


SPOTIFY_SCOPES = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
]


def _pluck_track(t: dict) -> dict:
    """Flatten a Spotify track object into just what our app needs."""
    if not t:
        return {}
    return {
        "id": t.get("id"),
        "uri": t.get("uri"),
        "name": t.get("name"),
        "artists": [{"id": a.get("id"), "name": a.get("name")} for a in (t.get("artists") or [])],
        "album": {
            "name": (t.get("album") or {}).get("name"),
            "image": ((t.get("album") or {}).get("images") or [{}])[0].get("url") if (t.get("album") or {}).get("images") else None,
        },
        "duration_ms": t.get("duration_ms"),
        "preview_url": t.get("preview_url"),
        "external_url": (t.get("external_urls") or {}).get("spotify"),
    }


def _pluck_artist(a: dict) -> dict:
    if not a:
        return {}
    return {
        "id": a.get("id"),
        "uri": a.get("uri"),
        "name": a.get("name"),
        "genres": a.get("genres", []),
        "image": ((a.get("images") or [{}])[0].get("url")) if a.get("images") else None,
        "external_url": (a.get("external_urls") or {}).get("spotify"),
    }


def _pluck_playlist(p: dict) -> dict:
    if not p:
        return {}
    return {
        "id": p.get("id"),
        "uri": p.get("uri"),
        "name": p.get("name"),
        "description": p.get("description"),
        "image": ((p.get("images") or [{}])[0].get("url")) if p.get("images") else None,
        "track_count": (p.get("tracks") or {}).get("total", 0),
        "owner": (p.get("owner") or {}).get("display_name"),
        "external_url": (p.get("external_urls") or {}).get("spotify"),
    }


class SpotifyProvider(MusicProvider):
    name = "spotify"
    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    API = "https://api.spotify.com/v1"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    # ---- OAuth ----
    def build_authorize_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": " ".join(SPOTIFY_SCOPES),
            "show_dialog": "false",
        }
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(params)}"

    def _basic_auth_header(self) -> dict:
        raw = f"{self.client_id}:{self.client_secret}".encode()
        return {"Authorization": "Basic " + base64.b64encode(raw).decode()}

    async def exchange_code(self, code: str, redirect_uri: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                self.TOKEN_URL,
                data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri},
                headers={**self._basic_auth_header(), "Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            return r.json()

    async def refresh(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                self.TOKEN_URL,
                data={"grant_type": "refresh_token", "refresh_token": refresh_token},
                headers={**self._basic_auth_header(), "Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            return r.json()

    # ---- Internal ----
    async def _get(self, access_token: str, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{self.API}{path}",
                headers={"Authorization": f"Bearer {access_token}"},
                params=params or {},
            )
            r.raise_for_status()
            return r.json()

    async def _post(self, access_token: str, path: str, json: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{self.API}{path}",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=json or {},
            )
            r.raise_for_status()
            if r.status_code == 204 or not r.content:
                return {}
            return r.json()

    # ---- Data ----
    async def me(self, access_token: str) -> dict:
        d = await self._get(access_token, "/me")
        return {
            "id": d.get("id"),
            "display_name": d.get("display_name"),
            "email": d.get("email"),
            "product": d.get("product"),
            "image": ((d.get("images") or [{}])[0].get("url")) if d.get("images") else None,
        }

    async def playlists(self, access_token: str, limit: int = 20) -> list[dict]:
        d = await self._get(access_token, "/me/playlists", {"limit": limit})
        return [_pluck_playlist(p) for p in (d.get("items") or [])]

    async def top_tracks(self, access_token: str, limit: int = 10, time_range: str = "medium_term") -> list[dict]:
        d = await self._get(access_token, "/me/top/tracks", {"limit": limit, "time_range": time_range})
        return [_pluck_track(t) for t in (d.get("items") or [])]

    async def top_artists(self, access_token: str, limit: int = 10, time_range: str = "medium_term") -> list[dict]:
        d = await self._get(access_token, "/me/top/artists", {"limit": limit, "time_range": time_range})
        return [_pluck_artist(a) for a in (d.get("items") or [])]

    async def recently_played(self, access_token: str, limit: int = 20) -> list[dict]:
        d = await self._get(access_token, "/me/player/recently-played", {"limit": limit})
        items = d.get("items") or []
        return [
            {**_pluck_track(i.get("track") or {}), "played_at": i.get("played_at")}
            for i in items
        ]

    async def recommendations(
        self,
        access_token: str,
        seed_tracks: Optional[list[str]] = None,
        seed_artists: Optional[list[str]] = None,
        seed_genres: Optional[list[str]] = None,
        target: Optional[dict[str, Any]] = None,
        limit: int = 15,
    ) -> list[dict]:
        params: dict[str, Any] = {"limit": limit}
        seeds_total = 0
        if seed_tracks:
            params["seed_tracks"] = ",".join(seed_tracks[:5 - seeds_total])
            seeds_total += min(5 - seeds_total, len(seed_tracks))
        if seed_artists and seeds_total < 5:
            take = min(5 - seeds_total, len(seed_artists))
            params["seed_artists"] = ",".join(seed_artists[:take])
            seeds_total += take
        if seed_genres and seeds_total < 5:
            take = min(5 - seeds_total, len(seed_genres))
            params["seed_genres"] = ",".join(seed_genres[:take])
        if target:
            for k, v in target.items():
                params[f"target_{k}"] = v
        d = await self._get(access_token, "/recommendations", params)
        return [_pluck_track(t) for t in (d.get("tracks") or [])]

    async def search_tracks(self, access_token: str, query: str, limit: int = 10) -> list[dict]:
        d = await self._get(access_token, "/search", {"q": query, "type": "track", "limit": limit})
        return [_pluck_track(t) for t in ((d.get("tracks") or {}).get("items") or [])]

    async def create_playlist(self, access_token: str, user_id: str, name: str, description: str) -> dict:
        d = await self._post(
            access_token,
            f"/users/{user_id}/playlists",
            {"name": name, "description": description, "public": False, "collaborative": False},
        )
        return _pluck_playlist(d)

    async def add_tracks(self, access_token: str, playlist_id: str, uris: list[str]) -> dict:
        d = await self._post(access_token, f"/playlists/{playlist_id}/tracks", {"uris": uris})
        return {"snapshot_id": d.get("snapshot_id")}

    # Available seed genres (subset — Spotify accepts these strings)
    AVAILABLE_GENRES = [
        "acoustic", "ambient", "chill", "classical", "electronic", "folk",
        "happy", "indie", "jazz", "lo-fi", "piano", "pop", "r-n-b", "rainy-day",
        "sad", "sleep", "study", "summer", "sunset", "work-out",
    ]
