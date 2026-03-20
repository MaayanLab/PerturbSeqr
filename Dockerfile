FROM node:22
WORKDIR /app
ADD package.json .
ADD package-lock.json .
RUN npm i
ADD . .
ARG NEXT_PUBLIC_MINIO_URL=https://s3.perturbseqr.maayanlab.cloud/data
ENV NEXT_PUBLIC_MINIO_URL=${NEXT_PUBLIC_MINIO_URL}
RUN npx next build && rm -f .env

CMD ["npm", "start"]