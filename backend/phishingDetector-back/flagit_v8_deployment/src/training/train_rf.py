import os
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

ROOT = r"c:\Users\Yasheer Sumun\OneDrive\New folder\MLtest1"
TRAIN_FILE = os.path.join(ROOT, "data", "processed", "X_train_url.csv")
TEST_FILE = os.path.join(ROOT, "data", "processed", "X_test_url.csv")
MODEL_FILE = os.path.join(ROOT, "models", "rf_v1.pkl")

def main():
    print("Loading datasets...")
    train_df = pd.read_csv(TRAIN_FILE)
    test_df = pd.read_csv(TEST_FILE)

    X_train = train_df.drop('label', axis=1)
    y_train = train_df['label']
    X_test = test_df.drop('label', axis=1)
    y_test = test_df['label']

    print("Training RandomForestClassifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train, y_train)

    joblib.dump(clf, MODEL_FILE)
    print(f"Model saved to {MODEL_FILE}")

    print("\n" + "="*40)
    print("--- Random Forest Classification Report ---")
    y_pred = clf.predict(X_test)
    print(classification_report(y_test, y_pred))

    print("--- Random Forest Confusion Matrix ---")
    cm = confusion_matrix(y_test, y_pred)
    print(f"[[TN, FP]\n [FN, TP]]")
    print(cm)
    print(f"-> False Negatives (Phishing labeled Safe): {cm[1, 0]}")
    print("="*40 + "\n")

if __name__ == "__main__":
    main()
