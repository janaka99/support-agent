FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# We will mount the source code for hot reloading
CMD ["npm", "run", "dev"]
