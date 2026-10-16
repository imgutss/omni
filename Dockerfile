FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Copy only the relay; never bake the panel, backups or credentials into this image.
COPY --chown=node:node managed-arvan/railway-fork-relay.cjs /app/omni-fork-relay.cjs
USER node
EXPOSE 8080
CMD ["node", "/app/omni-fork-relay.cjs"]
