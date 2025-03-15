FROM node:22-bookworm-slim AS base
WORKDIR /usr/local/app
COPY package.json .

# Installing kubectl and gcloud with gke-gcloud-auth-plugin for accessing GKE
RUN apt-get update && apt-get install -y curl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
RUN chmod +x kubectl
RUN ln -s /usr/local/app/kubectl /usr/local/bin/kubectl
RUN apt-get install -y apt-transport-https ca-certificates gnupg curl
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN apt-get update && apt-get install -y google-cloud-cli
RUN apt-get install -y google-cloud-cli-gke-gcloud-auth-plugin

# Build the typescript code
FROM base AS dependencies
RUN npm install
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Create the final production-ready image
FROM base AS release
RUN useradd -m appuser && chown -R appuser /usr/local/app
ENV NODE_ENV=production
RUN npm install --only=production
COPY --from=dependencies /usr/local/app/dist ./dist
USER appuser
CMD ["node", "dist/index.js"]
