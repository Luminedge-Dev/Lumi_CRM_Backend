FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY . .
RUN npm run build

EXPOSE 10000

CMD ["npm", "run", "start"]
