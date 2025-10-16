# Отрежи непознат хост / метод
server_tokens off;
client_max_body_size 10m;

if ($bad_host)   { return 444; }
if ($bad_method) { return 444; }

# Общ rate-limit
limit_req zone=global burst=100 nodelay;

# Блокирай чувствителни/нежелани файлове
location ~ /\.(?!well-known)                     { return 444; }  # .git, .env, ...
location ~* \.(php|pl|cgi|asp|aspx)$             { return 444; }
location ~* \.(ini|log|conf|bak|swp|ya?ml)$      { return 444; }
location ~* \.(git|hg|svn)(/|$)                  { return 444; }
