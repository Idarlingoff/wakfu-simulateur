#!/bin/bash

# Script pour arrêter l'application

echo "🛑 Arrêt de Wakfu Simulator"
echo "============================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Arrêter le backend Spring Boot
echo "🔍 Recherche des processus backend..."
MVN_PIDS=$(ps aux | grep -E "\[m\]vnw spring-boot:run|\[m\]vn spring-boot:run" | awk '{print $2}')
JAVA_PIDS=$(lsof -ti :8080)

if [ ! -z "$MVN_PIDS" ]; then
    echo "🔴 Arrêt du backend Spring Boot..."
    echo $MVN_PIDS | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓${NC} Backend Maven arrêté"
fi

if [ ! -z "$JAVA_PIDS" ]; then
    echo "🔴 Arrêt des processus sur le port 8080..."
    echo $JAVA_PIDS | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓${NC} Processus arrêtés"
fi

if [ -z "$MVN_PIDS" ] && [ -z "$JAVA_PIDS" ]; then
    echo -e "${YELLOW}⚠️${NC}  Aucun processus backend trouvé"
fi

# Arrêter le frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "🔴 Arrêt du frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo -e "${GREEN}✓${NC} Frontend arrêté"
    else
        echo -e "${YELLOW}⚠️${NC}  Frontend déjà arrêté"
    fi
    rm .frontend.pid
else
    echo -e "${YELLOW}⚠️${NC}  Pas de PID frontend trouvé"
    # Essayer de trouver et arrêter tous les processus sur le port 4200
    NG_PIDS=$(lsof -ti :4200)
    if [ ! -z "$NG_PIDS" ]; then
        echo "🔍 Processus trouvé sur le port 4200, arrêt..."
        echo $NG_PIDS | xargs kill
        echo -e "${GREEN}✓${NC} Processus arrêté"
    fi
fi

echo ""
echo -e "${GREEN}✅ Application arrêtée${NC}"

