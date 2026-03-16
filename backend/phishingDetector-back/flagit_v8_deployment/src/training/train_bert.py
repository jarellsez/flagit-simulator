import os
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report
from transformers import BertTokenizer, BertModel, get_linear_schedule_with_warmup
from torch.optim import AdamW
from tqdm import tqdm
import numpy as np

ROOT = r"c:\Users\Yasheer Sumun\OneDrive\New folder\MLtest1"
TRAIN_FILE = os.path.join(ROOT, "training_master_v8.csv")
VAL_FILE = os.path.join(ROOT, "validation_holdout_v8.csv")
MODEL_DIR = os.path.join(ROOT, "models", "bert_lstm_v8")

# Create model directory if it doesn't exist
os.makedirs(MODEL_DIR, exist_ok=True)

class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = int(self.labels[idx])

        encoding = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'label': torch.tensor(label, dtype=torch.long)
        }

class BertLSTMModel(nn.Module):
    def __init__(self, bert_model_name='bert-base-uncased', hidden_size=256, dropout_prob=0.3):
        super(BertLSTMModel, self).__init__()
        self.bert = BertModel.from_pretrained(bert_model_name)
        
        # Freeze BERT parameters to speed up training if memory is highly constrained, 
        # but the prompt asks to train the hybrid, so we'll leave it unfrozen.
        
        # Bidirectional LSTM taking BERT hidden states
        self.lstm = nn.LSTM(
            input_size=self.bert.config.hidden_size,
            hidden_size=hidden_size,
            batch_first=True,
            bidirectional=True
        )
        
        self.dropout = nn.Dropout(dropout_prob)
        # Linear output layer (2 classes)
        self.fc = nn.Linear(hidden_size * 2, 2)

    def forward(self, input_ids, attention_mask):
        # BERT output
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        # Sequence of hidden states (batch_size, sequence_length, hidden_size)
        sequence_output = outputs.last_hidden_state
        
        # LSTM output
        lstm_out, (hn, cn) = self.lstm(sequence_output)
        
        # Get the output from the last time step for both directions
        # hn shape: (num_layers * num_directions, batch_size, hidden_size)
        hidden = torch.cat((hn[-2,:,:], hn[-1,:,:]), dim=1)
        
        x = self.dropout(hidden)
        logits = self.fc(x)
        return logits

