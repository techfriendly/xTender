FROM node:22-bookworm-slim

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY apps/web apps/web
RUN npm --workspace apps/web run build

EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "start"]
