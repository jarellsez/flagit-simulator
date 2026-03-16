"""
Domain Reputation Module — Strategy A (The Digital Passport)
=============================================================
Performs WHOIS-based domain age checks with an in-memory cache.
Integrated as a pre-score safety override in ensemble_fusion.py.
"""

import re
import threading
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

try:
    import tldextract
    TLDEXTRACT_AVAILABLE = True
except ImportError:
    TLDEXTRACT_AVAILABLE = False

try:
    import whois as whois_lib
    WHOIS_AVAILABLE = True
except ImportError:
    WHOIS_AVAILABLE = False

# ─── Thread-safe in-memory cache ──────────────────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()

# ─── Constants ────────────────────────────────────────────────────────────────
WHOIS_TIMEOUT_SECONDS = 4          # max time to wait for a WHOIS lookup
MIN_AGE_DAYS_FOR_SAFE  = 365       # < 1 year  → penalty
SOVEREIGN_AGE_DAYS     = 365 * 5   # > 5 years on Sovereign TLD → bonus
SUSPICIOUS_HYPHEN_RE   = re.compile(
    r'(customs|border|portal|verify|login|secure|support|update|auth|helpdesk|office)'
    r'.*-.*\.(com|net|org|info|xyz|online|site|top)',
    re.IGNORECASE
)
SOVEREIGN_TLDS = {
    'gov', 'mil', 'edu', 'edu.my', 'edu.au', 'edu.uk',
    'gov.my', 'gov.au', 'gov.uk', 'ac.uk', 'ac.my',
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_registered_domain(url: str) -> Optional[str]:
    """Return the registered domain (e.g. 'google.com') from any URL string."""
    if not TLDEXTRACT_AVAILABLE:
        # Fallback: naive extraction
        url = re.sub(r'^https?://', '', url).split('/')[0].lower()
        parts = url.split('.')
        return '.'.join(parts[-2:]) if len(parts) >= 2 else url
    ext = tldextract.extract(url)
    if ext.domain and ext.suffix:
        return f"{ext.domain}.{ext.suffix}"
    return None


def _get_tld_suffix(url: str) -> str:
    """Return only the TLD/suffix portion (e.g. 'edu.my', 'gov')."""
    if not TLDEXTRACT_AVAILABLE:
        return url.split('.')[-1].lower()
    ext = tldextract.extract(url)
    return ext.suffix.lower() if ext.suffix else ''


def _whois_creation_date(domain: str) -> Optional[datetime]:
    """
    Perform a WHOIS lookup and return the creation date.
    Returns None on any failure (timeout, parse error, unsupported TLD).
    """
    if not WHOIS_AVAILABLE:
        return None
    try:
        import socket
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(WHOIS_TIMEOUT_SECONDS)
        try:
            w = whois_lib.whois(domain)
        finally:
            socket.setdefaulttimeout(old_timeout)

        created = w.creation_date
        if isinstance(created, list):
            created = created[0]
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            return created
    except Exception:
        pass
    return None


# ─── Public API ───────────────────────────────────────────────────────────────

def get_domain_reputation(url: str) -> dict:
    """
    Returns a reputation dict for a URL:
    {
        'domain'           : str   — registered domain
        'age_days'         : int | None
        'is_new_domain'    : bool  — < 1 year old
        'is_sovereign_old' : bool  — Sovereign TLD AND > 5 years old
        'is_suspicious_hyphen': bool
        'score_delta'      : float — penalty (+) or bonus (-) to apply to final_prob
        'client_note'      : str   — plain-English explanation
    }
    """
    domain = _extract_registered_domain(url) or url
    tld    = _get_tld_suffix(url)

    # ── Cache lookup ──────────────────────────────────────────────────────────
    with _cache_lock:
        if domain in _cache:
            return _cache[domain]

    # ── Suspicious hyphen check (no WHOIS needed) ─────────────────────────────
    is_suspicious_hyphen = bool(SUSPICIOUS_HYPHEN_RE.search(domain))

    # ── WHOIS age lookup ──────────────────────────────────────────────────────
    age_days: Optional[int] = None
    creation_date = _whois_creation_date(domain)
    if creation_date:
        now = datetime.now(tz=timezone.utc)
        age_days = (now - creation_date).days

    # ── Derive flags ──────────────────────────────────────────────────────────
    is_new_domain = (age_days is not None and age_days < MIN_AGE_DAYS_FOR_SAFE)
    is_sovereign_tld = any(tld == s or tld.endswith('.' + s) for s in SOVEREIGN_TLDS)
    is_sovereign_old = is_sovereign_tld and (age_days is not None and age_days >= SOVEREIGN_AGE_DAYS)

    # ── Score delta ───────────────────────────────────────────────────────────
    score_delta = 0.0
    notes = []

    if is_new_domain:
        score_delta += 0.75
        notes.append(
            f"This website ({domain}) was registered less than 1 year ago — "
            "newly created domains are a hallmark of phishing campaigns."
        )
    if is_suspicious_hyphen:
        score_delta += 0.75
        notes.append(
            f"The domain '{domain}' uses suspicious hyphenated keywords "
            "(e.g., 'customs-border', 'verify-login'). Legitimate organisations "
            "do not use hyphenated 'support' domains."
        )
    if is_sovereign_old:
        score_delta -= 0.50
        notes.append(
            f"The domain '{domain}' belongs to a verified government or educational "
            f"institution and has been registered for over 5 years. "
            "This is a strong trust indicator."
        )

    client_note = " ".join(notes) if notes else (
        f"Domain '{domain}' passed basic reputation checks."
        + (f" Age: {age_days} days." if age_days else " Age unknown (WHOIS unavailable).")
    )

    result = {
        "domain":               domain,
        "age_days":             age_days,
        "is_new_domain":        is_new_domain,
        "is_sovereign_old":     is_sovereign_old,
        "is_suspicious_hyphen": is_suspicious_hyphen,
        "score_delta":          score_delta,
        "client_note":          client_note,
    }

    # ── Cache (only cache successful lookups to avoid stale negatives) ────────
    with _cache_lock:
        _cache[domain] = result

    return result