def train_eval():
    print("Loading Master Dataset V8...")
    # Load data
    train_df = pd.read_csv(TRAIN_FILE)
    val_df = pd.read_csv(VAL_FILE)
    
    # Fill NAs
    train_df['text'] = train_df['text'].fillna("")
    val_df['text'] = val_df['text'].fillna("")

    tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
    
    # Use 'text' column which contains SUBJECT: ... \n BODY: ...
    train_dataset = TextDataset(train_df['text'].values, train_df['label'].values, tokenizer)
    val_dataset = TextDataset(val_df['text'].values, val_df['label'].values, tokenizer)

    batch_size = 16 # Adjust based on GPU memory
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Calculate Class Weights for Imbalance (Strategy: Prioritize Phishing)
    labels = train_df['label'].values
    class_indices = np.unique(labels)
    # count frequency of each class
    counts = np.bincount(labels)
    # weights are inversely proportional to frequency
    # We want to prioritize Phishing (Label 1)
    # weight = total_samples / (num_classes * count_per_class)
    weights = len(labels) / (len(class_indices) * counts)
    class_weights = torch.tensor(weights, dtype=torch.float).to(device)
    print(f"Applying Class Weights: Safe={class_weights[0]:.2f}, Phishing={class_weights[1]:.2f}")

    print("Initializing BERT-LSTM hybrid model...")
    model = BertLSTMModel().to(device)

    optimizer = AdamW(model.parameters(), lr=2e-5)
    loss_fn = nn.CrossEntropyLoss(weight=class_weights)

    epochs = 10
    total_steps = len(train_loader) * epochs
    # Add warmup (usually 10% of total steps)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(0.1 * total_steps),
        num_training_steps=total_steps
    )

    patience = 2
    best_val_loss = float('inf')
    patience_counter = 0
    best_epoch = 0
    best_model_weights = None
    initial_train_loss = None

    print("Starting Training Loop...")
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        loop = tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}")
        for batch in loop:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device)

            optimizer.zero_grad()
            outputs = model(input_ids, attention_mask)
            loss = loss_fn(outputs, labels)
            
            loss.backward()
            optimizer.step()
            scheduler.step()
            
            total_loss += loss.item()
            loop.set_postfix(loss=loss.item())
            
        avg_train_loss = total_loss / len(train_loader)
        if initial_train_loss is None:
            initial_train_loss = avg_train_loss
        
        # Validation
        model.eval()
        total_val_loss = 0
        val_preds = []
        val_targets = []
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels = batch['label'].to(device)
                
                outputs = model(input_ids, attention_mask)
                val_loss = loss_fn(outputs, labels)
                total_val_loss += val_loss.item()
                preds = torch.argmax(outputs, dim=1)
                
                val_preds.extend(preds.cpu().numpy())
                val_targets.extend(labels.cpu().numpy())
                
        avg_val_loss = total_val_loss / len(val_loader)
        val_acc = accuracy_score(val_targets, val_preds)
        print(f"Epoch {epoch+1} - Loss: {avg_train_loss:.4f} - Val Loss: {avg_val_loss:.4f} - Val Accuracy: {val_acc:.4f}")

        import copy
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            best_epoch = epoch + 1
            best_model_weights = copy.deepcopy(model.state_dict())
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping triggered. Reverting to best weights from Epoch {best_epoch}.")
                model.load_state_dict(best_model_weights)
                break

    if best_model_weights is not None:
        model.load_state_dict(best_model_weights)
        print(f"Loaded best weights from Epoch {best_epoch} with Val Loss: {best_val_loss:.4f}")

    print("Saving model and tokenizer...")
    model_to_save = model.module if hasattr(model, 'module') else model
    torch.save(model_to_save.state_dict(), os.path.join(MODEL_DIR, "pytorch_model.bin"))
    tokenizer.save_pretrained(MODEL_DIR)

    print("\nStarting Validation / Elite Evaluation...")
    model.eval()
    val_preds = []
    val_targets = []
    with torch.no_grad():
        for batch in tqdm(val_loader, desc="Evaluating"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device)
            
            outputs = model(input_ids, attention_mask)
            preds = torch.argmax(outputs, dim=1)
            
            val_preds.extend(preds.cpu().numpy())
            val_targets.extend(labels.cpu().numpy())
            
    val_acc = accuracy_score(val_targets, val_preds)
    val_f1 = f1_score(val_targets, val_preds)
    
    print("\n" + "="*50)
    print(f"--- PHASE 8 CONVERGENCE REPORT ---")
    print(f"Stopping Point: Epoch {epoch+1}/{epochs}")
    print(f"Final Best Epoch: {best_epoch}")
    
    loss_delta = initial_train_loss - best_val_loss
    print(f"Initial Train Loss: {initial_train_loss:.4f}")
    print(f"Final Val Loss: {best_val_loss:.4f}")
    print(f"Loss Delta (Convergence Gain): {loss_delta:.4f}")
    
    # Task: Elite Accuracy (Batch 51-59 breakdown) using validation holdout
    if 'source' in val_df.columns:
        # Check for elite batches
        elite_mask = val_df['source'].str.contains('BATCH5[1-9]', na=False)
        
        if elite_mask.any():
            elite_targets = np.array(val_targets)[elite_mask]
            elite_preds = np.array(val_preds)[elite_mask]
            elite_acc = accuracy_score(elite_targets, elite_preds)
            print(f"Elite Success Rate (Batches 51-59): {elite_acc*100:.2f}%")
            
            # Confusion Matrix for Elite Hard-Legit cases (Label 0)
            legit_elite_mask = elite_mask & (val_df['label'].astype(int) == 0)
            if legit_elite_mask.any():
                h_l_targets = np.array(val_targets)[legit_elite_mask]
                h_l_preds = np.array(val_preds)[legit_elite_mask]
                tn = np.sum((h_l_targets == 0) & (h_l_preds == 0))
                fp = np.sum((h_l_targets == 0) & (h_l_preds == 1))
                print(f"Elite Hard-Legit Metrics: Correct (Safe): {tn} | Misidentified (Phish): {fp}")
        else:
            print("No BATCH51-59 samples found in validation holdout.")

    print("-" * 50)
    print(f"Validation Holdout Accuracy: {val_acc:.4f}")
    print(f"Validation Holdout F1-score: {val_f1:.4f}")
    print("\nDetailed Classification Report (Validation Holdout):")
    print(classification_report(val_targets, val_preds))
    print("="*50)

if __name__ == "__main__":
    import warnings
    warnings.filterwarnings('ignore')
    train_eval()
