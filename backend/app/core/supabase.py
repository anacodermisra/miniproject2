"""Supabase client configuration for MindPulse backend.

Environment variables:
- SUPABASE_URL: Project URL
- SUPABASE_ANON_KEY: Client anon key (for RLS-respecting operations)
- SUPABASE_SERVICE_KEY: Service role key (for admin operations, keep secret!)
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

# Supabase configuration - set via environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Service role key for admin operations (bypasses RLS)
# This should be set in environment variables, not hardcoded
SUPABASE_SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_KEY", 
    ""  # Must be set via env var for security
)

_supabase_client: Client | None = None
_supabase_admin_client: Client | None = None


def get_supabase_client() -> Client:
    """Get Supabase client (uses anon key).
    
    Note: RLS is currently disabled in schema. Access control
    happens at the API layer using JWT authentication.
    """
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _supabase_client


def get_supabase_admin() -> Client | None:
    """Get admin Supabase client (uses service role key).
    
    This client has full access and should be used for backend operations.
    Returns None if service key not configured.
    """
    global _supabase_admin_client
    if _supabase_admin_client is None:
        if not SUPABASE_SERVICE_KEY:
            print("Warning: SUPABASE_SERVICE_KEY not set, using anon key (limited access)")
            return get_supabase_client()  # Fallback to regular client
        _supabase_admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_admin_client


def check_supabase_connection() -> bool:
    """Check if Supabase connection is working.
    
    Returns True if connection successful, False otherwise.
    """
    try:
        client = get_supabase_client()
        # Try a simple query
        result = client.table("chat_sessions").select("count").limit(1).execute()
        return True
    except Exception as e:
        print(f"Supabase connection check failed: {e}")
        return False
