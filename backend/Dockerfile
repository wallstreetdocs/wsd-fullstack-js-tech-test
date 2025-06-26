# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start the Express app
CMD ["npm", "start"]