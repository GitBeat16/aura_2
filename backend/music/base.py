"""Music provider abstraction — Spotify today, easy to add Apple Music / YT Music later."""

from abc import ABC, abstractmethod
from typing import Optional, Any


class MusicProvider(ABC):
    """Common interface every music provider must implement."""

    name: str = "abstract"

    # ---- OAuth ----
    @abstractmethod
    def build_authorize_url(self, state: str, redirect_uri: str) -> str: ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> dict: ...

    @abstractmethod
    async def refresh(self, refresh_token: str) -> dict: ...

    # ---- Data ----
    @abstractmethod
    async def me(self, access_token: str) -> dict: ...

    @abstractmethod
    async def playlists(self, access_token: str, limit: int = 20) -> list[dict]: ...

    @abstractmethod
    async def top_tracks(self, access_token: str, limit: int = 10, time_range: str = "medium_term") -> list[dict]: ...

    @abstractmethod
    async def top_artists(self, access_token: str, limit: int = 10, time_range: str = "medium_term") -> list[dict]: ...

    @abstractmethod
    async def recently_played(self, access_token: str, limit: int = 20) -> list[dict]: ...

    # ---- Recommendations & search ----
    @abstractmethod
    async def recommendations(
        self,
        access_token: str,
        seed_tracks: Optional[list[str]] = None,
        seed_artists: Optional[list[str]] = None,
        seed_genres: Optional[list[str]] = None,
        target: Optional[dict[str, Any]] = None,
        limit: int = 15,
    ) -> list[dict]: ...

    @abstractmethod
    async def search_tracks(self, access_token: str, query: str, limit: int = 10) -> list[dict]: ...

    # ---- Mutations ----
    @abstractmethod
    async def create_playlist(self, access_token: str, user_id: str, name: str, description: str) -> dict: ...

    @abstractmethod
    async def add_tracks(self, access_token: str, playlist_id: str, uris: list[str]) -> dict: ...
