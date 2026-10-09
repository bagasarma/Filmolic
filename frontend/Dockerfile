FROM nginx:alpine

# Bersihkan file default bawaan Nginx
RUN rm -rf /usr/share/nginx/html/*

# Salin konfigurasi kustom Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Salin seluruh file frontend (pages, css, dsb) ke web root Nginx
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]