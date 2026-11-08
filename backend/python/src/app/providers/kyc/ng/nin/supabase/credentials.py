"""Credentials for the Supabase NIN verification function."""

from dataclasses import dataclass

from app.providers.types import ProviderError

# Public Supabase anon key; it is safe to include in client-side applications.
# Paste the project's anon key here.
SUPABASE_NIN_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtb2NodXFhaHp3eXF1aGdpd3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NzM2MzcsImV4cCI6MjA4MDU0OTYzN30.hQLUpbfzBphVhIKFkgVFdYXoywBqtZRcH3AcybQ2q7c"


@dataclass(frozen=True)
class SupabaseNinCredentials:
    api_key: str


def load_supabase_nin_credentials() -> SupabaseNinCredentials:
    if not SUPABASE_NIN_ANON_KEY or SUPABASE_NIN_ANON_KEY == "PASTE_SUPABASE_ANON_KEY_HERE":
        raise ProviderError("Supabase NIN anon key has not been configured", 503)
    return SupabaseNinCredentials(api_key=SUPABASE_NIN_ANON_KEY)
