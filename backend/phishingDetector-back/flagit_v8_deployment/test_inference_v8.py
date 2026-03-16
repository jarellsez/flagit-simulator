import os
import sys
import torch
import torch.nn as nn
from transformers import BertTokenizer, BertModel
import numpy as np
import re

# ── Configuration ─────────────────────────────────────────────────────────────
import os
import torch

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Point to the model folder relative to this script
MODEL_DIR = os.path.join(CURRENT_DIR, "bert_lstm_v8")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Model Architecture ────────────────────────────────────────────────────────
class BertLSTMModel(nn.Module):
    def __init__(self, bert_model_name='bert-base-uncased', hidden_size=256, dropout_prob=0.3):
        super(BertLSTMModel, self).__init__()
        self.bert = BertModel.from_pretrained(bert_model_name)
        self.lstm = nn.LSTM(
            input_size=self.bert.config.hidden_size,
            hidden_size=hidden_size,
            batch_first=True,
            bidirectional=True
        )
        self.dropout = nn.Dropout(dropout_prob)
        self.fc = nn.Linear(hidden_size * 2, 2)

    def forward(self, input_ids=None, attention_mask=None, inputs_embeds=None):
        if inputs_embeds is not None:
            outputs = self.bert(inputs_embeds=inputs_embeds, attention_mask=attention_mask)
        else:
            outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
            
        sequence_output = outputs.last_hidden_state
        lstm_out, (hn, cn) = self.lstm(sequence_output)
        hidden = torch.cat((hn[-2,:,:], hn[-1,:,:]), dim=1)
        x = self.dropout(hidden)
        logits = self.fc(x)
        return logits

def parse_raw_email(raw_content):
    """Basic extraction of Subject and Body from raw text."""
    subject = "None"
    body = raw_content
    
    subj_match = re.search(r'^Subject:\s*(.*)', raw_content, re.IGNORECASE | re.MULTILINE)
    if subj_match:
        subject = subj_match.group(1).strip()
        # Remove headers to get the body
        body = re.sub(r'^(.*\n)*?\n', '', raw_content, flags=re.MULTILINE).strip()
    
    return subject, body

def get_token_saliency(model, tokenizer, text):
    """Performs basic gradient-based saliency to find 'Hot' tokens."""
    model.eval()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128, padding=True).to(DEVICE)
    input_ids = inputs['input_ids']
    attention_mask = inputs['attention_mask']
    
    # We want gradients w.r.t the embeddings
    embeddings = model.bert.embeddings.word_embeddings(input_ids).detach()
    embeddings.requires_grad = True
    
    # cudnn RNN backward requires training mode
    model.train()
    
    # Run forward with embeddings
    logits = model(inputs_embeds=embeddings, attention_mask=attention_mask)
    probs = torch.softmax(logits, dim=1)
    target_idx = torch.argmax(probs, dim=1).item()
    
    model.zero_grad()
    score = logits[0, target_idx]
    score.backward()
    
    # Saliency = magnitude of gradients on embeddings
    saliency = embeddings.grad.data.abs().sum(dim=-1).squeeze()
    saliency = (saliency / saliency.max()).cpu().numpy()
    
    tokens = tokenizer.convert_ids_to_tokens(input_ids[0])
    return tokens, saliency, probs[0].cpu().detach().numpy()

def run_test(raw_email):
    print("\n" + "="*60)
    print("  🧪  Phase 8 Inference Test — BERT-LSTM V8")
    print("="*60)
    
    subject, body = parse_raw_email(raw_email)
    formatted_text = f"SUBJECT: {subject} \n BODY: {body}"
    
    print(f"Parsed Subject: {subject}")
    print(f"Target Schema:  {formatted_text[:80]}...")
    
    print("\nLoading Model V8 Weights...")
    tokenizer = BertTokenizer.from_pretrained(MODEL_DIR)
    model = BertLSTMModel().to(DEVICE)
    model.load_state_dict(torch.load(os.path.join(MODEL_DIR, "pytorch_model.bin"), map_location=DEVICE, weights_only=False))
    
    tokens, saliency, probs = get_token_saliency(model, tokenizer, formatted_text)
    
    phish_score = probs[1] * 100
    verdict = "PHISHING" if phish_score > 50 else "LEGIT"
    
    print("\n" + "-"*30)
    print(f"📉 PROBABILITY SCORE: {phish_score:.2f}%")
    print(f"🏷️  FINAL LABEL:      {verdict}")
    print("-"*30)
    
    print("\n🔍 LINGUISTIC FEATURE IMPORTANCE (Saliency Map):")
    # Group sub-tokens (##) for better readability
    important_features = []
    for i, (tok, sal) in enumerate(zip(tokens, saliency)):
        if tok in ['[CLS]', '[SEP]', '[PAD]']: continue
        if sal > 0.4: # Threshold for 'Hot' tokens
            important_features.append((tok, sal))
    
    # Sort and display
    important_features.sort(key=lambda x: x[1], reverse=True)
    for tok, score in important_features[:10]:
        marker = "🚨" if phish_score > 50 else "✅"
        print(f"  {marker} [{tok:15}] | Signal Strength: {score:.4f}")

    if not important_features:
        print("  (Model analyzed structure rather than specific high-impact words)")

if __name__ == "__main__":
    test_input = """Subject: ACTION REQUIRED: Update your payroll details
    
Dear Colleague,

Our system audit shows that your payroll information is incomplete. Please log in to the employee portal immediately to verify your account or payments will be delayed.

Go to: https://university-payroll-portal.com/verify-now

Thank you,
Human Resources"""

    # If an argument is passed, use it as raw email
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            test_input = f.read()
            
    run_test(test_input)
