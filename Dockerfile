FROM node:latest
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm install -g typescript ts-node
COPY . .
ENV NODE_ENV dev
CMD ["npx", "ts-node", "server.ts"]