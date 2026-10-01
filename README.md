# SME Cyber Threat Early Warning System 🛡️

## Overview
This project is a hybrid cyber threat early warning system designed to proactively protect Small and Medium-sized Enterprises (SMEs). It combines Threat Intelligence feeds with a custom Deep Learning model to classify and detect malicious URLs in real-time. 

This project was developed during a professional internship at the **Centre Marocain de Recherche Polytechnique et d'Innovation (CMRPI) / Espace Maroc Cyberconfiance**.

## Key Features
* **Advanced Threat Detection:** Utilizes a custom Bi-LSTM neural network with an attention mechanism.
* **High Performance:** Achieves **98.15% classification accuracy** and a **0.09ms inference time** on a dataset of over 130,000 malicious and benign URLs.
* **Interactive Dashboard:** Real-time threat monitoring interface built with React.
* **Automated Alert System:** Node.js backend that logs threats and delivers contextual incident response procedures.

## Tech Stack
* **Frontend:** React.js, HTML/CSS
* **Backend:** Node.js, Express.js
* **AI / Machine Learning:** Python, Flask, TensorFlow / Keras

## Project Structure
* `/frontend`: Contains the React dashboard application.
* `/backend`: Contains the Node.js API and alert management system.
* `/ia_models`: Contains the Python Flask API, Jupyter notebooks, and the trained Bi-LSTM model weights.

## How to Run Locally

### 1. AI API (Flask)
```bash
cd ia_models
pip install -r requirements.txt
python api_ia.py
```
### 2. Backend (Node.js)
```bash
cd backend
npm install
npm start
```
### 3. Frontend (React)
```bash
cd frontend
npm install
npm start
```
