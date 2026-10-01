import os
import pickle
import numpy as np
import warnings
from flask import Flask, request, jsonify

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings("ignore")

import tensorflow as tf
from keras.utils import pad_sequences
from keras.models import Model
from keras.layers import Layer, Input, Embedding, Bidirectional, LSTM, Dropout, Dense

# 1. Definition de la couche d'Attention
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

app = Flask(__name__)

# 2. CHARGEMENT GLOBAL EN MEMOIRE
print("Initialisation du moteur IA...")
base_dir = os.path.dirname(os.path.abspath(__file__))
chemin_poids = os.path.join(base_dir, "poids_bilstm.weights.h5")
chemin_tokenizer = os.path.join(base_dir, "tokenizer_cyber.pkl")
chemin_encoder = os.path.join(base_dir, "label_encoder.pkl")

with open(chemin_tokenizer, 'rb') as handle:
    tokenizer = pickle.load(handle)
with open(chemin_encoder, 'rb') as handle:
    encoder = pickle.load(handle)

# --- RECONSTRUCTION DE L'ARCHITECTURE ---
vocab_size = len(tokenizer.word_index) + 1
num_classes = len(np.unique(encoder.classes_))
MAX_LEN = 200

inputs = Input(shape=(MAX_LEN,))
x = Embedding(input_dim=vocab_size, output_dim=64)(inputs)
x = Bidirectional(LSTM(128, return_sequences=True))(x)
x = Dropout(0.3)(x)
attention_out = AttentionLayer()(x)
x = Dense(64, activation='relu')(attention_out)
x = Dropout(0.3)(x)
outputs = Dense(num_classes, activation='softmax')(x)

modele = Model(inputs=inputs, outputs=outputs)

# --- INJECTION DES POIDS PURS ---
modele.load_weights(chemin_poids)
print("Moteur IA charge avec succes depuis les poids purs !")

# 3. Route API pour les predictions
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(silent=True) or {}
        url = (data.get('url') or '').strip()

        if not url:
            return jsonify({"error": "Aucune URL fournie."}), 400

        # Evite de tokeniser des entrées démesurées (le modèle tronque de toute façon à MAX_LEN)
        url = url[:2000]

        sequence = tokenizer.texts_to_sequences([url])
        url_pad = pad_sequences(sequence, maxlen=MAX_LEN, padding='post')
        
        prediction_prob = modele.predict(url_pad, verbose=0)
        classe_predite = np.argmax(prediction_prob, axis=1)[0]
        
        nom_classe = encoder.inverse_transform([classe_predite])[0].lower()
        est_dangereux = nom_classe not in ['benign', 'sain', 'normal', 'legitimate']
        
        return jsonify({
            "danger": est_dangereux,
            "type_menace": nom_classe if est_dangereux else "sain"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    
    app.run(port=5000, threaded=False, debug=False)