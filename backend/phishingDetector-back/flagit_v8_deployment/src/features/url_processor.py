import os
import json
import re
import pandas as pd
import whois
import tldextract
from datetime import datetime, timezone
from urllib.parse import urlparse
import logging
try:
    import checkdmarc
except ImportError:
    checkdmarc = None

class URLFeatureExtractor:
    def __init__(self):
        self.shorteners = {'bit.ly', 't.co', 'tinyurl.com', 'tinyurl', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly'}
        self.common_brands = {'google.com', 'github.com', 'microsoft.com', 'linkedin.com', 'amazon.com'}
        self.well_known_tlds = {'.gov', '.edu', '.mil', '.int'}
        self.sovereign_tlds = {'gov', 'mil', 'edu', 'edu.my', 'edu.au', 'edu.uk', 'gov.my', 'gov.au', 'gov.uk', 'ac.uk', 'ac.my'}
        self.domain_cache = {}
        
    def get_domain_reputation(self, url: str, text: str = "") -> dict:
        """Returns domain age and reputation penalties/bonuses (Strategy A)."""
        ext = tldextract.extract(url)
        domain = f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else url
        tld = ext.suffix.lower() if ext.suffix else ''
        
        if domain in self.domain_cache:
            print(f"🌍 [Domain Rep] CACHE HIT for {domain}")
            return self.domain_cache[domain]
            
        suspicious_hyphen_re = re.compile(
            r'(customs|border|portal|verify|login|secure|support|update|auth|helpdesk|office)'
            r'.*-.*\.(com|net|org|info|xyz|online|site|top)',
            re.IGNORECASE
        )
        is_suspicious_hyphen = bool(suspicious_hyphen_re.search(domain))
        
        age_days = None
        try:
            print(f"🌍 [Domain Rep] Performing LIVE WHOIS lookup for -> {domain} ...")
            import socket
            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(4)
            w = whois.whois(domain)
            socket.setdefaulttimeout(old_timeout)
            
            created = w.creation_date
            if isinstance(created, list):
                created = created[0]
            if isinstance(created, datetime):
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                now = datetime.now(tz=timezone.utc)
                age_days = (now - created).days
            print(f"🌍 [Domain Rep] SUCCESS -> Age: {age_days} days. (Created: {created})")
        except Exception as e:
            print(f"🌍 [Domain Rep] FAILED for {domain}: {str(e)}")
            pass
            
        is_new_domain = (age_days is not None and age_days < 180) # < 6 months old
        is_established_domain = (age_days is not None and age_days > 365 * 5)
        
        trusted_tlds = {'gov', 'edu.my', 'org'}
        generic_tlds = {'xyz', 'info', 'site', 'top', 'online', 'pro', 'live', 'club'}
        professional_tlds = {'io', 'ai', 'so', 'tech', 'legal', 'compliance', 'agency'}
        
        is_trusted_tld = any(tld == s or tld.endswith('.' + s) for s in trusted_tlds)
        is_generic_tld = any(tld == s or tld.endswith('.' + s) for s in generic_tlds)
        is_professional_tld = any(tld == s or tld.endswith('.' + s) for s in professional_tlds)
        
        score_delta = 0.0
        client_note = "Domain passed basic reputation checks."
        
        if age_days is None:
            client_note = "Unverified domain (No WHOIS data available)."
            
            # Task 1 & 4 (Neutral default for No-Data)
            score_delta = 0.0 
            
            # Tech/Legal TLD Adjustment
            is_internal_pattern = any(kw in domain.lower() for kw in ['internal', 'portal', 'compliance', 'legal', 'migration'])
            is_mfa_context = any(kw in text.lower() for kw in ['it security', 'mfa', 'compliance', 'migration'])
            
            if (is_internal_pattern or is_professional_tld) and (is_mfa_context or len(ext.subdomain) > 0):
                client_note = "Professional/Internal Infrastructure Context Detected (Neutral reputation applied)."
            elif is_professional_tld:
                client_note = "Professional TLD (.io/.ai/.so) recognized."
        
        if is_new_domain:
            score_delta += 0.85
            client_note = f"This sender is using a very new and unverified website ({domain}), registered less than 6 months ago."
        
        if is_suspicious_hyphen:
            score_delta += 0.75
            if not is_new_domain:
                client_note = f"This sender is using a suspicious hyphenated domain ({domain}) meant to trick you."

        if is_established_domain:
            score_delta -= 0.65
            client_note = f"The domain is well-established (Registered > 5 years ago)."

        if is_trusted_tld and age_days is not None:
            score_delta -= 0.20
        elif is_generic_tld:
            score_delta += 0.30
            if not is_new_domain and not is_suspicious_hyphen:
                client_note = f"The domain uses a low-reputation generic TLD (.{tld}) often associated with spam."

            
        res = {
            "domain": domain,
            "tld": tld,
            "age_days": age_days,
            "registration_date": str(created)[:19] if 'created' in locals() and created else None,
            "is_new_domain": is_new_domain,
            "is_established_domain": is_established_domain,
            "is_suspicious_hyphen": is_suspicious_hyphen,
            "is_trusted_tld": is_trusted_tld,
            "is_generic_tld": is_generic_tld,
            "score_delta": score_delta,
            "client_explanation": client_note
        }
        self.domain_cache[domain] = res
        return res

    def get_email_auth_status(self, sender_domain: str) -> dict:
        """Runs checkdmarc to verify SPF and DMARC."""
        if not checkdmarc or not sender_domain:
            return {"spf_status": "Unknown", "dmarc_policy": "Unknown", "is_authenticated": False}
        
        try:
            print(f"🛡️ [Auth Check] Verifying SPF/DMARC for -> {sender_domain} ...")
            # Using basic DNS queries instead of full checkdmarc parser to save time for simple lookups
            import dns.resolver
            
            spf_status = "Fail/None"
            try:
                txt_records = dns.resolver.resolve(sender_domain, 'TXT', lifetime=3)
                for r in txt_records:
                    if "v=spf1" in r.to_text():
                        spf_status = "Pass"
                        break
            except Exception:
                pass
                
            dmarc_policy = "None"
            try:
                dmarc_records = dns.resolver.resolve(f"_dmarc.{sender_domain}", 'TXT', lifetime=3)
                for r in dmarc_records:
                    txt = r.to_text()
                    if "v=DMARC1" in txt:
                        if "p=reject" in txt: dmarc_policy = "reject"
                        elif "p=quarantine" in txt: dmarc_policy = "quarantine"
                        else: dmarc_policy = "none"
                        break
            except Exception:
                pass
                
            print(f"🛡️ [Auth Check] {sender_domain} -> SPF: {spf_status} | DMARC: {dmarc_policy}")
            is_auth = (spf_status == "Pass" and dmarc_policy in ["quarantine", "reject"])
            return {"spf_status": spf_status, "dmarc_policy": dmarc_policy, "is_authenticated": is_auth}
        except Exception as e:
            print(f"🛡️ [Auth Check] Error: {str(e)}")
            return {"spf_status": "Unknown", "dmarc_policy": "Unknown", "is_authenticated": False}

    def extract_features(self, url_str, is_trusted_or_internal=False):
        # Base zero features
        features = {
            'url_length': 0,
            'count_dot': 0,
            'count_hyphen': 0,
            'count_at': 0,
            'count_question': 0,
            'count_ampersand': 0,
            'count_equal': 0,
            'count_underscore': 0,
            'num_subdomains': 0,
            'has_https': 0,
            'has_http': 0,
            'is_ip': 0,
            'is_shortener': 0,
            'is_new_entity': 1,
            'is_smuggling': 0
        }
        
        try:
            # The CSV might contain a stringified JSON array like '["https://example.com"]'
            url_list = json.loads(url_str)
            if not isinstance(url_list, list) or len(url_list) == 0:
                return features
            url = str(url_list[0])  # Use the first URL for features
        except Exception:
            # Fallback if it's just a raw string
            url = str(url_str)
            if url.strip() in ('[]', '', 'nan', 'None'):
                return features

        # Lexical features
        features['url_length'] = len(url)
        features['count_dot'] = url.count('.')
        features['count_hyphen'] = url.count('-')
        features['count_at'] = url.count('@')
        features['count_question'] = url.count('?')
        features['count_ampersand'] = url.count('&')
        features['count_equal'] = url.count('=')
        features['count_underscore'] = url.count('_')
        
        # Structural features & Abnormalities
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            if not domain and parsed.path: # For URLs without scheme like 'example.com/foo'
                domain = parsed.path.split('/')[0].lower()
            
            # Simple heuristic for subdomains
            features['num_subdomains'] = max(0, domain.count('.'))
            
            # Task 3: Subdomain Penalty Adjustment
            if is_trusted_or_internal:
                features['num_subdomains'] = 0
            
            # Scheme check
            if parsed.scheme == 'https':
                features['has_https'] = 1
            elif parsed.scheme == 'http':
                features['has_http'] = 1
                
            # IP check
            if re.match(r'^\d{1,3}(\.\d{1,3}){3}(:\d+)?$', domain):
                features['is_ip'] = 1
                
            # Shortener check
            if any(shortener in domain for shortener in self.shorteners):
                features['is_shortener'] = 1
                
            # Stranger Danger check
            is_common_brand = any(domain == brand or domain.endswith('.' + brand) for brand in self.common_brands)
            is_well_known_tld = any(domain.endswith(tld) for tld in self.well_known_tlds)
            is_internal_looking = any(kw in domain for kw in ['internal', 'portal', '.corp', '.local'])
            if is_common_brand or is_well_known_tld or is_internal_looking:
                features['is_new_entity'] = 0
                
            # HTML Smuggling Check
            if url.lower().startswith('blob:') or url.lower().startswith('data:'):
                features['is_smuggling'] = 1
                
        except Exception:
            pass
            
        return features

def process_file(input_path, output_path):
    print(f"Loading {os.path.basename(input_path)}...")
    df = pd.read_csv(input_path)
    
    extractor = URLFeatureExtractor()
    features_list = []
    
    print("Extracting URL features...")
    for url_val in df['url']:
        features_list.append(extractor.extract_features(str(url_val)))
        
    features_df = pd.DataFrame(features_list)
    
    # Combine with label only
    if 'label' in df.columns:
        features_df['label'] = df['label']
        
    print(f"Saving to {os.path.basename(output_path)}...")
    features_df.to_csv(output_path, index=False)
    
    return features_df

if __name__ == "__main__":
    ROOT = r"c:\Users\Yasheer Sumun\OneDrive\New folder\MLtest1"
    
    train_in = os.path.join(ROOT, "data", "processed", "train.csv")
    test_in = os.path.join(ROOT, "data", "processed", "test.csv")
    
    train_out = os.path.join(ROOT, "data", "processed", "X_train_url.csv")
    test_out = os.path.join(ROOT, "data", "processed", "X_test_url.csv")
    
    train_features = process_file(train_in, train_out)
    print("-" * 40)
    process_file(test_in, test_out)
    
    print("-" * 40)
    print("--- X_train_url.csv Head ---")
    print(train_features.head().to_string())
    
    print("\n--- Validation Check (DataTypes) ---")
    non_numeric = train_features.select_dtypes(include=['object']).columns
    if len(non_numeric) == 0:
        print("SUCCESS: All columns are purely numeric.")
    else:
        print(f"WARNING: Found non-numeric columns: {list(non_numeric)}")
    print(train_features.dtypes)
