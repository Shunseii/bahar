FROM getmeili/meilisearch:v1.3.4

COPY ./config.toml /etc/meilisearch/config.toml

EXPOSE 7700

CMD ["meilisearch", "--config-file-path=/etc/meilisearch/config.toml"]


