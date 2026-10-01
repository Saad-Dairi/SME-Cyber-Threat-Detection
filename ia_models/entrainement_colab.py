import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model # type: ignore
from tensorflow.keras.layers import Input, Embedding, LSTM, Bidirectional, Dense, Dropout, Layer # type: ignore
from tensorflow.keras.preprocessing.text import Tokenizer # type: ignore
from tensorflow.keras.preprocessing.sequence import pad_sequences # type: ignore
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import pickle

# --- 1. CONNEXION A GOOGLE DRIVE ---
from google.colab import drive # type: ignore
drive.mount('/content/drive')

# Remplacez ce chemin par l'emplacement exact de votre CSV dans votre Drive
CHEMIN_DATASET = '/content/drive/MyDrive/dataset_massif.csv' 
dataset = pd.read_csv(CHEMIN_DATASET)

# Nettoyage basique (supprimer les valeurs nulles si le dataset Kaggle n'est pas propre)
dataset = dataset.dropna()

# Supposons que vos colonnes s'appellent 'url' et 'type'
# A ajuster selon les vrais noms de colonnes du fichier Kaggle
X_brut = dataset['url'].values
y_brut = dataset['type'].values

# --- 2. PRETRAITEMENT DES DONNEES ---
# Encodage des labels (phishing, malware, benign, etc.) en chiffres (0, 1, 2...)
encoder = LabelEncoder()
y_encode = encoder.fit_transform(y_brut)

# Tokenization par caractere (crucial pour l'analyse d'URLs)
tokenizer = Tokenizer(char_level=True, oov_token='<UNK>')
tokenizer.fit_on_texts(X_brut)
X_sequences = tokenizer.texts_to_sequences(X_brut)

# Uniformisation de la longueur des URLs (ex: 200 caracteres maximum)
MAX_LEN = 200
X_pad = pad_sequences(X_sequences, maxlen=MAX_LEN, padding='post')

X_train, X_test, y_train, y_test = train_test_split(X_pad, y_encode, test_size=0.2, random_state=42)

# --- 3. DEFINITION DE LA COUCHE D'ATTENTION PERSONNALISEE ---
class AttentionLayer(Layer):
    def __init__(self, **kwargs):
        super(AttentionLayer, self).__init__(**kwargs)

    def build(self, input_shape):
        self.W = self.add_weight(name='attention_weight', shape=(input_shape[-1], 1), initializer='random_normal', trainable=True)
        self.b = self.add_weight(name='attention_bias', shape=(input_shape[1], 1), initializer='zeros', trainable=True)
        super(AttentionLayer, self).build(input_shape)

    def call(self, x):
        e = tf.keras.backend.tanh(tf.keras.backend.dot(x, self.W) + self.b)
        a = tf.keras.backend.softmax(e, axis=1)
        output = x * a
        return tf.keras.backend.sum(output, axis=1)

# --- 4. ARCHITECTURE DU MODELE BI-LSTM + ATTENTION ---
vocab_size = len(tokenizer.word_index) + 1
num_classes = len(np.unique(y_encode))

inputs = Input(shape=(MAX_LEN,))
# L'Embedding transforme les caracteres en vecteurs denses
x = Embedding(input_dim=vocab_size, output_dim=64)(inputs)
# Le Bi-LSTM lit l'URL de gauche a droite ET de droite a gauche
x = Bidirectional(LSTM(128, return_sequences=True))(x)
x = Dropout(0.3)(x)

# Application du mecanisme d'Attention pour se concentrer sur les fragments suspects
attention_out = AttentionLayer()(x)

x = Dense(64, activation='relu')(attention_out)
x = Dropout(0.3)(x)
# Couche de sortie avec Softmax pour une classification multi-classes
outputs = Dense(num_classes, activation='softmax')(x)

model = Model(inputs=inputs, outputs=outputs)
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.summary()

# --- 5. ENTRAINEMENT ---
# Batch_size de 256 est ideal pour saturer et exploiter la memoire du GPU
history = model.fit(X_train, y_train, epochs=10, batch_size=256, validation_data=(X_test, y_test))

# --- 6. EXPORTATION DES FICHIERS ---
# Sauvegarde du modele entraine et des encodeurs dans mon Drive
model.save('/content/drive/MyDrive/modele_bilstm_attention.h5')
with open('/content/drive/MyDrive/tokenizer_cyber.pkl', 'wb') as handle:
    pickle.dump(tokenizer, handle, protocol=pickle.HIGHEST_PROTOCOL)
with open('/content/drive/MyDrive/label_encoder.pkl', 'wb') as handle:
    pickle.dump(encoder, handle, protocol=pickle.HIGHEST_PROTOCOL)

print("Entrainement termine. Fichiers sauvegardes dans Google Drive avec succes.")