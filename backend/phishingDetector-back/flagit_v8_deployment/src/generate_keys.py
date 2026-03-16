# generate_keys.py
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# 1. Generate the Private Key
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# 2. Save Private Key (NEVER share this)
with open("server_private.pem", "wb") as f:
    f.write(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ))

# 3. Save Public Key (This will go into your Chrome Extension)
public_key = private_key.public_key()
with open("extension_public.pem", "wb") as f:
    f.write(public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ))

print("✅ Keys forged successfully! Check your folder for the .pem files.")