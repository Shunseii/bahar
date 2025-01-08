FROM getmeili/meilisearch:v1.12.0

COPY ./apps/search/config.toml /etc/meilisearch/config.toml

EXPOSE 7700

CMD ["meilisearch", "--config-file-path=/etc/meilisearch/config.toml"]


