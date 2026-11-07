FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# This image runs only the optional relay, not the Cloudflare control plane.
COPY --chown=node:node relay/railway.cjs /app/omni-fork-relay.cjs
USER node
EXPOSE 8080
CMD ["node", "/app/omni-fork-relay.cjs"]
