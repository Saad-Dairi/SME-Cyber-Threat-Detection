import requests
import csv

def collect_recent_threats():
    url = "https://urlhaus-api.abuse.ch/v1/urls/recent/"
    
    headers = {
        'Auth-Key': '0000',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        print("Connexion à l'API de Threat Intelligence en cours...")
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            menaces_list = data.get('urls', [])
            print(f"Succès ! {len(menaces_list)} menaces récentes récupérées.\n")
            
            # --- NOUVEAU CODE : Sauvegarde en CSV ---
            # On ouvre le fichier menaces.csv en mode écriture ("w")
            with open("menaces.csv", mode="w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                # Création de la ligne d'en-tête des colonnes
                writer.writerow(["URL", "Statut", "Date_Ajout", "Type_Menace"])
                
                # Écriture des données ligne par ligne
                for threat in menaces_list:
                    writer.writerow([
                        threat.get('url'), 
                        threat.get('url_status'), 
                        threat.get('date_added'),
                        threat.get('threat')
                    ])
                    
            print("Les données ont été sauvegardées avec succès dans 'menaces.csv'.\n")
            # ----------------------------------------
            
        else:
            print(f"Erreur de connexion à l'API. Code HTTP : {response.status_code}")
            
    except Exception as e:
        print(f"Une erreur s'est produite : {e}")

if __name__ == "__main__":
    collect_recent_threats()