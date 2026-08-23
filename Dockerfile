FROM python:3.12-slim

WORKDIR /app

# Installation des dépendances : certifi (SSL Resend) et psycopg2-binary (PostgreSQL)
RUN pip install --no-cache-dir certifi psycopg2-binary

# Copie des fichiers du projet dans le conteneur
COPY . /app

# Port d'écoute du serveur Sushi Lin
EXPOSE 3000

# Mode non bufférisé pour voir les logs d'e-mails, de commandes et de base de données en temps réel
ENV PYTHONUNBUFFERED=1

CMD ["python3", "dev_server.py"]
