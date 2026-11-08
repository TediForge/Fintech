"""Public Supabase NIN-verification adapter."""

from app.providers.kyc.ng.nin.supabase.client import (
    SupabaseNinClient,
    get_supabase_nin_client,
    verify_nin_with_supabase,
)

__all__ = [
    "SupabaseNinClient",
    "get_supabase_nin_client",
    "verify_nin_with_supabase",
]
