FROM node:22

COPY . /app
WORKDIR /app

RUN npm ci
ENV NODE_ENV=production
RUN npm run build

EXPOSE 5000
CMD ["node", "dist/index.js"]
