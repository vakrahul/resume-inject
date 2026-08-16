FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3010
CMD ["node", "server/dist/index.js"]
