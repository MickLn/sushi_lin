FROM node:25-alpine

WORKDIR /agent
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV PRINT_OUTPUT_DIR=/data/tickets
CMD ["node", "src/index.mjs"]
