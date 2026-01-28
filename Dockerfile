FROM node:22
WORKDIR /app
ADD package.json .
ADD package-lock.json .
RUN npm i
ADD . .
RUN npx next build && rm -f .env
CMD ["npm", "start"]