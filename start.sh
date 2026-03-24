#!/bin/bash

# Script pour démarrer l'application complète

echo "🚀 Démarrage de Wakfu Simulator"
echo "================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "Installez Node.js depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js et npm sont installés"
echo ""

# Fonction pour vérifier si un port est utilisé
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Vérifier le port 8080
echo "🔍 Vérification du port 8080..."
if check_port 8080; then
    echo -e "${YELLOW}⚠️  Le port 8080 est déjà utilisé${NC}"
    echo "Un serveur backend semble déjà tourner"
else
    echo -e "${GREEN}✓${NC} Port 8080 disponible"
    echo ""
    echo "Démarrage du serveur backend Spring Boot..."

    # Démarrer le backend Spring Boot en arrière-plan
    cd backend
    chmod +x mvnw
    ./mvnw spring-boot:run > ../backend-spring.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    echo -e "${GREEN}✓${NC} Serveur backend démarré (PID: $BACKEND_PID)"

    # Attendre que le serveur soit prêt (max 60 secondes)
    echo "⏳ Attente du démarrage du backend..."
    for i in {1..60}; do
        if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Serveur backend opérationnel"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "🔍 Vérification du port 4200..."
if check_port 4200; then
    echo -e "${YELLOW}⚠️  Le port 4200 est déjà utilisé${NC}"
    echo "Le frontend semble déjà tourner"
else
    echo -e "${GREEN}✓${NC} Port 4200 disponible"
    echo ""
    echo "🎨 Démarrage du frontend Angular..."
    echo "   (Cela peut prendre quelques secondes...)"

    cd frontend

    # Vérifier que les dépendances sont installées
    if [ ! -d "node_modules" ]; then
        echo "📥 Installation des dépendances du frontend..."
        npm install
    fi

    # Démarrer le frontend
    npm start > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..

    echo -e "${GREEN}✓${NC} Frontend en cours de démarrage (PID: $FRONTEND_PID)"
    echo ""
    echo "⏳ Attente du démarrage complet..."

    # Attendre que le frontend soit prêt (max 60 secondes)
    for i in {1..60}; do
        if check_port 4200; then
            echo -e "${GREEN}✓${NC} Frontend opérationnel"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

echo ""
echo "════════════════════════════════════════════════"
echo -e "${GREEN}✅ Application démarrée avec succès !${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo "📋 Informations :"
echo "   • Frontend :  http://localhost:4200"
echo "   • API Mock :  http://localhost:8080"
echo "   • Health :    http://localhost:8080/api/health"
echo ""
echo "📝 Logs :"
echo "   • Backend :   backend-mock.log"
echo "   • Frontend :  frontend.log"
echo ""
echo "🛑 Pour arrêter l'application :"
echo "   ./stop.sh"
echo ""
echo "═══════════════════════════════════════════════"
echo -e "${YELLOW} Ouvrez http://localhost:4200 dans votre navigateur !${NC}"
echo "═══════════════════════════════════════════════"

# Sauvegarder les PIDs pour pouvoir les arrêter plus tard
if [ ! -z "$BACKEND_PID" ]; then
    echo $BACKEND_PID > .backend.pid
fi
if [ ! -z "$FRONTEND_PID" ]; then
    echo $FRONTEND_PID > .frontend.pid
fi

