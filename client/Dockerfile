# thanks to Lukas Marx, https://malcoded.com/posts/angular-docker/

# build angular app
FROM node:current-alpine3.13 as node
WORKDIR /usr/src/app
# copy both, the package.json and the package.lock.json, into the image
COPY client/package.json ./
COPY client/package-lock.json ./
COPY shared ../shared
# then run npm install to install all dependencies of the project
RUN npm i
# we copy the rest of the project into the image
COPY client .
# run the serve script of the angular project
RUN npm run build


# serve built angular app
FROM nginx:1.21.0-alpine
# remove the nginx's defaultly served files
RUN rm -f /usr/share/nginx/html/*
# copy ng build's output to html folder to be served
COPY --from=node /usr/src/app/dist/frontend /usr/share/nginx/html
# copy nginx config file
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
