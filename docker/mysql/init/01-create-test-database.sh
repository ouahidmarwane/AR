#!/bin/bash
# Exécuté une seule fois, au premier démarrage du conteneur (volume vide).
# Crée la base de test "<MYSQL_DATABASE>_test" utilisée par `pnpm test`
# et donne tous les droits dessus à l'utilisateur applicatif.
set -euo pipefail

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}_test\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}_test\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
