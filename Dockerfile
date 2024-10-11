FROM node:latest

RUN mkdir -p /usr/src/bot

WORKDIR /usr/src/bot

COPY package*.json /usr/src/bot

RUN npm install

COPY /dist /usr/src/bot/dist
COPY /src/locales /usr/src/bot/src/locales

CMD [ "npm", "start" ]