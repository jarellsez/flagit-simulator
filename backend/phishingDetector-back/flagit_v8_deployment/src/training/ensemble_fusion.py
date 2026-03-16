import os
import sys
import pandas as pd
import numpy as np
import torch
import joblib
import xgboost as xgb
import json
import re
import shap
import pickle
from lime.lime_text import LimeTextExplainer
from urllib.parse import urlparse
from transformers import BertTokenizer

os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"

# --- Environment Setup ---

# This finds the folder where ensemble_fusion.py is (src/training)
# Then goes up 3 levels to reach 'flagit_v8_deployment'
current_file_path = os.path.abspath(__file__)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))

if ROOT not in sys.path:
    sys.path.append(ROOT)

try:
    from features.url_processor import URLFeatureExtractor
    from training.train_bert import BertLSTMModel
except ImportError:
    from ..features.url_processor import URLFeatureExtractor
    from ..training.train_bert import BertLSTMModel

# --- Constants ---
RF_MODEL_PATH = os.path.join(ROOT, "rf_v1.pkl")
XGB_MODEL_PATH = os.path.join(ROOT, "xgboost_v1.json")
BERT_MODEL_DIR = os.path.join(ROOT, "bert_lstm_v8")
BERT_WEIGHTS = os.path.join(BERT_MODEL_DIR, "pytorch_model.bin")

TRUSTED_DOMAINS = ['google.com', 'github.com', 'microsoft.com', 'linkedin.com', 'amazon.com']
SOVEREIGN_DOMAINS = ['taylors.edu.my', 'stanford.edu', 'global-corp.com']

SCAM_CATEGORY_MAP = {
    'High-End Tech': r'(macbook pro|m[4-9] max|m[4-9] ultra|titanium|rtx [5-9]090|128gb|256gb|unified memory|mac studio)',
    'Luxury Horology/Jewelry': r'(rolex|patek|audemars|vacheron|cartier|omega|white gold|jubilee|box and papers)',
    'Pro-Audio/Instruments': r'(steinway|yamaha grand|gibson custom|fender custom|synthesizer|moog|sennheiser he|orpheus|linn klimax)',
    'Pro-Visual/Cinema': r'(leica|hasselblad|phase one|red komodo|sony alpha|arri|cinema camera)'
}

def check_impossible_deal(text, url=""):
    text_lower = str(text).lower()
    has_giveaway_context = any(kw in text_lower for kw in ['donat', 'giv', 'free', 'liquidat', 'fee', 'shipping'])
    
    asset_count = 0
    detected_assets = []
    for category, pattern in SCAM_CATEGORY_MAP.items():
        if category == 'High-End Tech' and not has_giveaway_context:
            continue
        matches = re.finditer(pattern, text_lower)
        found = list(set(m.group(1) for m in matches))
        asset_count += len(found)
        detected_assets.extend(found)

    has_small_fee = False
    fee_regex = r'(fee|shipping|courier|insurance|handling|deposit|storage|movers)[^$0-9]*\$([0-9,]+(?:\.\d{2})?)'
    for m in re.finditer(fee_regex, text_lower):
        try:
            fee_amount = float(m.group(2).replace(',', ''))
            if fee_amount < 500:
                has_small_fee = True
                break
        except: pass

    has_oob_contact = bool(re.search(r'(sms|text|whatsapp|telegram).{0,30}(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', text_lower))
    has_logistics = bool(re.search(r'(logistics|coordination|shipping|courier|movers)', text_lower))
    
    return asset_count, has_small_fee, has_oob_contact, has_logistics, detected_assets

