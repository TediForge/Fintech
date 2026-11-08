"""Public football-data.org interface."""

from app.providers.sports.football.client import (
    FootballDataClient,
    PopularMatch,
    fetch_popular_matches,
    get_football_data_client,
)

__all__ = [
    "FootballDataClient",
    "PopularMatch",
    "fetch_popular_matches",
    "get_football_data_client",
]