class FlagItEnsemble:
    def __init__(self):
        torch.serialization.add_safe_globals([np.core.multiarray._reconstruct, np.ndarray, np.dtype])
        # Load Models
        self.rf_model = joblib.load(RF_MODEL_PATH)
        self.xgb_model = xgb.XGBClassifier()
        self.xgb_model.load_model(XGB_MODEL_PATH)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.bert_model = BertLSTMModel().to(self.device)
        self.bert_model.load_state_dict(torch.load(BERT_WEIGHTS, map_location=self.device, weights_only=False))
        self.bert_model.eval()
        self.tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_DIR)
        self.url_extractor = URLFeatureExtractor()

        # Initialize Explainers
        self.shap_explainer = shap.TreeExplainer(self.xgb_model)
        self.lime_explainer = LimeTextExplainer(class_names=['Safe', 'Phishing'])

    def _bert_predict_wrapper(self, texts):
        """Pipeline for LIME to interact with the BERT model"""
        self.bert_model.eval()
        results = []
        for t in texts:
            enc = self.tokenizer(t, max_length=128, padding='max_length', truncation=True, return_tensors='pt')
            with torch.no_grad():
                out = self.bert_model(enc['input_ids'].to(self.device), enc['attention_mask'].to(self.device))
                probs = torch.softmax(out, dim=1).cpu().numpy()[0]
                results.append(probs)
        return np.array(results)

    def generate_reasons(self, url, body, bert_prob, url_df=None, **kwargs):
        reasons = []
        body_lower = str(body).lower()

        # 1. HEURISTICS (PHASE 8)
        asset_count, has_fee, has_sms, has_log, assets = check_impossible_deal(body, url)
        if asset_count >= 1:
            if has_fee or has_log:
                reasons.append(f"Advance Fee Fraud: High-value assets ({', '.join(assets[:2])}) promised for a fee.")
            else:
                reasons.append(f"Suspicious Content: Luxury assets ({', '.join(assets[:2])}) mentioned.")

        mfa_triggers = [('verification code', 'reply'), ('6-digit', 'text me'), ('mfa', 'send')]
        if any(t1 in body_lower and t2 in body_lower for t1, t2 in mfa_triggers):
            reasons.append("Critical Alert: Social Engineering attempt for MFA tokens.")

        if kwargs.get('is_smuggling'): 
            reasons.append("Critical Alert: HTML Smuggling / Memory Exploit detected.")

        # 2. LIME (AI TEXT ANALYSIS) - Only run if BERT is suspicious
        if not reasons and bert_prob > 0.65:
            try:
                exp = self.lime_explainer.explain_instance(body, self._bert_predict_wrapper, num_features=3, num_samples=30)
                top_words = [word for word, weight in exp.as_list() if weight > 0.1]
                if top_words:
                    reasons.append(f"AI Detection: Risk keywords identified ({', '.join(top_words)}).")
            except: pass

        # 3. SHAP (URL ANALYSIS) - Only run if URL model is suspicious
        if not reasons and url_df is not None:
            shap_values = self.shap_explainer.shap_values(url_df)
            top_feat_idx = np.argmax(shap_values[0])
            if shap_values[0][top_feat_idx] > 0.1:
                feat_name = url_df.columns[top_feat_idx].replace('_', ' ')
                reasons.append(f"URL Analysis: Suspicious {feat_name} structure detected.")

        # FALLBACK
        if not reasons and bert_prob > 0.7:
            reasons.append("NLP Analysis: Structural signatures of phishing detected.")

        return reasons

    def predict_flagit(self, url, body, sender="", platform="email", subject=None):
        if not url or url == "TEXT_ONLY":
            url = "https://unknown-platform-input.com"
        
        is_trusted = False
        reputation = self.url_extractor.get_domain_reputation(url, text=body)
        auth_data = self.url_extractor.get_email_auth_status(sender)
        spf_status = auth_data.get('spf_status', 'Unknown')

        try:
            domain = urlparse(url).netloc.lower()
            for td in TRUSTED_DOMAINS + SOVEREIGN_DOMAINS:
                if domain == td or domain.endswith('.' + td):
                    is_trusted = True
                    break
        except: pass

        # ML Inference
        url_features = self.url_extractor.extract_features(url, is_trusted_or_internal=is_trusted)
        cols = ['url_length', 'count_dot', 'count_hyphen', 'count_at', 'count_question', 'count_ampersand', 'count_equal', 'count_underscore', 'num_subdomains', 'has_https', 'has_http', 'is_ip', 'is_shortener']
        url_df = pd.DataFrame([{col: url_features.get(col, 0) for col in cols}])
        
        url_avg_prob = (float(self.rf_model.predict_proba(url_df)[0][1]) + float(self.xgb_model.predict_proba(url_df)[0][1])) / 2.0
        if is_trusted: url_avg_prob *= 0.3

        encoding = self.tokenizer(f"SUBJECT: {subject} BODY: {body}" if subject else f"BODY: {body}", add_special_tokens=True, max_length=128, padding='max_length', truncation=True, return_tensors='pt')
        with torch.no_grad():
            outputs = self.bert_model(encoding['input_ids'].to(self.device), encoding['attention_mask'].to(self.device))
            bert_prob = float(torch.softmax(outputs, dim=1)[0][1].item())

        # Final Calculation
        is_smuggling = url_features.get('is_smuggling', 0) == 1
        infra_score = (0.6 * (0.5 + reputation.get('score_delta', 0))) + (0.4 * (1.0 if spf_status == 'Fail' else 0.0))
        final_prob = (0.7 * ((0.8 * bert_prob) + (0.2 * url_avg_prob))) + (0.3 * infra_score)
        
        # Scoring Overrides
        asset_count, has_fee, has_sms, _, _ = check_impossible_deal(body, url)
        if asset_count >= 1 and (has_fee or has_sms): final_prob = max(final_prob, 0.95)
        if is_smuggling: final_prob = max(final_prob, 0.99)
        
        final_prob = min(0.99, final_prob)
        reasons = self.generate_reasons(url, body, bert_prob, url_df=url_df, is_smuggling=is_smuggling)

        return {
            "score": round(final_prob, 4),
            "is_phishing": final_prob > 0.65,
            "confidence": "High" if final_prob > 0.85 else "Medium",
            "reasons": reasons,
            "auth_check": {"spf_status": spf_status, "dmarc_policy": auth_data.get('dmarc_policy', 'Unknown')}
        }